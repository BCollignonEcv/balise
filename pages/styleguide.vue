<script setup lang="ts">
import type { AnswerType, MissionStatus } from '~/types/game'

definePageMeta({ layout: 'game' })
useHead({ title: 'Styleguide · Balise' })

/* ---- Vérification de la connexion Supabase ---- */
type Check = { state: 'loading' | 'ok' | 'error'; message: string }
const supabaseCheck = ref<Check>({ state: 'loading', message: 'Vérification…' })

onMounted(async () => {
  const { supabaseUrl, supabaseKey } = useRuntimeConfig().public
  try {
    const res = await fetch(`${supabaseUrl}/auth/v1/settings`, { headers: { apikey: supabaseKey } })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const settings = await res.json()
    supabaseCheck.value = settings.external?.anonymous_users
      ? { state: 'ok', message: 'Connecté · connexion anonyme activée' }
      : { state: 'error', message: 'Connecté, mais la connexion anonyme est désactivée' }
  }
  catch (e) {
    supabaseCheck.value = { state: 'error', message: `Connexion impossible (${(e as Error).message})` }
  }
})

/* ---- Démonstration de la surcharge de thème ---- */
const theme = useState<GameTheme | null>('game-theme', () => null)
onBeforeUnmount(() => { theme.value = null })

const demoThemes: Record<string, GameTheme | null> = {
  'Par défaut': null,
  'Nuit en forêt': {
    tokens: {
      'color-bg': '#1B2621',
      'color-surface': '#24322B',
      'color-text': '#EEF2E6',
      'color-text-muted': '#A9B5A6',
      'color-border': '#3A4B41',
      'color-primary': '#E9B949',
      'color-on-primary': '#1B2621',
      'color-secondary': '#7CC4A4',
      'card-bg': '#24322B',
      'card-border-color': '#3A4B41',
      'card-radius': '4px',
      'badge-points-bg': '#E9B949',
      'badge-points-fg': '#1B2621',
      'status-validated-fg': '#7CC4A4',
      'font-heading': 'Bebas Neue',
      'font-body': 'Nunito',
    },
  },
  'Pop': {
    tokens: {
      'color-primary': '#7C3AED',
      'color-secondary': '#DB2777',
      'badge-points-bg': '#DB2777',
      'card-radius': '28px',
      'card-border-width': '3px',
      'card-border-color': '#1F2A24',
      'card-shadow': '4px 4px 0 #1F2A24',
      'font-heading': 'Baloo 2',
    },
  },
}
const activeTheme = ref('Par défaut')
watch(activeTheme, name => { theme.value = demoThemes[name] ?? null })

/* ---- Données d'exemple (maquette « grille des cartes mission ») ---- */
interface DemoMission {
  title: string
  basePoints: number
  answerTypes: AnswerType[]
  status: MissionStatus
  hasBonus?: boolean
  validatedCount?: number
  maxValidations?: number
  lastRefused?: boolean
}

const missions: DemoMission[] = [
  { title: 'Photo de groupe au sommet', basePoints: 50, answerTypes: ['photo'], status: 'validated' },
  { title: 'Chante l’hymne de l’équipe', basePoints: 80, answerTypes: ['video'], status: 'pending', hasBonus: true },
  { title: 'L’énigme du phare', basePoints: 40, answerTypes: ['text'], status: 'todo' },
  { title: 'Rejoins la balise nord', basePoints: 60, answerTypes: ['gps'], status: 'validated' },
  { title: 'Récolte de coquillages', basePoints: 10, answerTypes: ['photo'], status: 'validated', validatedCount: 3, maxValidations: 10 },
  { title: 'Pyramide humaine', basePoints: 70, answerTypes: ['photo'], status: 'todo', hasBonus: true, lastRefused: true },
  { title: 'Interview d’un inconnu', basePoints: 50, answerTypes: ['photo', 'video'], status: 'todo', hasBonus: true },
  { title: 'Le point culminant', basePoints: 40, answerTypes: ['gps'], status: 'refused' },
]

const colorTokens = [
  'color-bg', 'color-surface', 'color-text', 'color-text-muted',
  'color-border', 'color-primary', 'color-secondary',
] as const

