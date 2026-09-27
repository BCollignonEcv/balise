<script setup lang="ts">
import { Check, RotateCcw } from '@lucide/vue'
import type { Game } from '~/types/database'
import type { MissionStatus } from '~/types/game'

definePageMeta({ layout: 'admin' })

const route = useRoute()
const supabase = useAdminSupabase()
const gameId = route.params.id as string

const game = ref<Game | null>(null)
const loading = ref(true)
const loadError = ref<string | null>(null)

useHead(() => ({ title: `Thème · ${game.value?.name ?? 'Partie'} · Admin Balise` }))

/* ---- État de l'éditeur ---- */
const tokens = reactive<Record<TokenName, string>>(resolveTokens())
const logoUrl = ref<string | null>(null)
const headerImageUrl = ref<string | null>(null)
const customCss = ref('')

function applyTheme(theme: GameTheme | null | undefined, css: string | null | undefined) {
  Object.assign(tokens, resolveTokens(theme?.tokens))
  logoUrl.value = theme?.logoUrl ?? null
  headerImageUrl.value = theme?.headerImageUrl ?? null
  customCss.value = css ?? ''
}

const currentTheme = computed<GameTheme>(() => ({
  tokens: tokenOverrides(tokens),
  logoUrl: logoUrl.value,
  headerImageUrl: headerImageUrl.value,
}))

// Aperçu : mêmes composants que les pages participant, avec les tokens en cours d'édition.
const { style: previewStyle } = useGameTheme(currentTheme)

/* ---- Modifications non enregistrées ---- */
const savedSnapshot = ref('')
const snapshot = () => JSON.stringify({ theme: currentTheme.value, css: customCss.value })
const dirty = computed(() => !loading.value && snapshot() !== savedSnapshot.value)

onBeforeRouteLeave(() => {
  if (dirty.value && !window.confirm('Des modifications du thème ne sont pas enregistrées. Quitter quand même ?')) return false
})

async function load() {
  const { data, error } = await supabase.from('games').select('*').eq('id', gameId).maybeSingle()
  if (error) loadError.value = friendlyError(error)
  else if (!data) loadError.value = 'Partie introuvable.'
  else {
    game.value = data as Game
    applyTheme(game.value.theme, game.value.custom_css)
    savedSnapshot.value = snapshot()
  }
  loading.value = false
}

/* ---- Couleurs ---- */
/** Couleur effective d'un token (suit les « var(--…) » jusqu'à une valeur réelle). */
function resolved(name: TokenName): string {
  let value = tokens[name]
  for (let i = 0; i < 5 && value.startsWith('var('); i++) {
    const ref = value.match(/var\(--([\w-]+)\)/)?.[1] as TokenName | undefined
    value = ref && ref in tokens ? tokens[ref] : '#000000'
  }
  return value
}

const mainColors: { name: TokenName; label: string }[] = [
  { name: 'color-primary', label: 'Primaire' },
  { name: 'color-secondary', label: 'Secondaire' },
  { name: 'color-bg', label: 'Fond' },
  { name: 'color-text', label: 'Texte' },
]

const moreColors: { name: TokenName; label: string }[] = [
  { name: 'color-surface', label: 'Surface (cartes, champs)' },
  { name: 'color-text-muted', label: 'Texte secondaire' },
  { name: 'color-border', label: 'Bordures' },
  { name: 'color-on-primary', label: 'Texte sur primaire' },
  { name: 'color-on-secondary', label: 'Texte sur secondaire' },
]
const showMoreColors = ref(false)

const statuses: { value: MissionStatus; label: string }[] = [
  { value: 'todo', label: 'À faire' },
  { value: 'pending', label: 'Attente' },
  { value: 'validated', label: 'Validée' },
  { value: 'refused', label: 'Refusée' },
]
const editedStatus = ref<MissionStatus | null>(null)
const statusToken = (status: MissionStatus, part: 'bg' | 'fg') => `status-${status}-${part}` as TokenName

