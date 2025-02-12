<template>
  <div class="map-container relative w-full h-full">
    <div ref="mapRef" class="w-full h-full"></div>
    
    <!-- Overlay de chargement -->
    <div v-if="isLoading" class="absolute inset-0 bg-white bg-opacity-75 flex items-center justify-center z-50">
      <div class="animate-spin rounded-full h-12 w-12 border-4 border-primary-600 border-t-transparent"></div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch } from 'vue'
import L from 'leaflet'
import '@geoman-io/leaflet-geoman-free'
import 'leaflet/dist/leaflet.css'
import '@geoman-io/leaflet-geoman-free/dist/leaflet-geoman.css'
import * as turf from '@turf/turf'
import 'leaflet-elevation'
import 'leaflet-elevation/dist/leaflet-elevation.css'
import 'leaflet-geometryutil'

const props = defineProps({
  center: {
    type: Array as () => [number, number],
    default: () => [46.227638, 2.213749] // Centre de la France
  },
  zoom: {
    type: Number,
    default: 6
  },
  selectedTool: {
    type: Object,
    default: null
  },
  drawingOptions: {
    type: Object,
    default: () => ({})
  },
  isEditMode: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['shape-created', 'shape-updated', 'shape-deleted', 'elevation-data'])

const mapRef = ref(null)
const map = ref(null)
const isLoading = ref(true)
const drawingLayer = ref(null)
const editingLayer = ref(null)

// Configuration des outils de dessin
const drawingTools = {
  line: {
    name: 'Line',
    button: 'drawPolyline',
    handler: 'pm:create',
    options: {
      pathOptions: {
        color: props.drawingOptions.color,
        weight: props.drawingOptions.weight
      }
    }
  },
  rectangle: {
    name: 'Rectangle',
    button: 'drawRectangle',
    handler: 'pm:create',
    options: {
      pathOptions: {
        color: props.drawingOptions.color,
        weight: props.drawingOptions.weight
      }
    }
  },
  circle: {
    name: 'Circle',
    button: 'drawCircle',
    handler: 'pm:create',
    options: {
      pathOptions: {
        color: props.drawingOptions.color,
        weight: props.drawingOptions.weight
      },
      fixedRadius: props.drawingOptions.fixedRadius,
      radius: props.drawingOptions.radius
    }
  },
  semicircle: {
    name: 'Semicircle',
    button: 'drawCircle',
    handler: 'pm:create',
    options: {
      pathOptions: {
        color: props.drawingOptions.color,
        weight: props.drawingOptions.weight
      },
      isSemicircle: true,
      startAngle: props.drawingOptions.orientation,
      stopAngle: props.drawingOptions.orientation + 180
    }
  }
}

// Initialisation de la carte
onMounted(async () => {
  // Création de la carte
  map.value = L.map(mapRef.value, {
    center: props.center,
    zoom: props.zoom,
    zoomControl: false,
    attributionControl: false
  })

  // Ajout des contrôles de zoom dans le coin supérieur droit
  L.control.zoom({
    position: 'topright'
  }).addTo(map.value)

  // Ajout du fond de carte
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19
  }).addTo(map.value)

  // Initialisation des calques de dessin
  drawingLayer.value = L.featureGroup().addTo(map.value)
  editingLayer.value = L.featureGroup().addTo(map.value)

  // Configuration de Leaflet.PM
  map.value.pm.addControls({
    position: 'topleft',
    drawCircle: true,
    drawMarker: false,
    drawCircleMarker: false,
    drawText: false,
    cutPolygon: false
  })

  // Gestion des événements de dessin
  map.value.on('pm:create', (e) => {
    const layer = e.layer
    drawingLayer.value.addLayer(layer)
    
    // Calcul des propriétés de la forme
    const properties = calculateShapeProperties(layer)
    
    // Si c'est une ligne, récupérer le profil d'élévation
    if (e.shape === 'Line') {
      getElevationProfile(layer)
    }

    emit('shape-created', {
      id: L.Util.stamp(layer),
      type: e.shape.toLowerCase(),
      layer: layer,
      properties: properties
    })
  })

  // Gestion des modifications
  map.value.on('pm:edit', (e) => {
    const layer = e.layer
    const properties = calculateShapeProperties(layer)
    
    emit('shape-updated', {
      id: L.Util.stamp(layer),
      properties: properties
    })
  })

  // Gestion des suppressions
  map.value.on('pm:remove', (e) => {
    emit('shape-deleted', {
      id: L.Util.stamp(e.layer)
    })
  })

  isLoading.value = false
})

