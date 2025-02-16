<template>
  <div class="h-full">
    <!-- Barre d'outils -->
    <div class="fixed top-16 left-4 z-10 bg-white rounded-lg shadow-lg p-2">
      <div class="space-y-2">
        <button
          v-for="tool in drawingTools"
          :key="tool.name"
          @click="selectTool(tool)"
          class="w-10 h-10 flex items-center justify-center rounded-lg hover:bg-gray-100"
          :class="{ 'bg-primary-100': currentTool?.name === tool.name }"
          :title="tool.label"
        >
          <component :is="tool.icon" class="w-6 h-6 text-gray-600" />
        </button>
      </div>
    </div>

    <!-- Carte -->
    <div ref="mapContainer" class="h-full"></div>

    <!-- Panneau latéral -->
    <div
      v-if="showSidebar"
      class="fixed top-16 right-0 w-80 h-[calc(100vh-4rem)] bg-white shadow-lg p-4 overflow-y-auto"
    >
      <div class="space-y-6">
        <!-- Calques -->
        <div>
          <h3 class="text-lg font-medium text-gray-900 mb-4">Calques</h3>
          <div class="space-y-2">
            <div
              v-for="layer in layers"
              :key="layer.id"
              class="flex items-center justify-between p-2 bg-gray-50 rounded-lg"
            >
              <div class="flex items-center space-x-2">
                <input
                  :id="layer.id"
                  v-model="layer.visible"
                  type="checkbox"
                  class="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                />
                <label :for="layer.id" class="text-sm font-medium text-gray-700">
                  {{ layer.name }}
                </label>
              </div>
              <button
                @click="toggleLayerLock(layer)"
                class="p-1 rounded-md hover:bg-gray-200"
                :title="layer.locked ? 'Déverrouiller' : 'Verrouiller'"
              >
                <component
                  :is="layer.locked ? 'LockClosedIcon' : 'LockOpenIcon'"
                  class="w-4 h-4 text-gray-500"
                />
              </button>
            </div>
          </div>
        </div>

        <!-- Actions -->
        <div class="space-y-2">
          <button
            @click="savePlan"
            class="w-full flex items-center justify-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
          >
            Sauvegarder
          </button>
          <button
            @click="exportPlan"
            class="w-full flex items-center justify-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
          >
            Exporter
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

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
</script>
