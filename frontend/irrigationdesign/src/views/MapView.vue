<template>
  <div class="h-full flex">
    <!-- Carte -->
    <div class="flex-1 relative">
      <div ref="mapContainer" class="h-full w-full"></div>
      <ShapeInfo v-if="selectedShapeInfo" :shape="selectedShapeInfo" />
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
            class="p-3 bg-gray-50 rounded-md hover:bg-gray-100 transition-colors"
          >
            <div class="flex items-center justify-between mb-2">
              <span class="text-sm font-medium text-gray-700">{{ getShapeDisplayName(shape) }}</span>
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

            <!-- Dimensions spécifiques selon le type de forme -->
            <div class="space-y-1 text-sm text-gray-600">
              <template v-if="shape.properties.dimensions">
                <!-- Rectangle -->
                <template v-if="shape.type.toLowerCase() === 'rectangle'">
                  <div>Largeur: {{ formatDistance(shape.properties.dimensions.width) }}</div>
                  <div>Longueur: {{ formatDistance(shape.properties.dimensions.height) }}</div>
                </template>

                <!-- Cercle -->
                <template v-if="shape.type.toLowerCase() === 'circle'">
                  <div>Rayon: {{ formatDistance(shape.properties.dimensions.radius) }}</div>
                  <div>Diamètre: {{ formatDistance(shape.properties.dimensions.diameter) }}</div>
                </template>

                <!-- Demi-cercle -->
                <template v-if="shape.type.toLowerCase() === 'semicircle'">
                  <div>Rayon: {{ formatDistance(shape.properties.dimensions.radius) }}</div>
                  <div>Orientation: {{ shape.properties.dimensions.orientation }}°</div>
                </template>
              </template>

              <!-- Ligne -->
              <template v-if="shape.type.toLowerCase() === 'line'">
                <div>Longueur: {{ formatDistance(shape.properties.length) }}</div>
                <div>Zone d'influence: {{ formatArea(shape.properties.surfaceInfluence) }}</div>
              </template>

              <!-- Surfaces pour les formes fermées -->
              <template v-if="shape.properties.surfaceInterieure">
                <div class="mt-2 pt-2 border-t border-gray-200">
                  <div>Surface intérieure: {{ formatArea(shape.properties.surfaceInterieure) }}</div>
                  <div>Surface extérieure: {{ formatArea(shape.properties.surfaceExterieure) }}</div>
                  <div>Périmètre: {{ formatDistance(shape.properties.perimetre) }}</div>
                </div>
              </template>
            </div>
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
import 'leaflet-semicircle'
import * as turf from '@turf/turf'
import ShapeInfo from '@/components/ShapeInfo.vue'

const mapContainer = ref<HTMLElement | null>(null)
const map = ref<L.Map | null>(null)
const featureGroup = ref<L.FeatureGroup | null>(null)
const searchQuery = ref('')
const selectedShape = ref('Rectangle')
const shapes = ref([])
const irrigationStore = useIrrigationStore()
const currentDrawing = ref(null)
const selectedShapeInfo = ref(null)

const drawingOptions = ref({
  color: '#3388ff',
  weight: 3,
  opacity: 0.8,
  fillOpacity: 0.2
})

const isDrawing = ref(false)
const drawingState = ref('idle') // 'idle', 'drawing', 'editing'
const currentShape = ref(null)

// Configuration des options de dessin
const drawingOptionsGeoman = {
  position: 'topright',
  drawControls: false,
  editControls: false,  // On cache les contrôles d'édition par défaut
  cutControls: false,
  dragMode: false,
  removalMode: false,
  drawText: false,
  rotateMode: false,
  oneBlock: false,
  customControls: false,
  optionsControls: false,
  snappingOption: true,
  snapDistance: 20,
  tooltips: true
}

// Ajout du fond de carte OpenStreetMap
const baseMaps = {
  'OpenStreetMap': L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap contributors'
  }),
  'Satellite': L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
    attribution: '© Esri'
  }),
  'Terrain': L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenTopoMap contributors'
  })
}

