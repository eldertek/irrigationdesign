<template>
  <div class="shape-info bg-white shadow-lg rounded-lg p-4 absolute bottom-4 left-4 z-10 max-w-md">
    <div v-if="selectedShape" class="space-y-4">
      <div class="flex justify-between items-start">
        <h3 class="text-lg font-medium text-gray-900">
          {{ getShapeTitle(selectedShape.type) }}
        </h3>
        <button
          @click="$emit('close')"
          class="text-gray-400 hover:text-gray-500"
        >
          <span class="sr-only">Fermer</span>
          <svg class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
            <path
              fill-rule="evenodd"
              d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
              clip-rule="evenodd"
            />
          </svg>
        </button>
      </div>

      <!-- Dimensions -->
      <div class="grid grid-cols-2 gap-4">
        <template v-if="selectedShape.type === 'rectangle'">
          <div>
            <label class="text-sm font-medium text-gray-700">Largeur</label>
            <p class="mt-1 text-sm text-gray-900">{{ formatDistance(selectedShape.width) }}</p>
          </div>
          <div>
            <label class="text-sm font-medium text-gray-700">Longueur</label>
            <p class="mt-1 text-sm text-gray-900">{{ formatDistance(selectedShape.length) }}</p>
          </div>
        </template>

        <template v-if="selectedShape.type === 'circle'">
          <div>
            <label class="text-sm font-medium text-gray-700">Rayon</label>
            <p class="mt-1 text-sm text-gray-900">{{ formatDistance(selectedShape.radius) }}</p>
          </div>
          <div>
            <label class="text-sm font-medium text-gray-700">Diamètre</label>
            <p class="mt-1 text-sm text-gray-900">{{ formatDistance(selectedShape.radius * 2) }}</p>
          </div>
        </template>

        <template v-if="selectedShape.type === 'semicircle'">
          <div>
            <label class="text-sm font-medium text-gray-700">Rayon</label>
            <p class="mt-1 text-sm text-gray-900">{{ formatDistance(selectedShape.radius) }}</p>
          </div>
          <div>
            <label class="text-sm font-medium text-gray-700">Orientation</label>
            <p class="mt-1 text-sm text-gray-900">{{ selectedShape.orientation }}°</p>
          </div>
        </template>

        <template v-if="selectedShape.type === 'line'">
          <div>
            <label class="text-sm font-medium text-gray-700">Longueur</label>
            <p class="mt-1 text-sm text-gray-900">{{ formatDistance(selectedShape.length) }}</p>
          </div>
          <div v-if="selectedShape.elevation">
            <label class="text-sm font-medium text-gray-700">Dénivelé</label>
            <p class="mt-1 text-sm text-gray-900">{{ formatDistance(selectedShape.elevation) }}</p>
          </div>
        </template>
      </div>

      <!-- Surface -->
      <div v-if="hasArea(selectedShape.type)">
        <label class="text-sm font-medium text-gray-700">Surface</label>
        <p class="mt-1 text-sm text-gray-900">{{ formatArea(selectedShape.area) }}</p>
      </div>

      <!-- Profil altimétrique pour les lignes -->
      <div v-if="selectedShape.type === 'line' && selectedShape.elevation" class="mt-4">
        <h4 class="text-sm font-medium text-gray-700 mb-2">Profil altimétrique</h4>
        <div class="h-32 bg-gray-50 rounded-lg p-2">
          <!-- Ici, nous ajouterons le graphique du profil altimétrique -->
          <elevation-profile
            :points="selectedShape.elevationProfile"
            :min-elevation="selectedShape.minElevation"
            :max-elevation="selectedShape.maxElevation"
          />
        </div>
      </div>

      <!-- Actions -->
      <div class="flex space-x-3 mt-4 pt-4 border-t border-gray-200">
        <button
          @click="$emit('edit')"
          class="flex-1 bg-white text-gray-700 px-4 py-2 border border-gray-300 rounded-md text-sm hover:bg-gray-50 transition-colors"
        >
          Modifier
        </button>
        <button
          @click="$emit('delete')"
          class="flex-1 bg-red-600 text-white px-4 py-2 rounded-md text-sm hover:bg-red-700 transition-colors"
        >
          Supprimer
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import ElevationProfile from './ElevationProfile.vue'

const props = defineProps({
  selectedShape: {
    type: Object,
    required: true
  },
  units: {
    type: String,
    default: 'metric'
  }
})

const emit = defineEmits(['close', 'edit', 'delete'])

function getShapeTitle(type: string): string {
  const titles = {
    rectangle: 'Rectangle',
    circle: 'Cercle',
    semicircle: 'Demi-cercle',
    line: 'Ligne',
    connection: 'Connexion'
  }
  return titles[type] || 'Forme'
}

function hasArea(type: string): boolean {
  return ['rectangle', 'circle', 'semicircle'].includes(type)
}

function formatDistance(value: number): string {
  if (props.units === 'imperial') {
    return `${(value * 3.28084).toFixed(2)} ft`
  }
  return `${value.toFixed(2)} m`
}

function formatArea(value: number): string {
  if (props.units === 'imperial') {
    return `${(value * 10.7639).toFixed(2)} ft²`
  }
  return `${value.toFixed(2)} m²`
}
</script>

<style scoped>
.shape-info {
  width: 400px;
}
</style> 