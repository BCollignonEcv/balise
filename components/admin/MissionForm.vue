<script setup lang="ts">
import { AlignLeft, Camera, Crosshair, ImagePlus, MapPin, Trash2, Video } from '@lucide/vue'
import { ANSWER_TYPE_LABELS, sortAnswerTypes, type AnswerType } from '~/types/game'
import type { Mission, MissionSecret, ValidationMode } from '~/types/database'
import type { MissionFormValues, MissionImageChange } from '~/composables/useMissionAdmin'

const props = defineProps<{
  mission?: Mission | null
  secret?: MissionSecret | null
  submitLabel: string
  saving?: boolean
  error?: string | null
}>()

const emit = defineEmits<{ submit: [values: MissionFormValues, image: MissionImageChange] }>()

const m = props.mission
const s = props.secret

const form = reactive({
  title: m?.title ?? '',
  description: m?.description ?? '',
  basePoints: m?.base_points ?? 50,
  answerTypes: [...(m?.answer_types ?? ['photo'])] as AnswerType[],
  validationMode: (m?.validation_mode ?? 'manual') as ValidationMode,
  repeatable: (m?.max_validations ?? 1) > 1,
  maxValidations: Math.max(2, m?.max_validations ?? 5),
  hasBonus: !!m?.bonus_label,
  bonusLabel: m?.bonus_label ?? '',
  bonusPoints: m?.bonus_points ?? 10,
  bonusMax: m?.bonus_max ?? 1,
  expectedAnswer: s?.expected_answer ?? '',
  coordinates: s?.target_lat != null && s?.target_lng != null ? `${s.target_lat}, ${s.target_lng}` : '',
  radius: s?.radius_m ?? 50,
})

/* ---- Image ---- */
const imageFile = ref<File | null>(null)
const removeImage = ref(false)
const localPreview = ref<string | null>(null)
const imageInput = ref<HTMLInputElement | null>(null)

const imagePreview = computed(() => localPreview.value ?? (removeImage.value ? null : assetUrl(m?.image_path)))

function onImagePicked(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0]
  if (!file) return
  if (localPreview.value) URL.revokeObjectURL(localPreview.value)
  imageFile.value = file
  removeImage.value = false
  localPreview.value = URL.createObjectURL(file)
}

function clearImage() {
  if (localPreview.value) URL.revokeObjectURL(localPreview.value)
  localPreview.value = null
  imageFile.value = null
  removeImage.value = true
  if (imageInput.value) imageInput.value.value = ''
}

onBeforeUnmount(() => {
  if (localPreview.value) URL.revokeObjectURL(localPreview.value)
})

/* ---- Types et validation ---- */
const answerTypes: { value: AnswerType; icon: typeof Camera }[] = [
  { value: 'photo', icon: Camera },
  { value: 'video', icon: Video },
  { value: 'text', icon: AlignLeft },
  { value: 'gps', icon: MapPin },
]

const hasType = (t: AnswerType) => form.answerTypes.includes(t)

const typesHint = computed(() => {
  const labels = sortAnswerTypes(form.answerTypes).map(t => ANSWER_TYPE_LABELS[t].toLowerCase())
  if (labels.length < 2) return 'Coche plusieurs types pour laisser le choix à l’équipe.'
  return `L’équipe envoie au moins une réponse parmi : ${labels.join(', ')}.`
})

const validationHint = computed(() => {
  if (form.validationMode === 'manual') return ['La réponse reste en attente jusqu’à ta décision.']
  const hints: string[] = []
  if (hasType('text')) hints.push('Texte : validé s’il correspond à la réponse attendue (sans tenir compte des majuscules, accents et espaces superflus), sinon refusé.')
  if (hasType('gps')) hints.push('Position : validée si elle est dans le rayon défini, sinon refusée.')
  if (hasType('photo') || hasType('video')) {
    hints.push(hints.length
      ? 'Une réponse ne contenant que des photos ou vidéos est validée dès l’envoi.'
      : 'La réponse est validée dès l’envoi.')
  }
  return hints
})

const needsExpectedText = computed(() => form.validationMode === 'auto' && hasType('text'))
const needsTarget = computed(() => form.validationMode === 'auto' && hasType('gps'))

