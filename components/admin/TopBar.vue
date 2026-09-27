<script setup lang="ts">
import { ChevronLeft, LogOut } from '@lucide/vue'
import type { RouteLocationRaw } from 'vue-router'

defineProps<{
  title: string
  subtitle?: string
  back?: { to: RouteLocationRaw; label: string }
}>()

const { signOut } = useAdminAuth()

async function logout() {
  await signOut()
  await navigateTo('/admin/login')
}
</script>

<template>
  <header class="topbar">
    <div class="topbar__row">
      <NuxtLink v-if="back" :to="back.to" class="topbar__back">
        <ChevronLeft :size="18" aria-hidden="true" /> {{ back.label }}
      </NuxtLink>
      <span v-else class="topbar__kicker">Admin</span>
      <button type="button" class="topbar__logout" @click="logout">
        <LogOut :size="16" aria-hidden="true" /> Déconnexion
      </button>
    </div>
    <div class="topbar__title-row">
      <div>
        <h1 class="topbar__title">{{ title }}</h1>
        <p v-if="subtitle" class="topbar__subtitle">{{ subtitle }}</p>
      </div>
      <slot name="aside" />
    </div>
  </header>
</template>

<style scoped>
.topbar {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  padding: var(--space-4) 0 var(--space-2);
}

.topbar__row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
}

.topbar__kicker {
  color: var(--color-text-muted);
  font-size: 0.75rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.topbar__back {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
  min-height: var(--tap-min);
  color: var(--color-text);
  font-weight: 600;
  text-decoration: none;
}

.topbar__logout {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
  min-height: var(--tap-min);
  padding: 0 var(--space-2);
  border: none;
  background: none;
  color: var(--color-text-muted);
  font-size: 0.875rem;
}

.topbar__title-row {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--space-3);
}

.topbar__title {
  font-family: var(--font-body);
  font-size: 1.625rem;
  font-weight: 700;
}

.topbar__subtitle {
  margin-top: var(--space-1);
  color: var(--color-text-muted);
  font-size: 0.9375rem;
}
</style>
