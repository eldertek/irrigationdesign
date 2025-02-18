<template>
  <div class="h-full flex overflow-hidden">
    <!-- Carte -->
    <div class="flex-1 relative overflow-hidden">
      <div ref="mapContainer" class="absolute inset-0 w-full h-full"></div>
      
      <!-- Barre d'outils principale -->
      <div class="absolute bottom-6 left-6 z-[1000]">
        <!-- Boutons de gestion des plans -->
        <div class="bg-white rounded-lg shadow-lg p-3 space-y-2">
          <div class="flex items-center space-x-2 mb-2">
            <span class="text-sm font-medium text-gray-600">Actions</span>
          </div>
          <div class="grid grid-cols-1 gap-2">
            <button
              @click="showNewPlanModal = true"
              class="flex items-center px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 transition-colors duration-200"
            >
              <svg class="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/>
              </svg>
              Nouveau plan
            </button>
            
            <button
              @click="showLoadPlanModal = true"
              class="flex items-center px-4 py-2 bg-white text-primary-600 border border-primary-600 rounded-md hover:bg-primary-50 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 transition-colors duration-200"
            >
              <svg class="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"/>
              </svg>
              Charger un plan
            </button>
            
            <button
              v-if="drawingStore.currentPlanId"
              @click="savePlan"
              class="flex items-center px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 transition-colors duration-200"
              :class="{ 'opacity-50 cursor-not-allowed': !drawingStore.hasUnsavedChanges }"
              :disabled="!drawingStore.hasUnsavedChanges"
            >
              <svg class="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4"/>
              </svg>
              Sauvegarder
            </button>
            
            <button
              @click="goToProjects"
              class="flex items-center px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 transition-colors duration-200"
            >
              <svg class="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"/>
              </svg>
              Liste des plans
            </button>
          </div>
        </div>
      </div>

      <!-- Outils de dessin -->
      <div class="drawing-tools-container absolute top-4 right-4 z-[1000]">
        <DrawingTools
          :current-tool="currentTool"
          :selected-shape="selectedShape"
          @tool-change="setDrawingTool"
          @style-update="updateShapeStyle"
          @properties-update="updateShapeProperties"
        />
      </div>

      <!-- Modal Nouveau Plan -->
      <div v-if="showNewPlanModal" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[2000]">
        <div class="bg-white rounded-lg p-6 max-w-md w-full mx-4">
          <div class="flex justify-between items-center mb-4">
            <h2 class="text-xl font-semibold text-gray-900">Créer un nouveau plan</h2>
            <button
              @click="showNewPlanModal = false"
              class="text-gray-400 hover:text-gray-500 focus:outline-none"
            >
              <svg class="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <form @submit.prevent="createNewPlan" class="space-y-4">
            <div>
              <label for="nom" class="block text-sm font-medium text-gray-700">Nom du plan</label>
              <input
                type="text"
                id="nom"
                v-model="newPlanData.nom"
                class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
                required
                placeholder="Entrez le nom du plan"
              />
            </div>
            <div>
              <label for="description" class="block text-sm font-medium text-gray-700">Description</label>
              <textarea
                id="description"
                v-model="newPlanData.description"
                rows="3"
                class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
                placeholder="Décrivez votre plan"
              ></textarea>
            </div>
            <div class="flex justify-end space-x-3 pt-4">
              <button
                type="button"
                @click="showNewPlanModal = false"
                class="px-4 py-2 border border-gray-300 rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 transition-colors duration-200"
              >
                Annuler
              </button>
              <button
                type="submit"
                class="px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 transition-colors duration-200"
              >
                Créer
              </button>
            </div>
          </form>
        </div>
      </div>

      <!-- Modal Charger un Plan -->
      <div v-if="showLoadPlanModal" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[2000]">
        <div class="bg-white rounded-lg p-6 max-w-md w-full mx-4">
          <div class="flex justify-between items-center mb-4">
            <h2 class="text-xl font-semibold text-gray-900">Charger un plan existant</h2>
            <button
              @click="showLoadPlanModal = false"
              class="text-gray-400 hover:text-gray-500 focus:outline-none"
            >
              <svg class="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <div class="max-h-96 overflow-y-auto">
            <div v-if="irrigationStore.plans.length === 0" class="text-center py-8">
              <p class="text-gray-500">Aucun plan disponible</p>
            </div>
            <div v-else class="space-y-2">
              <button
                v-for="plan in irrigationStore.plans"
                :key="plan.id"
                @click="loadPlan(plan.id)"
                class="w-full px-4 py-3 text-left bg-white hover:bg-gray-50 rounded-lg border border-gray-200 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2"
              >
                <div class="font-medium text-gray-900">{{ plan.nom }}</div>
                <div class="text-sm text-gray-500">{{ plan.description }}</div>
                <div class="text-xs text-gray-400 mt-1">
                  Modifié le {{ new Date(plan.date_modification).toLocaleDateString() }}
                </div>
              </button>
            </div>
          </div>
          <div class="mt-6 flex justify-end">
            <button
              @click="showLoadPlanModal = false"
              class="px-4 py-2 border border-gray-300 rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 transition-colors duration-200"
            >
              Fermer
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref, watch, onBeforeUnmount } from 'vue';
import type { LatLngTuple, LatLng } from 'leaflet';
import * as L from 'leaflet';
import * as turf from '@turf/turf';
import DrawingTools from '../components/DrawingTools.vue';
import { useMapDrawing } from '../composables/useMapDrawing';
import { useMapState } from '../composables/useMapState';
import { useIrrigationStore } from '@/stores/irrigation';
import { useDrawingStore } from '@/stores/drawing';
import { useRouter } from 'vue-router';

