<script setup lang="ts">
const props = defineProps<{ teamId: string; to?: string }>()

const { positionOf } = useLeaderboard()
const position = computed(() => positionOf(props.teamId))
</script>

<template>
  <NuxtLink
    v-if="position"
    :to="to"
    class="rank"
    :aria-label="`Classement : ${ordinal(position.rank)} sur ${position.total}`"
  >
    {{ ordinal(position.rank) }} / {{ position.total }}
  </NuxtLink>
</template>

<style scoped>
.rank {
  flex: none;
  padding: var(--space-1) var(--space-3);
  border-radius: var(--radius-pill);
  background: var(--color-text);
  color: var(--color-surface);
  font-size: 0.9375rem;
  font-weight: 700;
  text-decoration: none;
  white-space: nowrap;
  font-variant-numeric: tabular-nums;
}
</style>
