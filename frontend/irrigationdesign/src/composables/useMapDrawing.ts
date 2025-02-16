import { ref, onUnmounted } from 'vue';
import L from 'leaflet';
import '@geoman-io/leaflet-geoman-free';
import { useShapeProperties } from './useShapeProperties';
import { useElevationApi } from './useElevationApi';

export function useMapDrawing() {
  const map = ref<L.Map | null>(null);
  const featureGroup = ref<L.FeatureGroup | null>(null);
  const currentTool = ref<string>('');
  const selectedShape = ref<any>(null);
  const isDrawing = ref(false);

  const { calculateProperties } = useShapeProperties();
  const { fetchElevation } = useElevationApi();

  const initMap = (element: HTMLElement, center: L.LatLngExpression, zoom: number) => {
    map.value = L.map(element).setView(center, zoom);
    
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors'
    }).addTo(map.value);

    featureGroup.value = new L.FeatureGroup().addTo(map.value);

    // Désactiver tous les contrôles par défaut de Leaflet-Geoman
    map.value.pm.addControls({
      position: 'topleft',
      drawMarker: false,
      drawPolyline: false,
      drawRectangle: false,
      drawPolygon: false,
      drawCircle: false,
      drawCircleMarker: false,
      drawText: false,
      editMode: false,
      dragMode: false,
      cutPolygon: false,
      removalMode: false
    });

    // Événements de dessin
    map.value.on('pm:drawstart', () => {
      isDrawing.value = true;
    });

    map.value.on('pm:drawend', () => {
      isDrawing.value = false;
    });

    map.value.on('pm:create', async (e: any) => {
      const layer = e.layer;
      featureGroup.value?.addLayer(layer);
      
      // Initialiser les propriétés de style
      layer.properties = {
        style: {
          fillColor: '#3B82F6',
          fillOpacity: 0.2,
          color: '#2563EB',
          weight: 2
        }
      };

      // Calculer les propriétés géométriques
      const props = calculateProperties(layer);
      layer.properties = { ...layer.properties, ...props };

      // Récupérer les données d'élévation
      try {
        const points = getLayerPoints(layer);
        const elevationData = await fetchElevation(points);
        layer.properties.elevation = elevationData;
      } catch (error) {
        console.error('Erreur lors de la récupération des données d\'élévation:', error);
      }

      selectedShape.value = layer;
    });

    // Événements de sélection
    map.value.on('click', (e: L.LeafletMouseEvent) => {
      const target = e.target;
      if (target === map.value) {
        selectedShape.value = null;
      }
    });

    featureGroup.value.on('click', (e: L.LeafletMouseEvent) => {
      L.DomEvent.stopPropagation(e);
      const layer = e.layer;
      selectedShape.value = layer;
    });

    // Événements d'édition
    map.value.on('pm:edit', (e: any) => {
      const layer = e.layer;
      if (layer) {
        const props = calculateProperties(layer);
        layer.properties = { ...layer.properties, ...props };
        if (layer === selectedShape.value) {
          selectedShape.value = { ...layer };
        }
      }
    });

    return map.value;
  };

  const setDrawingTool = (tool: string) => {
    if (!map.value) return;

    // Désactiver tous les modes
    map.value.pm.disableDraw();
    map.value.pm.disableGlobalEditMode();
    map.value.pm.disableGlobalDragMode();
    map.value.pm.disableGlobalRemovalMode();

    currentTool.value = tool;

    switch (tool) {
      case 'Circle':
        map.value.pm.enableDraw('Circle');
        break;
      case 'Semicircle':
        map.value.pm.enableDraw('Circle', {
          // Configuration spécifique pour le demi-cercle
          // À implémenter
        });
        break;
      case 'Rectangle':
        map.value.pm.enableDraw('Rectangle');
        break;
      case 'Polygon':
        map.value.pm.enableDraw('Polygon');
        break;
      case 'Line':
        map.value.pm.enableDraw('Line');
        break;
      case 'edit':
        map.value.pm.enableGlobalEditMode();
        break;
      case 'drag':
        map.value.pm.enableGlobalDragMode();
        break;
      case 'delete':
        map.value.pm.enableGlobalRemovalMode();
        break;
    }
  };

  const updateShapeStyle = (style: any) => {
    if (!selectedShape.value) return;

    const layer = selectedShape.value;
    
    // Mettre à jour les propriétés stockées
    layer.properties = layer.properties || {};
    layer.properties.style = layer.properties.style || {};
    layer.properties.style = { ...layer.properties.style, ...style };

    // Créer l'objet de style Leaflet
    const leafletStyle: L.PathOptions = {};
    
    // Gérer la couleur de remplissage
    if (style.fillColor) leafletStyle.fillColor = style.fillColor;
    if (style.fillOpacity !== undefined) leafletStyle.fillOpacity = style.fillOpacity;
    
    // Gérer la bordure
    if (style.strokeColor) leafletStyle.color = style.strokeColor;
    if (style.strokeOpacity !== undefined) leafletStyle.opacity = style.strokeOpacity;
    if (style.strokeWidth !== undefined) leafletStyle.weight = style.strokeWidth;
    
    // Gérer le type de trait
    if (style.dashArray) leafletStyle.dashArray = style.dashArray;

    // Appliquer le style à la couche Leaflet
    layer.setStyle(leafletStyle);
  };

  const updateShapeProperties = (properties: any) => {
    if (!selectedShape.value) return;

    const layer = selectedShape.value;
    layer.properties = { ...layer.properties, ...properties };

    // Mettre à jour la géométrie si nécessaire
    if (properties.radius && layer instanceof L.Circle) {
      layer.setRadius(properties.radius);
    }
    // Ajouter d'autres mises à jour spécifiques aux formes si nécessaire
  };

  const getLayerPoints = (layer: L.Layer): L.LatLng[] => {
    if (layer instanceof L.Circle) {
      return [layer.getLatLng()];
    } else if (layer instanceof L.Polygon) {
      return layer.getLatLngs()[0] as L.LatLng[];
    } else if (layer instanceof L.Polyline) {
      return layer.getLatLngs() as L.LatLng[];
    }
    return [];
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
    currentTool,
    selectedShape,
    isDrawing,
    initMap,
    setDrawingTool,
    updateShapeStyle,
    updateShapeProperties
  };
} 