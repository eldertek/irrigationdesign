import { ref, onUnmounted } from 'vue';
import L from 'leaflet';
import '@geoman-io/leaflet-geoman-free';
import { useShapeProperties } from './useShapeProperties';
import { CircleArc } from '../utils/CircleArc';
import type { TextStyle, TextProperties, TextMarker, TextRectangle } from '../types/leaflet';
import * as turf from '@turf/turf';

// Interface pour Leaflet-Geoman
interface PMMap {
  addControls: (options: any) => void;
  enableDraw: (shape: string, options?: any) => void;
  disableDraw: () => void;
  enableGlobalEditMode: () => void;
  disableGlobalEditMode: () => void;
  enableGlobalDragMode: () => void;
  disableGlobalDragMode: () => void;
  enableGlobalRemovalMode: () => void;
  disableGlobalRemovalMode: () => void;
  setGlobalOptions: (options: any) => void;
}

interface PMLayer {
  enable: () => void;
  disable: () => void;
  _layers?: any[];
  _markers?: any[];
  _markerGroup?: L.LayerGroup;
}

// Extension des types Leaflet
declare module 'leaflet' {
  interface Layer {
    properties?: any;
    pm?: PMLayer;
    _map?: L.Map;
    _textLayer?: L.Marker;
  }
  
  interface Map {
    pm: PMMap;
  }
}