const mapContainer = ref<HTMLElement | null>(null);
const irrigationStore = useIrrigationStore();
const shapes = ref<any[]>([]);
const selectedShapeInfo = ref<any>(null);
const shapeOptions = ref<any>({});
const semicircleEvents = ref<any>({
  mousedown: null,
  mousemove: null,
  mouseup: null
});

const {
  currentTool,
  selectedShape,
  map,
  initMap: initDrawing,
  setDrawingTool,
  updateShapeStyle,
  updateShapeProperties
} = useMapDrawing();

const {
  initMap: initState
} = useMapState();

const drawingStore = useDrawingStore();
const router = useRouter();

// Ajout des refs pour les modals
const showNewPlanModal = ref(false);
const showLoadPlanModal = ref(false);
const newPlanData = ref({
  nom: '',
  description: ''
});

// Fonction pour sauvegarder la position dans les cookies
function saveMapPosition(mapInstance: L.Map) {
  const center = mapInstance.getCenter();
  const zoom = mapInstance.getZoom();
  const mapState = {
    lat: center.lat,
    lng: center.lng,
    zoom: zoom
  };
  document.cookie = `mapState=${JSON.stringify(mapState)};max-age=2592000;path=/`; // expire dans 30 jours
}

// Fonction pour récupérer la position depuis les cookies
function getMapPosition(): { lat: number; lng: number; zoom: number } | null {
  const cookies = document.cookie.split(';');
  const mapCookie = cookies.find(cookie => cookie.trim().startsWith('mapState='));
  if (mapCookie) {
    try {
      return JSON.parse(mapCookie.split('=')[1]);
    } catch (e) {
      console.error('Erreur lors de la lecture du cookie de position:', e);
      return null;
    }
  }
  return null;
}

onMounted(() => {
  if (mapContainer.value) {
    // Récupérer la dernière position sauvegardée ou utiliser la position par défaut
    const savedPosition = getMapPosition();
    const center: LatLngTuple = savedPosition 
      ? [savedPosition.lat, savedPosition.lng]
      : [46.603354, 1.888334];
    const zoom = savedPosition?.zoom ?? 6;

    // Initialiser les outils de dessin (qui crée aussi la carte)
    const mapInstance = initDrawing(mapContainer.value, center, zoom) as L.Map;
    
    // Configurer la langue française pour Leaflet-Geoman
    mapInstance.pm.setLang('fr');
    
    // Désactiver les contrôles de rotation par défaut
    mapInstance.pm.addControls({
      rotateMode: false
    });
    
    // Ajouter la couche de carte satellite Esri World Imagery
    L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
      attribution: 'Tiles © Esri — Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community',
      maxZoom: 19
    }).addTo(mapInstance);
    
    // Initialiser l'état de la carte avec l'instance existante
    if (mapInstance) {
      initState(mapInstance);
      
      // Sauvegarder la position quand la carte bouge
      mapInstance.on('moveend', () => {
        saveMapPosition(mapInstance);
      });
      
      // Ajouter l'écouteur d'événement pour le changement de localisation
      window.addEventListener('map-set-location', ((event: CustomEvent) => {
        if (mapInstance && event.detail) {
          const { lat, lng, zoom } = event.detail;
          mapInstance.flyTo([lat, lng], zoom, {
            duration: 1.5,
            easeLinearity: 0.25
          });
        }
      }) as EventListener);
    }
  }
});