/* ---- Typographies ---- */
const fontGroups = computed(() => {
  const labels = { serif: 'Avec empattements', sans: 'Sans empattements', display: 'Affichage', hand: 'Manuscrites' }
  return (Object.keys(labels) as (keyof typeof labels)[]).map(category => ({
    label: labels[category],
    fonts: Object.keys(FONT_CATALOG).filter(f => FONT_CATALOG[f]!.category === category),
  }))
})

/* ---- Cartes ---- */
const px = (name: TokenName) => computed({
  get: () => Number.parseInt(tokens[name], 10) || 0,
  set: (v: number) => { tokens[name] = `${v}px` },
})
const cardRadius = px('card-radius')
const cardBorderWidth = px('card-border-width')

const shadows = [
  { label: 'Aucune', value: 'none' },
  { label: 'Légère', value: '0 1px 3px rgb(0 0 0 / 0.08)' },
  { label: 'Moyenne', value: '0 4px 12px rgb(0 0 0 / 0.12)' },
  { label: 'Forte', value: '0 10px 24px rgb(0 0 0 / 0.18)' },
  { label: 'Décalée (style BD)', value: '4px 4px 0 var(--color-text)' },
]

const badgeShapes = [
  { label: 'Pilule', value: '999px' },
  { label: 'Arrondi', value: '8px' },
  { label: 'Carré', value: '0px' },
]

const cssUrl = (url: string | null) => (url ? `url("${url}")` : 'none')
const urlFromCss = (value: string) => value.match(/url\("?([^")]+)"?\)/)?.[1] ?? null

const cardBgMode = computed({
  get: () => (tokens['card-bg-image'] !== 'none' ? 'image' : 'color'),
  set: (mode: 'color' | 'image') => {
    if (mode === 'color') tokens['card-bg-image'] = 'none'
    else cardBgPending.value = true
  },
})
const cardBgPending = ref(false)

/* ---- Images ---- */
const uploading = ref<string | null>(null)
const imageError = ref<string | null>(null)

async function uploadThemeImage(file: File, key: string): Promise<string | null> {
  imageError.value = null
  uploading.value = key
  try {
    // Logos, motifs PNG légers, SVG et GIF : tels quels (transparence) ; photos : recompressées.
    const keepAsIs = ['image/svg+xml', 'image/gif'].includes(file.type)
      || (file.type === 'image/png' && file.size < 1.5 * 1024 * 1024)
      || key === 'logo'
    const blob = keepAsIs ? file : (await compressImage(file, { maxSize: 1920, quality: 0.82 })).blob
    const mime = blob.type || file.type
    const path = `games/${gameId}/theme/${randomId()}.${extensionFor(mime)}`
    const { error } = await supabase.storage.from(ASSETS_BUCKET).upload(path, blob, { contentType: mime, cacheControl: '31536000' })
    if (error) throw error
    return assetUrl(path)
  }
  catch (e) {
    imageError.value = friendlyError(e, 'Envoi de l’image impossible.')
    return null
  }
  finally {
    uploading.value = null
  }
}

async function pickLogo(file: File) {
  const url = await uploadThemeImage(file, 'logo')
  if (url) logoUrl.value = url
}
async function pickHeader(file: File) {
  const url = await uploadThemeImage(file, 'header')
  if (url) headerImageUrl.value = url
}
async function pickPageBg(file: File) {
  const url = await uploadThemeImage(file, 'page-bg')
  if (url) tokens['page-bg-image'] = cssUrl(url)
}
async function pickCardBg(file: File) {
  const url = await uploadThemeImage(file, 'card-bg')
  if (url) {
    tokens['card-bg-image'] = cssUrl(url)
    cardBgPending.value = false
  }
}

const pageBgPattern = computed({
  get: () => tokens['page-bg-repeat'] === 'repeat',
  set: (pattern: boolean) => {
    tokens['page-bg-repeat'] = pattern ? 'repeat' : 'no-repeat'
    tokens['page-bg-size'] = pattern ? 'auto' : 'cover'
  },
})

