<script setup lang="ts">
import { LayoutGrid, Trophy, Users } from '@lucide/vue'

const props = defineProps<{ code: string }>()

const tabs = computed(() => [
  { to: `/j/${props.code}/missions`, label: 'Missions', icon: LayoutGrid },
  { to: `/j/${props.code}/classement`, label: 'Classement', icon: Trophy },
  { to: `/j/${props.code}/equipe`, label: 'Mon équipe', icon: Users },
])
</script>

<template>
  <nav class="tabbar" aria-label="Navigation">
    <NuxtLink v-for="tab in tabs" :key="tab.to" :to="tab.to" class="tabbar__tab" active-class="is-active">
      <component :is="tab.icon" :size="24" :stroke-width="1.75" aria-hidden="true" />
      <span>{{ tab.label }}</span>
    </NuxtLink>
  </nav>
</template>

<style scoped>
.tabbar {
  position: fixed;
  right: 0;
  bottom: 0;
  left: 0;
  z-index: 40;
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  padding: var(--space-2) var(--space-2) calc(var(--space-2) + env(safe-area-inset-bottom, 0px));
  border-top: 1px solid var(--color-border);
  background: var(--color-surface);
}

.tabbar__tab {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  min-height: 52px;
  justify-content: center;
  color: var(--color-text-muted);
  font-size: 0.875rem;
  font-weight: 500;
  text-decoration: none;
}

.tabbar__tab.is-active {
  color: var(--color-primary);
  font-weight: 700;
}
</style>
