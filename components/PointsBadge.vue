<script setup lang="ts">
defineProps<{ points: number }>()
</script>

<template>
  <span class="points">{{ points }} pts</span>
</template>

<style scoped>
.points {
  display: inline-block;
  padding: 4px 10px;
  border-radius: var(--badge-points-radius);
  background: var(--badge-points-bg);
  color: var(--badge-points-fg);
  font-family: var(--font-heading);
  font-weight: 700;
  font-size: 1rem;
  line-height: 1.2;
  white-space: nowrap;
}
</style>
