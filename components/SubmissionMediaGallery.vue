<script setup lang="ts">
import type { SubmissionMedia } from '~/types/database'

/**
 * Photos et vidéos d'une soumission (stockage privé : liens signés temporaires).
 */
const props = withDefaults(defineProps<{
  media: SubmissionMedia[]
  client?: 'player' | 'admin'
  size?: 'sm' | 'lg'
}>(), { client: 'player', size: 'sm' })

const urls = ref<Record<string, string>>({})
const failed = ref(false)

async function sign() {
  const paths = props.media.map(m => m.path).filter(p => !urls.value[p])
  if (!paths.length) return
  const supabase = props.client === 'admin' ? useAdminSupabase() : usePlayerSupabase()
  const { data, error } = await supabase.storage.from(SUBMISSIONS_BUCKET).createSignedUrls(paths, 60 * 60)
  if (error) {
    failed.value = true
    return
  }
  const next = { ...urls.value }
  for (const item of data) if (item.path && item.signedUrl) next[item.path] = item.signedUrl
  urls.value = next
}

watch(() => props.media.map(m => m.path).join('|'), sign, { immediate: true })
</script>

<template>
  <div v-if="media.length" class="gallery" :class="`gallery--${size}`">
    <p v-if="failed" class="gallery__error">Impossible d’afficher les fichiers.</p>
    <template v-for="m in media" :key="m.id">
      <a
        v-if="m.kind === 'photo'"
        class="gallery__item"
        :class="{ placeholder: !urls[m.path] }"
        :href="urls[m.path]"
        target="_blank"
        rel="noopener"
        aria-label="Ouvrir la photo en grand"
      >
        <img v-if="urls[m.path]" :src="urls[m.path]" alt="" loading="lazy">
      </a>
      <div v-else class="gallery__item gallery__item--video" :class="{ placeholder: !urls[m.path] }">
        <video v-if="urls[m.path]" :src="urls[m.path]" controls playsinline preload="metadata" />
      </div>
    </template>
  </div>
</template>

<style scoped>
.gallery {
  display: grid;
  gap: var(--space-2);
}

.gallery--sm {
  grid-template-columns: repeat(auto-fill, minmax(88px, 1fr));
}

.gallery--lg {
  grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
}

.gallery__item {
  display: block;
  aspect-ratio: 1;
  overflow: hidden;
  border-radius: var(--radius-md);
}

.gallery__item--video {
  grid-column: 1 / -1;
  aspect-ratio: 16 / 9;
  background: var(--color-text);
}

.gallery__item img,
.gallery__item video {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.gallery__item video {
  object-fit: contain;
}

.gallery__error {
  grid-column: 1 / -1;
  color: var(--status-refused-fg);
  font-size: 0.875rem;
}
</style>
