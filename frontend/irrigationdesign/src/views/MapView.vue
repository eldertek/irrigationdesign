<template>
  <div class="h-screen flex">
    <!-- Carte -->
    <div class="flex-1 relative">
      <div ref="mapContainer" class="absolute inset-0"></div>
      <!-- Outils de dessin -->
      <div class="drawing-tools-container">
        <DrawingTools
          :current-tool="currentTool"
          :selected-shape="selectedShape"
          @tool-change="setDrawingTool"
          @style-update="updateShapeStyle"
          @properties-update="updateShapeProperties"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref, watch } from 'vue';
import type { LatLngTuple } from 'leaflet';
import * as L from 'leaflet';
import DrawingTools from '../components/DrawingTools.vue';
import { useMapDrawing } from '../composables/useMapDrawing';
import { useMapState } from '../composables/useMapState';
import { useIrrigationStore } from '@/stores/irrigation';

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

onMounted(() => {
  if (mapContainer.value) {
    // Coordonnées centrées sur la France
    const center: LatLngTuple = [46.603354, 1.888334];
    const zoom = 6;

    // Initialiser les outils de dessin (qui crée aussi la carte)
    const mapInstance = initDrawing(mapContainer.value, center, zoom) as L.Map;
    
    // Initialiser l'état de la carte avec l'instance existante
    if (mapInstance) {
      initState(mapInstance);
    }
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
      selectedShapeInfo.value = {
        id: shape.id,
        type: shape.type,
        properties: layer.properties || {},
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