// Initialisation de la carte
onMounted(() => {
  if (!mapContainer.value) return

  // Création de la carte
  map.value = L.map(mapContainer.value, {
    layers: [baseMaps['Satellite']] // Fond satellite par défaut
  }).setView([48.8566, 2.3522], 13)

  // Ajout du contrôle de couches
  L.control.layers(baseMaps).addTo(map.value)

  // Initialisation du groupe de formes
  featureGroup.value = new L.FeatureGroup()
  map.value.addLayer(featureGroup.value)

  // Initialisation de Leaflet-Geoman
  map.value.pm.addControls(drawingOptionsGeoman)

  // Gestionnaire d'événements pour le dessin et les modifications
  map.value.on('pm:create', handleShapeCreated)
  map.value.on('pm:remove', handleShapeRemoved)
  map.value.on('pm:edit', (e) => {
    const layer = e.layer
    // Recalculer les propriétés
    const updatedProperties = calculateShapeProperties(layer, layer.shape || layer.options.shape || 'unknown')
    
    // Mettre à jour selectedShapeInfo si c'est la forme actuellement sélectionnée
    if (selectedShapeInfo.value && layer.id === selectedShapeInfo.value.id) {
      selectedShapeInfo.value = {
        ...selectedShapeInfo.value,
        properties: updatedProperties
      }
    }
    
    // Mettre à jour la forme dans la liste
    const shapeIndex = shapes.value.findIndex(s => s.layer === layer)
    if (shapeIndex !== -1) {
      shapes.value[shapeIndex].properties = updatedProperties
    }
  })

  // Écouter l'événement de changement de position de la carte
  window.addEventListener('map-set-location', ((event: CustomEvent) => {
    if (map.value && event.detail) {
      const { lat, lng, zoom } = event.detail
      map.value.setView([lat, lng], zoom)
    }
  }) as EventListener)

  // Chargement des formes existantes si un plan est sélectionné
  if (irrigationStore.currentPlan) {
    loadExistingShapes()
  }
})

