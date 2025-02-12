<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { useIrrigationStore } from '@/stores/irrigation'
import * as L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import '@geoman-io/leaflet-geoman-free'
import '@geoman-io/leaflet-geoman-free/dist/leaflet-geoman.css'

const irrigationStore = useIrrigationStore()
const mapContainer = ref<HTMLElement | null>(null)
const map = ref<L.Map | null>(null)
const showSidebar = ref(true)
const currentTool = ref(null)
const selectedElement = ref(null)

const currentPlan = irrigationStore.currentPlan

// Outils de dessin
const drawingTools = [
  {
    name: 'marker',
    label: 'Marqueur',
    icon: 'MapPinIcon'
  },
  {
    name: 'polyline',
    label: 'Ligne',
    icon: 'PencilIcon'
  },
  {
    name: 'polygon',
    label: 'Polygone',
    icon: 'Square2StackIcon'
  },
  {
    name: 'circle',
    label: 'Cercle',
    icon: 'CircleStackIcon'
  },
  {
    name: 'rectangle',
    label: 'Rectangle',
    icon: 'RectangleStackIcon'
  }
]

// Calques
const layers = ref([
  {
    id: 'base',
    name: 'Fond de carte',
    visible: true,
    locked: true
  },
  {
    id: 'irrigation',
    name: 'Système d\'irrigation',
    visible: true,
    locked: false
  },
  {
    id: 'annotations',
    name: 'Annotations',
    visible: true,
    locked: false
  }
])

// Initialisation de la carte
onMounted(() => {
  if (mapContainer.value) {
    // Création de la carte
    map.value = L.map(mapContainer.value).setView([48.8566, 2.3522], 13)

    // Ajout du fond de carte OpenStreetMap
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors'
    }).addTo(map.value)

    // Initialisation des contrôles de dessin
    map.value.pm.addControls({
      position: 'topleft',
      drawMarker: true,
      drawPolyline: true,
      drawRectangle: true,
      drawPolygon: true,
      drawCircle: true,
      editMode: true,
      dragMode: true,
      cutPolygon: true,
      removalMode: true
    })

    // Chargement des données du plan si disponibles
    if (currentPlan?.elements) {
      loadPlanElements(currentPlan.elements)
    }

    // Événements de la carte
    map.value.on('pm:create', (e) => {
      console.log('Created shape:', e.layer)
      // Ajouter l'élément créé à la couche appropriée
    })

    map.value.on('pm:remove', (e) => {
      console.log('Removed shape:', e.layer)
      // Supprimer l'élément de la couche
    })
  }
})

// Nettoyage
onUnmounted(() => {
  if (map.value) {
    map.value.remove()
  }
})

// Fonctions
function toggleSidebar() {
  showSidebar.value = !showSidebar.value
}

function selectTool(tool: any) {
  currentTool.value = tool
  if (map.value) {
    // Activer l'outil de dessin correspondant
    map.value.pm.enableDraw(tool.name)
  }
}

function toggleLayerLock(layer: any) {
  layer.locked = !layer.locked
  // Mettre à jour les permissions d'édition de la couche
}

function loadPlanElements(elements: any[]) {
  // Charger les éléments du plan sur la carte
}

async function savePlan() {
  try {
    // Récupérer les éléments de la carte
    const elements = []
    if (map.value) {
      map.value.eachLayer((layer) => {
        if (layer instanceof L.Polygon || layer instanceof L.Polyline || layer instanceof L.Marker) {
          elements.push({
            type: layer.constructor.name,
            coordinates: layer.getLatLngs()
          })
        }
      })
    }

    // Sauvegarder le plan
    if (currentPlan) {
      await irrigationStore.updatePlan(currentPlan.id, {
        elements
      })
    } else {
      // Créer un nouveau plan
      await irrigationStore.createPlan({
        nom: 'Nouveau plan',
        description: 'Description du plan',
        elements
      })
    }
  } catch (error) {
    console.error('Erreur lors de la sauvegarde du plan:', error)
  }
}

function exportPlan() {
  // Exporter le plan au format GeoJSON
  if (map.value) {
    const geojson = {
      type: 'FeatureCollection',
      features: []
    }

    map.value.eachLayer((layer) => {
      if (layer instanceof L.Polygon || layer instanceof L.Polyline || layer instanceof L.Marker) {
        geojson.features.push(layer.toGeoJSON())
      }
    })

    // Télécharger le fichier
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(geojson))
    const downloadAnchorNode = document.createElement('a')
    downloadAnchorNode.setAttribute('href', dataStr)
    downloadAnchorNode.setAttribute('download', 'plan.geojson')
    document.body.appendChild(downloadAnchorNode)
    downloadAnchorNode.click()
    downloadAnchorNode.remove()
  }
}
<template>
  <main>
    <TheWelcome />
  </main>
</template>
