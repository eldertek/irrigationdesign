<template>
  <div class="elevation-profile">
    <svg
      :width="width"
      :height="height"
      :viewBox="`0 0 ${width} ${height}`"
      class="w-full h-full"
    >
      <!-- Grille de fond -->
      <g class="grid">
        <line
          v-for="y in gridLines"
          :key="'h' + y"
          x1="0"
          :x2="width"
          :y1="y"
          :y2="y"
          class="stroke-gray-200"
          stroke-dasharray="4,4"
        />
        <line
          v-for="x in 5"
          :key="'v' + x"
          :x1="(width / 4) * (x - 1)"
          :x2="(width / 4) * (x - 1)"
          y1="0"
          :y2="height"
          class="stroke-gray-200"
          stroke-dasharray="4,4"
        />
      </g>

      <!-- Ligne du profil -->
      <path
        :d="pathData"
        fill="none"
        class="stroke-primary-500"
        stroke-width="2"
      />

      <!-- Points de mesure -->
      <g v-for="(point, index) in scaledPoints" :key="index">
        <circle
          :cx="point.x"
          :cy="point.y"
          r="3"
          class="fill-primary-500"
          @mouseenter="showTooltip(point, $event)"
          @mouseleave="hideTooltip"
        />
      </g>

      <!-- Axes -->
      <g class="axes">
        <!-- Axe Y (élévation) -->
        <line
          x1="0"
          y1="0"
          x2="0"
          :y2="height"
          class="stroke-gray-400"
        />
        <text
          v-for="label in elevationLabels"
          :key="label.value"
          x="-5"
          :y="label.y"
          class="text-xs fill-gray-500"
          text-anchor="end"
          alignment-baseline="middle"
        >
          {{ label.text }}
        </text>

        <!-- Axe X (distance) -->
        <line
          x1="0"
          :y1="height"
          :x2="width"
          :y2="height"
          class="stroke-gray-400"
        />
        <text
          v-for="label in distanceLabels"
          :key="label.value"
          :x="label.x"
          :y="height + 15"
          class="text-xs fill-gray-500"
          text-anchor="middle"
        >
          {{ label.text }}
        </text>
      </g>
    </svg>

    <!-- Tooltip -->
    <div
      v-if="tooltip.show"
      class="absolute bg-white shadow-lg rounded-md p-2 text-sm pointer-events-none"
      :style="tooltipStyle"
    >
      <p class="font-medium">Point {{ tooltip.pointIndex + 1 }}</p>
      <p>Distance : {{ formatDistance(tooltip.distance) }}</p>
      <p>Élévation : {{ formatElevation(tooltip.elevation) }}</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'

const props = defineProps({
  points: {
    type: Array as () => { distance: number; elevation: number }[],
    required: true
  },
  minElevation: {
    type: Number,
    required: true
  },
  maxElevation: {
    type: Number,
    required: true
  },
  width: {
    type: Number,
    default: 400
  },
  height: {
    type: Number,
    default: 200
  },
  units: {
    type: String,
    default: 'metric'
  }
})

const tooltip = ref({
  show: false,
  x: 0,
  y: 0,
  pointIndex: 0,
  distance: 0,
  elevation: 0
})

// Calcul des points mis à l'échelle
const scaledPoints = computed(() => {
  const xScale = props.width / Math.max(...props.points.map(p => p.distance))
  const yScale = props.height / (props.maxElevation - props.minElevation)

  return props.points.map(point => ({
    x: point.distance * xScale,
    y: props.height - (point.elevation - props.minElevation) * yScale,
    original: point
  }))
})

// Génération du chemin SVG
const pathData = computed(() => {
  if (scaledPoints.value.length < 2) return ''
  
  return scaledPoints.value.reduce((path, point, index) => {
    return path + (index === 0 ? 'M' : 'L') + `${point.x},${point.y}`
  }, '')
})

// Lignes de la grille
const gridLines = computed(() => {
  const count = 5
  const step = props.height / (count - 1)
  return Array.from({ length: count }, (_, i) => i * step)
})

// Étiquettes des axes
const elevationLabels = computed(() => {
  const count = 5
  const step = (props.maxElevation - props.minElevation) / (count - 1)
  return Array.from({ length: count }, (_, i) => ({
    value: props.minElevation + i * step,
    y: props.height - (i * props.height) / (count - 1),
    text: formatElevation(props.minElevation + i * step)
  }))
})

const distanceLabels = computed(() => {
  const count = 5
  const maxDistance = Math.max(...props.points.map(p => p.distance))
  const step = maxDistance / (count - 1)
  return Array.from({ length: count }, (_, i) => ({
    value: i * step,
    x: (i * props.width) / (count - 1),
    text: formatDistance(i * step)
  }))
})

// Gestion du tooltip
function showTooltip(point: any, event: MouseEvent) {
  const rect = (event.target as Element).getBoundingClientRect()
  tooltip.value = {
    show: true,
    x: rect.left + window.scrollX,
    y: rect.top + window.scrollY,
    pointIndex: props.points.findIndex(p => p === point.original),
    distance: point.original.distance,
    elevation: point.original.elevation
  }
}

function hideTooltip() {
  tooltip.value.show = false
}

const tooltipStyle = computed(() => ({
  left: `${tooltip.value.x}px`,
  top: `${tooltip.value.y - 70}px`
}))

// Formatage des valeurs
function formatDistance(value: number): string {
  if (props.units === 'imperial') {
    return `${(value * 3.28084).toFixed(1)} ft`
  }
  return `${value.toFixed(1)} m`
}

function formatElevation(value: number): string {
  if (props.units === 'imperial') {
    return `${(value * 3.28084).toFixed(1)} ft`
  }
  return `${value.toFixed(1)} m`
}
</script>

<style scoped>
.elevation-profile {
  position: relative;
  width: 100%;
  height: 100%;
}
</style> 