/* ---- Coordonnées GPS ---- */
function parseCoordinates(value: string): { lat: number; lng: number } | null {
  const parts = value.trim().split(/[\s,;]+/).filter(Boolean)
  if (parts.length !== 2) return null
  const [lat, lng] = parts.map(p => Number(p.replace(',', '.')))
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null
  if (Math.abs(lat!) > 90 || Math.abs(lng!) > 180) return null
  return { lat: lat!, lng: lng! }
}

const parsedTarget = computed(() => parseCoordinates(form.coordinates))
const mapUrl = computed(() => {
  const t = parsedTarget.value
  return t ? `https://www.openstreetmap.org/?mlat=${t.lat}&mlon=${t.lng}#map=18/${t.lat}/${t.lng}` : null
})

const locating = ref(false)
const locateError = ref<string | null>(null)

function useCurrentPosition() {
  locateError.value = null
  if (!('geolocation' in navigator) || !window.isSecureContext) {
    locateError.value = 'La géolocalisation nécessite une connexion sécurisée (HTTPS).'
    return
  }
  locating.value = true
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      form.coordinates = `${pos.coords.latitude.toFixed(6)}, ${pos.coords.longitude.toFixed(6)}`
      locating.value = false
    },
    (err) => {
      locateError.value = err.code === err.PERMISSION_DENIED
        ? 'Accès à la position refusé par le navigateur.'
        : 'Position introuvable pour le moment.'
      locating.value = false
    },
    { enableHighAccuracy: true, timeout: 15000 },
  )
}

/* ---- Envoi ---- */
const validationError = ref<string | null>(null)

const isInt = (n: unknown, min: number) => Number.isInteger(n) && (n as number) >= min

function submit() {
  validationError.value = null
  const fail = (msg: string) => (validationError.value = msg)

  if (!form.title.trim()) return fail('Le titre est obligatoire.')
  if (!isInt(form.basePoints, 0)) return fail('Les points de base doivent être un nombre entier positif.')
  if (!form.answerTypes.length) return fail('Coche au moins un type de réponse.')
  if (form.repeatable && !isInt(form.maxValidations, 2)) return fail('Le nombre maximum de validations doit être d’au moins 2.')
  if (form.hasBonus) {
    if (!form.bonusLabel.trim()) return fail('Décris le bonus.')
    if (!isInt(form.bonusPoints, 1)) return fail('Les points par bonus doivent être un entier supérieur à 0.')
    if (!isInt(form.bonusMax, 1)) return fail('Le nombre maximum de bonus doit être d’au moins 1.')
  }
  if (needsExpectedText.value && !form.expectedAnswer.trim()) return fail('Indique la réponse attendue.')
  if (needsTarget.value) {
    if (!parsedTarget.value) return fail('Coordonnées cibles invalides. Format attendu : 48.858370, 2.294481')
    if (!isInt(form.radius, 1)) return fail('Le rayon de tolérance doit être un nombre entier de mètres.')
  }

  emit(
    'submit',
    {
      title: form.title.trim(),
      description: form.description.trim(),
      base_points: form.basePoints,
      answer_types: sortAnswerTypes(form.answerTypes),
      validation_mode: form.validationMode,
      max_validations: form.repeatable ? form.maxValidations : 1,
      bonus_label: form.hasBonus ? form.bonusLabel.trim() : null,
      bonus_points: form.hasBonus ? form.bonusPoints : null,
      bonus_max: form.hasBonus ? form.bonusMax : null,
      expected_answer: needsExpectedText.value ? form.expectedAnswer.trim() : null,
      target_lat: needsTarget.value ? parsedTarget.value!.lat : null,
      target_lng: needsTarget.value ? parsedTarget.value!.lng : null,
      radius_m: needsTarget.value ? form.radius : null,
    },
    { file: imageFile.value, remove: removeImage.value },
  )
}
</script>

