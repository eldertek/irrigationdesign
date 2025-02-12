<template>
  <div class="h-full flex">
    <!-- Barre latérale -->
    <div class="w-80 bg-white shadow-lg flex flex-col">
      <!-- En-tête de la barre latérale -->
      <div class="p-4 border-b border-gray-200">
        <div class="mb-4">
          <label for="search" class="sr-only">Rechercher une adresse</label>
          <div class="relative">
            <input
              type="text"
              id="search"
              v-model="searchQuery"
              class="input pl-10 pr-4 py-2"
              placeholder="Rechercher une adresse..."
              @keyup.enter="searchLocation"
            />
            <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <svg class="h-5 w-5 text-gray-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                <path fill-rule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clip-rule="evenodd" />
              </svg>
            </div>
          </div>
        </div>
      </div>

      <!-- Outils de dessin -->
      <div class="p-4 border-b border-gray-200">
        <h2 class="text-lg font-medium text-gray-900 mb-4">Outils de dessin</h2>
        <div class="space-y-4">
          <!-- Sélection du type de forme -->
          <div>
            <label for="shapeType" class="block text-sm font-medium text-gray-700">Type de forme</label>
            <select
              id="shapeType"
              v-model="selectedShape"
              class="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm rounded-md"
            >
              <option value="rectangle">Rectangle</option>
              <option value="circle">Cercle</option>
              <option value="semicircle">Demi-cercle</option>
              <option value="line">Ligne</option>
            </select>
          </div>

          <!-- Boutons d'action -->
          <div class="flex space-x-2">
            <button
              @click="startDrawing"
              class="flex-1 inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
            >
              <svg class="h-5 w-5 mr-2" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
              </svg>
              Dessiner
            </button>
            <button
              @click="cancelDrawing"
              class="inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
            >
              <svg class="h-5 w-5 mr-2" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd" />
              </svg>
              Annuler
            </button>
          </div>
        </div>
      </div>

      <!-- Liste des formes -->
      <div class="flex-1 p-4 overflow-y-auto">
        <h2 class="text-lg font-medium text-gray-900 mb-4">Formes dessinées</h2>
        <div class="space-y-2">
          <div
            v-for="shape in shapes"
            :key="shape.id"
            class="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100"
          >
            <div class="flex items-center">
              <span class="font-medium text-gray-900">{{ shape.type }}</span>
              <span class="ml-2 text-sm text-gray-500">{{ formatArea(shape.surface) }}</span>
            </div>
            <button
              @click="deleteShape(shape.id)"
              class="text-red-600 hover:text-red-800"
            >
              <svg class="h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                <path fill-rule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clip-rule="evenodd" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Carte -->
    <div class="flex-1">
      <MapComponent
        ref="mapComponent"
        @shape-created="handleShapeCreated"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import MapComponent from '@/components/MapComponent.vue'
import { useIrrigationStore } from '@/stores/irrigation'

const mapComponent = ref(null)
const searchQuery = ref('')
const selectedShape = ref('rectangle')
const shapes = ref([])
const irrigationStore = useIrrigationStore()

// Recherche d'adresse
async function searchLocation() {
  if (!searchQuery.value) return
  try {
    const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery.value)}`)
    const data = await response.json()
    if (data && data[0]) {
      mapComponent.value?.map.setView([data[0].lat, data[0].lon], 16)
    }
  } catch (error) {
    console.error('Erreur lors de la recherche d\'adresse:', error)
  }
}

// Gestion du dessin
function startDrawing() {
  if (!mapComponent.value?.map) return
  // Activer l'outil de dessin correspondant
  switch (selectedShape.value) {
    case 'rectangle':
      // Activer l'outil rectangle
      break
    case 'circle':
      // Activer l'outil cercle
      break
    case 'semicircle':
      // Activer l'outil demi-cercle
      break
    case 'line':
      // Activer l'outil ligne
      break
  }
}

function cancelDrawing() {
  if (!mapComponent.value?.map) return
  // Désactiver l'outil de dessin actif
}

function deleteShape(shapeId: number) {
  // Supprimer la forme
  shapes.value = shapes.value.filter(s => s.id !== shapeId)
}

function handleShapeCreated(shape: any) {
  shapes.value.push(shape)
}

function formatArea(surface: number | undefined): string {
  if (!surface) return ''
  return `${surface.toFixed(2)} m²`
}

onMounted(async () => {
  // Charger les formes existantes si un plan est sélectionné
  if (irrigationStore.currentPlan) {
    const response = await irrigationStore.getShapes(irrigationStore.currentPlan.id)
    shapes.value = response.data
  }
})
</script> 