/* ---- Repartir d'un autre thème ---- */
const otherGames = ref<Pick<Game, 'id' | 'name' | 'theme' | 'custom_css'>[]>([])
const sourceGameId = ref('')

async function loadOtherGames() {
  const { data } = await supabase.from('games').select('id, name, theme, custom_css').neq('id', gameId).order('created_at', { ascending: false })
  otherGames.value = (data ?? []) as typeof otherGames.value
}

function copyFrom() {
  const source = otherGames.value.find(g => g.id === sourceGameId.value)
  if (!source) return
  if (!window.confirm(`Remplacer le thème actuel par celui de « ${source.name} » ?\nTu pourras encore annuler en quittant sans enregistrer.`)) return
  applyTheme(source.theme, source.custom_css)
  sourceGameId.value = ''
}

function resetToDefault() {
  if (!window.confirm('Revenir au thème par défaut ? Couleurs, polices, images et CSS personnalisé seront effacés (après enregistrement).')) return
  applyTheme(null, '')
}

/* ---- Enregistrement ---- */
const saving = ref(false)
const saveError = ref<string | null>(null)
const savedAt = ref<number | null>(null)

async function save() {
  saving.value = true
  saveError.value = null
  const { error } = await supabase
    .from('games')
    .update({ theme: currentTheme.value, custom_css: customCss.value })
    .eq('id', gameId)
  saving.value = false
  if (error) {
    saveError.value = friendlyError(error)
    return
  }
  savedSnapshot.value = snapshot()
  savedAt.value = Date.now()
  setTimeout(() => (savedAt.value = null), 2500)
}

onMounted(() => {
  load()
  loadOtherGames()
})
</script>