<template>
  <form class="mission-form" novalidate @submit.prevent="submit">
    <!-- Aperçu -->
    <div class="mission-form__preview">
      <MissionCard
        :title="form.title || 'Titre de la mission'"
        :base-points="Number.isInteger(form.basePoints) ? form.basePoints : 0"
        :answer-types="form.answerTypes.length ? form.answerTypes : ['photo']"
        status="todo"
        :image-url="imagePreview"
        :has-bonus="form.hasBonus"
        :validated-count="0"
        :max-validations="form.repeatable ? form.maxValidations : 1"
      />
      <p class="field__hint">Aperçu avec le thème par défaut.</p>
    </div>

    <!-- Contenu -->
    <section class="block">
      <h2 class="block__title">Contenu</h2>
      <div class="field">
        <label class="field__label" for="m-title">Titre</label>
        <input id="m-title" v-model="form.title" class="input" type="text" placeholder="Ex. : Pyramide humaine">
      </div>
      <div class="field">
        <label class="field__label" for="m-desc">Description</label>
        <textarea id="m-desc" v-model="form.description" class="input" rows="4" placeholder="Ce que l’équipe doit faire, et comment le prouver." />
      </div>
      <div class="field">
        <label class="field__label" for="m-points">Points de base</label>
        <input id="m-points" v-model.number="form.basePoints" class="input input--short" type="number" inputmode="numeric" min="0" step="1">
      </div>

      <div class="field">
        <span class="field__label">Image d’illustration <span class="optional">(optionnelle)</span></span>
        <div class="image-picker">
          <div class="image-picker__thumb" :class="{ placeholder: !imagePreview }">
            <img v-if="imagePreview" :src="imagePreview" alt="">
          </div>
          <div class="image-picker__actions">
            <AppButton variant="outline" @click="imageInput?.click()">
              <ImagePlus :size="16" aria-hidden="true" /> {{ imagePreview ? 'Changer' : 'Choisir' }}
            </AppButton>
            <AppButton v-if="imagePreview" variant="danger" @click="clearImage">
              <Trash2 :size="16" aria-hidden="true" /> Retirer
            </AppButton>
          </div>
          <input ref="imageInput" class="visually-hidden" type="file" accept="image/*" tabindex="-1" @change="onImagePicked">
        </div>
      </div>
    </section>

    <!-- Réponse -->
    <section class="block">
      <h2 class="block__title">Réponse attendue</h2>
      <fieldset class="field bare">
        <legend class="field__label">Types de réponse acceptés</legend>
        <div class="choice choice--4">
          <label v-for="t in answerTypes" :key="t.value" class="choice__option" :class="{ 'is-active': hasType(t.value) }">
            <input v-model="form.answerTypes" class="visually-hidden" type="checkbox" :value="t.value">
            <component :is="t.icon" :size="20" aria-hidden="true" />
            {{ ANSWER_TYPE_LABELS[t.value] }}
          </label>
        </div>
        <span class="field__hint">{{ typesHint }}</span>
      </fieldset>

      <fieldset class="field bare">
        <legend class="field__label">Validation</legend>
        <div class="choice choice--2">
          <label class="choice__option" :class="{ 'is-active': form.validationMode === 'manual' }">
            <input v-model="form.validationMode" class="visually-hidden" type="radio" name="validation" value="manual">
            Manuelle
          </label>
          <label class="choice__option" :class="{ 'is-active': form.validationMode === 'auto' }">
            <input v-model="form.validationMode" class="visually-hidden" type="radio" name="validation" value="auto">
            Automatique
          </label>
        </div>
        <span v-for="hint in validationHint" :key="hint" class="field__hint">{{ hint }}</span>
      </fieldset>

      <div v-if="needsExpectedText" class="field">
        <label class="field__label" for="m-expected">Réponse attendue</label>
        <input id="m-expected" v-model="form.expectedAnswer" class="input" type="text" autocomplete="off" placeholder="Ex. : Phare de Kermorvan">
        <span class="field__hint">Jamais visible par les participants.</span>
      </div>

      <template v-if="needsTarget">
        <div class="field">
          <label class="field__label" for="m-coords">Coordonnées cibles</label>
          <input id="m-coords" v-model="form.coordinates" class="input" type="text" inputmode="decimal" autocomplete="off" placeholder="48.858370, 2.294481">
          <span class="field__hint">
            Latitude, longitude. Astuce : dans Google Maps, un appui long sur un lieu affiche ses coordonnées.
          </span>
          <div class="coords-actions">
            <AppButton variant="outline" :loading="locating" @click="useCurrentPosition">
              <Crosshair :size="16" aria-hidden="true" /> {{ locating ? 'Localisation…' : 'Ma position actuelle' }}
            </AppButton>
            <a v-if="mapUrl" :href="mapUrl" target="_blank" rel="noopener" class="link">Vérifier sur la carte</a>
          </div>
          <span v-if="locateError" class="field__error">{{ locateError }}</span>
        </div>
        <div class="field">
          <label class="field__label" for="m-radius">Rayon de tolérance (mètres)</label>
          <input id="m-radius" v-model.number="form.radius" class="input input--short" type="number" inputmode="numeric" min="1" step="1">
          <span class="field__hint">Tiens compte de l’imprécision du GPS des téléphones : 30 à 50 m minimum conseillés.</span>
        </div>
      </template>
    </section>

    <!-- Répétition et bonus -->
    <section class="block">
      <h2 class="block__title">Répétition et bonus</h2>
      <AppSwitch v-model="form.repeatable" label="Mission répétable" hint="L’équipe peut la réussir plusieurs fois." />
      <div v-if="form.repeatable" class="field">
        <label class="field__label" for="m-max">Nombre maximum de validations par équipe</label>
        <input id="m-max" v-model.number="form.maxValidations" class="input input--short" type="number" inputmode="numeric" min="2" step="1">
      </div>

      <AppSwitch v-model="form.hasBonus" label="Bonus possible" hint="Toujours validé manuellement par toi." />
      <template v-if="form.hasBonus">
        <div class="field">
          <label class="field__label" for="m-bonus-label">Description du bonus</label>
          <input id="m-bonus-label" v-model="form.bonusLabel" class="input" type="text" placeholder="Ex. : Par personne au-delà de 5">
        </div>
        <div class="bonus-numbers">
          <div class="field">
            <label class="field__label" for="m-bonus-points">Points par bonus</label>
            <input id="m-bonus-points" v-model.number="form.bonusPoints" class="input" type="number" inputmode="numeric" min="1" step="1">
          </div>
          <div class="field">
            <label class="field__label" for="m-bonus-max">Nombre maximum</label>
            <input id="m-bonus-max" v-model.number="form.bonusMax" class="input" type="number" inputmode="numeric" min="1" step="1">
          </div>
        </div>
        <p class="field__hint">
          Jusqu’à +{{ (form.bonusPoints || 0) * (form.bonusMax || 0) }} pts en plus des {{ form.basePoints || 0 }} pts de base.
        </p>
      </template>
    </section>

    <p v-if="validationError || error" class="form-error" role="alert">{{ validationError || error }}</p>

    <AppButton type="submit" variant="secondary" size="lg" block :loading="saving">
      {{ saving ? 'Enregistrement…' : submitLabel }}
    </AppButton>
  </form>