// Fonctions de dessin
function startDrawing(shapeType) {
  if (!map.value) return

  // Mise à jour des états
  isDrawing.value = true
  drawingState.value = 'drawing'
  currentShape.value = shapeType

  // Ajouter une classe pour le mode dessin
  map.value.getContainer().classList.add('drawing-mode')

  // Désactiver tous les modes de dessin et nettoyage
  map.value.pm.disableDraw()
  cleanupSemicircleEvents()
  
  // Ajout d'un curseur personnalisé pour indiquer le mode dessin
  map.value.getContainer().style.cursor = 'crosshair'

  const drawOptions = {
    templineStyle: { 
      color: drawingOptions.value.color,
      dashArray: [5, 5]
    },
    hintlineStyle: { 
      color: drawingOptions.value.color,
      dashArray: [5, 5]
    },
    pathOptions: {
      color: drawingOptions.value.color,
      fillColor: drawingOptions.value.color,
      fillOpacity: drawingOptions.value.fillOpacity,
      weight: drawingOptions.value.weight
    },
    tooltips: true,
    snapDistance: 20,
    finishOn: 'contextmenu'
  }

  // Afficher un message d'aide selon le type de forme
  const helpMessage = {
    'Rectangle': 'Cliquez et glissez pour dessiner un rectangle',
    'Cercle': 'Cliquez et glissez pour définir le rayon du cercle',
    'Ligne': 'Cliquez pour commencer la ligne, double-cliquez pour terminer',
    'Demi-cercle': 'Cliquez pour placer le centre, glissez pour définir le rayon'
  }

  // Afficher le message d'aide
  if (map.value && helpMessage[shapeType]) {
    const helpDiv = document.createElement('div')
    helpDiv.className = 'drawing-help-message'
    helpDiv.textContent = helpMessage[shapeType]
    map.value.getContainer().appendChild(helpDiv)
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
  let drawingStep = 0
  let radius = 0
  let helpTooltip = L.tooltip({
    permanent: true,
    direction: 'right',
    className: 'drawing-tooltip'
  })

  // Fonction pour mettre à jour le tooltip
  const updateTooltip = (latlng, text) => {
    helpTooltip.setLatLng(latlng)
    helpTooltip.setContent(text)
  }

  map.value.once('click', (e) => {
    // Premier clic pour définir le centre
    center = e.latlng
    drawingStep = 1
    
    // Ajouter le tooltip
    helpTooltip.setLatLng(e.latlng)
    helpTooltip.setContent('Move mouse to set radius')
    helpTooltip.addTo(map.value)
    
    // Créer le cercle temporaire
    tempCircle = L.circle(center, {
      radius: 0,
      color: drawingOptions.value.color,
      fillColor: drawingOptions.value.color,
      fillOpacity: drawingOptions.value.fillOpacity,
      weight: drawingOptions.value.weight,
      dashArray: '5, 5'
    }).addTo(map.value)

    // Gestionnaire de mouvement pour le rayon
    const handleMouseMove = (e) => {
      if (drawingStep === 1) {
        radius = center.distanceTo(e.latlng)
        tempCircle.setRadius(radius)
        updateTooltip(e.latlng, 'Click to set radius')
      }
    }

    map.value.on('mousemove', handleMouseMove)

    // Gestionnaire pour définir le rayon
    map.value.once('click', (e) => {
      if (drawingStep === 1) {
        radius = center.distanceTo(e.latlng)
        drawingStep = 2
        map.value.off('mousemove', handleMouseMove)

        // Convertir en demi-cercle
        if (tempCircle) {
          map.value.removeLayer(tempCircle)
        }

        // Créer le demi-cercle temporaire
        tempCircle = L.semiCircle(center, {
          radius: radius,
          color: drawingOptions.value.color,
          fillColor: drawingOptions.value.color,
          fillOpacity: drawingOptions.value.fillOpacity,
          weight: drawingOptions.value.weight,
          startAngle: 0,
          stopAngle: 180,
          dashArray: '5, 5'
        }).addTo(map.value)

        updateTooltip(e.latlng, 'Move mouse to set orientation')

        // Gestionnaire de mouvement pour l'orientation
        const handleOrientation = (e) => {
          if (drawingStep === 2) {
            const angle = Math.atan2(e.latlng.lat - center.lat, e.latlng.lng - center.lng) * 180 / Math.PI
            tempCircle.setStartAngle(angle - 90)
            tempCircle.setStopAngle(angle + 90)
            updateTooltip(e.latlng, 'Click to finish')
          }
        }

        map.value.on('mousemove', handleOrientation)

        // Gestionnaire pour finaliser le demi-cercle
        map.value.once('click', (e) => {
          const angle = Math.atan2(e.latlng.lat - center.lat, e.latlng.lng - center.lng) * 180 / Math.PI
          
          // Créer le demi-cercle final
          const semicircle = L.semiCircle(center, {
            radius: radius,
            color: drawingOptions.value.color,
            fillColor: drawingOptions.value.color,
            fillOpacity: drawingOptions.value.fillOpacity,
            weight: drawingOptions.value.weight,
            startAngle: angle - 90,
            stopAngle: angle + 90
          })
          
          // Nettoyer les éléments temporaires
          map.value.removeLayer(tempCircle)
          map.value.removeLayer(helpTooltip)
          map.value.off('mousemove', handleOrientation)
          
          featureGroup.value.addLayer(semicircle)
          
          handleShapeCreated({
            layer: semicircle,
            shape: 'semicircle',
            radius: radius,
            center: center,
            angle: angle
          })

          // Réinitialiser les variables
          center = null
          tempCircle = null
          drawingStep = 0
        })
      }
    })
  })
}

// Gestion de la création d'une forme
function handleShapeCreated(e) {
  const { layer, shape } = e
  if (!layer) return
  
  // Mise à jour des états
  isDrawing.value = false
  drawingState.value = 'idle'
  currentShape.value = null

  // Retirer la classe de mode dessin
  if (map.value) {
    map.value.getContainer().classList.remove('drawing-mode')
  }

  // Déterminer le type de forme en français
  const typeMap = {
    'rectangle': 'Rectangle',
    'circle': 'Cercle',
    'semicircle': 'Demi-cercle',
    'line': 'Ligne'
  }
  
  const baseType = shape.toLowerCase()
  const frenchType = typeMap[baseType] || shape
  
  // Calculer les propriétés détaillées de la forme
  const properties = calculateShapeProperties(layer, baseType)

  // Ajouter un effet de confirmation visuelle
  layer.getElement()?.classList.add('shape-created')
  setTimeout(() => {
    layer.getElement()?.classList.remove('shape-created')
  }, 1000)
  
  // Rendre la forme modifiable
  layer.on('click', () => {
    if (map.value) {
      // Désactiver l'édition sur toutes les autres formes d'abord
      featureGroup.value.eachLayer((l) => {
        if (l !== layer) {
          l.pm.disable()
        }
      })
      // Activer l'édition sur la forme cliquée
      layer.pm.enable({
        allowSelfIntersection: false,
        preventMarkerRemoval: true,
        removeLayerOnEmpty: false
      })
      
      // Mettre à jour selectedShapeInfo avec les informations de la forme
      const shapeData = shapes.value.find(s => s.layer === layer)
      if (shapeData) {
        selectedShapeInfo.value = {
          id: shapeData.id,
          type: shapeData.type,
          properties: shapeData.properties
        }
      }
    }
  })
  
  // Ajouter un gestionnaire pour désélectionner la forme
  if (!map.value._clickHandler) {
    map.value._clickHandler = (e) => {
      // Vérifier si le clic n'est pas sur une forme
      if (!e.originalEvent.target.closest('.leaflet-interactive')) {
        selectedShapeInfo.value = null
      }
    }
    map.value.on('click', map.value._clickHandler)
  }
  
  // Ajouter la forme au groupe
  featureGroup.value.addLayer(layer)
  
  // Sauvegarder la forme si un plan est sélectionné
  if (irrigationStore.currentPlan) {
    saveShape(layer, baseType, properties)
  }

  // Ajouter la forme à la liste des formes
  shapes.value.push({
    id: layer.id || Date.now(),
    type: frenchType,
    layer: layer,
    properties: properties
  })

  // Ajouter des gestionnaires d'événements pour l'édition
  layer.on('pm:edit', (event) => {
    const updatedProperties = calculateShapeProperties(event.target, baseType)
    if (selectedShapeInfo.value && event.target.id === selectedShapeInfo.value.id) {
      selectedShapeInfo.value = {
        ...selectedShapeInfo.value,
        properties: updatedProperties
      }
    }
  })
}

// Fonction pour calculer les propriétés détaillées d'une forme
function calculateShapeProperties(layer, shapeType) {
  const properties = {
    type: shapeType,
    surfaceInterieure: 0,
    surfaceExterieure: 0,
    perimetre: 0,
    dimensions: {},
    elevation: {
      difference: 0,
      slope: 0
    }
  }

  // Convertir la forme en GeoJSON pour utiliser Turf.js
  const geoJson = layer.toGeoJSON()

  switch (shapeType.toLowerCase()) {
    case 'rectangle':
      const bbox = turf.bbox(geoJson)
      const poly = turf.bboxPolygon(bbox)
      properties.surfaceInterieure = turf.area(poly)
      // Ajouter une marge de 1 mètre pour la surface extérieure
      const buffered = turf.buffer(poly, 1, { units: 'meters' })
      properties.surfaceExterieure = turf.area(buffered)
      properties.perimetre = turf.length(turf.polygonToLine(poly), { units: 'meters' })
      
      // Calculer les dimensions en mètres
      const sw = turf.point([bbox[0], bbox[1]])
      const se = turf.point([bbox[2], bbox[1]])
      const nw = turf.point([bbox[0], bbox[3]])
      properties.dimensions = {
        width: turf.distance(sw, se, { units: 'meters' }),
        height: turf.distance(sw, nw, { units: 'meters' })
      }
      break

    case 'circle':
      const radius = layer.getRadius()
      properties.surfaceInterieure = Math.PI * Math.pow(radius, 2)
      properties.surfaceExterieure = Math.PI * Math.pow(radius + 1, 2)
      properties.perimetre = 2 * Math.PI * radius
      properties.dimensions = {
        radius: radius,
        diameter: radius * 2
      }
      break

    case 'semicircle':
      const semiRadius = layer.getRadius()
      properties.surfaceInterieure = (Math.PI * Math.pow(semiRadius, 2)) / 2
      properties.surfaceExterieure = (Math.PI * Math.pow(semiRadius + 1, 2)) / 2
      properties.perimetre = Math.PI * semiRadius + 2 * semiRadius
      properties.dimensions = {
        radius: semiRadius,
        orientation: layer.options.startAngle + 90
      }
      break

    case 'line':
      const line = turf.lineString(layer.getLatLngs().map(ll => [ll.lng, ll.lat]))
      properties.length = turf.length(line, { units: 'meters' })
      // Calculer la zone d'influence de 1 mètre de chaque côté
      const bufferedLine = turf.buffer(line, 1, { units: 'meters' })
      properties.surfaceInfluence = turf.area(bufferedLine)
      properties.dimensions = {
        width: 2,
      }
      
      // Simuler les données d'élévation (à remplacer par des données réelles d'API d'élévation)
      properties.elevation = {
        difference: 0, // Différence d'altitude en mètres
        slope: 0 // Pente en pourcentage
      }
      
      // Si l'API d'élévation est disponible, calculer le dénivelé et la pente
      if (map.value) {
        const coords = layer.getLatLngs()
        if (coords.length >= 2) {
          // TODO: Appeler l'API d'élévation pour obtenir les altitudes
          // Pour l'instant, on utilise des valeurs simulées
          const startPoint = coords[0]
          const endPoint = coords[coords.length - 1]
          const distance = properties.length // en mètres
          
          // Simulation : pente de 2%
          properties.elevation.difference = distance * 0.02
          properties.elevation.slope = 2
        }
      }
      break
  }

  return properties
}

// Sauvegarde d'une forme
async function saveShape(layer, shapeType, properties) {
  try {
    const shapeData = {
      plan_id: irrigationStore.currentPlan.id,
      type_forme: shapeType.toUpperCase(),
      geometrie: layer.toGeoJSON().geometry,
      proprietes: {
        ...properties,
        style: layer.options
      }
    }
    
    const response = await irrigationStore.createShape(shapeData)
    layer.id = response.data.id
  } catch (error) {
    console.error('Erreur lors de la sauvegarde de la forme:', error)
    featureGroup.value.removeLayer(layer)
  }
}

// Gestion de la suppression d'une forme
function handleShapeRemoved(e) {
  const { layer } = e
  if (irrigationStore.currentPlan) {
    deleteShape(layer)
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
  
  // Mise à jour des états
  isDrawing.value = false
  drawingState.value = 'idle'
  currentShape.value = null

  // Nettoyer l'interface
  map.value.getContainer().classList.remove('drawing-mode')
  cleanupSemicircleEvents()
  
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
    window.removeEventListener('map-set-location', ((event: CustomEvent) => {
      if (map.value && event.detail) {
        const { lat, lng, zoom } = event.detail
        map.value.setView([lat, lng], zoom)
      }
    }) as EventListener)
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

// Ajout d'un watcher pour les changements d'état
watch(drawingState, (newState, oldState) => {
  if (!map.value) return

  // Mettre à jour les classes CSS selon l'état
  const container = map.value.getContainer()
  container.classList.remove(`state-${oldState}`)
  container.classList.add(`state-${newState}`)

  // Mettre à jour le curseur selon l'état
  switch (newState) {
    case 'drawing':
      container.style.cursor = 'crosshair'
      break
    case 'editing':
      container.style.cursor = 'pointer'
      break
    default:
      container.style.cursor = ''
  }
})

function cleanupSemicircleEvents() {
  if (!map.value) return
  
  // Réactiver le déplacement de la carte
  map.value.dragging.enable()
  
  // Réinitialiser le curseur
  map.value.getContainer().style.cursor = ''
  
  // Supprimer le message d'aide
  const helpMessage = map.value.getContainer().querySelector('.drawing-help-message')
  if (helpMessage) {
    helpMessage.remove()
  }
  
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

// Fonction pour formater les distances
function formatDistance(value) {
  if (!value) return ''
  return `${value.toFixed(2)} m`
}

// Ajout des compteurs pour chaque type de forme
const shapeCounters = ref({
  'rectangle': 0,
  'circle': 0,
  'semicircle': 0,
  'line': 0
})

// Fonction pour obtenir le nom d'affichage de la forme
function getShapeDisplayName(shape) {
  const typeMap = {
    'rectangle': 'Rectangle',
    'circle': 'Cercle',
    'semicircle': 'Demi-cercle',
    'line': 'Ligne'
  }
  
  const baseType = shape.type.toLowerCase()
  return typeMap[baseType] || shape.type
}
</script>

<style>
@import 'leaflet/dist/leaflet.css';

/* Ajuster le z-index du conteneur de la carte */
.leaflet-container {
  z-index: 1;
}

/* Ajuster le z-index des contrôles de la carte */
.leaflet-control-container {
  z-index: 1000;
}

/* Styles pour les messages d'aide */
.drawing-help-message {
  position: fixed;
  top: 20px;
  left: 50%;
  transform: translateX(-50%);
  background-color: rgba(0, 0, 0, 0.8);
  color: white;
  padding: 8px 16px;
  border-radius: 4px;
  font-size: 14px;
  z-index: 1000;
  pointer-events: none;
}

/* Styles pour les marqueurs personnalisés */
.custom-div-icon {
  background: transparent;
  border: none;
}

.marker-pin {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: #3388ff;
  border: 2px solid white;
  box-shadow: 0 0 4px rgba(0, 0, 0, 0.3);
}

/* Styles pour les lignes de guide */
.leaflet-pm-draggable {
  cursor: move;
}

.leaflet-pm-drawing {
  cursor: crosshair;
}

/* Styles pour le mode édition */
.editing-mode .leaflet-container {
  cursor: pointer;
}

/* Animation pour les guides visuels */
@keyframes pulse {
  0% {
    transform: scale(1);
    opacity: 1;
  }
  50% {
    transform: scale(1.2);
    opacity: 0.8;
  }
  100% {
    transform: scale(1);
    opacity: 1;
  }
}

.drawing-guide {
  animation: pulse 2s infinite;
}

/* États de la carte */
.state-drawing .leaflet-container {
  background-color: rgba(51, 136, 255, 0.05);
}

.state-editing .leaflet-container {
  background-color: rgba(255, 193, 7, 0.05);
}

/* Animation de création de forme */
@keyframes shapeCreated {
  0% {
    opacity: 0.7;
  }
  50% {
    opacity: 1;
  }
  100% {
    opacity: 0.7;
  }
}

.shape-created {
  animation: shapeCreated 0.3s ease-out;
}

/* Styles pour les guides de dessin */
.drawing-guide-line {
  stroke-dasharray: 5, 5;
  animation: dash 20s linear infinite;
}

@keyframes dash {
  to {
    stroke-dashoffset: 1000;
  }
}

/* Amélioration des styles de sélection */
.leaflet-interactive:hover {
  filter: brightness(1.1);
}

.leaflet-interactive:active {
  filter: brightness(0.9);
}

/* Styles pour le mode édition */
.editing-mode .leaflet-interactive {
  transition: all 0.2s ease;
}

.editing-mode .leaflet-marker-icon {
  transition: transform 0.2s ease;
}

.editing-mode .leaflet-marker-icon:hover {
  transform: scale(1.2);
}

/* Styles pour les points de contrôle */
.leaflet-pm-draggable {
  transition: transform 0.2s ease;
}

.leaflet-pm-draggable:hover {
  transform: scale(1.2);
}

/* Styles pour les messages d'aide contextuels */
.context-help {
  position: absolute;
  background: rgba(0, 0, 0, 0.8);
  color: white;
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 12px;
  pointer-events: none;
  z-index: 1000;
  transition: opacity 0.2s ease;
}

/* Styles pour les indicateurs de mesure */
.measurement-label {
  background: white;
  border: 1px solid #ccc;
  border-radius: 3px;
  padding: 2px 4px;
  font-size: 11px;
  white-space: nowrap;
  pointer-events: none;
  box-shadow: 0 1px 3px rgba(0,0,0,0.2);
}

/* Styles pour le mode dessin actif */
.drawing-mode {
  .leaflet-container {
    transition: background-color 0.3s ease;
  }
  
  .leaflet-control-container {
    opacity: 0.7;
  }
}

/* Styles pour les formes en cours de dessin */
.shape-drawing {
  stroke-dasharray: 5, 5;
  animation: drawing-dash 1s linear infinite;
}

@keyframes drawing-dash {
  to {
    stroke-dashoffset: 10;
  }
}

/* Styles pour les tooltips de dessin */
.drawing-tooltip {
  background: rgba(0, 0, 0, 0.8);
  border: none;
  border-radius: 4px;
  color: white;
  padding: 4px 8px;
  font-size: 12px;
  white-space: nowrap;
}

.drawing-tooltip::before {
  border-top-color: rgba(0, 0, 0, 0.8);
}
</style> 