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
import { ref, onMounted, onUnmounted, watch } from 'vue'
import { useIrrigationStore } from '@/stores/irrigation'
import L from 'leaflet'
import '@geoman-io/leaflet-geoman-free'
import '@geoman-io/leaflet-geoman-free/dist/leaflet-geoman.css'

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

// Configuration des options de dessin
const drawingOptionsGeoman = {
  position: 'topright',
  drawControls: false,
  editControls: true,
  cutControls: false,
  dragMode: false,
  removalMode: true,
  drawText: false,
  rotateMode: true,
  oneBlock: false,
  customControls: false,
  optionsControls: true,
  snappingOption: true
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

  // Initialisation du groupe de formes
  featureGroup.value = new L.FeatureGroup()
  map.value.addLayer(featureGroup.value)

  // Initialisation de Leaflet-Geoman
  map.value.pm.addControls(drawingOptionsGeoman)

  // Gestionnaire d'événements pour le dessin
  map.value.on('pm:create', handleShapeCreated)
  map.value.on('pm:remove', handleShapeRemoved)

  // Chargement des formes existantes si un plan est sélectionné
  if (irrigationStore.currentPlan) {
    loadExistingShapes()
  }
})

// Fonctions de dessin
function startDrawing(shapeType) {
  if (!map.value) return

  // Désactiver tous les modes de dessin
  map.value.pm.disableDraw()
  
  // Nettoyer les événements précédents du demi-cercle
  cleanupSemicircleEvents()

  const drawOptions = {
    templineStyle: { color: drawingOptions.value.color },
    hintlineStyle: { 
      color: drawingOptions.value.color,
      dashArray: [5, 5]
    },
    pathOptions: {
      color: drawingOptions.value.color,
      fillColor: drawingOptions.value.color,
      fillOpacity: drawingOptions.value.fillOpacity,
      weight: drawingOptions.value.weight
    }
  }

  switch (shapeType) {
    case 'Rectangle':
      map.value.pm.enableDraw('Rectangle', drawOptions)
      break
    case 'Cercle':
      map.value.pm.enableDraw('Circle', drawOptions)
      break
    case 'Ligne':
      map.value.pm.enableDraw('Line', drawOptions)
      break
    case 'Demi-cercle':
      enableSemicircleDrawing()
      break
  }
}

// Gestion du dessin du demi-cercle
let semicircleEvents = {
  mousedown: null,
  mousemove: null,
  mouseup: null
}

function enableSemicircleDrawing() {
  if (!map.value) return

  let center = null
  let tempCircle = null
  let isDrawing = false

  // Gestionnaire mousedown
  semicircleEvents.mousedown = (e) => {
    if (!isDrawing) {
      isDrawing = true
      center = e.latlng
      
      tempCircle = L.circle(center, {
        radius: 0,
        color: drawingOptions.value.color,
        fillColor: drawingOptions.value.color,
        fillOpacity: drawingOptions.value.fillOpacity,
        weight: drawingOptions.value.weight
      }).addTo(map.value)
    }
  }

  // Gestionnaire mousemove
  semicircleEvents.mousemove = (e) => {
    if (isDrawing && tempCircle && center) {
      const radius = center.distanceTo(e.latlng)
      tempCircle.setRadius(radius)
      
      // Créer l'effet visuel du demi-cercle
      const points = calculateSemicirclePoints(center, radius)
      updateTempSemicircle(points)
    }
  }

  // Gestionnaire mouseup
  semicircleEvents.mouseup = (e) => {
    if (isDrawing && tempCircle && center) {
      const radius = center.distanceTo(e.latlng)
      const points = calculateSemicirclePoints(center, radius)
      
      // Supprimer le cercle temporaire
      map.value.removeLayer(tempCircle)
      
      // Créer le demi-cercle final
      const semicircle = L.polygon(points, {
        color: drawingOptions.value.color,
        fillColor: drawingOptions.value.color,
        fillOpacity: drawingOptions.value.fillOpacity,
        weight: drawingOptions.value.weight
      })
      
      // Ajouter au groupe de formes et déclencher l'événement de création
      featureGroup.value.addLayer(semicircle)
      handleShapeCreated({
        layer: semicircle,
        shape: 'semicircle',
        radius: radius,
        center: center
      })

      // Réinitialiser l'état
      isDrawing = false
      center = null
      tempCircle = null
    }
  }

  // Attacher les événements
  map.value.on('mousedown', semicircleEvents.mousedown)
  map.value.on('mousemove', semicircleEvents.mousemove)
  map.value.on('mouseup', semicircleEvents.mouseup)
}