<template>
  <div class="page">
    <AdminTopBar title="Thème de la partie" :subtitle="game?.name" :back="{ to: `/admin/parties/${gameId}`, label: game?.name ?? 'Partie' }" />

    <p v-if="loading" class="empty">Chargement…</p>
    <p v-else-if="loadError" class="form-error" role="alert">{{ loadError }}</p>

    <template v-else-if="game">
      <!-- Aperçu en direct -->
      <section class="preview-wrap" aria-label="Aperçu en direct">
        <p class="kicker">Aperçu en direct</p>
        <div class="preview themed" :style="previewStyle">
          <div class="preview__card">
            <MissionCard
              title="Pyramide humaine"
              :base-points="70"
              :answer-types="['photo']"
              :status="editedStatus ?? 'todo'"
              has-bonus
            />
          </div>
          <div class="preview__home">
            <div class="preview__logo" :class="{ 'preview__logo--image': logoUrl }">
              <img v-if="logoUrl" :src="logoUrl" alt="">
            </div>
            <p class="preview__title">{{ game.name }}</p>
            <AppButton>Bouton</AppButton>
          </div>
        </div>
      </section>

      <!-- Couleurs -->
      <section class="panel">
        <h2 class="panel__title">Couleurs</h2>
        <AdminColorField
          v-for="c in mainColors"
          :key="c.name"
          v-model="tokens[c.name]"
          :label="c.label"
          :default-value="DEFAULT_TOKENS[c.name]"
          :resolved="resolved(c.name)"
        />
        <button type="button" class="link-btn" @click="showMoreColors = !showMoreColors">
          {{ showMoreColors ? 'Moins de couleurs' : 'Plus de couleurs' }}
        </button>
        <template v-if="showMoreColors">
          <AdminColorField
            v-for="c in moreColors"
            :key="c.name"
            v-model="tokens[c.name]"
            :label="c.label"
            :default-value="DEFAULT_TOKENS[c.name]"
            :resolved="resolved(c.name)"
          />
        </template>

        <h3 class="panel__subtitle">Couleurs de statut</h3>
        <div class="status-chips">
          <button
            v-for="s in statuses"
            :key="s.value"
            type="button"
            class="status-chip"
            :class="{ 'is-active': editedStatus === s.value }"
            :style="{ background: resolved(statusToken(s.value, 'bg')), color: resolved(statusToken(s.value, 'fg')) }"
            @click="editedStatus = editedStatus === s.value ? null : s.value"
          >
            {{ s.label }}
          </button>
        </div>
        <template v-if="editedStatus">
          <AdminColorField
            v-model="tokens[statusToken(editedStatus, 'bg')]"
            label="Fond du statut"
            :default-value="DEFAULT_TOKENS[statusToken(editedStatus, 'bg')]"
            :resolved="resolved(statusToken(editedStatus, 'bg'))"
          />
          <AdminColorField
            v-model="tokens[statusToken(editedStatus, 'fg')]"
            label="Texte du statut"
            :default-value="DEFAULT_TOKENS[statusToken(editedStatus, 'fg')]"
            :resolved="resolved(statusToken(editedStatus, 'fg'))"
          />
        </template>
        <p v-else class="field__hint">Touche un statut pour modifier ses couleurs.</p>
      </section>

      <!-- Typographies -->
      <section class="panel">
        <h2 class="panel__title">Typographies</h2>
        <div class="field">
          <label class="field__label" for="font-heading">Police des titres</label>
          <select id="font-heading" v-model="tokens['font-heading']" class="input" :style="{ fontFamily: `'${tokens['font-heading']}'` }">
            <optgroup v-for="g in fontGroups" :key="g.label" :label="g.label">
              <option v-for="f in g.fonts" :key="f" :value="f">{{ f }}</option>
            </optgroup>
          </select>
        </div>
        <div class="field">
          <label class="field__label" for="font-body">Police du texte</label>
          <select id="font-body" v-model="tokens['font-body']" class="input" :style="{ fontFamily: `'${tokens['font-body']}'` }">
            <optgroup v-for="g in fontGroups" :key="g.label" :label="g.label">
              <option v-for="f in g.fonts" :key="f" :value="f">{{ f }}</option>
            </optgroup>
          </select>
        </div>
      </section>

      <!-- Cartes mission -->
      <section class="panel">
        <h2 class="panel__title">Cartes mission</h2>

        <div class="field">
          <div class="range-label">
            <label class="field__label" for="card-radius">Arrondi</label><span>{{ cardRadius }}px</span>
          </div>
          <input id="card-radius" v-model.number="cardRadius" class="range" type="range" min="0" max="32" step="1">
        </div>

        <div class="field">
          <label class="field__label" for="card-shadow">Ombre</label>
          <select id="card-shadow" v-model="tokens['card-shadow']" class="input">
            <option v-for="s in shadows" :key="s.value" :value="s.value">{{ s.label }}</option>
          </select>
        </div>

        <div class="field">
          <div class="range-label">
            <label class="field__label" for="card-border">Épaisseur de bordure</label><span>{{ cardBorderWidth }}px</span>
          </div>
          <input id="card-border" v-model.number="cardBorderWidth" class="range" type="range" min="0" max="4" step="1">
        </div>
        <AdminColorField
          v-model="tokens['card-border-color']"
          label="Couleur de bordure"
          :default-value="DEFAULT_TOKENS['card-border-color']"
          :resolved="resolved('card-border-color')"
          auto-label="bordures"
        />

        <div class="field">
          <span class="field__label">Fond des cartes</span>
          <div class="toggle">
            <button type="button" :class="{ 'is-active': cardBgMode === 'color' && !cardBgPending }" @click="cardBgMode = 'color'; cardBgPending = false">Couleur</button>
            <button type="button" :class="{ 'is-active': cardBgMode === 'image' || cardBgPending }" @click="cardBgMode = 'image'">Image</button>
          </div>
        </div>
        <AdminColorField
          v-if="cardBgMode === 'color' && !cardBgPending"
          v-model="tokens['card-bg']"
          label="Couleur de fond"
          :default-value="DEFAULT_TOKENS['card-bg']"
          :resolved="resolved('card-bg')"
          auto-label="surface"
        />
        <AdminImageField
          v-else
          label="Image de fond des cartes"
          hint="Texture discrète conseillée, pour garder le texte lisible."
          :url="urlFromCss(tokens['card-bg-image'])"
          :busy="uploading === 'card-bg'"
          @pick="pickCardBg"
          @clear="tokens['card-bg-image'] = 'none'"
        />

        <h3 class="panel__subtitle">Badge de points</h3>
        <AdminColorField
          v-model="tokens['badge-points-bg']"
          label="Fond"
          :default-value="DEFAULT_TOKENS['badge-points-bg']"
          :resolved="resolved('badge-points-bg')"
          auto-label="primaire"
        />
        <AdminColorField
          v-model="tokens['badge-points-fg']"
          label="Texte"
          :default-value="DEFAULT_TOKENS['badge-points-fg']"
          :resolved="resolved('badge-points-fg')"
          auto-label="texte sur primaire"
        />
        <div class="toggle toggle--3">
          <button
            v-for="shape in badgeShapes"
            :key="shape.value"
            type="button"
            :class="{ 'is-active': tokens['badge-points-radius'] === shape.value }"
            @click="tokens['badge-points-radius'] = shape.value"
          >
            {{ shape.label }}
          </button>
        </div>
      </section>

      <!-- Images de la page -->
      <section class="panel">
        <h2 class="panel__title">Images de la page</h2>
        <AdminImageField
          label="Logo de la partie"
          hint="PNG transparent ou SVG conseillé."
          :url="logoUrl"
          :busy="uploading === 'logo'"
          @pick="pickLogo"
          @clear="logoUrl = null"
        />
        <AdminImageField
          label="Image d’en-tête"
          hint="Affichée sur l’écran « rejoindre » (format large)."
          :url="headerImageUrl"
          :busy="uploading === 'header'"
          @pick="pickHeader"
          @clear="headerImageUrl = null"
        />
        <AdminImageField
          label="Image ou motif de fond"
          :url="urlFromCss(tokens['page-bg-image'])"
          :busy="uploading === 'page-bg'"
          @pick="pickPageBg"
          @clear="tokens['page-bg-image'] = 'none'"
        />
        <AppSwitch
          v-if="tokens['page-bg-image'] !== 'none'"
          v-model="pageBgPattern"
          label="Répéter en motif"
          hint="Sinon, l’image couvre tout le fond."
        />
        <p v-if="imageError" class="form-error" role="alert">{{ imageError }}</p>
      </section>

      <!-- CSS personnalisé -->
      <section class="panel">
        <h2 class="panel__title">CSS personnalisé</h2>
        <p class="field__hint">Appliqué uniquement aux pages participant de cette partie. Classes utiles : <code>.mission-card</code>, <code>.btn</code>, <code>.status</code>, <code>.points</code>.</p>
        <textarea
          v-model="customCss"
          class="input css-input"
          rows="6"
          spellcheck="false"
          autocapitalize="off"
          placeholder=".mission-card { transform: rotate(-1deg); }"
          aria-label="CSS personnalisé"
        />
      </section>

      <!-- Repartir d'un thème -->
      <section class="panel">
        <h2 class="panel__title">Repartir d’un thème existant</h2>
        <div class="copy-row">
          <select v-model="sourceGameId" class="input" aria-label="Partie source">
            <option value="">Thème d’une autre partie…</option>
            <option v-for="g in otherGames" :key="g.id" :value="g.id">{{ g.name }}</option>
          </select>
          <AppButton variant="outline" :disabled="!sourceGameId" @click="copyFrom">Reprendre</AppButton>
        </div>
        <AppButton variant="danger" @click="resetToDefault">
          <RotateCcw :size="16" aria-hidden="true" /> Revenir au thème par défaut
        </AppButton>
      </section>

      <!-- Barre d'enregistrement -->
      <div class="savebar" :class="{ 'savebar--dirty': dirty }">
        <p class="savebar__text" role="status">
          <template v-if="savedAt"><Check :size="16" aria-hidden="true" /> Thème enregistré</template>
          <template v-else-if="dirty">Modifications non enregistrées</template>
          <template v-else>Thème à jour</template>
        </p>
        <p v-if="saveError" class="form-error">{{ saveError }}</p>
        <AppButton variant="secondary" :disabled="!dirty" :loading="saving" @click="save">
          {{ saving ? 'Enregistrement…' : 'Enregistrer le thème' }}
        </AppButton>
      </div>
    </template>
  </div>
