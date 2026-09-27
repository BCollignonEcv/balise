<script setup lang="ts">
import { Camera, Check, Images, MapPin, RefreshCw, Video, X } from '@lucide/vue'
import type { Mission } from '~/types/database'
import type { DraftFile, DraftPosition, SubmitResult } from '~/composables/useSubmitAnswer'

const props = defineProps<{
  mission: Mission
  gameId: string
  teamId: string
}>()

const emit = defineEmits<{ submitted: [result: SubmitResult] }>()

const { submit, progress } = useSubmitAnswer()

const accepts = computed(() => ({
  photo: props.mission.answer_types.includes('photo'),
  video: props.mission.answer_types.includes('video'),
  text: props.mission.answer_types.includes('text'),
  gps: props.mission.answer_types.includes('gps'),
}))
const acceptsMedia = computed(() => accepts.value.photo || accepts.value.video)
const galleryAccept = computed(() =>
  [accepts.value.photo && 'image/*', accepts.value.video && 'video/*'].filter(Boolean).join(','),
)

/* ---- Fichiers ---- */
const files = ref<DraftFile[]>([])
const preparing = ref(false)
const fileErrors = ref<string[]>([])

const photoInput = ref<HTMLInputElement | null>(null)
const videoInput = ref<HTMLInputElement | null>(null)
const galleryInput = ref<HTMLInputElement | null>(null)

async function prepareFile(file: File): Promise<DraftFile | string> {
  const isVideo = file.type.startsWith('video/')
  const isImage = file.type.startsWith('image/') || /\.(heic|heif)$/i.test(file.name)

  if (isImage && accepts.value.photo) {
    try {
      const { blob, width, height } = await compressImage(file, {
        maxSize: MEDIA_LIMITS.photoMaxSize,
        quality: MEDIA_LIMITS.photoQuality,
      })
      return {
        id: randomId(), kind: 'photo', blob, mime: blob.type || 'image/jpeg', name: file.name,
        previewUrl: URL.createObjectURL(blob), width, height, duration: null,
      }
    }
    catch {
      return `« ${file.name} » : format de photo non pris en charge.`
    }
  }

  if (isVideo && accepts.value.video) {
    if (file.size > MEDIA_LIMITS.maxVideoBytes) {
      return `Vidéo trop lourde (${formatBytes(file.size)}, maximum ${formatBytes(MEDIA_LIMITS.maxVideoBytes)}). Filme un passage plus court.`
    }
    const meta = await readVideoMetadata(file)
    if (meta.duration !== null && meta.duration > MEDIA_LIMITS.maxVideoSeconds + 1) {
      return `Vidéo trop longue (${Math.round(meta.duration)} s, maximum ${MEDIA_LIMITS.maxVideoSeconds} s).`
    }
    return {
      id: randomId(), kind: 'video', blob: file, mime: file.type || 'video/mp4', name: file.name,
      previewUrl: URL.createObjectURL(file), width: meta.width, height: meta.height, duration: meta.duration,
    }
  }

  return `« ${file.name} » : ce type de fichier n’est pas accepté pour cette mission.`
}

async function onFilesPicked(event: Event) {
  const input = event.target as HTMLInputElement
  const picked = [...(input.files ?? [])]
  input.value = ''
  if (!picked.length) return

  fileErrors.value = []
  const room = MEDIA_LIMITS.maxFiles - files.value.length
  if (picked.length > room) {
    fileErrors.value.push(`Maximum ${MEDIA_LIMITS.maxFiles} fichiers par réponse.`)
  }

  preparing.value = true
  for (const file of picked.slice(0, Math.max(0, room))) {
    const result = await prepareFile(file)
    if (typeof result === 'string') fileErrors.value.push(result)
    else files.value.push(result)
  }
  preparing.value = false
}

function removeFile(id: string) {
  const file = files.value.find(f => f.id === id)
  if (file) URL.revokeObjectURL(file.previewUrl)
  files.value = files.value.filter(f => f.id !== id)
}

