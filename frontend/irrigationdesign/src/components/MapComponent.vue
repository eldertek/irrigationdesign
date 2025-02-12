<template>
  <div class="h-full w-full">
    <div ref="mapContainer" class="h-full w-full"></div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { useIrrigationStore } from '@/stores/irrigation'
import 'leaflet/dist/leaflet.css'
import L from 'leaflet'

const mapContainer = ref(null)
const map = ref(null)
const drawingLayer = ref(null)
const irrigationStore = useIrrigationStore()

// Configuration de la carte
const initMap = () => {
  if (!mapContainer.value) return

  // Création de la carte
  map.value = L.map(mapContainer.value).setView([48.8566, 2.3522], 13)

  // Ajout du fond de carte OpenStreetMap
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap contributors'
  }).addTo(map.value)

  // Initialisation de la couche de dessin
  drawingLayer.value = new L.FeatureGroup()
  map.value.addLayer(drawingLayer.value)

  // Ajout des contrôles de dessin
  const drawingOptions = {
    position: 'topright',
    draw: {
      polyline: {
        shapeOptions: {
          color: '#3388ff',
          weight: 4
        }
      },
      polygon: false,
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
    }
  }

  // Initialisation des événements de dessin
  map.value.on('draw:created', async (e) => {
    const layer = e.layer
    drawingLayer.value.addLayer(layer)

    // Préparation des données pour la sauvegarde
    const shapeData = {
      type: e.layerType,
      geometrie: layer.toGeoJSON().geometry,
      proprietes: {
        style: layer.options,
        radius: layer.getRadius ? layer.getRadius() : undefined
      }
    }

    try {
      // Si un plan est sélectionné, on sauvegarde la forme
      if (irrigationStore.currentPlan) {
        const response = await irrigationStore.createShape({
          plan_id: irrigationStore.currentPlan.id,
          ...shapeData
        })
        // Mise à jour de l'ID de la forme après sauvegarde
        layer.id = response.data.id
      }

      // Émettre l'événement avec la forme créée
      emit('shape-created', {
        id: layer.id,
        type: e.layerType,
        coordinates: layer.getLatLngs(),
        radius: layer.getRadius ? layer.getRadius() : null
      })
    } catch (error) {
      console.error('Erreur lors de la sauvegarde de la forme:', error)
      // En cas d'erreur, on supprime la forme de la carte
      drawingLayer.value.removeLayer(layer)
    }
  })

  // Chargement des formes existantes si un plan est sélectionné
  if (irrigationStore.currentPlan) {
    loadExistingShapes()
  }
}

// Chargement des formes existantes
const loadExistingShapes = async () => {
  try {
    const shapes = await irrigationStore.getShapes(irrigationStore.currentPlan.id)
    shapes.forEach(shape => {
      const layer = L.geoJSON(shape.geometrie, {
        style: shape.proprietes.style
      })
      layer.id = shape.id
      drawingLayer.value.addLayer(layer)
    })
  } catch (error) {
    console.error('Erreur lors du chargement des formes:', error)
  }
}

// Nettoyage de la carte lors de la destruction du composant
onUnmounted(() => {
  if (map.value) {
    map.value.remove()
  }
})

// Initialisation de la carte au montage du composant
onMounted(() => {
  initMap()
})

defineExpose({
  map,
  drawingLayer
})
</script>

<style>
@import 'leaflet/dist/leaflet.css';
</style> 