function calculateSemicirclePoints(center, radius) {
  const points = []
  const nbPoints = 32 // Nombre de points pour dessiner l'arc
  
  // Ajouter le centre comme premier point
  points.push(center)
  
  // Calculer les points de l'arc
  for (let i = 0; i <= nbPoints; i++) {
    const angle = (Math.PI * i) / nbPoints
    const lat = center.lat + (radius / 111319) * Math.cos(angle)
    const lng = center.lng + (radius / (111319 * Math.cos(center.lat * Math.PI / 180))) * Math.sin(angle)
    points.push([lat, lng])
  }
  
  // Fermer le polygone en revenant au centre
  points.push(center)
  
  return points
}

function cleanupSemicircleEvents() {
  if (!map.value) return
  
  // Détacher les événements précédents
  if (semicircleEvents.mousedown) {
    map.value.off('mousedown', semicircleEvents.mousedown)
  }
  if (semicircleEvents.mousemove) {
    map.value.off('mousemove', semicircleEvents.mousemove)
  }
  if (semicircleEvents.mouseup) {
    map.value.off('mouseup', semicircleEvents.mouseup)
  }
  
  // Réinitialiser les gestionnaires
  semicircleEvents = {
    mousedown: null,
    mousemove: null,
    mouseup: null
  }
}

// Gestion de la création d'une forme
function handleShapeCreated(e) {
  const { layer, shape } = e
  
  // Ajouter la forme au groupe
  featureGroup.value.addLayer(layer)
  
  // Sauvegarder la forme si un plan est sélectionné
  if (irrigationStore.currentPlan) {
    saveShape(layer, shape)
  }
}

// Gestion de la suppression d'une forme
function handleShapeRemoved(e) {
  const { layer } = e
  if (irrigationStore.currentPlan) {
    deleteShape(layer)
  }
}

// Sauvegarde d'une forme
async function saveShape(layer, shapeType) {
  try {
    const shapeData = {
      plan_id: irrigationStore.currentPlan.id,
      type_forme: shapeType.toUpperCase(),
      geometrie: layer.toGeoJSON().geometry,
      proprietes: {
        style: layer.options,
        radius: layer.getRadius ? layer.getRadius() : undefined
      }
    }
    
    const response = await irrigationStore.createShape(shapeData)
    layer.id = response.data.id
  } catch (error) {
    console.error('Erreur lors de la sauvegarde de la forme:', error)
    featureGroup.value.removeLayer(layer)
  }
}

// Suppression d'une forme
function deleteShape(shapeId) {
  const shape = shapes.value.find(s => s.id === shapeId)
  if (!shape || !map.value || !featureGroup.value) return
  
  featureGroup.value.removeLayer(shape.layer)
  shapes.value = shapes.value.filter(s => s.id !== shapeId)
}

// Fonction pour annuler le dessin en cours
function cancelDrawing() {
  if (!currentDrawing.value || !map.value) return
  
  map.value.removeLayer(currentDrawing.value.layer)
  currentDrawing.value = null
  map.value.pm.disableDraw()
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

// Surveiller les changements de forme sélectionnée
watch(selectedShape, (newShape) => {
  if (newShape) {
    startDrawing(newShape)
  }
})

// Fonctions de gestion du dessin
function handleShapeChange() {
  if (!map.value) return
  cancelDrawing()
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