/* ---- Texte ---- */
const text = ref('')

/* ---- Position GPS ----
 * Le premier relevé d'un téléphone est souvent approximatif : on écoute le GPS
 * jusqu'à GPS_MAX_MS, en gardant le meilleur relevé, et on s'arrête dès qu'il
 * atteint GPS_GOOD_ACCURACY_M.
 */
const GPS_MAX_MS = 15000
const GPS_GOOD_ACCURACY_M = 20

const position = ref<DraftPosition | null>(null)
const locating = ref(false)
const locateError = ref<string | null>(null)
let watchId: number | null = null
let watchTimer: ReturnType<typeof setTimeout> | undefined

function stopLocating() {
  if (watchId !== null) navigator.geolocation.clearWatch(watchId)
  watchId = null
  clearTimeout(watchTimer)
  locating.value = false
}

function locate() {
  locateError.value = null
  if (!('geolocation' in navigator) || !window.isSecureContext) {
    locateError.value = 'La géolocalisation nécessite une connexion sécurisée (HTTPS).'
    return
  }
  stopLocating()
  position.value = null
  locating.value = true

  watchId = navigator.geolocation.watchPosition(
    (pos) => {
      if (!position.value || pos.coords.accuracy < position.value.accuracy) {
        position.value = { lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy }
      }
      if (position.value.accuracy <= GPS_GOOD_ACCURACY_M) stopLocating()
    },
    (err) => {
      // Une erreur après un premier relevé n'empêche pas d'utiliser le meilleur obtenu.
      if (!position.value) {
        locateError.value = err.code === err.PERMISSION_DENIED
          ? 'Accès à ta position refusé. Autorise la localisation pour ce site dans les réglages du navigateur.'
          : 'Position introuvable pour le moment. Réessaie à découvert.'
      }
      stopLocating()
    },
    { enableHighAccuracy: true, maximumAge: 0, timeout: GPS_MAX_MS },
  )
  watchTimer = setTimeout(() => {
    if (!position.value) locateError.value = 'Position introuvable pour le moment. Réessaie à découvert.'
    stopLocating()
  }, GPS_MAX_MS)
}

onBeforeUnmount(stopLocating)

/* ---- Commentaire et envoi ---- */
const comment = ref('')
const submitting = ref(false)
const submitError = ref<string | null>(null)

const hasAnswer = computed(() => files.value.length > 0 || !!text.value.trim() || !!position.value)

async function send() {
  if (!hasAnswer.value || submitting.value) return
  submitting.value = true
  submitError.value = null
  try {
    const result = await submit({
      mission: props.mission,
      gameId: props.gameId,
      teamId: props.teamId,
      text: accepts.value.text ? text.value : '',
      position: accepts.value.gps ? position.value : null,
      comment: comment.value,
      files: files.value,
    })
    reset()
    emit('submitted', result)
  }
  catch (e) {
    submitError.value = (e as Error).message
  }
  finally {
    submitting.value = false
  }
}

function reset() {
  for (const f of files.value) URL.revokeObjectURL(f.previewUrl)
  files.value = []
  text.value = ''
  position.value = null
  comment.value = ''
  fileErrors.value = []
}

onBeforeUnmount(() => {
  for (const f of files.value) URL.revokeObjectURL(f.previewUrl)
})

const commentPlaceholder = computed(() =>
  props.mission.bonus_label ? `Signale ici le bonus réalisé (${props.mission.bonus_label.toLowerCase()})` : 'Une précision pour l’organisateur ?',
)
</script>

