<script setup lang="ts">
/** Image de thème : vignette + « Choisir » / « Retirer ». Émet le fichier choisi. */
defineProps<{
  label: string
  url: string | null
  hint?: string
  busy?: boolean
}>()

const emit = defineEmits<{ pick: [file: File]; clear: [] }>()
const input = ref<HTMLInputElement | null>(null)

function onChange(event: Event) {
  const target = event.target as HTMLInputElement
  const file = target.files?.[0]
  target.value = ''
  if (file) emit('pick', file)
}
</script>

<template>
  <div class="image-field">
    <div class="image-field__thumb" :class="{ placeholder: !url }">
      <img v-if="url" :src="url" alt="">
    </div>
    <div class="image-field__text">
      <span class="image-field__label">{{ label }}</span>
      <span v-if="hint" class="image-field__hint">{{ hint }}</span>
    </div>
    <div class="image-field__actions">
      <button v-if="url" type="button" class="image-field__clear" :disabled="busy" @click="emit('clear')">Retirer</button>
      <AppButton variant="outline" :loading="busy" @click="input?.click()">{{ busy ? '…' : 'Choisir' }}</AppButton>
    </div>
    <input ref="input" class="visually-hidden" type="file" accept="image/*" tabindex="-1" @change="onChange">
  </div>
</template>

<style scoped>
.image-field {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  min-height: 56px;
}

.image-field__thumb {
  flex: none;
  width: 44px;
  height: 44px;
  overflow: hidden;
  border-radius: var(--radius-sm);
}

.image-field__thumb img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.image-field__text {
  display: flex;
  flex: 1;
  flex-direction: column;
  min-width: 0;
}

.image-field__label {
  font-weight: 600;
}

.image-field__hint {
  color: var(--color-text-muted);
  font-size: 0.8125rem;
}

.image-field__actions {
  display: flex;
  flex: none;
  align-items: center;
  gap: var(--space-2);
}

.image-field__clear {
  padding: var(--space-2);
  border: none;
  background: none;
  color: var(--status-refused-fg);
  font-size: 0.8125rem;
  font-weight: 600;
}
</style>
