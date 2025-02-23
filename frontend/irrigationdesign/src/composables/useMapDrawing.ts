import { ref, onUnmounted, nextTick, type Ref } from 'vue';
import L from 'leaflet';
import '@geoman-io/leaflet-geoman-free';
import { CircleArc } from '../utils/CircleArc';
import type { TextStyle, TextMarker } from '../types/leaflet';
import * as turf from '@turf/turf';


// Ajouter cette interface avant la déclaration du module 'leaflet'
interface CustomIconOptions extends L.DivIconOptions {
  html?: string;
  className?: string;
}

// Modifier l'interface Layer pour éviter les conflits de type
declare module 'leaflet' {
  interface Layer {
    properties?: any;
    pm?: any;
    _textLayer?: L.Marker;
    options: L.LayerOptions;
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

// Fonction pour mettre à jour le style d'un élément de texte
const updateTextStyle = (element: HTMLElement, style: TextStyle) => {
  element.style.fontSize = style.fontSize;
  element.style.color = style.color;
  element.style.backgroundColor = hexToRgba(style.backgroundColor, style.backgroundOpacity);
  if (style.hasBorder) {
    element.style.border = `${style.borderWidth} solid ${hexToRgba(style.borderColor, style.borderOpacity)}`;
  } else {
    element.style.border = 'none';
  }
  element.style.padding = style.padding;
  element.style.borderRadius = style.borderRadius;
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

// Fonction pour convertir les mètres en pixels selon la latitude et le zoom
function metersToPixels(meters: number, latitude: number, zoom: number): number {
  const resolution = 156543.03392 * Math.cos(latitude * Math.PI / 180) / Math.pow(2, zoom);
  return meters / resolution;
}

// Fonction pour formater les mesures
const formatMeasure = (value: number, unit: string = 'm', label: string = ''): string => {
  let formattedValue: string;
  let formattedUnit: string;

  // Formater selon l'unité
  if (unit === 'm²') {
    if (value >= 10000) {
      formattedValue = (value / 10000).toFixed(2);
      formattedUnit = 'ha';
    } else {
      formattedValue = value.toFixed(2);
      formattedUnit = 'm²';
    }
  } else if (unit === 'm') {
    if (value >= 1000) {
      formattedValue = (value / 1000).toFixed(2);
      formattedUnit = 'km';
    } else {
      formattedValue = value.toFixed(2);
      formattedUnit = 'm';
    }
  } else {
    formattedValue = value.toFixed(2);
    formattedUnit = unit;
  }

  return label ? `${label}: ${formattedValue} ${formattedUnit}` : `${formattedValue} ${formattedUnit}`;
};

// Fonction pour formater les angles
const formatAngle = (angle: number): string => {
  return `${((angle % 360 + 360) % 360).toFixed(1)}°`;
};

// Interface pour les points de contrôle avec mesure
interface ControlPoint extends L.CircleMarker {
  measureDiv?: HTMLElement;
}

// Ajouter cette fonction utilitaire en haut du fichier
const convertMouseEvent = (e: MouseEvent): MouseEvent => {
  return {
    ...e,
    clientX: e.clientX,
    clientY: e.clientY,
    button: e.button || 0,
    buttons: e.buttons || 0,
    altKey: e.altKey || false,
  } as MouseEvent;
};

interface MapDrawingReturn {
  map: Ref<any>;
  featureGroup: Ref<any>;
  currentTool: Ref<string>;
  selectedShape: Ref<any>;
  isDrawing: Ref<boolean>;
  initMap: (element: HTMLElement, center: L.LatLngExpression, zoom: number) => L.Map;
  setDrawingTool: (tool: string) => void;
  updateShapeStyle: (style: any) => void;
  updateShapeProperties: (properties: any) => void;
  updateTextFixedSize: (textMarker: TextMarker, physicalSizeInMeters: number) => void;
  adjustView: () => void;
  clearActiveControlPoints: () => void;
}

export function useMapDrawing(): MapDrawingReturn {
  const map = ref<any>(null);
  const featureGroup = ref<any>(null);
  const currentTool = ref<string>('');
  const selectedShape = ref<any>(null);
  const isDrawing = ref<boolean>(false);

  const createTextMarker = (latlng: L.LatLng, text: string = 'Double-cliquez pour éditer'): L.Marker => {
    const defaultStyle: TextStyle = {
      fontSize: '14px',
      color: '#000000',
      backgroundColor: '#FFFFFF',
      backgroundOpacity: 1,
      borderColor: '#000000',
      borderWidth: '1px',
      borderOpacity: 1,
      padding: '5px 10px',
      borderRadius: '3px',
      hasBorder: true,
      rotation: 0,
      physicalSize: 2.0
    };

    const createHtml = (text: string, style: TextStyle) => {
      const zoom = map.value?.getZoom() || 14;
      const centerLat = latlng.lat;
      const boxSizePx = metersToPixels(style.physicalSize, centerLat, zoom);
      
      return `<div class="text-container" style="width:${boxSizePx}px;height:${boxSizePx}px;transform:rotate(${style.rotation}deg)">
        <div class="text-annotation" style="font-size:${boxSizePx * 0.2}px;color:${style.color};background-color:${hexToRgba(style.backgroundColor, style.backgroundOpacity)};border:${style.hasBorder ? style.borderWidth + ' solid ' + hexToRgba(style.borderColor, style.borderOpacity) : 'none'};padding:${style.padding};border-radius:${style.borderRadius}">${text}</div>
        <div class="text-controls"><div class="control-button rotate"></div><div class="control-button move"></div></div>
      </div>`;
    };

    const updateMarkerSize = () => {
      if (!map.value) return;
      
      // Mettre à jour l'icône avec la nouvelle taille
      const icon = marker.getIcon();
      const newOptions: CustomIconOptions = {
        html: createHtml(marker.properties.text, marker.properties.style),
        className: icon.options.className
      };
      marker.setIcon(L.divIcon(newOptions));
    };

    const textIcon = L.divIcon({
      html: createHtml(text, defaultStyle),
      className: 'text-container',
      iconSize: [40, 40],
      iconAnchor: [20, 20]
    });

    const marker = L.marker(latlng, {
      icon: textIcon,
      draggable: false,
      pmIgnore: true
    });

    marker.properties = {
      type: 'text',
      text: text,
      style: { ...defaultStyle }
    };

    // Gestion du zoom
    if (map.value) {
      map.value.on('zoomend', updateMarkerSize);
      marker.on('remove', () => {
        map.value?.off('zoomend', updateMarkerSize);
      });
    }

    // Appliquer la taille initiale
    updateMarkerSize();

    // Gestion des contrôles
    let isRotating = false;
    let isDragging = false;
    let startAngle = 0;
    let startRotation = 0;

    const onMouseDown = (e: MouseEvent) => {
      if (!map.value) return;
      const target = e.target as HTMLElement;
      
      if (target.classList.contains('rotate')) {
        isRotating = true;
        const markerPos = marker.getLatLng();
        const mousePos = map.value.mouseEventToLatLng(e as any);
        startAngle = Math.atan2(
          mousePos.lat - markerPos.lat,
          mousePos.lng - markerPos.lng
        ) * 180 / Math.PI;
        startRotation = marker.properties.style.rotation || 0;
      } else if (target.classList.contains('move')) {
        isDragging = true;
      }

      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);
    };

    const onMouseMove = (e: MouseEvent) => {
      if (!isDragging || !map.value) return;

      if (isRotating) {
        const markerPos = marker.getLatLng();
        const mousePos = map.value.mouseEventToLatLng(e as any);
        const currentAngle = Math.atan2(
          mousePos.lat - markerPos.lat,
          mousePos.lng - markerPos.lng
        ) * 180 / Math.PI;
        
        const rotation = (startRotation + (currentAngle - startAngle)) % 360;
        marker.properties.style.rotation = rotation;
        
        const icon = marker.getIcon() as L.DivIcon;
        const newOptions: CustomIconOptions = {
          html: createHtml(marker.properties.text, marker.properties.style),
          className: icon.options.className
        };
        marker.setIcon(L.divIcon(newOptions));
      } else if (isDragging) {
        const mouseEvent = convertMouseEvent(e);
        const newPos = map.value.mouseEventToLatLng(mouseEvent);
        marker.setLatLng(newPos);
      }
    };

    const onMouseUp = () => {
      isRotating = false;
      isDragging = false;
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };

    marker.on('add', () => {
      const element = marker.getElement();
      if (element) {
        const controls = element.querySelectorAll('.control-button');
        controls.forEach((control: Element) => {
          control.addEventListener('mousedown', onMouseDown as EventListener);
        });
      }
    });

    marker.on('remove', () => {
      const element = marker.getElement();
      if (element) {
        const controls = element.querySelectorAll('.control-button');
        controls.forEach((control: Element) => {
          control.removeEventListener('mousedown', onMouseDown as EventListener);
        });
      }
    });

    // Édition du texte
    marker.on('dblclick', (e: L.LeafletMouseEvent) => {
      L.DomEvent.stopPropagation(e);
      const element = marker.getElement()?.querySelector('.text-annotation') as HTMLElement;
      if (!element) return;

      element.contentEditable = 'true';
      element.focus();
      element.classList.add('editing');

      // Sélectionner tout le texte
      const selection = window.getSelection();
      const range = document.createRange();
      range.selectNodeContents(element);
      selection?.removeAllRanges();
      selection?.addRange(range);

      const finishEditing = () => {
        element.contentEditable = 'false';
        element.classList.remove('editing');
        const newText = element.innerText.trim();
        if (newText) {
          marker.properties.text = newText;
          const icon = marker.getIcon() as L.DivIcon;
          const newOptions: CustomIconOptions = {
            html: createHtml(newText, marker.properties.style),
            className: icon.options.className
          };
          marker.setIcon(L.divIcon(newOptions));
        }
        element.removeEventListener('blur', finishEditing);
        element.removeEventListener('keydown', onKeyDown);
      };

      const onKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          finishEditing();
        }
      };

      element.addEventListener('blur', finishEditing);
      element.addEventListener('keydown', onKeyDown);
    });