// Utilitaire pour convertir une couleur hex en rgba
const hexToRgba = (hex: string | undefined, opacity: number): string => {
  if (!hex || typeof hex !== 'string' || !hex.startsWith('#')) {
    return `rgba(0, 0, 0, ${opacity})`; // Couleur par défaut
  }
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${opacity})`;
};

// Utilitaire pour mettre à jour le style d'un élément de texte
const updateTextStyle = (element: HTMLElement, style: Partial<TextStyle>): void => {
  if (!style) return;

  if (style.fontSize) {
    element.style.fontSize = style.fontSize;
  }
  if (style.color) {
    element.style.color = style.color;
  }
  if (style.backgroundColor) {
    element.style.backgroundColor = hexToRgba(style.backgroundColor, style.backgroundOpacity ?? 1);
  }
  if (style.padding) {
    element.style.padding = style.padding;
  }
  if (style.borderRadius) {
    element.style.borderRadius = style.borderRadius;
  }
  
  if (style.hasBorder) {
    element.style.border = `${style.borderWidth || '1px'} solid ${hexToRgba(style.borderColor, style.borderOpacity ?? 1)}`;
  } else {
    element.style.border = 'none';
  }
};

// Style par défaut pour le texte
const defaultTextStyle: TextStyle = {
  fontSize: '14px',
  color: '#000000',
  backgroundColor: '#FFFFFF',
  backgroundOpacity: 1,
  borderColor: '#000000',
  borderWidth: '1px',
  borderOpacity: 1,
  padding: '5px 10px',
  borderRadius: '3px',
  hasBorder: true
};

// Fonction pour créer et afficher un message d'aide
const showHelpMessage = (message: string): HTMLElement => {
  // Supprimer tous les messages d'aide existants
  const existingMessages = document.querySelectorAll('.drawing-help-message');
  existingMessages.forEach(msg => msg.remove());

  const helpMsg = L.DomUtil.create('div', 'drawing-help-message');
  helpMsg.innerHTML = message;
  helpMsg.style.cssText = `
    position: fixed;
    bottom: 20px;
    left: 50%;
    transform: translateX(-50%);
    background-color: rgba(0, 0, 0, 0.8);
    color: white;
    padding: 8px 16px;
    border-radius: 4px;
    font-size: 14px;
    z-index: 2000;
    pointer-events: none;
    text-align: center;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
  `;
  document.body.appendChild(helpMsg);
  return helpMsg;
};

// Fonction pour calculer la taille du texte en fonction du zoom
const calculateTextSize = (baseSize: number, zoom: number): number => {
  const minZoom = 1;
  const maxZoom = 19;
  const scaleFactor = Math.max(1, 2 - (zoom - minZoom) / (maxZoom - minZoom));
  return baseSize * scaleFactor;
};

// Fonction pour convertir les mètres en pixels selon la latitude et le zoom
function metersToPixels(meters: number, latitude: number, zoom: number): number {
  const resolution = 156543.03392 * Math.cos(latitude * Math.PI / 180) / Math.pow(2, zoom);
  return meters / resolution;
}

// Fonction pour formater les mesures
const formatMeasure = (value: number, unit: string = 'm'): string => {
  if (value >= 1000) {
    return `${(value / 1000).toFixed(2)} k${unit}`;
  }
  return `${value.toFixed(2)} ${unit}`;
};

// Fonction pour afficher une mesure temporaire
const showMeasure = (position: L.LatLng, text: string): HTMLElement => {
  const measureDiv = L.DomUtil.create('div', 'measure-tooltip');
  measureDiv.innerHTML = text;
  measureDiv.style.cssText = `
    position: fixed;
    background-color: rgba(0, 0, 0, 0.8);
    color: white;
    padding: 4px 8px;
    border-radius: 4px;
    font-size: 12px;
    z-index: 2000;
    pointer-events: none;
    white-space: nowrap;
  `;
  document.body.appendChild(measureDiv);

  // Positionner la tooltip
  if (map.value) {
    const point = map.value.latLngToContainerPoint(position);
    measureDiv.style.left = `${point.x + 10}px`;
    measureDiv.style.top = `${point.y - 25}px`;
  }

  return measureDiv;
};

// Fonction pour ajouter les événements de mesure aux points de contrôle
const addMeasureEvents = (point: L.CircleMarker, layer: L.Layer, getMeasureText: () => string) => {
  point.on('mouseover', () => {
    const measureDiv = showMeasure(point.getLatLng(), getMeasureText());
    point.measureDiv = measureDiv;
  });

  point.on('mousemove', (e: L.LeafletMouseEvent) => {
    if (point.measureDiv && map.value) {
      const containerPoint = map.value.latLngToContainerPoint(e.latlng);
      point.measureDiv.style.left = `${containerPoint.x + 10}px`;
      point.measureDiv.style.top = `${containerPoint.y - 25}px`;
    }
  });

  point.on('mouseout', () => {
    if (point.measureDiv) {
      point.measureDiv.remove();
      point.measureDiv = null;
    }
  });
};

export function useMapDrawing() {
  const map = ref<L.Map | null>(null);
  const featureGroup = ref<L.FeatureGroup | null>(null);
  const currentTool = ref<string>('');
  const selectedShape = ref<L.Layer | null>(null);
  const isDrawing = ref<boolean>(false);

  const { calculateProperties } = useShapeProperties();

  // Ajouter ces variables au niveau du composable
  let activeControlPoints: L.CircleMarker[] = [];

  // Fonction pour nettoyer les points de contrôle actifs
  const clearActiveControlPoints = () => {
    activeControlPoints.forEach(point => {
      if (point && point.remove) {
        if (featureGroup.value) {
          featureGroup.value.removeLayer(point);
        }
        point.remove();
      }
    });
    activeControlPoints = [];
  };

  // Fonction pour créer un point de contrôle
  const createControlPoint = (position: L.LatLng, color: string = '#2563EB'): L.CircleMarker => {
    const point = L.circleMarker(position, {
      radius: 6,
      color: color,
      fillColor: color,
      fillOpacity: 1,
      weight: 2,
      className: 'control-point',
      pmIgnore: true
    });
    
    if (featureGroup.value) {
      featureGroup.value.addLayer(point);
    }
    
    return point;
  };

  // Fonction pour mettre à jour les points de contrôle d'un demi-cercle
  const updateSemicircleControlPoints = (layer: CircleArc) => {
    if (!map.value || !layer.properties || !featureGroup.value) return;

    // Nettoyer les points de contrôle existants
    clearActiveControlPoints();

    const center = layer.getCenter();
    const radius = layer.getRadius();
    const startAngle = layer.properties.startAngle || 0;
    const stopAngle = layer.properties.stopAngle || 180;

    // Point central (vert)
    const centerPoint = createControlPoint(center, '#059669');
    activeControlPoints.push(centerPoint);

    // Ajouter les mesures au point central
    addMeasureEvents(centerPoint, layer, () => {
      const area = (Math.PI * radius * radius) / 2;
      return `Rayon: ${formatMeasure(radius)}\nSurface: ${formatMeasure(area, 'm²')}`;
    });

    centerPoint.on('mousedown', (e: L.LeafletMouseEvent) => {
      if (!map.value) return;
      L.DomEvent.stopPropagation(e);
      map.value.dragging.disable();
      
      let isDragging = true;
      
      const onMouseMove = (e: L.LeafletMouseEvent) => {
        if (!isDragging) return;
        layer.setCenter(e.latlng);
        centerPoint.setLatLng(e.latlng);
        updateSemicircleControlPoints(layer);
      };
      
      const onMouseUp = () => {
        isDragging = false;
        if (!map.value) return;
        map.value.off('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
        map.value.dragging.enable();
      };
      
      map.value.on('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);
    });

    // Points aux extrémités
    const startRad = (startAngle * Math.PI) / 180;
    const endRad = (stopAngle * Math.PI) / 180;
    
    const startPoint = L.latLng(
      center.lat + (radius / 111319.9) * Math.sin(startRad),
      center.lng + (radius / (111319.9 * Math.cos(center.lat * Math.PI / 180))) * Math.cos(startRad)
    );
    
    const endPoint = L.latLng(
      center.lat + (radius / 111319.9) * Math.sin(endRad),
      center.lng + (radius / (111319.9 * Math.cos(center.lat * Math.PI / 180))) * Math.cos(endRad)
    );

    // Point de début (bleu)
    const startMarker = createControlPoint(startPoint, '#2563EB');
    activeControlPoints.push(startMarker);
    
    // Ajouter les mesures au point de début
    addMeasureEvents(startMarker, layer, () => {
      const angle = layer.getStartAngle();
      return `Angle de début: ${angle.toFixed(1)}°`;
    });

    startMarker.on('mousedown', (e: L.LeafletMouseEvent) => {
      if (!map.value) return;
      L.DomEvent.stopPropagation(e);
      map.value.dragging.disable();
      
      let isDragging = true;
      
      const onMouseMove = (e: L.LeafletMouseEvent) => {
        if (!isDragging) return;
        
        const angle = Math.atan2(
          e.latlng.lat - center.lat,
          e.latlng.lng - center.lng
        ) * (180 / Math.PI);
        
        if (!isNaN(angle)) {
          layer.setAngles(angle, stopAngle);
          startMarker.setLatLng(e.latlng);
          updateSemicircleControlPoints(layer);
        }
      };
      
      const onMouseUp = () => {
        isDragging = false;
        if (!map.value) return;
        map.value.off('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
        map.value.dragging.enable();
      };
      
      map.value.on('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);
    });

    // Point de fin (rouge)
    const endMarker = createControlPoint(endPoint, '#DC2626');
    activeControlPoints.push(endMarker);
    
    // Ajouter les mesures au point de fin
    addMeasureEvents(endMarker, layer, () => {
      const angle = layer.getStopAngle();
      const openingAngle = layer.getOpeningAngle();
      return `Angle de fin: ${angle.toFixed(1)}°\nOuverture: ${openingAngle.toFixed(1)}°`;
    });

    endMarker.on('mousedown', (e: L.LeafletMouseEvent) => {
      if (!map.value) return;
      L.DomEvent.stopPropagation(e);
      map.value.dragging.disable();
      
      let isDragging = true;
      
      const onMouseMove = (e: L.LeafletMouseEvent) => {
        if (!isDragging) return;
        
        const angle = Math.atan2(
          e.latlng.lat - center.lat,
          e.latlng.lng - center.lng
        ) * (180 / Math.PI);
        
        if (!isNaN(angle)) {
          layer.setAngles(startAngle, angle);
          endMarker.setLatLng(e.latlng);
          updateSemicircleControlPoints(layer);
        }
      };
      
      const onMouseUp = () => {
        isDragging = false;
        if (!map.value) return;
        map.value.off('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
        map.value.dragging.enable();
      };
      
      map.value.on('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);
    });

    // Point milieu pour le rayon (bleu)
    const midAngle = (startAngle + stopAngle) / 2;
    const midRad = (midAngle * Math.PI) / 180;
    const midPoint = L.latLng(
      center.lat + (radius / 111319.9) * Math.sin(midRad),
      center.lng + (radius / (111319.9 * Math.cos(center.lat * Math.PI / 180))) * Math.cos(midRad)
    );
    
    const midMarker = createControlPoint(midPoint, '#2563EB');
    activeControlPoints.push(midMarker);
    
    // Ajouter les mesures au point milieu
    addMeasureEvents(midMarker, layer, () => {
      const radius = layer.getRadius();
      return `Rayon: ${formatMeasure(radius)}`;
    });

    midMarker.on('mousedown', (e: L.LeafletMouseEvent) => {
      if (!map.value) return;
      L.DomEvent.stopPropagation(e);
      map.value.dragging.disable();
      
      let isDragging = true;
      
      const onMouseMove = (e: L.LeafletMouseEvent) => {
        if (!isDragging) return;
        
        const newRadius = center.distanceTo(e.latlng);
        if (newRadius > 0) {
          layer.setRadius(newRadius);
          midMarker.setLatLng(e.latlng);
          updateSemicircleControlPoints(layer);
        }
      };
      
      const onMouseUp = () => {
        isDragging = false;
        if (!map.value) return;
        map.value.off('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
        map.value.dragging.enable();
      };
      
      map.value.on('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);
    });
  };

  // Fonction pour mettre à jour la taille physique du texte
  const updateTextFixedSize = (textMarker: TextMarker, physicalSizeInMeters: number = 2.0) => {
    if (!map.value) {
      console.warn('Map is not available for text size update');
      return;
    }

    const zoom = map.value.getZoom();
    const centerLat = textMarker.getLatLng().lat;
    const fontSizePx = metersToPixels(physicalSizeInMeters, centerLat, zoom);

    const element = textMarker.getElement()?.querySelector('.text-annotation') as HTMLElement;
    if (element) {
      textMarker.properties.style.fontSize = `${fontSizePx}px`;
      textMarker.properties.physicalWidth = physicalSizeInMeters;
      textMarker.properties.physicalHeight = physicalSizeInMeters;
      updateTextStyle(element, textMarker.properties.style);
    }
  };

  const initMap = (element: HTMLElement, center: L.LatLngExpression, zoom: number): L.Map => {
    const mapInstance = L.map(element).setView(center, zoom);
    map.value = mapInstance;
    
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors'
    }).addTo(mapInstance);

    const fg = new L.FeatureGroup();
    fg.addTo(mapInstance);
    featureGroup.value = fg;

    // Désactiver tous les contrôles par défaut de Leaflet-Geoman
    mapInstance.pm.addControls({
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

    // Configuration globale de Leaflet-Geoman
    mapInstance.pm.setGlobalOptions({
      snappable: true,
      snapDistance: 20,
      allowSelfIntersection: false,
      preventMarkerRemoval: true,
      syncLayersOnDrag: true,
      layerGroup: fg,
      templineStyle: {
        color: '#3388ff',
        weight: 2,
        opacity: 0.7,
        dashArray: '6,6'
      },
      hintlineStyle: {
        color: '#3388ff',
        weight: 2,
        opacity: 0.7,
        dashArray: '6,6'
      }
    });

    // Événements de dessin
    mapInstance.on('pm:drawstart', (e: any) => {
      isDrawing.value = true;
      // Définir le curseur approprié
      if (e.shape === 'Circle' && currentTool.value === 'Semicircle') {
        mapInstance.getContainer().style.cursor = 'crosshair';
      }
    });

    mapInstance.on('pm:drawend', () => {
      isDrawing.value = false;
      // Réinitialiser le curseur
      mapInstance.getContainer().style.cursor = '';
      // Afficher le message d'aide uniquement si une forme a été créée
      if (selectedShape.value) {
        showHelpMessage('Cliquez sur la forme pour afficher les points de contrôle');
      }
    });

    mapInstance.on('pm:create', async (e: any) => {
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

      // Si c'est un demi-cercle
      if (currentTool.value === 'Semicircle' && layer instanceof L.Circle) {
        const center = layer.getLatLng();
        const radius = layer.getRadius();
        
        // Supprimer le cercle original
        featureGroup.value?.removeLayer(layer);
        
        // Créer un nouveau demi-cercle
        const semicircle = new CircleArc(center, radius);
        featureGroup.value?.addLayer(semicircle);
        
        // Mettre à jour la sélection
        selectedShape.value = semicircle;
        
        // Ajouter les points de contrôle immédiatement
        updateSemicircleControlPoints(semicircle);
      } else {
      // Calculer les propriétés géométriques
      const props = calculateProperties(layer, map.value);
      layer.properties = { ...layer.properties, ...props };
        selectedShape.value = layer;

        // Ajouter les points de contrôle immédiatement selon le type
        if (layer instanceof L.Circle) {
          updateCircleControlPoints(layer);
        } else if (layer instanceof L.Rectangle) {
          updateRectangleControlPoints(layer);
        } else if (layer instanceof L.Polygon) {
          updatePolygonControlPoints(layer);
        } else if (layer instanceof L.Polyline && !(layer instanceof L.Polygon)) {
          updateLineControlPoints(layer);
        }
      }
    });

    // Événements de sélection
    mapInstance.on('click', (e: L.LeafletMouseEvent) => {
      const target = e.target;
      if (target === mapInstance) {
        clearActiveControlPoints();
        selectedShape.value = null;
        // Supprimer tous les messages d'aide si on clique sur la carte
        document.querySelectorAll('.drawing-help-message').forEach(msg => msg.remove());
      }
    });

    // Ajouter l'écouteur d'événement click sur le featureGroup
    fg.on('click', (e: L.LeafletMouseEvent) => {
      L.DomEvent.stopPropagation(e);
      const layer = e.layer;
      
      // Toujours nettoyer les points de contrôle existants
      clearActiveControlPoints();
      document.querySelector('.drawing-help-message')?.remove();
      
      // Mettre à jour la forme sélectionnée
      selectedShape.value = layer;

      if (layer instanceof CircleArc || layer.properties?.type === 'Semicircle') {
        if (layer.pm) {
          layer.pm._layers = [];
          layer.pm._markers = [];
          layer.pm._markerGroup?.clearLayers();
        }
        updateSemicircleControlPoints(layer as CircleArc);
      } else if (layer instanceof L.Circle) {
        updateCircleControlPoints(layer);
      } else if (layer instanceof L.Rectangle) {
        updateRectangleControlPoints(layer);
      } else if (layer instanceof L.Polygon) {
        updatePolygonControlPoints(layer);
      } else if (layer instanceof L.Polyline && !(layer instanceof L.Polygon)) {
        updateLineControlPoints(layer);
      }
    });

    // Événements d'édition
    mapInstance.on('pm:edit', (e: any) => {
      const layer = e.layer;
      if (layer) {
        const props = calculateProperties(layer, map.value);
        layer.properties = { ...layer.properties, ...props };
        if (layer === selectedShape.value) {
          selectedShape.value = layer;
          // Afficher le message d'aide pour l'édition
          showHelpMessage('Utilisez les points de contrôle pour modifier la forme');
        }
      }
    });

    // Événements de glisser-déposer
    mapInstance.on('pm:dragstart', () => {
      // Supprimer les messages précédents avant d'afficher le nouveau
      document.querySelectorAll('.drawing-help-message').forEach(msg => msg.remove());
      showHelpMessage('Déplacez la forme à l\'endroit souhaité');
    });

    mapInstance.on('pm:dragend', () => {
      // Attendre un court instant avant d'afficher le message suivant
      setTimeout(() => {
        showHelpMessage('Cliquez sur la forme pour afficher les points de contrôle');
      }, 100);
    });

    // Événements de suppression
    mapInstance.on('pm:remove', () => {
      document.querySelector('.drawing-help-message')?.remove();
    });

    // Événements de sélection/désélection
    mapInstance.on('pm:select', (e: any) => {
      const layer = e.layer;
      // Supprimer les messages précédents avant d'afficher le nouveau
      document.querySelectorAll('.drawing-help-message').forEach(msg => msg.remove());
      
      if (layer instanceof CircleArc || layer.properties?.type === 'Semicircle') {
        showHelpMessage('Points de contrôle : <span style="color: #059669">●</span> Ajuster le rayon, <span style="color: #2563EB">●</span> et <span style="color: #DC2626">●</span> Modifier l\'ouverture du demi-cercle');
      } else {
        showHelpMessage('Utilisez les points de contrôle pour modifier la forme');
      }
    });

    mapInstance.on('pm:unselect', () => {
      // Supprimer tous les messages d'aide à la désélection
      document.querySelectorAll('.drawing-help-message').forEach(msg => msg.remove());
    });

    return mapInstance;
  };

  const adjustView = () => {
    if (!map.value || !featureGroup.value) return;
    
    const bounds = featureGroup.value.getBounds();
    if (bounds.isValid()) {
      map.value.fitBounds(bounds, {
        padding: [50, 50],
        maxZoom: 19
      });
    }
  };

  const setDrawingTool = (tool: string) => {
              if (!map.value) return;

    // Nettoyer les messages d'aide existants
    document.querySelectorAll('.drawing-help-message').forEach(msg => msg.remove());

    // Désactiver tous les modes
    map.value.pm.disableDraw();
    map.value.pm.disableGlobalEditMode();
    map.value.pm.disableGlobalDragMode();
    map.value.pm.disableGlobalRemovalMode();

    currentTool.value = tool;

    // Si aucun outil n'est sélectionné
    if (!tool) {
      clearActiveControlPoints();
      return;
    }

    // Attendre un court instant avant d'afficher le nouveau message
    setTimeout(() => {
      switch (tool) {
        case 'Circle':
          showHelpMessage('Cliquez et maintenez pour dessiner un cercle, relâchez pour terminer');
          map.value?.pm.enableDraw('Circle', {
            finishOn: 'mouseup'
          });
          break;
        case 'Semicircle':
          showHelpMessage('Cliquez et maintenez pour dessiner un demi-cercle, relâchez pour terminer');
          map.value?.pm.enableDraw('Circle', {
            finishOn: 'mouseup',
            continueDrawing: false,
            markerStyle: {
              draggable: true
            }
          });
        break;
      case 'Rectangle':
          showHelpMessage('Cliquez et maintenez pour dessiner un rectangle, relâchez pour terminer');
          map.value?.pm.enableDraw('Rectangle', {
            finishOn: 'mouseup'
          });
        break;
      case 'Polygon':
          showHelpMessage('Cliquez pour ajouter des points, double-cliquez pour terminer le polygone');
          map.value?.pm.enableDraw('Polygon', {
            finishOn: 'dblclick',
            continueDrawing: false,
            snapMiddle: true,
            snapDistance: 20
          });
        break;
      case 'Line':
          showHelpMessage('Cliquez pour ajouter des points, double-cliquez pour terminer la ligne');
          map.value?.pm.enableDraw('Line', {
            finishOn: 'dblclick',
            continueDrawing: false,
            snapMiddle: true,
            snapDistance: 20
          });
        break;
      case 'drag':
          showHelpMessage('Cliquez et maintenez une forme pour la déplacer');
          map.value?.pm.enableGlobalDragMode();
        break;
      case 'delete':
          showHelpMessage('Cliquez sur une forme pour la supprimer');
          map.value?.pm.enableGlobalRemovalMode();
        break;
    }
    }, 100);
  };

  const updateShapeStyle = (style: any) => {
    if (!selectedShape.value) return;

    const layer = selectedShape.value;
    layer.properties = layer.properties || {};
    layer.properties.style = layer.properties.style || {};
    layer.properties.style = { ...layer.properties.style, ...style };

    if (layer.properties.type === 'text') {
      const textLayer = layer.properties._textLayer;
      const element = textLayer?.getElement()?.querySelector('.text-annotation') as HTMLElement;
      if (element) {
        updateTextStyle(element, layer.properties.style);
      }
      const leafletStyle: L.PathOptions = {
        color: style.borderColor || layer.properties.style.borderColor,
        weight: parseInt(style.borderWidth || layer.properties.style.borderWidth),
        opacity: style.borderOpacity ?? layer.properties.style.borderOpacity
      };
      if ('setStyle' in layer) {
        (layer as L.Path).setStyle(leafletStyle);
      }
    } else {
      const leafletStyle: L.PathOptions = {};
      if (style.fillColor) leafletStyle.fillColor = style.fillColor;
      if (style.fillOpacity !== undefined) leafletStyle.fillOpacity = style.fillOpacity;
      if (style.strokeColor) leafletStyle.color = style.strokeColor;
      if (style.strokeOpacity !== undefined) leafletStyle.opacity = style.strokeOpacity;
      if (style.strokeWidth !== undefined) leafletStyle.weight = style.strokeWidth;
      if (style.dashArray) leafletStyle.dashArray = style.dashArray;

      if ('setStyle' in layer) {
        (layer as L.Path).setStyle(leafletStyle);
      }
    }
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

  // Fonction pour calculer le point milieu entre deux points
  const getMidPoint = (p1: L.LatLng, p2: L.LatLng): L.LatLng => {
    return L.latLng(
      (p1.lat + p2.lat) / 2,
      (p1.lng + p2.lng) / 2
    );
  };

  // Fonction pour mettre à jour les points de contrôle d'un cercle
  const updateCircleControlPoints = (layer: L.Circle) => {
    if (!map.value || !featureGroup.value) return;

    // Nettoyer tous les points de contrôle existants
    clearActiveControlPoints();

    const center = layer.getLatLng();
    const radius = layer.getRadius();

    // Point central (vert)
    const centerPoint = createControlPoint(center, '#059669');
    activeControlPoints.push(centerPoint);
    
    // Ajouter les mesures au point central
    addMeasureEvents(centerPoint, layer, () => {
      const area = Math.PI * radius * radius;
      return `Rayon: ${formatMeasure(radius)}\nSurface: ${formatMeasure(area, 'm²')}`;
    });

    centerPoint.on('mousedown', (e: L.LeafletMouseEvent) => {
      if (!map.value) return;
      L.DomEvent.stopPropagation(e);
      map.value.dragging.disable();
      
      // Nettoyer tous les points de contrôle sauf le point central
      clearActiveControlPoints();
      activeControlPoints = [centerPoint];
      
      let isDragging = true;
      
      const onMouseMove = (e: L.LeafletMouseEvent) => {
        if (!isDragging) return;
        layer.setLatLng(e.latlng);
        centerPoint.setLatLng(e.latlng);
      };
      
      const onMouseUp = () => {
        isDragging = false;
        if (!map.value) return;
        map.value.off('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
        map.value.dragging.enable();
        // Recréer tous les points de contrôle
        updateCircleControlPoints(layer);
      };
      
      map.value.on('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);
    });

    // Points cardinaux (bleu)
    [0, 45, 90, 135, 180, 225, 270, 315].forEach(angle => {
      const rad = (angle * Math.PI) / 180;
      const point = L.latLng(
        center.lat + (radius / 111319.9) * Math.sin(rad),
        center.lng + (radius / (111319.9 * Math.cos(center.lat * Math.PI / 180))) * Math.cos(rad)
      );
      const controlPoint = createControlPoint(point, '#2563EB');
      activeControlPoints.push(controlPoint);
      
      // Ajouter les mesures aux points cardinaux
      addMeasureEvents(controlPoint, layer, () => {
        const distance = center.distanceTo(controlPoint.getLatLng());
        return `Distance du centre: ${formatMeasure(distance)}`;
      });
      
      controlPoint.on('mousedown', (e: L.LeafletMouseEvent) => {
        if (!map.value) return;
        L.DomEvent.stopPropagation(e);
        map.value.dragging.disable();
        
        // Nettoyer tous les points de contrôle sauf celui qu'on déplace
        clearActiveControlPoints();
        activeControlPoints = [controlPoint];
        
        let isDragging = true;
        
        const onMouseMove = (e: L.LeafletMouseEvent) => {
          if (!isDragging) return;
          const newRadius = center.distanceTo(e.latlng);
          layer.setRadius(newRadius);
          controlPoint.setLatLng(e.latlng);
        };
        
        const onMouseUp = () => {
          isDragging = false;
          if (!map.value) return;
          map.value.off('mousemove', onMouseMove);
          document.removeEventListener('mouseup', onMouseUp);
          map.value.dragging.enable();
          // Recréer tous les points de contrôle
          updateCircleControlPoints(layer);
        };
        
        map.value.on('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
      });
    });
  };

  // Fonction pour mettre à jour les points de contrôle d'un rectangle
  const updateRectangleControlPoints = (layer: L.Rectangle) => {
    if (!map.value || !featureGroup.value) return;

    // Nettoyer les points de contrôle existants
    clearActiveControlPoints();

    const bounds = layer.getBounds();
    const corners = [
      bounds.getNorthWest(),
      bounds.getNorthEast(),
      bounds.getSouthEast(),
      bounds.getSouthWest()
    ];

    // Points de coin (vert)
    corners.forEach((corner, index) => {
      const cornerPoint = createControlPoint(corner, '#059669');
      activeControlPoints.push(cornerPoint);
      
      // Ajouter les mesures aux coins
      addMeasureEvents(cornerPoint, layer, () => {
        const bounds = layer.getBounds();
        const width = bounds.getNorthEast().distanceTo(bounds.getNorthWest());
        const height = bounds.getNorthWest().distanceTo(bounds.getSouthWest());
        const area = width * height;
        return `Largeur: ${formatMeasure(width)}\nHauteur: ${formatMeasure(height)}\nSurface: ${formatMeasure(area, 'm²')}`;
      });

      cornerPoint.on('mousedown', (e: L.LeafletMouseEvent) => {
        if (!map.value) return;
        L.DomEvent.stopPropagation(e);
        map.value.dragging.disable();
        
        let isDragging = true;
        
        const onMouseMove = (e: L.LeafletMouseEvent) => {
          if (!isDragging) return;
          
          // Mettre à jour le coin
          corners[index] = e.latlng;
          
          // Créer les nouvelles bounds
          const newBounds = L.latLngBounds([
            [
              Math.min(corners[0].lat, corners[2].lat),
              Math.min(corners[0].lng, corners[2].lng)
            ],
            [
              Math.max(corners[0].lat, corners[2].lat),
              Math.max(corners[0].lng, corners[2].lng)
            ]
          ]);
          
          layer.setBounds(newBounds);
          cornerPoint.setLatLng(e.latlng);
          
          // Mettre à jour les points milieux
          updateMidPoints();
        };
        
        const onMouseUp = () => {
          isDragging = false;
          if (!map.value) return;
          map.value.off('mousemove', onMouseMove);
          document.removeEventListener('mouseup', onMouseUp);
          map.value.dragging.enable();
          updateRectangleControlPoints(layer);
        };
        
        map.value.on('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
      });
    });

    // Points milieux (bleu)
    const updateMidPoints = () => {
      const bounds = layer.getBounds();
      const corners = [
        bounds.getNorthWest(),
        bounds.getNorthEast(),
        bounds.getSouthEast(),
        bounds.getSouthWest()
      ];

      // Supprimer les anciens points milieux
      activeControlPoints.slice(4).forEach(point => {
        if (featureGroup.value) {
          featureGroup.value.removeLayer(point);
        }
      });
      activeControlPoints = activeControlPoints.slice(0, 4);

      // Créer les nouveaux points milieux
      const sides = [
        [corners[0], corners[1]], // Nord
        [corners[1], corners[2]], // Est
        [corners[2], corners[3]], // Sud
        [corners[3], corners[0]]  // Ouest
      ];

      sides.forEach((side, index) => {
        const midPoint = getMidPoint(side[0], side[1]);
        const midControlPoint = createControlPoint(midPoint, '#2563EB');
        activeControlPoints.push(midControlPoint);

        // Ajouter les mesures aux points milieux
        addMeasureEvents(midControlPoint, layer, () => {
          const distance = side[0].distanceTo(side[1]);
          return `Longueur du côté: ${formatMeasure(distance)}`;
        });

        midControlPoint.on('mousedown', (e: L.LeafletMouseEvent) => {
          if (!map.value) return;
          L.DomEvent.stopPropagation(e);
          map.value.dragging.disable();

          let isDragging = true;

          const onMouseMove = (e: L.LeafletMouseEvent) => {
            if (!isDragging) return;

            const isVertical = index === 1 || index === 3;
            const newBounds = layer.getBounds();
            const cornerPoints = [
              newBounds.getNorthWest(),
              newBounds.getNorthEast(),
              newBounds.getSouthEast(),
              newBounds.getSouthWest()
            ];

            if (isVertical) {
              // Déplacement horizontal des côtés verticaux
              const newLng = e.latlng.lng;
              if (index === 1) { // Côté Est
                cornerPoints[1].lng = newLng;
                cornerPoints[2].lng = newLng;
              } else { // Côté Ouest
                cornerPoints[0].lng = newLng;
                cornerPoints[3].lng = newLng;
              }
            } else {
              // Déplacement vertical des côtés horizontaux
              const newLat = e.latlng.lat;
              if (index === 0) { // Côté Nord
                cornerPoints[0].lat = newLat;
                cornerPoints[1].lat = newLat;
              } else { // Côté Sud
                cornerPoints[2].lat = newLat;
                cornerPoints[3].lat = newLat;
              }
            }

            const newLatLngBounds = L.latLngBounds([
              [
                Math.min(cornerPoints[0].lat, cornerPoints[2].lat),
                Math.min(cornerPoints[0].lng, cornerPoints[2].lng)
              ],
              [
                Math.max(cornerPoints[0].lat, cornerPoints[2].lat),
                Math.max(cornerPoints[0].lng, cornerPoints[2].lng)
              ]
            ]);

            layer.setBounds(newLatLngBounds);
            midControlPoint.setLatLng(e.latlng);
            updateMidPoints();
          };

          const onMouseUp = () => {
            isDragging = false;
            if (!map.value) return;
            map.value.off('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);
            map.value.dragging.enable();
            updateRectangleControlPoints(layer);
          };

          map.value.on('mousemove', onMouseMove);
          document.addEventListener('mouseup', onMouseUp);
        });
      });
    };

    updateMidPoints();
  };

  // Fonction pour mettre à jour les points de contrôle d'un polygone
  const updatePolygonControlPoints = (layer: L.Polygon) => {
    if (!map.value || !featureGroup.value) return;

    clearActiveControlPoints();
    showHelpMessage('Points de contrôle : <span style="color: #059669">●</span> Sommets, <span style="color: #2563EB">●</span> Milieux des côtés');

    const points = (layer.getLatLngs()[0] as L.LatLng[]);

    // Points de sommet (vert)
    points.forEach((point, i) => {
      const pointMarker = createControlPoint(point, '#059669');
      activeControlPoints.push(pointMarker);

      pointMarker.on('mousedown', (e: L.LeafletMouseEvent) => {
        L.DomEvent.stopPropagation(e);
        if (!map.value) return;
        
        map.value.dragging.disable();
        let isDragging = true;
        
        const onMouseMove = (e: L.LeafletMouseEvent) => {
          if (!isDragging) return;
          L.DomEvent.stopPropagation(e);
          
          points[i] = e.latlng;
          layer.setLatLngs([points]);
          pointMarker.setLatLng(e.latlng);
          
          // Mettre à jour les points milieux
          updateMidPoints();
        };

        const onMouseUp = () => {
          isDragging = false;
          if (!map.value) return;
          map.value.off('mousemove', onMouseMove);
          document.removeEventListener('mouseup', onMouseUp);
          map.value.dragging.enable();
        };

        map.value.on('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
      });
    });

    // Points milieux (bleu)
    const updateMidPoints = () => {
      const points = (layer.getLatLngs()[0] as L.LatLng[]);
      
      // Supprimer les anciens points milieux
      activeControlPoints.slice(points.length).forEach(point => {
        if (featureGroup.value) {
          featureGroup.value.removeLayer(point);
        }
      });
      activeControlPoints = activeControlPoints.slice(0, points.length);

      // Créer les nouveaux points milieux
      for (let i = 0; i < points.length; i++) {
        const midPoint = getMidPoint(points[i], points[(i + 1) % points.length]);
        const midPointMarker = createControlPoint(midPoint, '#2563EB');
        activeControlPoints.push(midPointMarker);
      }
    };

    updateMidPoints();
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
    updateShapeProperties,
    updateTextFixedSize,
    adjustView
  };
} 