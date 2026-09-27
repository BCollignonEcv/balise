<script setup lang="ts">
defineProps<{ label: string; hint?: string }>()
const model = defineModel<boolean>({ required: true })
</script>

<template>
  <label class="switch">
    <span class="switch__text">
      <span class="switch__label">{{ label }}</span>
      <span v-if="hint" class="switch__hint">{{ hint }}</span>
    </span>
    <input v-model="model" class="switch__input" type="checkbox" role="switch">
    <span class="switch__track" aria-hidden="true"><span class="switch__thumb" /></span>
  </label>
</template>

<style scoped>
.switch {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
  min-height: var(--tap-min);
  cursor: pointer;
}

.switch__text {
  display: flex;
  flex-direction: column;
}

.switch__label {
  font-weight: 600;
}

.switch__hint {
  color: var(--color-text-muted);
  font-size: 0.8125rem;
}

.switch__input {
  position: absolute;
  opacity: 0;
  pointer-events: none;
}

.switch__track {
  position: relative;
  flex: none;
  width: 48px;
  height: 28px;
  border-radius: var(--radius-pill);
  background: var(--color-border);
  transition: background 0.15s;
}

.switch__thumb {
  position: absolute;
  top: 3px;
  left: 3px;
  width: 22px;
  height: 22px;
  border-radius: 50%;
  background: var(--color-surface);
  box-shadow: 0 1px 3px rgb(0 0 0 / 0.2);
  transition: transform 0.15s;
}

.switch__input:checked + .switch__track {
  background: var(--color-secondary);
}

.switch__input:checked + .switch__track .switch__thumb {
  transform: translateX(20px);
}

.switch__input:focus-visible + .switch__track {
  outline: 2px solid var(--color-secondary);
  outline-offset: 2px;
}
</style>