</template>

<style scoped>
.page {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  max-width: 760px;
  margin: 0 auto;
  padding: 0 var(--space-4) calc(120px + env(safe-area-inset-bottom, 0px));
}

.empty {
  padding: var(--space-8) var(--space-4);
  color: var(--color-text-muted);
  text-align: center;
}

.kicker {
  margin-bottom: var(--space-2);
  color: var(--color-text-muted);
  font-size: 0.75rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

/* Aperçu : reste visible pendant qu'on fait défiler les réglages */
.preview-wrap {
  position: sticky;
  top: env(safe-area-inset-top, 0px);
  z-index: 10;
  padding: var(--space-2) 0;
  background: var(--admin-bg);
}

.preview {
  display: flex;
  align-items: center;
  gap: var(--space-4);
  padding: var(--space-3);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  background-color: var(--color-bg);
  background-image: var(--page-bg-image);
  background-size: var(--page-bg-size);
  background-repeat: var(--page-bg-repeat);
  color: var(--color-text);
  font-family: var(--font-body);
}

.preview__card {
  flex: 0 0 min(46%, 190px);
}

.preview__home {
  display: flex;
  flex: 1;
  flex-direction: column;
  align-items: flex-start;
  gap: var(--space-2);
  min-width: 0;
}

.preview__logo {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: var(--color-primary);
}

.preview__logo--image {
  width: auto;
  max-width: 120px;
  border-radius: 0;
  background: none;
}

.preview__logo img {
  height: 100%;
  object-fit: contain;
}

.preview__title {
  font-family: var(--font-heading);
  font-size: 1.375rem;
  font-weight: 800;
  line-height: 1.1;
  overflow-wrap: anywhere;
}

.panel {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  padding: var(--space-5) var(--space-4);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  background: var(--color-surface);
}

.panel__title {
  font-family: var(--font-body);
  font-size: 1.125rem;
  font-weight: 700;
}

.panel__subtitle {
  margin-top: var(--space-2);
  font-family: var(--font-body);
  font-size: 0.9375rem;
  font-weight: 700;
}

.link-btn {
  align-self: flex-start;
  padding: 0;
  border: none;
  background: none;
  color: var(--color-secondary);
  font-weight: 600;
}

.status-chips {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: var(--space-2);
}

.status-chip {
  min-height: 36px;
  border: 2px solid transparent;
  border-radius: var(--radius-pill);
  font-size: 0.8125rem;
  font-weight: 700;
}

.status-chip.is-active {
  border-color: var(--color-text);
}

.range-label {
  display: flex;
  justify-content: space-between;
  color: var(--color-text-muted);
}

.range {
  width: 100%;
  accent-color: var(--color-secondary);
}

.toggle {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--space-2);
}

.toggle--3 {
  grid-template-columns: repeat(3, 1fr);
}

.toggle button {
  min-height: var(--tap-min);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-surface);
  font-weight: 600;
}

.toggle button.is-active {
  border-color: var(--color-text);
  background: var(--color-text);
  color: var(--color-surface);
}

.css-input {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 0.875rem;
}

.copy-row {
  display: flex;
  gap: var(--space-2);
}

.savebar {
  position: fixed;
  right: 0;
  bottom: 0;
  left: 0;
  z-index: 20;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-2) var(--space-3);
  padding: var(--space-3) var(--space-4) calc(var(--space-3) + env(safe-area-inset-bottom, 0px));
  border-top: 1px solid var(--color-border);
  background: var(--color-surface);
}

.savebar--dirty {
  background: var(--status-pending-bg);
}

.savebar__text {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  font-weight: 600;
}
</style>
