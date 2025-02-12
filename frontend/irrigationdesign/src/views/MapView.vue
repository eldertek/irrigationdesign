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
              <option value="Rectangle">Rectangle</option>
              <option value="Circle">Cercle</option>
              <option value="Semicircle">Demi-cercle</option>
              <option value="Line">Ligne</option>
            </select>
          </div>

          <!-- Options de style -->
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-2">Style</label>
            <div class="space-y-3">
              <!-- Couleur -->
              <div>
                <label class="block text-xs text-gray-500">Couleur</label>
                <input
                  type="color"
                  v-model="drawingOptions.color"
                  class="mt-1 h-8 w-full rounded-md"
                />
              </div>
              <!-- Épaisseur -->
              <div>
                <label class="block text-xs text-gray-500">Épaisseur</label>
                <input
                  type="range"
                  v-model="drawingOptions.weight"
                  min="1"
                  max="10"
                  class="mt-1 w-full"
                />
              </div>
            </div>
          </div>

          <!-- Boutons d'action -->
          <div class="flex space-x-2">
            <button
              @click="startDrawing"
              class="flex-1 inline-flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
            >
              <svg class="h-5 w-5 mr-2" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
              </svg>
              Dessiner
            </button>
            <button
              @click="cancelDrawing"
              class="inline-flex items-center justify-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
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
    <div class="flex-1 relative">
      <div ref="mapContainer" class="absolute inset-0"></div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { useIrrigationStore } from '@/stores/irrigation'
import * as L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import 'leaflet-draw'
import 'leaflet-draw/dist/leaflet.draw.css'

const mapContainer = ref<HTMLElement | null>(null)
const map = ref<L.Map | null>(null)
const drawControl = ref<L.Control.Draw | null>(null)
const featureGroup = ref<L.FeatureGroup | null>(null)
const searchQuery = ref('')
const selectedShape = ref('Rectangle')
const shapes = ref([])
const irrigationStore = useIrrigationStore()

const drawingOptions = ref({
  color: '#3388ff',
  weight: 3,
  opacity: 0.8,
  fillOpacity: 0.2
})

// Configuration des traductions françaises
L.drawLocal.draw.toolbar.buttons = {
  polyline: 'Dessiner une ligne',
  polygon: 'Dessiner un polygone',
  rectangle: 'Dessiner un rectangle',
  circle: 'Dessiner un cercle',
  marker: 'Placer un marqueur',
  circlemarker: 'Placer un marqueur circulaire'
}

L.drawLocal.draw.toolbar.actions = {
  title: 'Annuler le dessin',
  text: 'Annuler'
}

L.drawLocal.draw.handlers.circle = {
  tooltip: {
    start: 'Cliquez et déplacez pour dessiner un cercle'
  },
  radius: 'Rayon'
}

L.drawLocal.draw.handlers.circlemarker = {
  tooltip: {
    start: 'Cliquez pour placer un marqueur circulaire'
  }
}

L.drawLocal.draw.handlers.marker = {
  tooltip: {
    start: 'Cliquez pour placer un marqueur'
  }
}

L.drawLocal.draw.handlers.polygon = {
  tooltip: {
    start: 'Cliquez pour commencer à dessiner une forme',
    cont: 'Cliquez pour continuer à dessiner la forme',
    end: 'Cliquez sur le premier point pour fermer la forme'
  }
}

L.drawLocal.draw.handlers.polyline = {
  tooltip: {
    start: 'Cliquez pour commencer à dessiner une ligne',
    cont: 'Cliquez pour continuer à dessiner la ligne',
    end: 'Cliquez sur le dernier point pour terminer la ligne'
  }
}

L.drawLocal.draw.handlers.rectangle = {
  tooltip: {
    start: 'Cliquez et déplacez pour dessiner un rectangle'
  }
}

L.drawLocal.edit.toolbar.actions = {
  save: {
    title: 'Sauvegarder les modifications',
    text: 'Sauvegarder'
  },
  cancel: {
    title: 'Annuler les modifications',
    text: 'Annuler'
  },
  clearAll: {
    title: 'Effacer toutes les formes',
    text: 'Tout effacer'
  }
}

L.drawLocal.edit.handlers.edit = {
  tooltip: {
    text: 'Déplacez les points pour modifier la forme',
    subtext: 'Cliquez sur Annuler pour annuler les modifications'
  }
}

L.drawLocal.edit.handlers.remove = {
  tooltip: {
    text: 'Cliquez sur une forme pour la supprimer'
  }
}