// Nettoyer l'écouteur d'événement lors de la destruction du composant
onBeforeUnmount(() => {
  if (map.value) {
    map.value.off('moveend');
  }
});

// Chargement des formes existantes
async function loadExistingShapes() {
  if (!map.value || !irrigationStore.currentPlan) return;

  try {
    const existingShapes = irrigationStore.currentPlan.elements;
    existingShapes.forEach((shape: any) => {
      if (map.value) {
      const layer = L.geoJSON(shape.geometrie, {
        style: shape.proprietes.style
        });
        if (layer instanceof L.Layer) {
          (map.value as unknown as L.LayerGroup).addLayer(layer);
      shapes.value.push({
        id: shape.id,
        type: shape.type_forme,
        layer,
        surface: shape.surface
          });
        }
      }
    });
  } catch (error) {
    console.error('Erreur lors du chargement des formes:', error);
  }
}

function cleanupSemicircleEvents() {
  if (!map.value) return;
  
  // Réactiver le déplacement de la carte
  map.value.dragging.enable();
  
  // Réinitialiser le curseur
  map.value.getContainer().style.cursor = '';
  
  // Supprimer le message d'aide
  const helpMessage = map.value.getContainer().querySelector('.drawing-help-message');
  if (helpMessage) {
    helpMessage.remove();
  }
  
  // Détacher les événements précédents
  if (semicircleEvents.value.mousedown) {
    map.value.off('mousedown', semicircleEvents.value.mousedown);
  }
  if (semicircleEvents.value.mousemove) {
    map.value.off('mousemove', semicircleEvents.value.mousemove);
  }
  if (semicircleEvents.value.mouseup) {
    map.value.off('mouseup', semicircleEvents.value.mouseup);
  }
  
  // Réinitialiser les gestionnaires
  semicircleEvents.value = {
    mousedown: null,
    mousemove: null,
    mouseup: null
  };
}

// Fonction pour formater les distances
function formatDistance(value: number): string {
  if (!value) return '';
  return `${value.toFixed(2)} m`;
}

// Ajout des compteurs pour chaque type de forme
const shapeCounters = ref({
  'rectangle': 0,
  'circle': 0,
  'semicircle': 0,
  'line': 0
});

// Fonction pour obtenir le nom d'affichage de la forme
function getShapeDisplayName(shape: any): string {
  const typeMap: Record<string, string> = {
    'rectangle': 'Rectangle',
    'circle': 'Cercle',
    'semicircle': 'Demi-cercle',
    'line': 'Ligne'
  };
  
  const baseType = shape.type.toLowerCase();
  return typeMap[baseType] || shape.type;
}

// Ajout de la fonction formatSlope
function formatSlope(value: number): string {
  if (!value && value !== 0) return '0 %';
  return `${value.toFixed(1)} %`;
}

// Fonction utilitaire pour obtenir le centre d'une forme
function getLayerCenter(layer: any): L.LatLng {
  if (layer.getCenter) return layer.getCenter();
  if (layer.getBounds) return layer.getBounds().getCenter();
  if (layer.getLatLng) return layer.getLatLng();
  if (layer.getLatLngs) {
    const latLngs = layer.getLatLngs();
    const points = Array.isArray(latLngs[0]) ? latLngs[0] : latLngs;
    const sumLat = points.reduce((sum: number, p: L.LatLng) => sum + p.lat, 0);
    const sumLng = points.reduce((sum: number, p: L.LatLng) => sum + p.lng, 0);
    return L.latLng(sumLat / points.length, sumLng / points.length);
  }
  // Retourner une position par défaut au lieu de null
  return L.latLng(0, 0);
}

// Fonction utilitaire pour décaler un point en mètres
function offsetLatLng(latlng: L.LatLng, meters: number): L.LatLng {
  const earthRadius = 6378137; // rayon de la Terre en mètres
  const latOffset = (meters / earthRadius) * (180 / Math.PI);
  return L.latLng(latlng.lat + latOffset, latlng.lng);
}