// Nettoyage
onUnmounted(() => {
  if (map.value) {
    map.value.remove()
  }
})

// Observation des changements d'outils
watch(() => props.selectedTool, (newTool) => {
  if (!map.value) return

  // Désactiver tous les modes de dessin
  map.value.pm.disableDraw()
  
  if (newTool) {
    const tool = drawingTools[newTool.type]
    if (tool) {
      map.value.pm.enableDraw(tool.button, tool.options)
    }
  }
})

// Observation du mode édition
watch(() => props.isEditMode, (isEdit) => {
  if (!map.value) return

  if (isEdit) {
    map.value.pm.enableGlobalEditMode()
  } else {
    map.value.pm.disableGlobalEditMode()
  }
})

// Observation des options de dessin
watch(() => props.drawingOptions, (newOptions) => {
  if (!map.value) return

  // Mise à jour des options de dessin
  map.value.pm.setGlobalOptions({
    pathOptions: {
      color: newOptions.color,
      weight: newOptions.weight
    }
  })
}, { deep: true })

// Calcul des propriétés des formes
function calculateShapeProperties(layer) {
  const properties = {
    area: 0,
    length: 0,
    radius: 0,
    width: 0,
    height: 0
  }

  if (layer instanceof L.Polygon) {
    const latLngs = layer.getLatLngs()[0]
    const coordinates = latLngs.map(ll => [ll.lng, ll.lat])
    coordinates.push(coordinates[0]) // Fermer le polygone
    const polygon = turf.polygon([coordinates])
    properties.area = turf.area(polygon)
  }
  
  if (layer instanceof L.Polyline) {
    const latLngs = layer.getLatLngs()
    const coordinates = latLngs.map(ll => [ll.lng, ll.lat])
    const line = turf.lineString(coordinates)
    properties.length = turf.length(line, { units: 'meters' })
  }

  if (layer instanceof L.Circle) {
    properties.radius = layer.getRadius()
    properties.area = Math.PI * Math.pow(properties.radius, 2)
  }

  return properties
}

// Récupération du profil d'élévation
async function getElevationProfile(layer) {
  try {
    const latLngs = layer.getLatLngs()
    const coordinates = latLngs.map(ll => [ll.lng, ll.lat])
    
    // Ici, vous devrez implémenter l'appel à votre API d'élévation
    // Pour l'exemple, nous utilisons des données simulées
    const elevationData = coordinates.map((coord, i) => ({
      distance: i * 100, // Distance en mètres
      elevation: Math.random() * 100 // Élévation simulée
    }))

    emit('elevation-data', {
      id: L.Util.stamp(layer),
      profile: elevationData
    })
  } catch (error) {
    console.error('Erreur lors de la récupération du profil d\'élévation:', error)
  }
}
</script>

<style>
.map-container {
  @apply bg-gray-100;
}

/* Personnalisation des contrôles Leaflet.PM */
.leaflet-pm-toolbar {
  @apply border-none shadow-lg;
}

.leaflet-pm-toolbar .leaflet-pm-action {
  @apply bg-white hover:bg-gray-50;
}

.leaflet-pm-toolbar .leaflet-pm-action.active {
  @apply bg-primary-100 text-primary-700;
}

/* Personnalisation des marqueurs d'édition */
.leaflet-marker-icon.leaflet-pm-draggable {
  @apply bg-white border-2 border-primary-500;
}
</style> 