    return marker;
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
      white-space: pre-line;
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
  const addMeasureEvents = (point: ControlPoint, _layer: L.Layer, getMeasureText: () => string) => {
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
        point.measureDiv = undefined;
      }
    });
  };
  // Ajouter ces variables au niveau du composable
  let activeControlPoints: ControlPoint[] = [];

  // Fonction pour nettoyer les points de contrôle actifs
  const clearActiveControlPoints = () => {
    activeControlPoints.forEach(point => {
      if (point && point.remove) {
        // Nettoyer les mesures associées
        if ('measureDiv' in point && point.measureDiv) {
          point.measureDiv.remove();
          point.measureDiv = undefined;
        }
        // Supprimer le point de contrôle
        if (featureGroup.value) {
          featureGroup.value.removeLayer(point);
        }
        point.remove();
      }
    });
    activeControlPoints = [];

    // Nettoyer toutes les mesures restantes sur la carte
    document.querySelectorAll('.measure-tooltip').forEach(measure => {
      measure.remove();
    });
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
    } as L.CircleMarkerOptions);
    
    if (featureGroup.value) {
      featureGroup.value.addLayer(point);
    }
    
    return point;
  };

  // Fonction pour calculer les propriétés d'une forme
  const calculateShapeProperties = (layer: L.Layer, type: string): any => {
    console.log('=== CALCULATING SHAPE PROPERTIES START ===');
    console.log('Input layer:', {
      type,
      instanceof: {
        Circle: layer instanceof L.Circle,
        Rectangle: layer instanceof L.Rectangle,
        Polygon: layer instanceof L.Polygon,
        Polyline: layer instanceof L.Polyline,
        CircleArc: layer instanceof CircleArc
      },
      options: layer.options
    });

    const properties: any = {
      type,
      style: layer.options || {}
    };

    try {
      if (layer instanceof L.Circle) {
        const radius = layer.getRadius();
        const center = layer.getLatLng();
        properties.radius = radius;
        properties.diameter = radius * 2;
        properties.area = Math.PI * Math.pow(radius, 2);
        properties.perimeter = 2 * Math.PI * radius;
        properties.center = center;
        properties.surfaceInterieure = properties.area;
        properties.surfaceExterieure = properties.area;
        console.log('Circle properties calculated:', properties);
      } 
      else if (layer instanceof CircleArc) {
        const radius = layer.getRadius();
        const center = layer.getCenter();
        const startAngle = layer.getStartAngle();
        const stopAngle = layer.getStopAngle();
        const openingAngle = layer.getOpeningAngle();
        
        properties.radius = radius;
        properties.diameter = radius * 2;
        properties.area = (Math.PI * Math.pow(radius, 2) * openingAngle) / 360;
        properties.arcLength = (2 * Math.PI * radius * openingAngle) / 360;
        properties.perimeter = properties.arcLength + 2 * radius;
        properties.center = center;
        properties.startAngle = startAngle;
        properties.stopAngle = stopAngle;
        properties.openingAngle = openingAngle;
        properties.surfaceInterieure = properties.area;
        properties.surfaceExterieure = properties.area;
        console.log('CircleArc properties calculated:', properties);
      }
      else if (layer instanceof L.Rectangle) {
        const bounds = layer.getBounds();
        const ne = bounds.getNorthEast();
        const sw = bounds.getSouthWest();
        const width = turf.distance([sw.lng, sw.lat], [ne.lng, sw.lat], { units: 'meters' });
        const height = turf.distance([sw.lng, sw.lat], [sw.lng, ne.lat], { units: 'meters' });
        properties.width = width;
        properties.height = height;
        properties.area = width * height;
        properties.perimeter = 2 * (width + height);
        properties.surfaceInterieure = properties.area;
        properties.surfaceExterieure = properties.area;
        properties.dimensions = {
          width,
          height
        };
        console.log('Rectangle properties calculated:', properties);
      }
      else if (layer instanceof L.Polygon) {
        const latLngs = layer.getLatLngs()[0] as L.LatLng[];
        const coordinates = latLngs.map((ll: L.LatLng) => [ll.lng, ll.lat]);
        coordinates.push(coordinates[0]); // Fermer le polygone
        const polygon = turf.polygon([coordinates]);
        properties.area = turf.area(polygon);
        properties.perimeter = turf.length(turf.lineString([...coordinates]), { units: 'meters' });
        properties.surfaceInterieure = properties.area;
        properties.surfaceExterieure = properties.area;
        console.log('Polygon properties calculated:', properties);
      }
      else if (layer instanceof L.Polyline && !(layer instanceof L.Polygon)) {
        const latLngs = layer.getLatLngs() as L.LatLng[];
        const coordinates = latLngs.map((ll: L.LatLng) => [ll.lng, ll.lat]);
        const line = turf.lineString(coordinates);
        properties.length = turf.length(line, { units: 'meters' });
        // Calculer la surface d'influence pour les lignes
        const width = 10; // Largeur d'influence par défaut en mètres
        properties.surfaceInfluence = properties.length * width;
        properties.dimensions = {
          width
        };
        console.log('Polyline properties calculated:', properties);
      }

      // Ajouter les propriétés de style
      properties.style = {
        ...properties.style,
        color: (layer.options as L.PathOptions)?.color || '#3388ff',
        weight: (layer.options as L.PathOptions)?.weight || 3,
        opacity: (layer.options as L.PathOptions)?.opacity || 1,
        fillColor: (layer.options as L.PathOptions)?.fillColor || '#3388ff',
        fillOpacity: (layer.options as L.PathOptions)?.fillOpacity || 0.2,
        dashArray: (layer.options as any)?.dashArray || ''
      };

    } catch (error) {
      console.error('Error calculating shape properties:', error);
    }

    console.log('=== CALCULATING SHAPE PROPERTIES END ===');
    console.log('Final properties:', properties);
    return properties;
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
        dashArray: '6,6',
        radius: 6
      } as L.CircleMarkerOptions,
      hintlineStyle: {
        color: '#3388ff',
        weight: 2,
        opacity: 0.7,
        dashArray: '6,6',
        radius: 6
      } as L.CircleMarkerOptions
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
      
      // Déterminer le type de forme
      let shapeType = 'unknown';
      if (layer instanceof L.Circle) {
        shapeType = currentTool.value === 'Semicircle' ? 'Semicircle' : 'Circle';
      } else if (layer instanceof L.Rectangle) {
        shapeType = 'Rectangle';
      } else if (layer instanceof L.Polygon) {
        shapeType = 'Polygon';
      } else if (layer instanceof L.Polyline && !(layer instanceof L.Polygon)) {
        shapeType = 'Line';
      }

      // Calculer et initialiser les propriétés
      layer.properties = calculateShapeProperties(layer, shapeType);
      selectedShape.value = layer;

      // Ajouter les points de contrôle selon le type
      if (shapeType === 'Semicircle') {
        const center = layer.getLatLng();
        const radius = layer.getRadius();
        
        // Supprimer le cercle original
        featureGroup.value?.removeLayer(layer);
        
        // Créer un nouveau demi-cercle
        const semicircle = new CircleArc(center, radius);
        semicircle.properties = calculateShapeProperties(semicircle, 'Semicircle');
        featureGroup.value?.addLayer(semicircle);
        selectedShape.value = semicircle;
        updateSemicircleControlPoints(semicircle);
      } else {
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

      // Afficher le message d'aide
      showHelpMessage('Cliquez sur la forme pour afficher les points de contrôle');
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
      console.log('=== PM:EDIT EVENT START ===');
      console.log('Event details:', e);
      
      const layer = e.layer;
      if (layer) {
        console.log('Layer before update:', {
          type: layer.properties?.type,
          properties: layer.properties,
          options: layer.options,
          _mRadius: layer._mRadius,
          _latlng: layer._latlng,
          constructor: layer.constructor.name
        });

        // Déterminer le type de forme
        let shapeType = 'unknown';
        if (layer instanceof L.Circle) {
          shapeType = layer.properties?.type === 'Semicircle' ? 'Semicircle' : 'Circle';
          console.log('Circle detected with radius:', layer.getRadius());
        } else if (layer instanceof L.Rectangle) {
          shapeType = 'Rectangle';
        } else if (layer instanceof L.Polygon) {
          shapeType = 'Polygon';
        } else if (layer instanceof L.Polyline && !(layer instanceof L.Polygon)) {
          shapeType = 'Line';
        }
        console.log('Detected shape type:', shapeType);

        // Recalculer les propriétés
        const newProperties = calculateShapeProperties(layer, shapeType);
        console.log('Newly calculated properties:', newProperties);
        
        // Mettre à jour la forme sélectionnée
        if (selectedShape.value && selectedShape.value === layer) {
          console.log('Updating selected shape...', {
            currentRadius: layer._mRadius,
            newRadius: newProperties.radius
          });
          
          // Créer une nouvelle référence pour les propriétés
          const updatedProperties = { ...newProperties };
          
          // Mettre à jour les propriétés de la forme avec une nouvelle référence
          layer.properties = updatedProperties;
          
          // Forcer la mise à jour de la forme sélectionnée
          selectedShape.value = null;
          nextTick(() => {
            selectedShape.value = layer;
          });
          
          // Émettre un événement pour notifier les changements
          console.log('Emitting properties:updated event with:', {
            shape: {
              _mRadius: layer._mRadius,
              _latlng: layer._latlng,
              properties: updatedProperties,
              constructor: layer.constructor.name
            }
          });
          
          // Émettre l'événement avec la nouvelle référence des propriétés
          layer.fire('properties:updated', {
            shape: layer,
            properties: updatedProperties
          });

          // Vérifier que les propriétés ont été mises à jour
          console.log('Shape properties after update:', {
            layerRadius: layer._mRadius,
            propertiesRadius: layer.properties.radius,
            fullProperties: layer.properties
          });
        }

        // Mettre à jour les points de contrôle
        if (shapeType === 'Semicircle') {
          updateSemicircleControlPoints(layer as CircleArc);
        } else if (layer instanceof L.Circle) {
          updateCircleControlPoints(layer);
        } else if (layer instanceof L.Rectangle) {
          updateRectangleControlPoints(layer);
        } else if (layer instanceof L.Polygon) {
          updatePolygonControlPoints(layer);
        } else if (layer instanceof L.Polyline) {
          updateLineControlPoints(layer);
        }

        // Afficher le message d'aide pour l'édition
        showHelpMessage('Utilisez les points de contrôle pour modifier la forme');
      }
      console.log('=== PM:EDIT EVENT END ===');
    });

    // Événements de glisser-déposer
    mapInstance.on('pm:dragstart', () => {
      // Supprimer les messages précédents avant d'afficher le nouveau
      document.querySelectorAll('.drawing-help-message').forEach(msg => msg.remove());
      showHelpMessage('Déplacez la forme à l\'endroit souhaité');
    });

    mapInstance.on('pm:dragend', (e: any) => {
      // Recalculer les propriétés après le déplacement
      if (e.layer && selectedShape.value === e.layer) {
        const layer = e.layer;
        const shapeType = layer.properties?.type || 'unknown';
        const newProperties = calculateShapeProperties(layer, shapeType);
        
        // Mettre à jour les propriétés
        layer.properties = { ...newProperties };
        
        // Forcer la mise à jour de la forme sélectionnée
        selectedShape.value = null;
        nextTick(() => {
          selectedShape.value = layer;
        });
        
        // Émettre l'événement de mise à jour
        layer.fire('properties:updated', {
          shape: layer,
          properties: layer.properties
        });
      }

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

    console.log('=== SETTING DRAWING TOOL START ===');
    console.log('Current tool:', currentTool.value);
    console.log('New tool:', tool);

    // Nettoyer les messages d'aide existants
    document.querySelectorAll('.drawing-help-message').forEach(msg => msg.remove());

    // Désactiver tous les modes et nettoyer les points de contrôle
    try {
      console.log('Disabling all modes...');
      
      // Désactiver les modes de manière sécurisée
      const pm = map.value.pm;
      // Désactiver les modes globaux de manière sécurisée
      if (pm.globalEditModeEnabled()) {
        pm.disableGlobalEditMode();
      }
      if (pm.globalDragModeEnabled()) {
        pm.disableGlobalDragMode();
      }
      if (pm.globalRemovalModeEnabled()) {
        pm.disableGlobalRemovalMode();
      }
      
      // Désactiver le mode dessin en cours
      pm.disableDraw();
      
      clearActiveControlPoints();
    } catch (error) {
      console.error('Error disabling modes:', error);
    }

    currentTool.value = tool;
    console.log('Tool set to:', currentTool.value);

    // Si aucun outil n'est sélectionné
    if (!tool) {
      console.log('No tool selected, clearing control points');
      clearActiveControlPoints();
      return;
    }

    // Attendre un court instant avant d'afficher le nouveau message
    setTimeout(() => {
      try {
        console.log('Enabling tool:', tool);
        switch (tool) {
          case 'Circle':
            showHelpMessage('Cliquez et maintenez pour dessiner un cercle, relâchez pour terminer');
            map.value?.pm.enableDraw('Circle', {
              finishOn: 'mouseup' as any,
              continueDrawing: false
            });
            break;
          case 'Semicircle':
            showHelpMessage('Cliquez et maintenez pour dessiner un demi-cercle, relâchez pour terminer');
            map.value?.pm.enableDraw('Circle', {
              finishOn: 'mouseup' as any,
              continueDrawing: false
            });
            break;
          case 'Rectangle':
            showHelpMessage('Cliquez et maintenez pour dessiner un rectangle, relâchez pour terminer');
            map.value?.pm.enableDraw('Rectangle', {
              finishOn: 'mouseup' as any
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
          case 'Text':
            showHelpMessage('Cliquez pour ajouter du texte, double-cliquez pour éditer');
            if (map.value) {
              const onClick = (e: L.LeafletMouseEvent) => {
                if (!map.value || !featureGroup.value) return;

                const marker = createTextMarker(e.latlng);
                featureGroup.value.addLayer(marker);
                selectedShape.value = marker;
                
                // Désactiver le mode texte après l'ajout
                map.value.off('click', onClick);
                setDrawingTool('');
              };
              
              map.value.on('click', onClick);
            }
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
        console.log('Tool enabled successfully');
      } catch (error) {
        console.error('Error enabling tool:', error);
      }
    }, 100);
    console.log('=== SETTING DRAWING TOOL END ===');
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

    clearActiveControlPoints();
    const center = layer.getLatLng();
    const radius = layer.getRadius();

    // Point central (vert)
    const centerPoint = createControlPoint(center, '#059669');
    activeControlPoints.push(centerPoint);
    
    // Ajouter les mesures au point central
    addMeasureEvents(centerPoint, layer, () => {
      const area = Math.PI * radius * radius;
      return [
        formatMeasure(radius, 'm', 'Rayon'),
        formatMeasure(area, 'm²', 'Surface')
      ].join('<br>');
    });

    // Points cardinaux (bleu)
    const cardinalPoints: L.CircleMarker[] = [];
    [0, 45, 90, 135, 180, 225, 270, 315].forEach(angle => {
      const rad = (angle * Math.PI) / 180;
      const point = L.latLng(
        center.lat + (radius / 111319.9) * Math.sin(rad),
        center.lng + (radius / (111319.9 * Math.cos(center.lat * Math.PI / 180))) * Math.cos(rad)
      );
      const controlPoint = createControlPoint(point, '#2563EB');
      cardinalPoints.push(controlPoint);
      activeControlPoints.push(controlPoint);
      
      // Ajouter les mesures aux points cardinaux
      addMeasureEvents(controlPoint, layer, () => {
        const distance = center.distanceTo(controlPoint.getLatLng());
        return formatMeasure(distance, 'm', 'Distance du centre');
      });

      // Gestion du redimensionnement via les points cardinaux
      controlPoint.on('mousedown', (e: L.LeafletMouseEvent) => {
          if (!map.value) return;
      L.DomEvent.stopPropagation(e);
      map.value.dragging.disable();
      
      let isDragging = true;
      
          const onMouseMove = (e: L.LeafletMouseEvent) => {
        if (!isDragging) return;
          const newRadius = center.distanceTo(e.latlng);
          layer.setRadius(newRadius);

          // Mettre à jour la position de tous les points cardinaux
          cardinalPoints.forEach((point, i) => {
            const pointAngle = (i * 45 * Math.PI) / 180;
            const newPoint = L.latLng(
              center.lat + (newRadius / 111319.9) * Math.sin(pointAngle),
              center.lng + (newRadius / (111319.9 * Math.cos(center.lat * Math.PI / 180))) * Math.cos(pointAngle)
            );
            point.setLatLng(newPoint);
          });

        // Recalculer et émettre les nouvelles propriétés
        const newProperties = calculateShapeProperties(layer, 'Circle');
        layer.properties = { ...newProperties };
        layer.fire('properties:updated', {
          shape: layer,
          properties: layer.properties
        });
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

    // Gestion du déplacement via le point central
    centerPoint.on('mousedown', (e: L.LeafletMouseEvent) => {
        if (!map.value) return;
        L.DomEvent.stopPropagation(e);
        map.value.dragging.disable();
        
        let isDragging = true;
        
        const onMouseMove = (e: L.LeafletMouseEvent) => {
          if (!isDragging) return;
        layer.setLatLng(e.latlng);
        centerPoint.setLatLng(e.latlng);

        // Mettre à jour la position des points cardinaux
        cardinalPoints.forEach((point, i) => {
          const angle = (i * 45 * Math.PI) / 180;
          const newPoint = L.latLng(
            e.latlng.lat + (radius / 111319.9) * Math.sin(angle),
            e.latlng.lng + (radius / (111319.9 * Math.cos(e.latlng.lat * Math.PI / 180))) * Math.cos(angle)
          );
          point.setLatLng(newPoint);
          });
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
              
  // Fonction pour mettre à jour les points de contrôle d'un rectangle
  const updateRectangleControlPoints = (layer: L.Rectangle) => {
    if (!map.value || !featureGroup.value) return;

    clearActiveControlPoints();
    const bounds = layer.getBounds();
    const center = bounds.getCenter();
    const corners = [
      bounds.getNorthWest(),
      bounds.getNorthEast(),
      bounds.getSouthEast(),
      bounds.getSouthWest()
    ];

    // Point central (vert)
    const centerPoint = createControlPoint(center, '#059669');
    activeControlPoints.push(centerPoint);

    // Ajouter les mesures au point central
    addMeasureEvents(centerPoint, layer, () => {
      const bounds = layer.getBounds();
      const width = bounds.getNorthEast().distanceTo(bounds.getNorthWest());
      const height = bounds.getNorthWest().distanceTo(bounds.getSouthWest());
      const area = width * height;
      return [
        formatMeasure(width, 'm', 'Largeur'),
        formatMeasure(height, 'm', 'Hauteur'),
        formatMeasure(area, 'm²', 'Surface')
      ].join('<br>');
    });

    // Points de coin (rouge)
    const cornerPoints: L.CircleMarker[] = [];
    corners.forEach((corner) => {
      const cornerPoint = createControlPoint(corner, '#DC2626');
      cornerPoints.push(cornerPoint);
      activeControlPoints.push(cornerPoint);
      
      // Ajouter les mesures aux coins
      addMeasureEvents(cornerPoint, layer, () => {
        const bounds = layer.getBounds();
        const width = bounds.getNorthEast().distanceTo(bounds.getNorthWest());
        const height = bounds.getNorthWest().distanceTo(bounds.getSouthWest());
        return [
          formatMeasure(width, 'm', 'Largeur'),
          formatMeasure(height, 'm', 'Hauteur')
        ].join('<br>');
      });
    });

    // Points milieux (bleu)
    const midPoints: L.CircleMarker[] = [];
    corners.forEach((corner, index) => {
      const nextCorner = corners[(index + 1) % 4];
      const midPoint = getMidPoint(corner, nextCorner);
      const midPointMarker = createControlPoint(midPoint, '#2563EB');
      midPoints.push(midPointMarker);
      activeControlPoints.push(midPointMarker);

      // Ajouter les mesures aux points milieux
      addMeasureEvents(midPointMarker, layer, () => {
        const bounds = layer.getBounds();
        const width = bounds.getNorthEast().distanceTo(bounds.getNorthWest());
        const height = bounds.getNorthWest().distanceTo(bounds.getSouthWest());
        return [
          formatMeasure(width, 'm', 'Largeur'),
          formatMeasure(height, 'm', 'Hauteur')
        ].join('<br>');
      });
    });

    // Gestion du déplacement via le point central
    centerPoint.on('mousedown', (e: L.LeafletMouseEvent) => {
        if (!map.value) return;
        L.DomEvent.stopPropagation(e);
        map.value.dragging.disable();
        
        let isDragging = true;
      const startBounds = layer.getBounds();
      const startMouseLatLng = e.latlng;
        
        const onMouseMove = (e: L.LeafletMouseEvent) => {
        if (!isDragging) return;
        
        // Calculer le déplacement
        const dx = e.latlng.lng - startMouseLatLng.lng;
        const dy = e.latlng.lat - startMouseLatLng.lat;
        
        // Déplacer le rectangle en conservant ses dimensions
        const newBounds = L.latLngBounds(
          L.latLng(startBounds.getSouth() + dy, startBounds.getWest() + dx),
          L.latLng(startBounds.getNorth() + dy, startBounds.getEast() + dx)
        );
        layer.setBounds(newBounds);
        
        // Mettre à jour la position de tous les points de contrôle
        const newCorners = [
          newBounds.getNorthWest(),
          newBounds.getNorthEast(),
          newBounds.getSouthEast(),
          newBounds.getSouthWest()
        ];

        // Mettre à jour le point central
        centerPoint.setLatLng(newBounds.getCenter());

        // Mettre à jour les points de coin
        cornerPoints.forEach((point, i) => {
          point.setLatLng(newCorners[i]);
        });

        // Mettre à jour les points milieux
        midPoints.forEach((point, i) => {
          const corner = newCorners[i];
          const nextCorner = newCorners[(i + 1) % 4];
          point.setLatLng(getMidPoint(corner, nextCorner));
        });
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

    // Gestion du redimensionnement via les points de coin
    cornerPoints.forEach((cornerPoint, index) => {
      cornerPoint.on('mousedown', (e: L.LeafletMouseEvent) => {
      if (!map.value) return;
      L.DomEvent.stopPropagation(e);
        map.value.dragging.disable();

      let isDragging = true;

      const onMouseMove = (e: L.LeafletMouseEvent) => {
          if (!isDragging) return;
          
          // Mettre à jour le coin opposé
          const oppositeIndex = (index + 2) % 4;
          const oppositeCorner = corners[oppositeIndex];
          
          // Créer les nouvelles limites en gardant le coin opposé fixe
          const newBounds = L.latLngBounds(oppositeCorner, e.latlng);
          layer.setBounds(newBounds);
          
          // Mettre à jour la position de tous les points de contrôle
          const newCorners = [
            newBounds.getNorthWest(),
            newBounds.getNorthEast(),
            newBounds.getSouthEast(),
            newBounds.getSouthWest()
          ];

          // Mettre à jour le point central
          centerPoint.setLatLng(newBounds.getCenter());

          // Mettre à jour les points de coin
          cornerPoints.forEach((point, i) => {
            point.setLatLng(newCorners[i]);
          });

          // Mettre à jour les points milieux
          midPoints.forEach((point, i) => {
            const corner = newCorners[i];
            const nextCorner = newCorners[(i + 1) % 4];
            point.setLatLng(getMidPoint(corner, nextCorner));
        });
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
  };

  // Fonction pour mettre à jour les points de contrôle d'une ligne
  const updateLineControlPoints = (layer: L.Polyline) => {
          if (!map.value || !featureGroup.value) return;

    clearActiveControlPoints();
    const points = layer.getLatLngs() as L.LatLng[];

    // Points d'extrémité (vert)
    points.forEach((point, i) => {
      const pointMarker = createControlPoint(point, '#059669');
      activeControlPoints.push(pointMarker);

      // Ajouter les mesures aux points d'extrémité
      addMeasureEvents(pointMarker, layer, () => {
        const totalLength = points.reduce((acc, curr, idx) => {
          if (idx === 0) return 0;
          return acc + curr.distanceTo(points[idx - 1]);
        }, 0);
        
        let distanceFromStart = points.slice(0, i + 1).reduce((acc, curr, idx) => {
          if (idx === 0) return 0;
          return acc + curr.distanceTo(points[idx - 1]);
        }, 0);

        return [
          formatMeasure(distanceFromStart, 'm', 'Distance depuis le début'),
          formatMeasure(totalLength, 'm', 'Longueur totale')
        ].join('<br>');
      });

      pointMarker.on('mousedown', (e: L.LeafletMouseEvent) => {
        if (!map.value) return;
        L.DomEvent.stopPropagation(e);
        map.value.dragging.disable();
        
        let isDragging = true;
        
        const onMouseMove = (e: L.LeafletMouseEvent) => {
          if (!isDragging) return;
          points[i] = e.latlng;
          layer.setLatLngs(points);
          pointMarker.setLatLng(e.latlng);
          updateMidPoints();
        };
        
        const onMouseUp = () => {
          isDragging = false;
            if (!map.value) return;
          map.value.off('mousemove', onMouseMove);
          document.removeEventListener('mouseup', onMouseUp);
          map.value.dragging.enable();
          updateLineControlPoints(layer);
        };
        
        map.value.on('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
      });
    });

    // Points milieux (bleu)
    const updateMidPoints = () => {
      // Supprimer les anciens points milieux
      activeControlPoints.slice(points.length).forEach(point => {
        if (featureGroup.value) {
          featureGroup.value.removeLayer(point);
        }
      });
      activeControlPoints = activeControlPoints.slice(0, points.length);

      // Créer les nouveaux points milieux
      for (let i = 0; i < points.length - 1; i++) {
        const midPoint = getMidPoint(points[i], points[i + 1]);
        const midPointMarker = createControlPoint(midPoint, '#2563EB');
        activeControlPoints.push(midPointMarker);

        // Ajouter les mesures aux points milieux
        addMeasureEvents(midPointMarker, layer, () => {
          const segmentLength = points[i].distanceTo(points[i + 1]);
          const totalLength = points.reduce((acc, curr, idx) => {
            if (idx === 0) return 0;
            return acc + curr.distanceTo(points[idx - 1]);
          }, 0);
          const distanceFromStart = points.slice(0, i + 1).reduce((acc, curr, idx) => {
            if (idx === 0) return 0;
            return acc + curr.distanceTo(points[idx - 1]);
          }, 0) + segmentLength / 2;

          return [
            formatMeasure(segmentLength, 'm', 'Longueur du segment'),
            formatMeasure(segmentLength/2, 'm', 'Demi-segment'),
            formatMeasure(distanceFromStart, 'm', 'Distance depuis le début'),
            formatMeasure(totalLength, 'm', 'Longueur totale')
          ].join('<br>');
        });

        midPointMarker.on('mousedown', (e: L.LeafletMouseEvent) => {
          if (!map.value) return;
          L.DomEvent.stopPropagation(e);
        map.value.dragging.disable();

          let isDragging = true;
          
          const onMouseMove = (e: L.LeafletMouseEvent) => {
            if (!isDragging) return;
            // Insérer un nouveau point
            points.splice(i + 1, 0, e.latlng);
            layer.setLatLngs(points);
            updateLineControlPoints(layer);
          };
          
          const onMouseUp = () => {
            isDragging = false;
            if (!map.value) return;
            map.value.off('mousemove', onMouseMove);
          map.value.dragging.enable();
          };
          
          map.value.on('mousemove', onMouseMove);
          document.addEventListener('mouseup', onMouseUp);
        });
      }
    };

    updateMidPoints();
  };

  // Mettre à jour la fonction updatePolygonControlPoints pour ajouter plus de mesures
  const updatePolygonControlPoints = (layer: L.Polygon) => {
          if (!map.value || !featureGroup.value) return;

    clearActiveControlPoints();
    const points = (layer.getLatLngs()[0] as L.LatLng[]);
    
    // Convertir les points en format GeoJSON pour turf
    const coordinates = points.map(point => [point.lng, point.lat]);
    coordinates.push(coordinates[0]); // Fermer le polygone
    const polygon = turf.polygon([coordinates]);
    const area = turf.area(polygon);
    
    const perimeter = points.reduce((acc, curr, idx) => {
      const nextPoint = points[(idx + 1) % points.length];
      return acc + curr.distanceTo(nextPoint);
    }, 0);

    // Points de sommet (vert)
    points.forEach((point, i) => {
      const pointMarker = createControlPoint(point, '#059669');
      activeControlPoints.push(pointMarker);

      // Ajouter les mesures aux sommets
      addMeasureEvents(pointMarker, layer, () => {
        const prevPoint = points[(i - 1 + points.length) % points.length];
        const nextPoint = points[(i + 1) % points.length];
        const distanceToPrev = point.distanceTo(prevPoint);
        const distanceToNext = point.distanceTo(nextPoint);
        
        return [
          formatMeasure(distanceToPrev, 'm', 'Distance au point précédent'),
          formatMeasure(distanceToNext, 'm', 'Distance au point suivant'),
          formatMeasure(perimeter, 'm', 'Périmètre total'),
          formatMeasure(area, 'm²', 'Surface')
        ].join('<br>');
      });

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
        const nextPoint = points[(i + 1) % points.length];
        const midPoint = getMidPoint(points[i], nextPoint);
        const midPointMarker = createControlPoint(midPoint, '#2563EB');
        activeControlPoints.push(midPointMarker);

        // Ajouter les mesures aux points milieux
        addMeasureEvents(midPointMarker, layer, () => {
          const segmentLength = points[i].distanceTo(nextPoint);
          return [
            formatMeasure(segmentLength, 'm', 'Longueur du segment'),
            formatMeasure(perimeter, 'm', 'Périmètre total'),
            formatMeasure(area, 'm²', 'Surface')
          ].join('<br>');
        });
      }
    };

    updateMidPoints();
  };

  // Fonction pour mettre à jour les points de contrôle d'un demi-cercle
  const updateSemicircleControlPoints = (layer: CircleArc) => {
    if (!map.value || !featureGroup.value) return;

    clearActiveControlPoints();
    const center = layer.getCenter();
    const radius = layer.getRadius();
    const startAngle = layer.getStartAngle();
    const stopAngle = layer.getStopAngle();

    // Points de contrôle des angles (rouges)
    const angles = [startAngle, stopAngle];
    angles.forEach((currentAngle, index) => {
      const rad = (currentAngle * Math.PI) / 180;
      const point = L.latLng(
        center.lat + (radius / 111319.9) * Math.sin(rad),
        center.lng + (radius / (111319.9 * Math.cos(center.lat * Math.PI / 180))) * Math.cos(rad)
      );

      const angleControl = createControlPoint(point, '#DC2626');
      activeControlPoints.push(angleControl);

      addMeasureEvents(angleControl, layer, () => {
        return `Angle: ${formatAngle(currentAngle)}`;
      });

      angleControl.on('mousedown', (e: L.LeafletMouseEvent) => {
        if (!map.value) return;
        L.DomEvent.stopPropagation(e);
        map.value.dragging.disable();

        let isDragging = true;

        // Cacher le point bleu pendant le déplacement des points rouges
        const radiusControl = activeControlPoints.find(point => point.options.color === '#2563EB');
        if (radiusControl) {
          radiusControl.setStyle({ opacity: 0, fillOpacity: 0 });
        }

        const onMouseMove = (e: L.LeafletMouseEvent) => {
          if (!isDragging || !map.value) return;

          const newAngle = Math.atan2(
            e.latlng.lat - center.lat,
            e.latlng.lng - center.lng
          ) * 180 / Math.PI;

          const exactPoint = L.latLng(
            center.lat + (radius / 111319.9) * Math.sin(newAngle * Math.PI / 180),
            center.lng + (radius / (111319.9 * Math.cos(center.lat * Math.PI / 180))) * Math.cos(newAngle * Math.PI / 180)
          );

          angleControl.setLatLng(exactPoint);

          // Mise à jour des angles selon le point déplacé
          if (index === 0) {
            layer.setAngles(newAngle, layer.getStopAngle());
          } else {
            layer.setAngles(layer.getStartAngle(), newAngle);
          }

          // Recalculer et émettre les nouvelles propriétés
          const newProperties = calculateShapeProperties(layer, 'Semicircle');
          layer.properties = { ...newProperties };
          layer.fire('properties:updated', {
            shape: layer,
            properties: layer.properties
          });
        };

        const onMouseUp = () => {
          isDragging = false;
          if (!map.value) return;
          map.value.off('mousemove', onMouseMove);
          document.removeEventListener('mouseup', onMouseUp);
          map.value.dragging.enable();
          // Réafficher et mettre à jour le point bleu après le relâchement
          updateSemicircleControlPoints(layer);
        };

        map.value.on('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
      });
    });

    // Point central (vert)
    const centerPoint = createControlPoint(center, '#059669');
    activeControlPoints.push(centerPoint);

    // Ajouter les mesures au point central
    addMeasureEvents(centerPoint, layer, () => {
      const area = (Math.PI * radius * radius * layer.getOpeningAngle()) / 360;
      return [
        formatMeasure(radius, 'm', 'Rayon'),
        formatMeasure(area, 'm²', 'Surface'),
        `Angle: ${formatAngle(layer.getOpeningAngle())}`
      ].join('<br>');
    });

    // Point de contrôle du rayon au milieu de l'arc (bleu)
    const openingAngle = layer.getOpeningAngle();
    // Ne pas afficher le point bleu si l'angle d'ouverture est trop petit
    if (openingAngle > 5) {
      const midAngle = ((startAngle + stopAngle) / 2 + 360) % 360;
      const midRad = (midAngle * Math.PI) / 180;
      const midPoint = L.latLng(
        center.lat + (radius / 111319.9) * Math.sin(midRad),
        center.lng + (radius / (111319.9 * Math.cos(center.lat * Math.PI / 180))) * Math.cos(midRad)
      );
      
      const radiusControl = createControlPoint(midPoint, '#2563EB');
      activeControlPoints.push(radiusControl);

      // Ajouter les mesures au point de contrôle du rayon
      addMeasureEvents(radiusControl, layer, () => {
        return formatMeasure(radius, 'm', 'Rayon');
      });

      // Gestion du redimensionnement via le point de contrôle du rayon
      radiusControl.on('mousedown', (e: L.LeafletMouseEvent) => {
        if (!map.value) return;
        L.DomEvent.stopPropagation(e);
        map.value.dragging.disable();

        let isDragging = true;

        const onMouseMove = (e: L.LeafletMouseEvent) => {
          if (!isDragging) return;
          const newRadius = center.distanceTo(e.latlng);
          layer.setRadius(newRadius);

          // Calculer le nouvel angle pour garder le point sur l'arc
          const newAngle = Math.atan2(
            e.latlng.lat - center.lat,
            e.latlng.lng - center.lng
          ) * 180 / Math.PI;
          
          // S'assurer que le point reste dans l'arc
          const normalizedAngle = ((newAngle - startAngle + 360) % 360);
          if (normalizedAngle <= openingAngle) {
            // Mettre à jour la position du point de contrôle sur l'arc
            const exactPoint = L.latLng(
              center.lat + (newRadius / 111319.9) * Math.sin(midRad),
              center.lng + (newRadius / (111319.9 * Math.cos(center.lat * Math.PI / 180))) * Math.cos(midRad)
            );
            radiusControl.setLatLng(exactPoint);

            // Recalculer et émettre les nouvelles propriétés
            const newProperties = calculateShapeProperties(layer, 'Semicircle');
            layer.properties = { ...newProperties };
            layer.fire('properties:updated', {
              shape: layer,
              properties: layer.properties
            });

            // Mettre à jour la position des points de contrôle des angles
            angles.forEach((angle, index) => {
              const rad = (angle * Math.PI) / 180;
              const point = L.latLng(
                center.lat + (newRadius / 111319.9) * Math.sin(rad),
                center.lng + (newRadius / (111319.9 * Math.cos(center.lat * Math.PI / 180))) * Math.cos(rad)
              );
              activeControlPoints[index].setLatLng(point);
            });
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
    }

    // Gestion du déplacement du point central
    centerPoint.on('mousedown', (e: L.LeafletMouseEvent) => {
      if (!map.value) return;
      L.DomEvent.stopPropagation(e);
      map.value.dragging.disable();

      let isDragging = true;

      const onMouseMove = (e: L.LeafletMouseEvent) => {
        if (!isDragging) return;
        layer.setCenter(e.latlng);
        centerPoint.setLatLng(e.latlng);

        // Recalculer et émettre les nouvelles propriétés
        const newProperties = calculateShapeProperties(layer, 'Semicircle');
        layer.properties = { ...newProperties };
        layer.fire('properties:updated', {
          shape: layer,
          properties: layer.properties
        });

        // Mettre à jour la position des points de contrôle des angles
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
    adjustView,
    clearActiveControlPoints
  };
}