// Fonction utilitaire pour calculer l'angle entre deux points
function getAngle(center: L.LatLng, latlng: L.LatLng): number {
  return Math.atan2(latlng.lat - center.lat, latlng.lng - center.lng) * 180 / Math.PI;
}

// Fonction pour mettre à jour les propriétés de rotation d'une forme
function updateShapeRotationProperty(layer: any, angle: number) {
  const shape = shapes.value.find(s => s.layer === layer);
  if (shape && shape.properties) {
    shape.properties.rotation = angle;
    if (selectedShapeInfo.value && selectedShapeInfo.value.id === shape.id) {
      selectedShapeInfo.value.properties = shape.properties;
    }
  }
}

// Fonction pour créer le contrôle de rotation
function createRotationControl(layer: any) {
  if (!map.value || !layer) {
    console.warn('Map or layer not initialized');
    return null;
  }

  // Supprimer l'ancien contrôle de rotation s'il existe
  if (layer._rotationControl) {
    map.value.removeLayer(layer._rotationControl);
    delete layer._rotationControl;
  }

  // Obtenir le centre de la forme
  const center = getLayerCenter(layer);
  if (!center) {
    console.warn('Cannot determine center of layer');
    return null;
  }

  // Calculer la position du contrôle de rotation
  let radiusPx = 50; // valeur par défaut
  if (layer.getRadius) {
    const radiusMeters = layer.getRadius();
    const centerPoint = map.value.latLngToLayerPoint(center);
    const testLatLng = offsetLatLng(center, radiusMeters);
    const testPoint = map.value.latLngToLayerPoint(testLatLng);
    radiusPx = centerPoint.distanceTo(testPoint);
  } else if (layer.getBounds) {
    const bounds = layer.getBounds();
    const northPoint = map.value.latLngToLayerPoint(bounds.getNorth());
    const centerPoint = map.value.latLngToLayerPoint(center);
    radiusPx = centerPoint.distanceTo(northPoint);
  }

  // Créer un identifiant unique pour cette instance
  const controlId = `rotation-control-${Date.now()}`;

  // Créer l'icône de rotation
  const rotationIcon = L.divIcon({
    className: `rotation-control ${controlId}`,
    html: `<svg viewBox="0 0 24 24" width="24" height="24">
      <path fill="currentColor" d="M12 4V1L8 5l4 4V6c3.31 0 6 2.69 6 6 0 1.01-.25 1.97-.7 2.8l1.46 1.46C19.54 15.03 20 13.57 20 12c0-4.42-3.58-8-8-8zm0 14c-3.31 0-6-2.69-6-6 0-1.01.25-1.97.7-2.8L5.24 7.74C4.46 8.97 4 10.43 4 12c0 4.42 3.58 8 8 8v3l4-4-4-4v3z"/>
    </svg>`,
    iconSize: [32, 32],
    iconAnchor: [16, 16]
  });

  // Calculer la position du contrôle
  const controlPoint = map.value.latLngToLayerPoint(center).subtract([0, radiusPx + 40]);
  const controlLatLng = map.value.layerPointToLatLng(controlPoint);

  // Créer le marqueur de rotation (non draggable)
  const rotationControl = L.marker(controlLatLng, {
    icon: rotationIcon,
    draggable: false,
    zIndexOffset: 1000,
    pmIgnore: true,
    interactive: true
  });

  let rotationActive = false;
  let startAngle = 0;

  function onRotateMove(e: L.LeafletMouseEvent) {
    if (!rotationActive) return;
    const currentAngle = getAngle(center, e.latlng);
    const angleDiff = currentAngle - startAngle;
    const roundedAngle = Math.round(angleDiff / 5) * 5;
    
    if (typeof layer.setRotation === 'function') {
      layer.setRotation(roundedAngle);
      updateShapeRotationProperty(layer, roundedAngle);
    }
  }

  function endRotation() {
    rotationActive = false;
    const rotationElement = document.querySelector(`.${controlId}`);
    if (rotationElement) {
      rotationElement.classList.remove('rotating');
    }
    map.value?.off('mousemove', onRotateMove);
    
    // Réactiver l'édition de la forme après la rotation
    if (layer.pm) {
      layer.pm.enable({
        allowSelfIntersection: false,
        preventMarkerRemoval: true,
        removeLayerOnEmpty: false
      });
    }
  }

  // Gestionnaire de clic pour démarrer/arrêter la rotation
  rotationControl.on('click', (e: L.LeafletMouseEvent) => {
    L.DomEvent.stopPropagation(e);
    
    if (!rotationActive) {
      // Désactiver temporairement l'édition pendant la rotation
      if (layer.pm) {
        layer.pm.disable();
      }

      // Démarrer la rotation
      rotationActive = true;
      startAngle = getAngle(center, rotationControl.getLatLng());
      
      const rotationElement = document.querySelector(`.${controlId}`);
      if (rotationElement) {
        rotationElement.classList.add('rotating');
      }

      map.value?.on('mousemove', onRotateMove);
      map.value?.once('click', endRotation);
    }
  });

  // Ajouter le contrôle directement à la carte
  if (rotationControl instanceof L.Layer) {
    (map.value as unknown as L.LayerGroup).addLayer(rotationControl);
  }

  // Sauvegarder la référence au contrôle
  layer._rotationControl = rotationControl;

  return rotationControl;
}

