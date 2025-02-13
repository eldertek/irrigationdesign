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
          :y1="padding"
          x2="0"
          :y2="height - padding"
          stroke="#666"
          stroke-width="1"
        />
        <text
          v-for="tick in yTicks"
          :key="tick.value"
          x="-5"
          :y="tick.y"
          class="text-xs fill-gray-500"
          text-anchor="end"
          alignment-baseline="middle"
        >
          {{ tick.value }}m
        </text>

        <!-- Axe X (distance) -->
        <line
          x1="padding"
          :y1="height - padding"
          :x2="width - padding"
          :y2="height - padding"
          stroke="#666"
          stroke-width="1"
        />
        <text
          v-for="tick in xTicks"
          :key="tick.value"
          :x="tick.x"
          :y="height - padding + 15"
          class="text-xs fill-gray-500"
          text-anchor="middle"
        >
          {{ formatDistance(tick.value) }}
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

const padding = 20
const leftPadding = 40

const tooltip = ref({
  show: false,
  x: 0,
  y: 0,
  pointIndex: 0,
  distance: 0,
  elevation: 0
})

// Échelles
const xScale = computed(() => {
  const maxDistance = props.points[props.points.length - 1].distance
  return (props.width - leftPadding - padding) / maxDistance
})

const yScale = computed(() => {
  const range = props.maxElevation - props.minElevation
  return (props.height - 2 * padding) / range
})

// Points mis à l'échelle
const scaledPoints = computed(() => {
  return props.points.map(point => ({
    x: point.distance * xScale.value + leftPadding,
    y: props.height - padding - (point.elevation - props.minElevation) * yScale.value
  }))
})

// Données du chemin SVG
const pathData = computed(() => {
  return scaledPoints.value.reduce((path, point, i) => {
    return path + (i === 0 ? 'M' : 'L') + point.x + ',' + point.y
  }, '')
})

// Graduations Y
const yTicks = computed(() => {
  const numTicks = 5
  const step = Math.ceil((props.maxElevation - props.minElevation) / (numTicks - 1))
  const ticks = []
  
  for (let i = 0; i < numTicks; i++) {
    const value = Math.min(props.minElevation + i * step, props.maxElevation)
    ticks.push({
      value,
      y: props.height - padding - (value - props.minElevation) * yScale.value
    })
  }
  
  return ticks
})

// Graduations X
const xTicks = computed(() => {
  const maxDistance = props.points[props.points.length - 1].distance
  const numTicks = 4
  const step = Math.ceil(maxDistance / numTicks)
  const ticks = []
  
  for (let i = 0; i <= numTicks; i++) {
    const value = i * step
    if (value <= maxDistance) {
      ticks.push({
        value,
        x: value * xScale.value + leftPadding
      })
    }
  }
  
  return ticks
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
</style> 