<script setup lang="ts">
import { ChevronRight, Compass, Lock, Search } from '@lucide/vue'
import type { JoinParticipant } from '~/types/database'

const { state, game, participants, claim, load, setNotice } = usePlayerSession()

const query = ref('')
const normalize = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()

const filtered = computed(() => {
  const q = normalize(query.value)
  return q ? participants.value.filter(p => normalize(p.name).includes(q)) : participants.value
})

const logoUrl = computed(() => game.value?.theme?.logoUrl ?? null)
const headerImageUrl = computed(() => game.value?.theme?.headerImageUrl ?? null)

/* ---- Confirmation du choix ---- */
const selected = ref<JoinParticipant | null>(null)
const claiming = ref(false)
const claimError = ref<string | null>(null)

function pick(p: JoinParticipant) {
  if (p.taken) return
  claimError.value = null
  setNotice(null)
  selected.value = p
}

async function confirm() {
  if (!selected.value) return
  claiming.value = true
  claimError.value = null
  try {
    await claim(selected.value.id)
    // La page parente redirige vers les missions dès que « me » est connu.
  }
  catch (e) {
    claimError.value = (e as Error).message
  }
  finally {
    claiming.value = false
  }
}

/* La liste des noms pris évolue pendant que les autres rejoignent : rafraîchissement léger. */
let timer: ReturnType<typeof setInterval> | undefined
onMounted(() => {
  timer = setInterval(() => {
    if (state.value.code && !selected.value) load(state.value.code, { silent: true })
  }, 15000)
})
onBeforeUnmount(() => clearInterval(timer))

const initial = (name: string) => name.trim().charAt(0).toUpperCase()
</script>

<template>
  <main v-if="game" class="join">
    <header class="join__top">
      <div class="join__logo" :class="{ 'join__logo--image': logoUrl }">
        <img v-if="logoUrl" :src="logoUrl" alt="">
        <Compass v-else :size="26" aria-hidden="true" />
      </div>
      <span class="join__code">Code {{ game.code }}</span>
    </header>

    <img v-if="headerImageUrl" class="join__header-image" :src="headerImageUrl" alt="">

    <h1 class="join__title">{{ game.name }}</h1>
    <p class="join__lead">Choisis ton nom pour rejoindre ton équipe.</p>

    <p v-if="state.notice" class="join__notice" role="status">{{ state.notice }}</p>

    <label class="join__search-label" for="search">Rechercher mon nom</label>
    <div class="join__search">
      <Search :size="20" aria-hidden="true" />
      <input id="search" v-model="query" type="search" autocomplete="off" placeholder="Ex. : Léa">
    </div>

    <ul class="join__list">
      <li v-for="p in filtered" :key="p.id">
        <button
          type="button"
          class="person"
          :class="{ 'person--taken': p.taken }"
          :disabled="p.taken"
          :aria-label="p.taken ? `${p.name}, déjà pris` : `Je suis ${p.name}, équipe ${p.team_name}`"
          @click="pick(p)"
        >
          <span class="person__avatar" :style="p.taken ? undefined : { background: p.team_color }">{{ initial(p.name) }}</span>
          <span class="person__text">
            <span class="person__name">{{ p.name }}</span>
            <span class="person__team">{{ p.team_name }}</span>
          </span>
          <span v-if="p.taken" class="person__taken"><Lock :size="16" aria-hidden="true" /> Déjà pris</span>
          <ChevronRight v-else :size="22" aria-hidden="true" />
        </button>
      </li>
    </ul>

    <p v-if="!participants.length" class="join__empty">Aucun participant n’a encore été inscrit dans cette partie.</p>
    <p v-else-if="!filtered.length" class="join__empty">Aucun nom ne correspond à « {{ query }} ».</p>

    <p class="join__footer">Ton nom est déjà pris ? Demande à l’organisateur de le réinitialiser.</p>

    <!-- Confirmation -->
    <Transition name="sheet">
      <div v-if="selected" class="sheet-backdrop" @click.self="selected = null">
        <div class="sheet" role="dialog" aria-modal="true" aria-labelledby="sheet-title">
          <span class="person__avatar person__avatar--lg" :style="{ background: selected.team_color }">{{ initial(selected.name) }}</span>
          <h2 id="sheet-title" class="sheet__title">Tu es bien {{ selected.name }} ?</h2>
          <p class="sheet__text">
            Équipe <strong>{{ selected.team_name }}</strong>. Ce nom sera réservé à ce téléphone pour toute la partie.
          </p>
          <p v-if="claimError" class="form-error" role="alert">{{ claimError }}</p>
          <AppButton size="lg" block :loading="claiming" @click="confirm">
            {{ claiming ? 'Connexion…' : 'Oui, c’est moi' }}
          </AppButton>
          <AppButton variant="outline" size="lg" block :disabled="claiming" @click="selected = null">Annuler</AppButton>
        </div>
      </div>
    </Transition>
  </main>