const statuses: MissionStatus[] = ['todo', 'pending', 'validated', 'refused']
</script>

<template>
  <main class="sg">
    <header class="sg__header">
      <h1>Design system</h1>
      <p class="sg__muted">Étape 1 · tokens et composants de base</p>
    </header>

    <section class="sg__panel">
      <h2>Supabase</h2>
      <p class="sg__check" :class="`sg__check--${supabaseCheck.state}`">{{ supabaseCheck.message }}</p>
    </section>

    <section class="sg__panel">
      <h2>Thème</h2>
      <p class="sg__muted">Exemples de surcharges partielles : tout token non surchargé garde sa valeur par défaut.</p>
      <div class="sg__row">
        <AppButton
          v-for="(_, name) in demoThemes"
          :key="name"
          :variant="activeTheme === name ? 'dark' : 'outline'"
          @click="activeTheme = name"
        >
          {{ name }}
        </AppButton>
      </div>
    </section>

    <section class="sg__panel">
      <h2>Couleurs</h2>
      <div class="sg__swatches">
        <div v-for="t in colorTokens" :key="t" class="sg__swatch">
          <span class="sg__chip" :style="{ background: `var(--${t})` }" />
          <code>--{{ t }}</code>
        </div>
      </div>
    </section>

    <section class="sg__panel">
      <h2>Typographies</h2>
      <p class="sg__display">La Grande Traque</p>
      <p>Choisis ton nom pour rejoindre ton équipe. Texte courant en police de texte.</p>
    </section>

    <section class="sg__panel">
      <h2>Boutons</h2>
      <div class="sg__stack">
        <AppButton size="lg" block>Envoyer la réponse</AppButton>
        <div class="sg__row">
          <AppButton variant="secondary">Valider · 80 pts</AppButton>
          <AppButton variant="danger">Refuser</AppButton>
          <AppButton variant="outline">Choisir</AppButton>
          <AppButton variant="dark">Toutes</AppButton>
          <AppButton disabled>Désactivé</AppButton>
        </div>
      </div>
    </section>

    <section class="sg__panel">
      <h2>Badges</h2>
      <div class="sg__row">
        <StatusBadge v-for="s in statuses" :key="s" :status="s" />
        <StatusBadge status="validated" label="Validée 3 fois" />
      </div>
      <div class="sg__row">
        <PointsBadge :points="70" />
        <BonusBadge />
        <AnswerTypeIcon :types="['photo']" />
        <AnswerTypeIcon :types="['video']" />
        <AnswerTypeIcon :types="['text']" />
        <AnswerTypeIcon :types="['gps']" />
        <AnswerTypeIcon :types="['text', 'photo']" with-label />
      </div>
    </section>

    <section>
      <h2 class="sg__section-title">Cartes mission</h2>
      <div class="sg__grid">
        <MissionCard v-for="m in missions" :key="m.title" v-bind="m" />
      </div>
    </section>
  </main>
</template>

<style scoped>
.sg {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  max-width: 720px;
  margin: 0 auto;
  padding: var(--space-6) var(--space-4) var(--space-8);
}

.sg__header h1 {
  font-size: 2rem;
}

.sg__muted {
  color: var(--color-text-muted);
}

.sg__panel {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  padding: var(--space-4);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  background: var(--color-surface);
}

.sg__panel h2,
.sg__section-title {
  font-size: 1.25rem;
}

.sg__section-title {
  margin-bottom: var(--space-3);
}

.sg__check {
  font-weight: 600;
}

.sg__check--ok {
  color: var(--status-validated-fg);
}

.sg__check--error {
  color: var(--status-refused-fg);
}

.sg__row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-2);
}

.sg__stack {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.sg__swatches {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
  gap: var(--space-3);
}

.sg__swatch {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  font-size: 0.75rem;
}

.sg__chip {
  flex: none;
  width: 32px;
  height: 32px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
}

.sg__display {
  font-family: var(--font-heading);
  font-size: 2.25rem;
  font-weight: 800;
  line-height: 1.1;
}

.sg__grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--space-3);
}

@media (min-width: 640px) {
  .sg__grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}
</style>