<template>
  <form class="answer" @submit.prevent="send">
    <!-- Photo / vidéo -->
    <template v-if="acceptsMedia">
      <div class="capture" :class="{ 'capture--double': accepts.photo && accepts.video }">
        <button v-if="accepts.photo" type="button" class="capture__btn" :disabled="submitting" @click="photoInput?.click()">
          <Camera :size="28" aria-hidden="true" />
          Prendre une photo
        </button>
        <button v-if="accepts.video" type="button" class="capture__btn" :disabled="submitting" @click="videoInput?.click()">
          <Video :size="28" aria-hidden="true" />
          Filmer une vidéo
        </button>
      </div>
      <AppButton variant="outline" block :disabled="submitting" @click="galleryInput?.click()">
        <Images :size="18" aria-hidden="true" /> Choisir dans la galerie
      </AppButton>
      <p v-if="accepts.video" class="hint">
        Vidéo : choisis « Prendre une vidéo » (ou la caméra) dans le menu qui s’ouvre.
        {{ MEDIA_LIMITS.maxVideoSeconds }} s et {{ formatBytes(MEDIA_LIMITS.maxVideoBytes) }} maximum.
      </p>

      <input ref="photoInput" class="visually-hidden" type="file" accept="image/*" capture="environment" tabindex="-1" @change="onFilesPicked">
      <!-- Pas d'attribut capture pour la vidéo : certains appareils ouvrent alors la caméra
           en mode photo uniquement. Sans lui, le téléphone propose « Prendre une vidéo ». -->
      <input ref="videoInput" class="visually-hidden" type="file" accept="video/*" tabindex="-1" @change="onFilesPicked">
      <input ref="galleryInput" class="visually-hidden" type="file" :accept="galleryAccept" multiple tabindex="-1" @change="onFilesPicked">

      <p v-if="preparing" class="hint">Préparation des fichiers…</p>
      <ul v-if="fileErrors.length" class="errors">
        <li v-for="err in fileErrors" :key="err">{{ err }}</li>
      </ul>

      <ul v-if="files.length" class="thumbs">
        <li v-for="f in files" :key="f.id" class="thumb">
          <img v-if="f.kind === 'photo'" :src="f.previewUrl" alt="">
          <template v-else>
            <video :src="f.previewUrl" muted playsinline preload="metadata" />
            <span class="thumb__badge"><Video :size="12" aria-hidden="true" /> {{ f.duration ? `${Math.round(f.duration)} s` : 'vidéo' }}</span>
          </template>
          <button type="button" class="thumb__remove" :aria-label="`Retirer ${f.name}`" :disabled="submitting" @click="removeFile(f.id)">
            <X :size="16" aria-hidden="true" />
          </button>
        </li>
      </ul>
    </template>

    <!-- Texte -->
    <div v-if="accepts.text" class="field">
      <label class="field__label" for="answer-text">Ta réponse</label>
      <textarea id="answer-text" v-model="text" class="input" rows="2" :disabled="submitting" placeholder="Écris ta réponse ici" />
    </div>

    <!-- Position -->
    <div v-if="accepts.gps" class="gps">
      <template v-if="locating && position">
        <div class="gps__refining" role="status">
          <MapPin :size="20" aria-hidden="true" />
          <span>Précision en cours d’amélioration : ± {{ Math.round(position.accuracy) }} m…</span>
        </div>
        <AppButton variant="outline" block @click="stopLocating">Utiliser cette position</AppButton>
      </template>
      <template v-else-if="position">
        <div class="gps__done">
          <Check :size="20" aria-hidden="true" />
          <span>Position obtenue <span class="gps__accuracy">(précision ± {{ Math.round(position.accuracy) }} m)</span></span>
        </div>
        <div class="gps__actions">
          <AppButton variant="outline" :disabled="submitting" @click="locate">
            <RefreshCw :size="16" aria-hidden="true" /> Actualiser
          </AppButton>
          <AppButton variant="outline" :disabled="submitting" @click="position = null">Retirer</AppButton>
        </div>
      </template>
      <button v-else type="button" class="capture__btn capture__btn--full" :disabled="locating || submitting" @click="locate">
        <MapPin :size="28" aria-hidden="true" />
        {{ locating ? 'Localisation en cours…' : 'Envoyer ma position' }}
      </button>
      <p v-if="position && !locating && position.accuracy > 50" class="hint">
        Précision faible : si possible, sors à découvert puis actualise. Sinon, l’organisateur vérifiera ta réponse lui-même.
      </p>
      <p v-if="locateError" class="field__error">{{ locateError }}</p>
    </div>

    <!-- Commentaire -->
    <div class="field">
      <label class="field__label" for="answer-comment">Commentaire pour l’organisateur</label>
      <textarea id="answer-comment" v-model="comment" class="input" rows="3" :disabled="submitting" :placeholder="commentPlaceholder" />
    </div>

    <div v-if="progress" class="progress" role="status">
      <span>{{ progress.label }}</span>
      <div class="progress__bar" :class="{ 'progress__bar--indeterminate': progress.percent === null }">
        <span :style="progress.percent !== null ? { width: `${progress.percent}%` } : undefined" />
      </div>
    </div>

    <p v-if="submitError" class="form-error" role="alert">{{ submitError }}</p>

    <AppButton type="submit" size="lg" block :disabled="!hasAnswer || preparing || locating" :loading="submitting">
      {{ submitting ? 'Envoi…' : 'Envoyer la réponse' }}
    </AppButton>
  </form>
