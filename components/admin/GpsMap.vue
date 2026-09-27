<script setup lang="ts">
import 'leaflet/dist/leaflet.css'
import type { Layer, Map as LeafletMap } from 'leaflet'

/**
 * Position envoyée par l'équipe (point + marge d'erreur) et, si connue,
 * la cible de la mission (point + rayon de tolérance en pointillés).
 */
const props = defineProps<{
  lat: number
  lng: number
  accuracy?: number | null
  target?: { lat: number; lng: number; radius: number } | null
}>()

const el = ref<HTMLElement | null>(null)
let map: LeafletMap | null = null

onMounted(async () => {
  const L = await import('leaflet')
  if (!el.value) return

  // Une vue initiale est indispensable avant d'ajouter des cercles (rayon en mètres).
  map = L.map(el.value, { zoomControl: true, attributionControl: true, scrollWheelZoom: false })
    .setView([props.lat, props.lng], 17)
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '© OpenStreetMap',
  }).addTo(map)

  const styles = getComputedStyle(el.value)
  const team = styles.getPropertyValue('--color-primary').trim() || '#C2410C'
  const target = styles.getPropertyValue('--color-secondary').trim() || '#0F5E63'
  const halo = styles.getPropertyValue('--color-surface').trim() || '#FFFDF8'

  const layers: Layer[] = []
  if (props.target) {
    layers.push(
      L.circle([props.target.lat, props.target.lng], {
        radius: props.target.radius, color: target, weight: 2, dashArray: '6 6', fillOpacity: 0.08,
      }),
      L.circleMarker([props.target.lat, props.target.lng], { radius: 5, color: target, fillOpacity: 1 }),
    )
  }
  if (props.accuracy) {
    layers.push(L.circle([props.lat, props.lng], { radius: props.accuracy, color: team, weight: 1, fillOpacity: 0.1 }))
  }
  layers.push(L.circleMarker([props.lat, props.lng], { radius: 7, color: halo, weight: 2, fillColor: team, fillOpacity: 1 }))

  const group = L.featureGroup(layers).addTo(map)
  map.fitBounds(group.getBounds(), { padding: [24, 24], maxZoom: 18 })
})

onBeforeUnmount(() => {
  map?.remove()
  map = null
})
</script>

<template>
  <div ref="el" class="gps-map" role="img" aria-label="Carte de la position envoyée" />
</template>

<style scoped>
.gps-map {
  z-index: 0;
  width: 100%;
  aspect-ratio: 16 / 10;
  overflow: hidden;
  border-radius: var(--radius-md);
  background: var(--color-muted-surface);
}
</style>