</template>

<style scoped>
.mission-form {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.mission-form__preview {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  width: min(100%, 220px);
  margin: 0 auto;
}

.block {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  padding: var(--space-5) var(--space-4);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  background: var(--color-surface);
}

.block__title {
  font-family: var(--font-body);
  font-size: 1.125rem;
  font-weight: 700;
}

.bare {
  margin: 0;
  padding: 0;
  border: none;
}

.optional {
  color: var(--color-text-muted);
  font-weight: 400;
}

.input--short {
  max-width: 140px;
}

.image-picker {
  display: flex;
  align-items: center;
  gap: var(--space-3);
}

.image-picker__thumb {
  flex: none;
  width: 112px;
  aspect-ratio: 16 / 9;
  overflow: hidden;
  border-radius: var(--radius-sm);
}

.image-picker__thumb img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.image-picker__actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
}

.choice {
  display: grid;
  gap: var(--space-2);
}

.choice--4 {
  grid-template-columns: repeat(4, minmax(0, 1fr));
}

.choice--2 {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.choice__option {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--space-1);
  min-height: 52px;
  padding: var(--space-2);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-surface);
  font-size: 0.875rem;
  font-weight: 600;
  text-align: center;
  cursor: pointer;
}

.choice__option.is-active {
  border-color: var(--color-text);
  background: var(--color-text);
  color: var(--color-surface);
}

.choice__option:has(:focus-visible) {
  outline: 2px solid var(--color-secondary);
  outline-offset: 2px;
}

.coords-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-3);
  margin-top: var(--space-1);
}

.link {
  color: var(--color-secondary);
  font-weight: 600;
}

.bonus-numbers {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--space-3);
}
</style>
