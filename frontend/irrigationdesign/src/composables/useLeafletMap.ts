import { ref, onUnmounted } from 'vue';
import L from 'leaflet';
import '@geoman-io/leaflet-geoman-free';
import { calculateShapeProperties } from '@/utils/shapeCalculations';

export function useLeafletMap() {
  const map = ref<L.Map | null>(null);
  const featureGroup = ref<L.FeatureGroup | null>(null);
  const drawingState = ref<'idle' | 'drawing' | 'rotating'>('idle');

  const initializeMap = (container: HTMLElement, center: L.LatLng, zoom: number) => {
    // Configuration des fonds de carte
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
    };

    // Création de la carte
    map.value = L.map(container, {
      layers: [baseMaps['Satellite']]
    }).setView(center, zoom);

    // Ajout du contrôle de couches
    L.control.layers(baseMaps).addTo(map.value);

    // Initialisation du groupe de formes
    featureGroup.value = new L.FeatureGroup();
    map.value.addLayer(featureGroup.value);

    return { map: map.value, featureGroup: featureGroup.value };
  };

  const initializeDrawingTools = (options: any) => {
    if (!map.value) return;
    
    // Configuration des outils de dessin
    map.value.pm.addControls({
      position: 'topleft',
      drawCircle: true,
      drawCircleMarker: false,
      drawPolyline: true,
      drawRectangle: true,
      drawPolygon: true,
      drawMarker: false,
      drawText: false,
      cutPolygon: false,
      dragMode: false,
      removalMode: true,
      editMode: true,
      ...options
    });
  };

  const handleShapeCreated = (e: any, callback?: (shape: any) => void) => {
    const layer = e.layer;
    const shapeType = e.shape || layer.options.shape || 'unknown';
    
    // Calculer les propriétés de la forme
    const properties = calculateShapeProperties(layer, shapeType);
    
    // Ajouter la forme au groupe
    if (featureGroup.value) {
      featureGroup.value.addLayer(layer);
    }
    
    if (callback) {
      callback({ layer, properties, type: shapeType });
    }
  };

  const handleShapeEdited = (e: any, callback?: (shape: any) => void) => {
    const layer = e.layer;
    const shapeType = layer.shape || layer.options.shape || 'unknown';
    
    // Recalculer les propriétés après modification
    const properties = calculateShapeProperties(layer, shapeType);
    
    if (callback) {
      callback({ layer, properties, type: shapeType });
    }
  };

  const handleShapeRemoved = (e: any, callback?: (layer: L.Layer) => void) => {
    if (callback) {
      callback(e.layer);
    }
  };

  const clearMap = () => {
    if (featureGroup.value) {
      featureGroup.value.clearLayers();
    }
  };

  const setDrawingState = (state: 'idle' | 'drawing' | 'rotating') => {
    drawingState.value = state;
  };

  onUnmounted(() => {
    if (map.value) {
      map.value.remove();
      map.value = null;
    }
  });

  return {
    map,
    featureGroup,
    drawingState,
    initializeMap,
    initializeDrawingTools,
    handleShapeCreated,
    handleShapeEdited,
    handleShapeRemoved,
    clearMap,
    setDrawingState
  };
} 