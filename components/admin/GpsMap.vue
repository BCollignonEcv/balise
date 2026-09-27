<script setup lang="ts">
import 'leaflet/dist/leaflet.css'
import { Target, User } from '@lucide/vue'
import type { Layer, Map as LeafletMap } from 'leaflet'

/**
 * Position envoyée par l'équipe (point orange + marge d'erreur) et, si connue,
 * la cible de la mission (point vert + rayon de tolérance en pointillés),
 * reliées par un trait indiquant la distance.
 */
const props = defineProps<{
  lat: number
  lng: number
  accuracy?: number | null
  target?: { lat: number; lng: number; radius: number } | null
  distance?: number | null
}>()

const el = ref<HTMLElement | null>(null)
let map: LeafletMap | null = null

/** Icônes Lucide « user » et « target » (SVG brut : Leaflet insère du HTML, pas des composants Vue). */
const svg = (body: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`
const ICONS = {
  team: svg('<path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>'),
  target: svg('<circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>'),
}

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
  const teamColor = styles.getPropertyValue('--color-primary').trim() || '#C2410C'
  const targetColor = styles.getPropertyValue('--color-secondary').trim() || '#0F5E63'

  /** Pastille ronde avec icône, centrée sur le point. */
  const pin = (variant: 'team' | 'target', title: string) => L.divIcon({
    className: 'gps-pin-anchor',
    html: `<span class="gps-pin gps-pin--${variant}" title="${title}">${ICONS[variant]}</span>`,
    iconSize: [0, 0],
  })

  const layers: Layer[] = []
  const team: [number, number] = [props.lat, props.lng]

  if (props.target) {
    const target: [number, number] = [props.target.lat, props.target.lng]
    layers.push(
      L.circle(target, {
        radius: props.target.radius, color: targetColor, weight: 2, dashArray: '8 6', fillColor: targetColor, fillOpacity: 0.12,
      }),
      L.polyline([team, target], { color: styles.getPropertyValue('--color-text').trim() || '#1F2A24', weight: 3, dashArray: '4 7', opacity: 0.85 }),
      L.marker(target, { icon: pin('target', 'Cible'), keyboard: false }),
    )
  }
  if (props.accuracy) {
    layers.push(L.circle(team, { radius: props.accuracy, color: teamColor, weight: 1, fillColor: teamColor, fillOpacity: 0.15 }))
  }
  layers.push(L.marker(team, { icon: pin('team', 'Position envoyée'), keyboard: false, zIndexOffset: 1000 }))

  const group = L.featureGroup(layers).addTo(map)
  map.fitBounds(group.getBounds(), { padding: [36, 36], maxZoom: 18 })
})

onBeforeUnmount(() => {
  map?.remove()
  map = null
})
</script>

<template>
  <figure class="gps">
    <div ref="el" class="gps__map" role="img" aria-label="Carte : position envoyée par l’équipe et cible de la mission" />
    <figcaption class="gps__legend">
      <span class="legend">
        <span class="pin pin--team" aria-hidden="true"><User :size="13" :stroke-width="2.5" /></span>
        Position envoyée<template v-if="accuracy"> (± {{ Math.round(accuracy) }} m)</template>
      </span>
      <span v-if="target" class="legend">
        <span class="pin pin--target" aria-hidden="true"><Target :size="13" :stroke-width="2.5" /></span>
        Cible (rayon {{ target.radius }} m)
      </span>
      <span v-if="target && distance != null" class="legend legend--distance">
        Distance : <strong>{{ Math.round(distance) }} m</strong>
      </span>
    </figcaption>
  </figure>
</template>

<style scoped>
.gps {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  margin: 0;
}

.gps__map {
  z-index: 0;
  width: 100%;
  aspect-ratio: 16 / 10;
  overflow: hidden;
  border-radius: var(--radius-md);
  background: var(--color-muted-surface);
}

/* Pastilles créées par Leaflet : hors du rendu Vue, d'où :deep() */
.gps__map :deep(.gps-pin-anchor) {
  overflow: visible;
}

.gps__map :deep(.gps-pin),
.pin {
  display: grid;
  place-items: center;
  width: 32px;
  height: 32px;
  border: 3px solid var(--color-surface);
  border-radius: 50%;
  box-shadow: 0 1px 4px rgb(0 0 0 / 0.35);
}

.gps__map :deep(.gps-pin) {
  position: absolute;
  left: 0;
  top: 0;
  transform: translate(-50%, -50%);
}

.gps__map :deep(.gps-pin--team),
.pin--team {
  background: var(--color-primary);
  color: var(--color-on-primary);
}

.gps__map :deep(.gps-pin--target),
.pin--target {
  background: var(--color-secondary);
  color: var(--color-on-secondary);
}

.pin {
  flex: none;
  width: 24px;
  height: 24px;
  border-width: 2px;
}

.gps__legend {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-1) var(--space-4);
  font-size: 0.8125rem;
}

.legend {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
}

.legend--distance {
  margin-left: auto;
}
</style>