</template>

<style scoped>
.answer {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.capture {
  display: grid;
  gap: var(--space-3);
}

.capture--double {
  grid-template-columns: 1fr 1fr;
}

.capture__btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  min-height: 120px;
  padding: var(--space-4);
  border: 2px dashed var(--color-primary);
  border-radius: var(--card-radius);
  background: var(--color-primary-soft);
  color: var(--color-primary);
  font-size: 1.0625rem;
  font-weight: 700;
}

.capture__btn:disabled {
  opacity: 0.6;
}

.capture__btn--full {
  width: 100%;
}

.hint {
  color: var(--color-text-muted);
  font-size: 0.875rem;
}

.errors {
  margin: 0;
  padding-left: var(--space-5);
  color: var(--status-refused-fg);
  font-size: 0.9375rem;
  font-weight: 500;
}

.thumbs {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(96px, 1fr));
  gap: var(--space-2);
  margin: 0;
  padding: 0;
  list-style: none;
}

.thumb {
  position: relative;
  aspect-ratio: 1;
  overflow: hidden;
  border-radius: var(--radius-md);
  background: var(--color-muted-surface);
}

.thumb img,
.thumb video {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.thumb__badge {
  position: absolute;
  bottom: 6px;
  left: 6px;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 6px;
  border-radius: var(--radius-pill);
  background: var(--color-text);
  color: var(--color-surface);
  font-size: 0.75rem;
  font-weight: 600;
}

.thumb__remove {
  position: absolute;
  top: 6px;
  right: 6px;
  display: grid;
  place-items: center;
  width: 30px;
  height: 30px;
  border: none;
  border-radius: 50%;
  background: var(--color-text);
  color: var(--color-surface);
}

.gps {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.gps__done {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-4);
  border-radius: var(--card-radius);
  background: var(--status-validated-bg);
  color: var(--status-validated-fg);
  font-weight: 700;
}

.gps__refining {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-4);
  border-radius: var(--card-radius);
  background: var(--status-pending-bg);
  color: var(--status-pending-fg);
  font-weight: 600;
}

.gps__accuracy {
  font-weight: 500;
}

.gps__actions {
  display: flex;
  gap: var(--space-2);
}

.progress {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  font-weight: 600;
}

.progress__bar {
  height: 8px;
  overflow: hidden;
  border-radius: var(--radius-pill);
  background: var(--color-muted-surface);
}

.progress__bar span {
  display: block;
  height: 100%;
  background: var(--color-primary);
  transition: width 0.2s;
}

.progress__bar--indeterminate span {
  width: 35%;
  animation: indeterminate 1.1s ease-in-out infinite;
}

@keyframes indeterminate {
  from { transform: translateX(-100%); }
  to { transform: translateX(300%); }
}
</style>