// Initialisation de la carte
onMounted(() => {
  if (!mapContainer.value) return

  // Création de la carte
  map.value = L.map(mapContainer.value).setView([48.8566, 2.3522], 13)

  // Ajout du fond de carte OpenStreetMap
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap contributors'
  }).addTo(map.value)

  // Création du FeatureGroup pour stocker les formes dessinées
  featureGroup.value = new L.FeatureGroup()
  map.value.addLayer(featureGroup.value)

  // Configuration des options de dessin
  const drawOptions = {
    position: 'topright',
    draw: {
      polyline: {
        shapeOptions: {
          color: '#3388ff',
          weight: 4
        }
      },
      polygon: false, // Désactivé car non utilisé
      circle: {
        shapeOptions: {
          fillColor: '#3388ff',
          color: '#3388ff',
          fillOpacity: 0.2
        }
      },
      rectangle: {
        shapeOptions: {
          fillColor: '#3388ff',
          color: '#3388ff',
          fillOpacity: 0.2
        }
      },
      marker: false,
      circlemarker: false
    },
    edit: {
      featureGroup: featureGroup.value,
      remove: true
    }
  }

  // Création du contrôle de dessin
  drawControl.value = new L.Control.Draw(drawOptions)
  map.value.addControl(drawControl.value)

  // Gestion des événements de dessin
  map.value.on(L.Draw.Event.CREATED, (e: any) => {
    const layer = e.layer
    featureGroup.value?.addLayer(layer)

    // Si c'est un demi-cercle, on configure ses propriétés spécifiques
    if (e.layerType === 'circle' && layer.options.isHalfCircle) {
      layer.setStyle({
        startAngle: 0,
        stopAngle: 180
      })
    }
  })

  // Gestion des événements d'édition
  map.value.on(L.Draw.Event.EDITED, (e: any) => {
    const layers = e.layers
    layers.eachLayer((layer: any) => {
      // Mise à jour des propriétés après édition
      if (layer.options.isHalfCircle) {
        layer.setStyle({
          startAngle: 0,
          stopAngle: 180
        })
      }
    })
  })

  // Chargement des formes existantes si un plan est sélectionné
  if (irrigationStore.currentPlan) {
    loadExistingShapes()
  }
})

// Nettoyage lors du démontage du composant
onUnmounted(() => {
  if (map.value) {
    map.value.remove()
  }
})

// Recherche d'adresse
async function searchLocation() {
  if (!searchQuery.value || !map.value) return
  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery.value)}`
    )
    const data = await response.json()
    if (data && data[0]) {
      map.value.setView([data[0].lat, data[0].lon], 16)
    }
  } catch (error) {
    console.error('Erreur lors de la recherche d\'adresse:', error)
  }
}

// Gestion du dessin
function startDrawing() {
  if (!map.value) return

  // Mise à jour des options de style
  map.value.pm.setGlobalOptions({
    pathOptions: {
      color: drawingOptions.value.color,
      weight: drawingOptions.value.weight,
      opacity: drawingOptions.value.opacity,
      fillOpacity: drawingOptions.value.fillOpacity
    }
  })

  // Désactiver tous les outils de dessin d'abord
  map.value.pm.disableDraw()

  // Activation de l'outil de dessin correspondant
  switch (selectedShape.value) {
    case 'Rectangle':
      map.value.pm.enableDraw('Rectangle', {
        tooltips: {
          start: 'Cliquez pour commencer le rectangle',
          cont: 'Relâchez pour terminer'
        }
      })
      break
    case 'Circle':
      map.value.pm.enableDraw('Circle', {
        tooltips: {
          start: 'Cliquez pour placer le centre du cercle',
          cont: 'Déplacez pour définir le rayon'
        }
      })
      break
    case 'Line':
      map.value.pm.enableDraw('Line', {
        tooltips: {
          start: 'Cliquez pour commencer la ligne',
          cont: 'Cliquez pour continuer la ligne',
          end: 'Double-cliquez pour terminer'
        }
      })
      break
    case 'Semicircle':
      map.value.pm.enableDraw('Circle', {
        pathOptions: {
          ...drawingOptions.value,
          startAngle: 0,
          stopAngle: 180,
          fillOpacity: drawingOptions.value.fillOpacity,
          radius: undefined
        },
        tooltips: {
          start: 'Cliquez pour placer le centre du demi-cercle',
          cont: 'Déplacez pour définir le rayon'
        },
        editable: true,
        drawCircle: false,
        continueDrawing: false
      })
      break
  }
}

function cancelDrawing() {
  if (!map.value) return
  map.value.pm.disableDraw()
}

function deleteShape(shapeId: number) {
  const shape = shapes.value.find(s => s.id === shapeId)
  if (shape && map.value) {
    map.value.removeLayer(shape.layer)
    shapes.value = shapes.value.filter(s => s.id !== shapeId)
  }
}

// Chargement des formes existantes
async function loadExistingShapes() {
  try {
    const response = await irrigationStore.getShapes(irrigationStore.currentPlan.id)
    response.data.forEach((shape: any) => {
      const layer = L.geoJSON(shape.geometrie, {
        style: shape.proprietes.style
      }).addTo(map.value!)
      shapes.value.push({
        id: shape.id,
        type: shape.type_forme,
        layer,
        surface: shape.surface
      })
    })
  } catch (error) {
    console.error('Erreur lors du chargement des formes:', error)
  }
}

// Utilitaires
function calculateArea(layer: L.Layer): number {
  if (layer instanceof L.Polygon) {
    return L.GeometryUtil.geodesicArea(layer.getLatLngs()[0])
  }
  return 0
}

function formatArea(surface: number | undefined): string {
  if (!surface) return ''
  return `${surface.toFixed(2)} m²`
}

// Fonction pour activer le mode demi-cercle
function enableHalfCircleMode() {
  if (!map.value) return

  // Désactiver tous les autres modes de dessin
  Object.keys(drawControl.value?.options.draw).forEach((type) => {
    const handler = map.value._toolbars?.draw?._modes[type]
    if (handler) {
      handler.disable()
    }
  })

  // Activer le mode cercle avec les options de demi-cercle
  const circleDrawer = new L.Draw.Circle(map.value, {
    shapeOptions: {
      fillColor: '#3388ff',
      color: '#3388ff',
      fillOpacity: 0.2,
      isHalfCircle: true,
      startAngle: 0,
      stopAngle: 180
    }
  })
  circleDrawer.enable()
}
</script>

<style>
@import 'leaflet/dist/leaflet.css';
</style> 