// Fonction pour sélectionner une forme
function selectShape(shape: any) {
  if (!map.value) {
    console.warn('Map not initialized');
    return;
  }

  try {
    console.log('Selecting shape:', shape);

    // Désélectionner la forme précédente
    if (selectedShapeInfo.value && selectedShapeInfo.value.id !== shape.id) {
      const previousLayer = shapes.value.find(s => s.id === selectedShapeInfo.value.id)?.layer;
      if (previousLayer) {
        console.log('Disabling previous shape');
        previousLayer.pm.disable();
        if (previousLayer._rotationControl) {
          console.log('Removing previous rotation control');
          map.value.removeLayer(previousLayer._rotationControl);
          delete previousLayer._rotationControl;
        }
      }
    }

    // Sélectionner la nouvelle forme
    const layer = shape.layer;
    if (layer) {
      selectedShape.value = layer;
      
      // S'assurer que les propriétés sont calculées et mises à jour
      const properties = calculateShapeProperties(layer);
      console.log('Calculated properties for selected shape:', properties);
      
      selectedShapeInfo.value = {
        id: shape.id,
        type: shape.type,
        properties: {
          ...properties,
          style: layer.options || {}
        },
        layer: layer
      };

      // Activer l'édition sur la forme sélectionnée
      layer.pm.enable({
        allowSelfIntersection: false,
        preventMarkerRemoval: true,
        removeLayerOnEmpty: false
      });

      // Créer le contrôle de rotation si nécessaire
      if (typeof layer.setRotation !== 'function') {
        addRotationSupport(layer);
      }

      // Créer le contrôle de rotation après un court délai
      setTimeout(() => {
        const rotationControl = createRotationControl(layer);
        if (rotationControl && layer.getBounds) {
          map.value?.fitBounds(layer.getBounds(), { padding: [50, 50] });
        }
      }, 100);
    }
  } catch (error) {
    console.error('Error in selectShape:', error);
  }
}

// Ajouter la fonction setRotation à la couche Leaflet
function addRotationSupport(layer: any) {
  if (!layer || typeof layer.setRotation === 'function') return;

  layer.setRotation = function(angle: number) {
    if (!map.value) return;

    try {
      if (layer.properties?.type === 'Semicircle') {
        // Pour un demi-cercle, on met à jour directement l'orientation
        const currentOrientation = layer.properties.orientation || 0;
        const newOrientation = (currentOrientation + angle) % 360;
        
        // Mettre à jour les propriétés
        layer.properties.orientation = newOrientation;
        layer.properties.style.startAngle = newOrientation;
        layer.properties.style.stopAngle = newOrientation + 180;

        // Si c'est un CircleArc, utiliser sa méthode setAngles
        if (typeof layer.setAngles === 'function') {
          layer.setAngles(newOrientation, newOrientation + 180);
        } else {
          // Fallback pour les autres types de couches
          layer.setStyle({
            startAngle: newOrientation,
            stopAngle: newOrientation + 180
          });
        }

        // Émettre un événement pour notifier les changements
        layer.fire('rotate', { angle: newOrientation });
        return;
      }

      // Pour les autres formes, rotation normale
      const center = layer.getBounds ? 
        layer.getBounds().getCenter() : 
        (layer.getLatLng ? layer.getLatLng() : null);

      if (!center) return;

      const centerPoint = map.value.latLngToLayerPoint(center);
      const latLngs = layer.getLatLngs();
      const points = Array.isArray(latLngs[0]) ? latLngs[0] : latLngs;

      const rotatedPoints = points.map((latLng: L.LatLng) => {
        const point = map.value!.latLngToLayerPoint(latLng);
        const rotatedPoint = rotatePoint(point, centerPoint, angle);
        return map.value!.layerPointToLatLng(rotatedPoint);
      });

      if (Array.isArray(latLngs[0])) {
        layer.setLatLngs([rotatedPoints]);
      } else {
        layer.setLatLngs(rotatedPoints);
      }

      // Émettre un événement pour notifier les changements
      layer.fire('rotate', { angle });
    } catch (error) {
      console.error('Error rotating shape:', error);
    }
  };
}