</template>

<style scoped>
.join {
  display: flex;
  flex-direction: column;
  max-width: 560px;
  margin: 0 auto;
  padding: var(--space-5) var(--space-5) var(--space-8);
}

.join__top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
}

.join__logo {
  display: grid;
  place-items: center;
  width: 48px;
  height: 48px;
  overflow: hidden;
  border-radius: var(--radius-pill);
  background: var(--color-primary);
  color: var(--color-on-primary);
}

.join__logo--image {
  width: auto;
  max-width: 160px;
  border-radius: 0;
  background: none;
}

.join__logo img {
  height: 100%;
  object-fit: contain;
}

.join__code {
  padding: var(--space-2) var(--space-4);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-pill);
  background: var(--color-surface);
  font-weight: 700;
}

.join__header-image {
  width: 100%;
  aspect-ratio: 3 / 1;
  margin-top: var(--space-5);
  border-radius: var(--card-radius);
  object-fit: cover;
}

.join__title {
  margin-top: var(--space-6);
  font-size: clamp(2rem, 9vw, 2.75rem);
  font-weight: 800;
}

.join__lead {
  margin-top: var(--space-2);
  color: var(--color-text-muted);
  font-size: 1.125rem;
}

.join__notice {
  margin-top: var(--space-4);
  padding: var(--space-3) var(--space-4);
  border-radius: var(--radius-md);
  background: var(--status-pending-bg);
  color: var(--status-pending-fg);
  font-weight: 600;
}

.join__search-label {
  margin-top: var(--space-6);
  font-weight: 600;
}

.join__search {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  margin-top: var(--space-2);
  padding: 0 var(--space-4);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  background: var(--color-surface);
  color: var(--color-text-muted);
}

.join__search input {
  flex: 1;
  min-width: 0;
  min-height: 56px;
  border: none;
  outline: none;
  background: none;
  color: var(--color-text);
  font-size: 1.0625rem;
}

.join__search:focus-within {
  outline: 2px solid var(--color-secondary);
  outline-offset: 1px;
}

.join__list {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  margin: var(--space-5) 0 0;
  padding: 0;
  list-style: none;
}

.person {
  display: flex;
  align-items: center;
  gap: var(--space-4);
  width: 100%;
  padding: var(--space-3) var(--space-4);
  border: 1px solid var(--color-border);
  border-radius: var(--card-radius);
  background: var(--color-surface);
  color: var(--color-text);
  text-align: left;
}

.person:not(:disabled):active {
  transform: scale(0.99);
}

.person--taken {
  border-style: dashed;
  background: var(--color-muted-surface);
  color: var(--color-text-muted);
  cursor: not-allowed;
}

.person__avatar {
  display: grid;
  flex: none;
  place-items: center;
  width: 44px;
  height: 44px;
  border-radius: 50%;
  background: var(--color-border);
  color: var(--color-on-secondary);
  font-size: 1.125rem;
  font-weight: 700;
}

.person--taken .person__avatar {
  color: var(--color-text-muted);
}

.person__avatar--lg {
  width: 64px;
  height: 64px;
  font-size: 1.5rem;
}

.person__text {
  display: flex;
  flex: 1;
  flex-direction: column;
  min-width: 0;
}

.person__name {
  font-size: 1.125rem;
  font-weight: 600;
}

.person--taken .person__name {
  text-decoration: line-through;
}

.person__team {
  color: var(--color-text-muted);
  font-size: 0.9375rem;
}

.person__taken {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
  font-size: 0.9375rem;
  font-weight: 600;
  white-space: nowrap;
}

.join__empty {
  margin-top: var(--space-5);
  color: var(--color-text-muted);
  text-align: center;
}

.join__footer {
  margin-top: var(--space-6);
  color: var(--color-text-muted);
  text-align: center;
}

/* ---- Feuille de confirmation ---- */
.sheet-backdrop {
  position: fixed;
  inset: 0;
  z-index: 50;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  background: color-mix(in srgb, var(--color-text) 45%, transparent);
}

.sheet {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-3);
  width: 100%;
  max-width: 560px;
  padding: var(--space-6) var(--space-5) calc(var(--space-6) + env(safe-area-inset-bottom, 0px));
  border-radius: var(--card-radius) var(--card-radius) 0 0;
  background: var(--color-bg);
  text-align: center;
}

.sheet__title {
  font-size: 1.625rem;
  font-weight: 800;
}

.sheet__text {
  margin-bottom: var(--space-2);
  color: var(--color-text-muted);
}

.sheet-enter-active,
.sheet-leave-active {
  transition: opacity 0.2s;
}

.sheet-enter-active .sheet,
.sheet-leave-active .sheet {
  transition: transform 0.2s;
}

.sheet-enter-from,
.sheet-leave-to {
  opacity: 0;
}

.sheet-enter-from .sheet,
.sheet-leave-to .sheet {
  transform: translateY(100%);
}
</style>
