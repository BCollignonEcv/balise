<script setup lang="ts">
import type { RealtimeChannel } from '@supabase/supabase-js'

/**
 * Racine des pages participant d'une partie (/j/CODE/…).
 * Charge la partie, applique son thème, redirige selon que cet appareil a
 * déjà choisi un nom, et réagit en direct à une réinitialisation par l'admin.
 */
definePageMeta({ layout: 'game' })

const route = useRoute()
const supabase = usePlayerSupabase()
const { state, game, me, load, setNotice } = usePlayerSession()
const gameData = usePlayerGameData()
const leaderboard = useLeaderboard()

const code = computed(() => String(route.params.code ?? '').toUpperCase())
const isJoinPage = computed(() => route.name === 'j-code')
const ready = ref(false)

useHead(() => ({ title: game.value ? `${game.value.name} · Jeu de piste` : 'Jeu de piste' }))

/** Envoie l'appareil au bon écran selon qu'il a déjà choisi un nom. */
function guard() {
  if (!game.value) return
  if (!me.value && !isJoinPage.value) navigateTo(`/j/${code.value}`, { replace: true })
  else if (me.value && isJoinPage.value) navigateTo(`/j/${code.value}/missions`, { replace: true })
}

/* ---- Réinitialisation en direct ---- */
let channel: RealtimeChannel | null = null

function subscribe(gameId: string) {
  if (channel) supabase.removeChannel(channel)
  channel = supabase
    .channel(`game:${gameId}`)
    .on('broadcast', { event: 'participant_released' }, async ({ payload }) => {
      if (me.value && payload?.participant_id === me.value.id) {
        setNotice('L’organisateur a réinitialisé ton nom. Choisis-le à nouveau pour continuer.')
      }
      await load(code.value, { silent: true })
    })
    // Une validation ou un ajustement a changé les scores : on recharge le classement.
    .on('broadcast', { event: 'scores_changed' }, () => {
      if (me.value) leaderboard.refresh()
    })
    // Date limite prolongée, partie terminée… (reçu uniquement une fois membre de la partie)
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'games', filter: `id=eq.${gameId}` }, () => {
      load(code.value, { silent: true })
    })
    .subscribe()
}

/** Au retour sur l'onglet : vérifie que la session est toujours valide (notification manquée, veille…). */
function onVisible() {
  if (document.visibilityState !== 'visible') return
  load(code.value, { silent: true })
  gameData.refresh()
  leaderboard.refresh()
}

/* Missions, soumissions de l'équipe et classement : chargés dès que le participant est identifié. */
watch([() => game.value?.id, () => me.value?.team_id], ([gameId, teamId]) => {
  if (gameId && teamId) {
    gameData.start(gameId, teamId)
    leaderboard.load(gameId)
  }
  else gameData.stop()
}, { immediate: true })

onMounted(async () => {
  await load(code.value)
  ready.value = true
  guard()
  if (game.value) subscribe(game.value.id)
  document.addEventListener('visibilitychange', onVisible)
})

onBeforeUnmount(() => {
  document.removeEventListener('visibilitychange', onVisible)
  if (channel) supabase.removeChannel(channel)
  gameData.stop()
})

watch([me, () => route.name], guard)
watch(() => game.value?.id, (id, previous) => {
  if (id && previous && id !== previous) subscribe(id)
})
</script>

<template>
  <div v-if="!ready || state.loading" class="screen">
    <p class="muted">Chargement…</p>
  </div>

  <div v-else-if="state.error" class="screen">
    <h1 class="screen__title">Connexion impossible</h1>
    <p class="muted">{{ state.error }}</p>
    <AppButton variant="outline" @click="load(code)">Réessayer</AppButton>
  </div>

  <div v-else-if="state.info?.error" class="screen">
    <template v-if="state.info.error === 'not_open'">
      <h1 class="screen__title">{{ state.info.name }}</h1>
      <p class="muted">Cette partie n’est pas encore ouverte. Reviens un peu plus tard !</p>
      <AppButton variant="outline" @click="load(code)">Actualiser</AppButton>
    </template>
    <template v-else>
      <h1 class="screen__title">Partie introuvable</h1>
      <p class="muted">Aucune partie ne correspond au code <strong>{{ code }}</strong>. Vérifie-le auprès de l’organisateur.</p>
      <AppButton to="/" variant="outline">Saisir un autre code</AppButton>
    </template>
  </div>

  <NuxtPage v-else />
</template>

<style scoped>
.screen {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: var(--space-4);
  max-width: 480px;
  margin: 0 auto;
  padding: 15vh var(--space-5) var(--space-8);
}

.screen__title {
  font-size: 2rem;
  font-weight: 800;
}

.muted {
  color: var(--color-text-muted);
  font-size: 1.0625rem;
}
</style>
