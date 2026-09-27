<script setup lang="ts">
/**
 * Couleur d'un token : pastille (sélecteur natif) + code hexadécimal.
 * Si la valeur par défaut suit une autre couleur (« var(--…) »), un mode
 * « Auto » permet d'y revenir.
 */
const props = defineProps<{
  label: string
  /** Valeur par défaut du token (peut être « var(--color-…) »). */
  defaultValue: string
  /** Couleur effective affichée (valeur résolue en hexadécimal). */
  resolved: string
  /** Nom lisible de la couleur suivie en mode auto, ex. « primaire ». */
  autoLabel?: string
}>()

const model = defineModel<string>({ required: true })

const isAuto = computed(() => model.value.startsWith('var('))
const canBeAuto = computed(() => props.defaultValue.startsWith('var('))
const hexInput = ref(isAuto.value ? '' : model.value)

watch(model, (value) => {
  if (!value.startsWith('var(') && value.toLowerCase() !== hexInput.value.toLowerCase()) hexInput.value = value
})

function onHexInput(value: string) {
  hexInput.value = value
  const hex = value.startsWith('#') ? value : `#${value}`
  if (/^#[0-9a-f]{6}$/i.test(hex)) model.value = hex.toUpperCase()
}

function onPick(event: Event) {
  model.value = (event.target as HTMLInputElement).value.toUpperCase()
}
</script>

<template>
  <div class="color-field">
    <label class="color-field__swatch" :style="{ background: resolved }">
      <input type="color" :value="resolved" :aria-label="`Couleur : ${label}`" @input="onPick">
    </label>
    <span class="color-field__label">{{ label }}</span>
    <button
      v-if="canBeAuto && isAuto"
      type="button"
      class="color-field__auto"
      :title="`Suit la couleur ${autoLabel ?? ''}`"
      disabled
    >
      Auto<template v-if="autoLabel"> · {{ autoLabel }}</template>
    </button>
    <template v-else>
      <input
        class="input color-field__hex"
        type="text"
        :value="hexInput"
        maxlength="7"
        spellcheck="false"
        autocomplete="off"
        :aria-label="`Code couleur : ${label}`"
        @input="onHexInput(($event.target as HTMLInputElement).value)"
      >
      <button v-if="canBeAuto" type="button" class="color-field__reset" @click="model = defaultValue">Auto</button>
    </template>
  </div>
</template>

<style scoped>
.color-field {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  min-height: 52px;
}

.color-field__swatch {
  position: relative;
  flex: none;
  width: 40px;
  height: 40px;
  overflow: hidden;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  cursor: pointer;
}

.color-field__swatch input {
  position: absolute;
  inset: 0;
  opacity: 0;
  cursor: pointer;
}

.color-field__label {
  flex: 1;
  min-width: 0;
  font-weight: 600;
}

.color-field__hex {
  flex: none;
  width: 110px;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 0.9375rem;
  text-transform: uppercase;
}

.color-field__auto {
  padding: var(--space-2) var(--space-3);
  border: 1px dashed var(--color-border);
  border-radius: var(--radius-md);
  background: none;
  color: var(--color-text-muted);
  font-size: 0.8125rem;
  cursor: default;
}

.color-field__reset {
  padding: var(--space-2);
  border: none;
  background: none;
  color: var(--color-secondary);
  font-size: 0.8125rem;
  font-weight: 600;
}
</style>
