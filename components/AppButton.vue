<script setup lang="ts">
import type { RouteLocationRaw } from 'vue-router'

const props = withDefaults(defineProps<{
  variant?: 'primary' | 'secondary' | 'outline' | 'dark' | 'danger'
  size?: 'md' | 'lg'
  block?: boolean
  to?: RouteLocationRaw
  type?: 'button' | 'submit'
  disabled?: boolean
  loading?: boolean
}>(), {
  variant: 'primary',
  size: 'md',
  type: 'button',
})

const tag = computed(() => (props.to ? resolveComponent('NuxtLink') : 'button'))
</script>

<template>
  <component
    :is="tag"
    :to="to"
    :type="to ? undefined : type"
    :disabled="to ? undefined : disabled || loading"
    class="btn"
    :class="[`btn--${variant}`, `btn--${size}`, { 'btn--block': block, 'btn--loading': loading }]"
  >
    <slot />
  </component>
</template>

<style scoped>
.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  min-height: var(--tap-min);
  padding: 0 var(--space-5);
  border: 1px solid transparent;
  border-radius: var(--radius-md);
  font-family: var(--font-body);
  font-weight: 600;
  font-size: 1rem;
  text-decoration: none;
  transition: filter 0.15s, transform 0.1s;
}

.btn:active:not(:disabled) {
  transform: scale(0.98);
}

.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn--lg {
  min-height: 52px;
  font-size: 1.0625rem;
}

.btn--block {
  display: flex;
  width: 100%;
}

.btn--loading {
  cursor: progress;
}

.btn--primary {
  background: var(--color-primary);
  color: var(--color-on-primary);
}

.btn--secondary {
  background: var(--color-secondary);
  color: var(--color-on-secondary);
}

.btn--dark {
  background: var(--color-text);
  color: var(--color-surface);
}

.btn--outline {
  background: var(--color-surface);
  color: var(--color-text);
  border-color: var(--color-border);
}

.btn--danger {
  background: var(--color-surface);
  color: var(--status-refused-fg);
  border-color: color-mix(in srgb, var(--status-refused-fg) 45%, transparent);
}

.btn--primary:hover:not(:disabled),
.btn--secondary:hover:not(:disabled),
.btn--dark:hover:not(:disabled) {
  filter: brightness(1.08);
}
</style>
