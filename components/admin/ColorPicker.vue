<script setup lang="ts">
defineProps<{ colors: string[]; label?: string }>()
const model = defineModel<string>({ required: true })
</script>

<template>
  <div class="colors" role="radiogroup" :aria-label="label ?? 'Couleur'">
    <button
      v-for="c in colors"
      :key="c"
      type="button"
      role="radio"
      class="colors__swatch"
      :class="{ 'is-active': model.toLowerCase() === c.toLowerCase() }"
      :style="{ background: c }"
      :aria-checked="model.toLowerCase() === c.toLowerCase()"
      :aria-label="c"
      @click="model = c"
    />
    <label class="colors__custom" title="Autre couleur">
      <input v-model="model" type="color" aria-label="Autre couleur">
    </label>
  </div>
</template>

<style scoped>
.colors {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
}

.colors__swatch,
.colors__custom {
  width: 32px;
  height: 32px;
  border: 2px solid var(--color-surface);
  border-radius: 50%;
  box-shadow: 0 0 0 1px var(--color-border);
}

.colors__swatch.is-active {
  box-shadow: 0 0 0 2px var(--color-text);
}

.colors__custom {
  position: relative;
  overflow: hidden;
  background: conic-gradient(red, yellow, lime, cyan, blue, magenta, red);
  cursor: pointer;
}

.colors__custom input {
  position: absolute;
  inset: 0;
  opacity: 0;
  cursor: pointer;
}
</style>
