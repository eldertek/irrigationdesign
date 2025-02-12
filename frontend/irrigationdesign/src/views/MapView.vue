<template>
  <div class="h-full flex">
    <!-- Carte -->
    <div class="flex-1 relative">
      <div ref="mapContainer" class="h-full w-full"></div>
    </div>

    <!-- Panneau latéral -->
    <div class="w-80 bg-white shadow-lg flex flex-col">
      <!-- En-tête -->
      <div class="p-4 border-b border-gray-200">
        <h2 class="text-lg font-medium text-gray-900">Outils de dessin</h2>
      </div>

      <!-- Sélection de la forme -->
      <div class="p-4 border-b border-gray-200">
        <label class="block text-sm font-medium text-gray-700 mb-2">
          Type de forme
        </label>
        <div class="grid grid-cols-2 gap-2">
          <button
            v-for="shape in ['Rectangle', 'Cercle', 'Demi-cercle', 'Ligne']"
            :key="shape"
            @click="selectedShape = shape"
            class="px-3 py-2 rounded-md text-sm font-medium"
            :class="[
              selectedShape === shape
                ? 'bg-primary-100 text-primary-700 border-primary-500'
                : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
            ]"
          >
            {{ shape }}
          </button>
        </div>
      </div>

      <!-- Options de style -->
      <div class="p-4 border-b border-gray-200">
        <h3 class="text-sm font-medium text-gray-700 mb-4">Style</h3>
        
        <!-- Couleur -->
        <div class="mb-4">
          <label class="block text-sm text-gray-600 mb-1">
            Couleur
          </label>
          <input
            type="color"
            v-model="drawingOptions.color"
            class="w-full h-8 rounded border border-gray-300"
            @change="updateDrawingStyle"
          />
        </div>

        <!-- Épaisseur -->
        <div class="mb-4">
          <label class="block text-sm text-gray-600 mb-1">
            Épaisseur
          </label>
          <input
            type="range"
            v-model="drawingOptions.weight"
            min="1"
            max="10"
            class="w-full"
            @change="updateDrawingStyle"
          />
          <div class="text-sm text-gray-500 text-right">
            {{ drawingOptions.weight }}px
          </div>
        </div>

        <!-- Opacité -->
        <div>
          <label class="block text-sm text-gray-600 mb-1">
            Opacité
          </label>
          <input
            type="range"
            v-model="drawingOptions.opacity"
            min="0"
            max="1"
            step="0.1"
            class="w-full"
            @change="updateDrawingStyle"
          />
          <div class="text-sm text-gray-500 text-right">
            {{ Math.round(drawingOptions.opacity * 100) }}%
          </div>
        </div>
      </div>

      <!-- Liste des formes -->
      <div class="flex-1 p-4 overflow-y-auto">
        <h3 class="text-sm font-medium text-gray-700 mb-2">
          Formes dessinées
        </h3>
        <div class="space-y-2">
          <div
            v-for="shape in shapes"
            :key="shape.id"
            class="flex items-center justify-between p-2 bg-gray-50 rounded-md"
          >
            <div>
              <span class="text-sm font-medium text-gray-700">{{ shape.type }}</span>
              <span class="text-xs text-gray-500 block">
                {{ formatArea(shape.surface) }}
              </span>
            </div>
            <button
              @click="deleteShape(shape.id)"
              class="text-red-600 hover:text-red-800"
            >
              <span class="sr-only">Supprimer</span>
              <svg class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path
                  fill-rule="evenodd"
                  d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                  clip-rule="evenodd"
                />
              </svg>
            </button>
          </div>
        </div>
      </div>

      <!-- Actions -->
      <div class="p-4 border-t border-gray-200">
        <button
          @click="cancelDrawing"
          class="w-full mb-2 px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
        >
          Annuler le dessin
        </button>
        <button
          @click="savePlan"
          class="w-full px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary-600 hover:bg-primary-700"
        >
          Sauvegarder le plan
        </button>
      </div>
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
const featureGroup = ref<L.FeatureGroup | null>(null)
const searchQuery = ref('')
const selectedShape = ref('Rectangle')
const shapes = ref([])
const irrigationStore = useIrrigationStore()
const currentDrawing = ref(null)

const drawingOptions = ref({
  color: '#3388ff',
  weight: 3,
  opacity: 0.8,
  fillOpacity: 0.2
})

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

  // Gestionnaire d'événements pour le dessin
  map.value.on('mousedown', startShape)
  map.value.on('mousemove', updateShape)
  map.value.on('mouseup', finishShape)

  // Chargement des formes existantes si un plan est sélectionné
  if (irrigationStore.currentPlan) {
    loadExistingShapes()
  }
})

// Fonctions de dessin
function startShape(e) {
  if (!map.value || !selectedShape.value) return

  const latlng = e.latlng
  const shapeOptions = {
    color: drawingOptions.value.color,
    weight: drawingOptions.value.weight,
    opacity: drawingOptions.value.opacity,
    fillOpacity: drawingOptions.value.fillOpacity
  }

  switch (selectedShape.value) {
    case 'Rectangle':
      currentDrawing.value = {
        type: 'Rectangle',
        startPoint: latlng,
        layer: L.rectangle([latlng, latlng], shapeOptions).addTo(map.value)
      }
      break
    case 'Cercle':
      currentDrawing.value = {
        type: 'Cercle',
        center: latlng,
        layer: L.circle(latlng, { radius: 0, ...shapeOptions }).addTo(map.value)
      }
      break
    case 'Demi-cercle':
      currentDrawing.value = {
        type: 'Demi-cercle',
        center: latlng,
        layer: L.semiCircle(latlng, { radius: 0, ...shapeOptions, startAngle: 0, stopAngle: 180 }).addTo(map.value)
      }
      break
    case 'Ligne':
      currentDrawing.value = {
        type: 'Ligne',
        points: [latlng],
        layer: L.polyline([latlng], shapeOptions).addTo(map.value)
      }
      break
  }

  // Désactiver temporairement le déplacement de la carte pendant le dessin
  map.value.dragging.disable()
}