// Mise à jour du style de dessin
watch(() => shapeOptions.value, (newOptions) => {
  updateDrawingStyle();
}, { deep: true });

// Fonction pour sélectionner une couleur
function selectColor(color: string) {
  shapeOptions.value.color = color;
  updateDrawingStyle();
}

// Ajouter la fonction formatAngle
function formatAngle(angle: number): string {
  if (!angle && angle !== 0) return '0°';
  return `${Math.round(angle)}°`;
}

// Fonction utilitaire pour faire pivoter un point autour d'un centre
function rotatePoint(point: L.Point, center: L.Point, angle: number): L.Point {
  const rad = angle * Math.PI / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const dx = point.x - center.x;
  const dy = point.y - center.y;
  return new L.Point(
    center.x + dx * cos - dy * sin,
    center.y + dx * sin + dy * cos
  );
}

function updateDrawingStyle() {
  // Implémentation à ajouter
  console.log('Updating drawing style:', shapeOptions.value);
}

// Fonction pour calculer les propriétés d'une forme
function calculateShapeProperties(layer: L.Layer): {
  area: number;
  length: number;
  radius: number;
  width: number;
  height: number;
  perimeter: number;
} {
  console.log('Calculating properties for layer:', layer);
  const properties = {
    area: 0,
    length: 0,
    radius: 0,
    width: 0,
    height: 0,
    perimeter: 0
  };

  try {
    if (layer instanceof L.Polygon) {
      const latLngs = layer.getLatLngs()[0] as LatLng[];
      const coordinates = latLngs.map((ll: LatLng) => [ll.lng, ll.lat]);
      coordinates.push(coordinates[0]); // Fermer le polygone
      const polygon = turf.polygon([coordinates]);
      properties.area = turf.area(polygon);
      properties.perimeter = turf.length(turf.lineString([...coordinates]), { units: 'meters' });
      console.log('Polygon properties calculated:', properties);
    }
    
    if (layer instanceof L.Polyline) {
      const latLngs = layer.getLatLngs() as LatLng[];
      const coordinates = latLngs.map((ll: LatLng) => [ll.lng, ll.lat]);
      const line = turf.lineString(coordinates);
      properties.length = turf.length(line, { units: 'meters' });
      console.log('Polyline properties calculated:', properties);
    }

    if (layer instanceof L.Circle) {
      properties.radius = layer.getRadius();
      properties.area = Math.PI * Math.pow(properties.radius, 2);
      properties.perimeter = 2 * Math.PI * properties.radius;
      console.log('Circle properties calculated:', properties);
    }

    if (layer instanceof L.Rectangle) {
      const bounds = layer.getBounds();
      const ne = bounds.getNorthEast();
      const sw = bounds.getSouthWest();
      const width = turf.distance([sw.lng, sw.lat], [ne.lng, sw.lat], { units: 'meters' });
      const height = turf.distance([sw.lng, sw.lat], [sw.lng, ne.lat], { units: 'meters' });
      properties.width = width;
      properties.height = height;
      properties.area = width * height;
      properties.perimeter = 2 * (width + height);
      console.log('Rectangle properties calculated:', properties);
    }
  } catch (error) {
    console.error('Error calculating shape properties:', error);
  }

  return properties;
}