function updateShape(e) {
  if (!currentDrawing.value || !map.value) return

  const latlng = e.latlng
  const layer = currentDrawing.value.layer

  switch (currentDrawing.value.type) {
    case 'Rectangle':
      const bounds = L.latLngBounds(currentDrawing.value.startPoint, latlng)
      layer.setBounds(bounds)
      break
    case 'Cercle':
    case 'Demi-cercle':
      const radius = currentDrawing.value.center.distanceTo(latlng)
      layer.setRadius(radius)
      break
    case 'Ligne':
      const points = [...currentDrawing.value.points, latlng]
      layer.setLatLngs(points)
      break
  }
}

function finishShape(e) {
  if (!currentDrawing.value || !map.value || !featureGroup.value) return

  const layer = currentDrawing.value.layer
  featureGroup.value.addLayer(layer)

  // Ajouter la forme à la liste
  shapes.value.push({
    id: Date.now(),
    type: currentDrawing.value.type,
    layer: layer,
    surface: calculateArea(layer)
  })

  // Réinitialiser le dessin en cours
  currentDrawing.value = null

  // Réactiver le déplacement de la carte
  map.value.dragging.enable()
}

// Fonction pour annuler le dessin en cours
function cancelDrawing() {
  if (!currentDrawing.value || !map.value) return
  
  map.value.removeLayer(currentDrawing.value.layer)
  currentDrawing.value = null
  map.value.dragging.enable()
}

// Fonction pour supprimer une forme
function deleteShape(shapeId) {
  const shape = shapes.value.find(s => s.id === shapeId)
  if (!shape || !map.value || !featureGroup.value) return
  
  featureGroup.value.removeLayer(shape.layer)
  shapes.value = shapes.value.filter(s => s.id !== shapeId)
}

// Fonction pour calculer la surface
function calculateArea(layer) {
  if (layer instanceof L.Polygon) {
    return L.GeometryUtil.geodesicArea(layer.getLatLngs()[0])
  } else if (layer instanceof L.Circle) {
    return Math.PI * Math.pow(layer.getRadius(), 2)
  }
  return 0
}

// Fonction pour formater la surface
function formatArea(surface) {
  if (!surface) return ''
  return `${surface.toFixed(2)} m²`
}

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

// Fonctions de gestion du dessin
function handleShapeChange() {
  if (!map.value) return
  cancelDrawing()
}

function startDrawing() {
  if (!map.value) return

  // Désactiver tous les modes de dessin actuels
  cancelDrawing()

  // Mettre à jour les options de style
  updateDrawingStyle()

  // Activer le mode de dessin approprié
  switch (selectedShape.value) {
    case 'Rectangle':
      new L.Draw.Rectangle(map.value, {
        shapeOptions: {
          color: drawingOptions.value.color,
          weight: drawingOptions.value.weight,
          opacity: drawingOptions.value.opacity,
          fillOpacity: drawingOptions.value.fillOpacity
        }
      }).enable()
      break
    case 'Cercle':
      new L.Draw.Circle(map.value, {
        shapeOptions: {
          color: drawingOptions.value.color,
          weight: drawingOptions.value.weight,
          opacity: drawingOptions.value.opacity,
          fillOpacity: drawingOptions.value.fillOpacity
        }
      }).enable()
      break
    case 'Ligne':
      new L.Draw.Polyline(map.value, {
        shapeOptions: {
          color: drawingOptions.value.color,
          weight: drawingOptions.value.weight,
          opacity: drawingOptions.value.opacity
        }
      }).enable()
      break
    case 'Demi-cercle':
      enableHalfCircleMode()
      break
  }
}

function updateDrawingStyle() {
  if (!map.value || !map.value._toolbars || !map.value._toolbars.draw || !map.value._toolbars.draw.options.draw) return
  
  const newOptions = {
    shapeOptions: {
      color: drawingOptions.value.color,
      weight: drawingOptions.value.weight,
      opacity: drawingOptions.value.opacity,
      fillOpacity: drawingOptions.value.fillOpacity
    }
  }

  // Mettre à jour les options pour chaque type de forme
  const drawOptions = map.value._toolbars.draw.options.draw
  Object.keys(drawOptions).forEach((type) => {
    if (drawOptions[type]) {
      drawOptions[type].shapeOptions = { ...newOptions.shapeOptions }
    }
  })
}

// Fonction pour activer le mode demi-cercle
function enableHalfCircleMode() {
  if (!map.value || !map.value._toolbars || !map.value._toolbars.draw || !map.value._toolbars.draw.options.draw) return

  // Désactiver tous les autres modes de dessin
  const drawOptions = map.value._toolbars.draw.options.draw
  Object.keys(drawOptions).forEach((type) => {
    const handler = map.value._toolbars.draw._modes[type]
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

// Chargement des formes existantes
async function loadExistingShapes() {
  if (!map.value) return

  try {
    const response = await irrigationStore.getShapes(irrigationStore.currentPlan.id)
    response.data.forEach((shape: any) => {
      const layer = L.geoJSON(shape.geometrie, {
        style: shape.proprietes.style
      }).addTo(map.value)
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

function savePlan() {
  // Implementation de la sauvegarde du plan
}
</script>

<style>
@import 'leaflet/dist/leaflet.css';
</style> 