// Fonction pour créer un nouveau plan
async function createNewPlan() {
  try {
    // Créer le plan
    const plan = await irrigationStore.createPlan(newPlanData.value);
    // Définir comme plan courant dans le store de dessin
    drawingStore.setCurrentPlan(plan.id);
    // Réinitialiser le formulaire
    newPlanData.value = { nom: '', description: '' };
    showNewPlanModal.value = false;
  } catch (error) {
    console.error('Erreur lors de la création du plan:', error);
  }
}

// Fonction pour charger un plan existant
async function loadPlan(planId: number) {
  try {
    await drawingStore.loadPlanElements(planId);
    showLoadPlanModal.value = false;
  } catch (error) {
    console.error('Erreur lors du chargement du plan:', error);
  }
}

// Fonction pour sauvegarder le plan courant
async function savePlan() {
  try {
    if (drawingStore.hasUnsavedChanges) {
      await drawingStore.saveToPlan();
    }
  } catch (error) {
    console.error('Erreur lors de la sauvegarde du plan:', error);
  }
}

// Fonction pour aller à la liste des plans
function goToProjects() {
  router.push('/projects');
}
</script>

<style>
@import 'leaflet/dist/leaflet.css';

/* Masquer les contrôles de rotation */
.leaflet-pm-toolbar .leaflet-pm-icon-rotate,
.button-container[title="Tourner des calques"],
.leaflet-pm-toolbar .button-container[title="Tourner des calques"] {
  display: none !important;
}

/* Masquer le bouton de rotation des calques */
.button-container[title="Tourner des calques"] {
  display: none !important;
}

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

/* Styles pour le contrôle de rotation */
.rotation-control {
  width: 32px !important;
  height: 32px !important;
  margin-left: -16px !important;
  margin-top: -16px !important;
  cursor: pointer !important;
  background: white !important;
  border: 2px solid #3388ff !important;
  border-radius: 50% !important;
  display: flex !important;
  align-items: center !important;
  justify-content: center !important;
  box-shadow: 0 2px 5px rgba(0, 0, 0, 0.2) !important;
  transition: all 0.2s ease !important;
  pointer-events: auto !important;
  z-index: 1000 !important;
}

.rotation-control:hover {
  transform: scale(1.1) !important;
  background: #e6f0ff !important;
  box-shadow: 0 3px 8px rgba(0, 0, 0, 0.3) !important;
}

.rotation-control.rotating {
  background: #e6f0ff !important;
  transform: scale(1.1) !important;
  border-color: #2563eb !important;
  box-shadow: 0 0 0 4px rgba(37, 99, 235, 0.2) !important;
}

.rotation-control svg {
  width: 24px !important;
  height: 24px !important;
  color: #3388ff !important;
  transition: transform 0.2s ease !important;
  pointer-events: none !important;
}

.rotation-control.rotating svg {
  animation: rotate 2s linear infinite !important;
}

/* Styles pour la forme en cours de rotation */
.leaflet-interactive.rotating {
  transition: transform 0.1s ease-out !important;
}

/* Curseur personnalisé pendant la rotation */
.map-rotating {
  cursor: url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="%233388ff"><path d="M12 4V1L8 5l4 4V6c3.31 0 6 2.69 6 6 0 1.01-.25 1.97-.7 2.8l1.46 1.46C19.54 15.03 20 13.57 20 12c0-4.42-3.58-8-8-8zm0 14c-3.31 0-6-2.69-6-6 0-1.01.25-1.97.7-2.8L5.24 7.74C4.46 8.97 4 10.43 4 12c0 4.42 3.58 8 8 8v3l4-4-4-4v3z"/></svg>') 16 16, auto !important;
}

@keyframes rotate {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

/* S'assurer que le contrôle de rotation est toujours visible */
.leaflet-marker-icon.rotation-control {
  z-index: 1000 !important;
  opacity: 1 !important;
  visibility: visible !important;
  display: flex !important;
}

/* Ajuster la position de l'icône dans le contrôle */
.rotation-control .leaflet-div-icon {
  background: transparent !important;
  border: none !important;
}

/* Positionnement des outils de dessin */
.drawing-tools-container {
  position: absolute;
  top: 20px;
  right: 20px;
  background: white;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
  padding: 16px;
  width: 320px;
  max-height: calc(100vh - 40px);
  overflow-y: auto;
  z-index: 1000;
}
</style> 