import { ref, onUnmounted, nextTick, type Ref } from 'vue';
import L from 'leaflet';
import '@geoman-io/leaflet-geoman-free';
import { CircleArc } from '../utils/CircleArc';
import { Circle } from '../utils/Circle';
import { Rectangle } from '../utils/Rectangle';
import { TextRectangle } from '../utils/TextRectangle';
import { Line } from '../utils/Line';
import type { TextStyle, TextMarker } from '../types/leaflet';
import * as turf from '@turf/turf';
import centroid from '@turf/centroid';
import { PerformanceTracker } from '@/utils/PerformanceTracker';


// Ajouter cette interface avant la déclaration du module 'leaflet'
interface CustomIconOptions extends L.DivIconOptions {
  html?: string;
  className?: string;
}

// Extend GlobalOptions to include snapLayers
interface ExtendedGlobalOptions extends L.PM.GlobalOptions {
  snapLayers?: L.LayerGroup[];
}

// Modifier l'interface Layer pour éviter les conflits de type
declare module 'leaflet' {
  interface Layer {
    properties?: any;
    pm?: any;
    _textLayer?: L.Marker;
    options: L.LayerOptions;
    getCenter?: () => L.LatLng;
    getLatLng?: () => L.LatLng;
    getRadius?: () => number;
    getStartAngle?: () => number;
    getStopAngle?: () => number;
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
  controlPointsGroup: Ref<any>;
  tempControlPointsGroup: Ref<any>;
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

// Ajouter cette fonction en haut du fichier, après les imports
const debounce = (fn: Function, delay: number) => {
  let timeoutId: number;
  return function (this: any, ...args: any[]) {
    window.clearTimeout(timeoutId);
    timeoutId = window.setTimeout(() => fn.apply(this, args), delay);
  };
};

// Ajouter cette fonction throttle pour limiter la fréquence des mises à jour
const throttle = (fn: Function, delay: number) => {
  let lastCall = 0;
  return function (this: any, ...args: any[]) {
    const now = Date.now();
    if (now - lastCall < delay) return;
    lastCall = now;
    return fn.apply(this, args);
  };
};

// Ajouter cette fonction en haut du fichier

export function useMapDrawing(): MapDrawingReturn {
  const map = ref<any>(null);
  const featureGroup = ref<any>(null);
  const controlPointsGroup = ref<any>(null);
  const tempControlPointsGroup = ref<any>(null);
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

  // Ajouter cette fonction après la fonction showMeasure
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

  // Version throttlée pour la mise à jour des mesures
  const throttledUpdateMeasure = throttle((measureDiv: HTMLElement, position: L.LatLng, text: string) => {
    if (!measureDiv) return;
    
    // Mettre à jour le contenu
    measureDiv.innerHTML = text;
    
    // Mettre à jour la position
    if (map.value) {
      const point = map.value.latLngToContainerPoint(position);
      measureDiv.style.left = `${point.x + 10}px`;
      measureDiv.style.top = `${point.y - 25}px`;
    }
  }, 100); // Limiter à une mise à jour tous les 100ms

  // Fonction pour ajouter les événements de mesure aux points de contrôle
  const addMeasureEvents = (point: ControlPoint, _layer: L.Layer, getMeasureText: () => string) => {
    point.on('mouseover', () => {
      const measureDiv = showMeasure(point.getLatLng(), getMeasureText());
      point.measureDiv = measureDiv;
    });

    point.on('mousemove', (e: L.LeafletMouseEvent) => {
      if (point.measureDiv && map.value) {
        // Utiliser la version throttlée pour limiter les mises à jour
        throttledUpdateMeasure(point.measureDiv, e.latlng, getMeasureText());
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
        // Supprimer le point de contrôle du groupe dédié
        if (controlPointsGroup.value) {
          controlPointsGroup.value.removeLayer(point);
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
    
    if (controlPointsGroup.value) {
      controlPointsGroup.value.addLayer(point);
    }
    
    return point;
  };

  // Fonction pour calculer les propriétés d'une forme
  const calculateShapeProperties = (layer: L.Layer, type: string): any => {
    PerformanceTracker.start('useMapDrawing.calculateShapeProperties');
    console.log('=== CALCULATING SHAPE PROPERTIES START ===');
    console.log('Input layer:', {
      type,
      instanceof: {
        Circle: layer instanceof L.Circle,
        Rectangle: layer instanceof L.Rectangle,
        Polygon: layer instanceof L.Polygon,
        Polyline: layer instanceof L.Polyline,
        CircleArc: layer instanceof CircleArc,
        TextRectangle: layer instanceof TextRectangle
      },
      options: layer.options
    });

    const properties: any = {
      type,
      style: layer.options || {}
    };

    try {
      if (layer instanceof TextRectangle) {
        PerformanceTracker.end('useMapDrawing.calculateShapeProperties');
        return layer.properties;
      } else if (layer instanceof L.Circle) {
        PerformanceTracker.start('useMapDrawing.calculateShapeProperties.Circle');
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
        PerformanceTracker.end('useMapDrawing.calculateShapeProperties.Circle');
      } 
      else if (layer instanceof CircleArc) {
        PerformanceTracker.start('useMapDrawing.calculateShapeProperties.CircleArc');
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
        PerformanceTracker.end('useMapDrawing.calculateShapeProperties.CircleArc');
      }
      else if (layer instanceof L.Rectangle) {
        PerformanceTracker.start('useMapDrawing.calculateShapeProperties.Rectangle');
        const bounds = layer.getBounds();
        const ne = bounds.getNorthEast();
        const sw = bounds.getSouthWest();
        
        PerformanceTracker.start('useMapDrawing.calculateShapeProperties.Rectangle.turf');
        const width = turf.distance([sw.lng, sw.lat], [ne.lng, sw.lat], { units: 'meters' });
        const height = turf.distance([sw.lng, sw.lat], [sw.lng, ne.lat], { units: 'meters' });
        PerformanceTracker.end('useMapDrawing.calculateShapeProperties.Rectangle.turf');
        
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
        PerformanceTracker.end('useMapDrawing.calculateShapeProperties.Rectangle');
      }
      else if (layer instanceof L.Polygon) {
        PerformanceTracker.start('useMapDrawing.calculateShapeProperties.Polygon');
        const latLngs = layer.getLatLngs()[0] as L.LatLng[];
        const coordinates = latLngs.map((ll: L.LatLng) => [ll.lng, ll.lat]);
        coordinates.push(coordinates[0]); // Fermer le polygone
        
        PerformanceTracker.start('useMapDrawing.calculateShapeProperties.Polygon.turf');
        const polygon = turf.polygon([coordinates]);
        properties.area = turf.area(polygon);
        properties.perimeter = turf.length(turf.lineString([...coordinates]), { units: 'meters' });
        PerformanceTracker.end('useMapDrawing.calculateShapeProperties.Polygon.turf');
        
        properties.surfaceInterieure = properties.area;
        properties.surfaceExterieure = properties.area;
        console.log('Polygon properties calculated:', properties);
        PerformanceTracker.end('useMapDrawing.calculateShapeProperties.Polygon');
      }
      else if (layer instanceof L.Polyline && !(layer instanceof L.Polygon)) {
        PerformanceTracker.start('useMapDrawing.calculateShapeProperties.Line');
        if (layer instanceof Line) {
          // Si c'est notre classe Line personnalisée
          layer.updateProperties();
          // Utiliser les propriétés calculées par la classe
          Object.assign(properties, {
            ...layer.properties,
            type: 'Line'
          });
          console.log('Line (custom class) properties calculated:', properties);
        } else {
          // Pour les polylines standard de Leaflet
          const latLngs = layer.getLatLngs() as L.LatLng[];
          const coordinates = latLngs.map((ll: L.LatLng) => [ll.lng, ll.lat]);
          
          PerformanceTracker.start('useMapDrawing.calculateShapeProperties.Line.turf');
          const line = turf.lineString(coordinates);
          properties.length = turf.length(line, { units: 'meters' });
          PerformanceTracker.end('useMapDrawing.calculateShapeProperties.Line.turf');
          
          // Calculer la surface d'influence pour les lignes
          const width = 10; // Largeur d'influence par défaut en mètres
          properties.surfaceInfluence = properties.length * width;
          properties.dimensions = {
            width
          };
          console.log('Polyline properties calculated:', properties);
        }
        PerformanceTracker.end('useMapDrawing.calculateShapeProperties.Line');
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
    PerformanceTracker.end('useMapDrawing.calculateShapeProperties');
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

    // Initialiser les groupes de points de contrôle
    controlPointsGroup.value = L.featureGroup().addTo(mapInstance);
    tempControlPointsGroup.value = L.featureGroup().addTo(mapInstance);

    // Configuration de Leaflet-Geoman
    mapInstance.pm.setGlobalOptions({
      snappable: true,
      snapDistance: 20,
      allowSelfIntersection: false,
      preventMarkerRemoval: true,
      syncLayersOnDrag: true,
      layerGroup: fg,
      snapLayers: [fg, tempControlPointsGroup.value],
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
    } as ExtendedGlobalOptions);

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

      // Ajouter les événements de survol
      layer.on('mouseover', () => {
        console.log('[mouseover] Survol de la forme', {
          type: shapeType,
          isSelected: selectedShape.value === layer
        });
        if (!selectedShape.value || selectedShape.value !== layer) {
          generateTempControlPoints(layer);
        }
      });

      layer.on('mouseout', () => {
        console.log('[mouseout] Sortie de la forme', {
          type: shapeType,
          isSelected: selectedShape.value === layer
        });
        if (!selectedShape.value || selectedShape.value !== layer) {
          tempControlPointsGroup.value?.clearLayers();
        }
      });

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
      } else if (shapeType === 'Circle') {
        // Supprimer le cercle standard de Leaflet
        featureGroup.value?.removeLayer(layer);
        
        // Créer notre cercle personnalisé
        const circle = new Circle(layer.getLatLng(), {
          ...layer.options,
          radius: layer.getRadius()
        });
        circle.updateProperties();
        featureGroup.value?.addLayer(circle);
        selectedShape.value = circle;
        updateCircleControlPoints(circle);
      } else if (shapeType === 'Rectangle') {
        // Supprimer le rectangle standard de Leaflet
        featureGroup.value?.removeLayer(layer);
        
        // Créer notre rectangle personnalisé
        const rectangle = new Rectangle(layer.getBounds(), {
          ...layer.options,
        });
        rectangle.updateProperties();
        featureGroup.value?.addLayer(rectangle);
        selectedShape.value = rectangle;
        updateRectangleControlPoints(rectangle);
      } else if (layer instanceof L.Polygon) {
        updatePolygonControlPoints(layer);
      } else if (layer instanceof Line) {
        updateLineControlPoints(layer);
      } else if (layer instanceof L.Polyline && !(layer instanceof L.Polygon)) {
        // Pour la compatibilité avec les polylines standard de Leaflet
        // Convertir en notre Line personnalisée
        const latLngs = layer.getLatLngs() as L.LatLngExpression[];
        const line = new Line(latLngs, {
          ...layer.options
        });
        line.updateProperties();
        featureGroup.value?.removeLayer(layer);
        featureGroup.value?.addLayer(line);
        selectedShape.value = line;
        updateLineControlPoints(line);
      }

      // Afficher le message d'aide
      showHelpMessage('Cliquez sur la forme pour afficher les points de contrôle');
    });

    // Événements de sélection uniquement sur featureGroup (formes)
    fg.on('click', (e: L.LeafletMouseEvent) => {
      L.DomEvent.stopPropagation(e);
      const layer = e.layer;
      
      console.log('[featureGroup click] Sélection de forme', {
        type: layer.properties?.type,
        previouslySelected: selectedShape.value === layer
      });

      // Nettoyer les points temporaires
      tempControlPointsGroup.value?.clearLayers();
      
      // Nettoyer les points de contrôle existants
      clearActiveControlPoints();
      document.querySelector('.drawing-help-message')?.remove();
      
      // Mettre à jour la forme sélectionnée
      selectedShape.value = layer;

      // Pour TextRectangle, pas besoin d'ajouter de points de contrôle car ils sont édités directement via double-clic
      if (layer instanceof TextRectangle) {
        // Log to help debugging the TextRectangle selection
        console.log('[featureGroup click] TextRectangle selected', {
          id: (layer as any)._leaflet_id, // Use 'any' to access Leaflet's internal ID
          bounds: layer.getBounds(),
          hasTextContainer: !!layer.getTextElement(),
          properties: layer.properties
        });
        
        // Afficher un message d'aide spécifique pour le TextRectangle
        showHelpMessage('Double-cliquez sur le texte pour le modifier. Cliquez et glissez pour déplacer.');
        
        // Make sure any pending editing operations are cancelled
        if (map.value && map.value.pm) {
          try {
            // Cancel any active editing modes
            if (map.value.pm.globalEditModeEnabled()) {
              map.value.pm.disableGlobalEditMode();
            }
            
            // Check for any remnant standard rectangles that might be duplicates
            if (featureGroup.value) {
              const allLayers = featureGroup.value.getLayers();
              console.log('[TextRectangle] Checking for duplicates. Total layers:', allLayers.length);
              
              const textRectBounds = layer.getBounds();
              console.log('[TextRectangle] Selected TextRectangle bounds:', textRectBounds.toBBoxString());
              
              // Look for Rectangle layers with the same bounds
              const duplicateRectangles = allLayers.filter((otherLayer: L.Layer) => {
                if (otherLayer !== layer && 
                    otherLayer instanceof L.Rectangle && 
                    !(otherLayer instanceof TextRectangle)) {
                  // Compare bounds to see if it's a duplicate
                  const otherBounds = (otherLayer as L.Rectangle).getBounds();
                  const isSameBounds = 
                    Math.abs(otherBounds.getNorth() - textRectBounds.getNorth()) < 1e-6 &&
                    Math.abs(otherBounds.getSouth() - textRectBounds.getSouth()) < 1e-6 &&
                    Math.abs(otherBounds.getEast() - textRectBounds.getEast()) < 1e-6 &&
                    Math.abs(otherBounds.getWest() - textRectBounds.getWest()) < 1e-6;
                  
                  console.log('[TextRectangle] Comparing with Rectangle:', {
                    id: (otherLayer as any)._leaflet_id,
                    bounds: otherBounds.toBBoxString(),
                    isSameBounds: isSameBounds
                  });
                  
                  return isSameBounds;
                }
                return false;
              });
              
              // Remove any found duplicates
              if (duplicateRectangles.length > 0) {
                console.warn(`[TextRectangle] Found ${duplicateRectangles.length} duplicate rectangle(s) with TextRectangle, removing...`);
                duplicateRectangles.forEach((duplicate: L.Layer) => {
                  console.log('[TextRectangle] Removing duplicate:', (duplicate as any)._leaflet_id);
                  featureGroup.value?.removeLayer(duplicate);
                  if (map.value) {
                    map.value.removeLayer(duplicate);
                  }
                });
                console.log('[TextRectangle] After removing duplicates, total layers:', featureGroup.value.getLayers().length);
              } else {
                console.log('[TextRectangle] No duplicates found');
              }
            }
          } catch (e) {
            console.error('Error disabling edit mode:', e);
          }
        }
        
        return;
      }

      if (layer instanceof CircleArc || layer.properties?.type === 'Semicircle') {
        updateSemicircleControlPoints(layer as CircleArc);
      } else if (layer instanceof Circle) {
        updateCircleControlPoints(layer);
      } else if (layer instanceof L.Circle) {
        // Pour la compatibilité avec les cercles standard de Leaflet
        // Convertir en notre cercle personnalisé
        const circle = new Circle(layer.getLatLng(), {
          ...layer.options,
          radius: layer.getRadius()
        });
        circle.updateProperties();
        featureGroup.value?.removeLayer(layer);
        featureGroup.value?.addLayer(circle);
        selectedShape.value = circle;
        updateCircleControlPoints(circle);
      } else if (layer instanceof Rectangle) {
        updateRectangleControlPoints(layer);
      } else if (layer instanceof L.Rectangle) {
        // Pour la compatibilité avec les rectangles standard de Leaflet
        // Convertir en notre rectangle personnalisé
        const rectangle = new Rectangle(layer.getBounds(), {
          ...layer.options
        });
        rectangle.updateProperties();
        featureGroup.value?.removeLayer(layer);
        featureGroup.value?.addLayer(rectangle);
        selectedShape.value = rectangle;
        updateRectangleControlPoints(rectangle);
      } else if (layer instanceof L.Polygon) {
        updatePolygonControlPoints(layer);
      } else if (layer instanceof Line) {
        // Si c'est notre Line personnalisée, traiter spécifiquement
        updateLineControlPoints(layer);
      } else if (layer instanceof L.Polyline && !(layer instanceof L.Polygon)) {
        updateLineControlPoints(layer);
      }
    });

    // Événements d'édition
    mapInstance.on('pm:edit', (e: any) => {
      console.log('[pm:edit] Début', {
        layer: e.layer,
        currentProperties: e.layer.properties
      });

      const layer = e.layer;
      if (layer) {
        const shapeType = layer.properties?.type || 'unknown';
        updateLayerProperties(layer, shapeType);

        console.log('[pm:edit] Après updateLayerProperties', {
          updatedProperties: layer.properties,
          selectedShape: selectedShape.value
        });

        // Mise à jour des points de contrôle
        if (shapeType === 'Semicircle') {
          updateSemicircleControlPoints(layer as CircleArc);
        } else if (layer instanceof Circle) {
          updateCircleControlPoints(layer);
        } else if (layer instanceof Rectangle) {
          updateRectangleControlPoints(layer);
        } else if (layer instanceof L.Rectangle) {
          // Si c'est un rectangle standard Leaflet, le convertir en notre Rectangle personnalisé
          const rectangle = new Rectangle(layer.getBounds(), {
            ...layer.options
          });
          rectangle.updateProperties();
          featureGroup.value?.removeLayer(layer);
          featureGroup.value?.addLayer(rectangle);
          selectedShape.value = rectangle;
          updateRectangleControlPoints(rectangle);
        } else if (layer instanceof L.Polygon) {
          updatePolygonControlPoints(layer);
        } else if (layer instanceof Line) {
          // Si c'est notre Line personnalisée, s'assurer de mettre à jour ses propriétés
          layer.updateProperties();
          updateLayerProperties(layer, 'Line');
          // Mettre à jour les points de contrôle
          updateLineControlPoints(layer);
        } else if (layer instanceof L.Polyline) {
          updateLineControlPoints(layer);
        }
      }
    });

    // Événements de glisser-déposer
    mapInstance.on('pm:dragstart', () => {
      // Supprimer les messages précédents avant d'afficher le nouveau
      document.querySelectorAll('.drawing-help-message').forEach(msg => msg.remove());
      showHelpMessage('Déplacez la forme à l\'endroit souhaité');
    });

    mapInstance.on('pm:dragend', (e: any) => {
      console.log('[pm:dragend] Début', {
        layer: e.layer,
        currentProperties: e.layer.properties
      });

      const layer = e.layer;
      if (layer) {
        const shapeType = layer.properties?.type || 'unknown';
        
        // Si c'est un Rectangle standard Leaflet, le convertir en notre Rectangle personnalisé
        if (layer instanceof L.Rectangle && !(layer instanceof Rectangle)) {
          const rectangle = new Rectangle(layer.getBounds(), {
            ...layer.options
          });
          rectangle.updateProperties();
          featureGroup.value?.removeLayer(layer);
          featureGroup.value?.addLayer(rectangle);
          selectedShape.value = rectangle;
          updateRectangleControlPoints(rectangle);
        } else if (layer instanceof Line) {
          // Si c'est notre Line personnalisée, s'assurer de mettre à jour ses propriétés
          layer.updateProperties();
          updateLayerProperties(layer, 'Line');
          // Mettre à jour les points de contrôle
          updateLineControlPoints(layer);
        } else {
          updateLayerProperties(layer, shapeType);
        }

        console.log('[pm:dragend] Après updateLayerProperties', {
          updatedProperties: layer.properties,
          selectedShape: selectedShape.value
        });
      }
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
          case 'TextRectangle':
            showHelpMessage('Cliquez et maintenez pour dessiner un rectangle avec texte, relâchez pour terminer');
            console.log('[TextRectangle] Starting TextRectangle tool');
            map.value?.pm.enableDraw('Rectangle', {
              finishOn: 'mouseup' as any,
              continueDrawing: false
            });

            // Intercepter l'événement de création du rectangle
            map.value.once('pm:create', (e: any) => {
              const layer = e.layer;
              
              // Check all layers in feature group before starting
              console.log('[TextRectangle] BEFORE PROCESSING - All layers in feature group:', 
                featureGroup.value 
                  ? featureGroup.value.getLayers().map((l: any) => ({
                      id: l._leaflet_id,
                      type: l.constructor.name,
                      isOnMap: map.value?.hasLayer(l)
                    }))
                  : 'No feature group'
              );
              
              console.log('[TextRectangle] Rectangle created:', {
                id: layer._leaflet_id || 'unknown',
                instanceType: layer.constructor.name,
                isRectangle: layer instanceof L.Rectangle,
                bounds: layer.getBounds ? layer.getBounds().toBBoxString() : 'no bounds'
              });
              
              // Check if there's already a rectangle with these bounds
              if (featureGroup.value && layer.getBounds) {
                const newBounds = layer.getBounds();
                const existingRectangles = featureGroup.value.getLayers().filter((l: any) => {
                  if (l !== layer && l instanceof L.Rectangle && l.getBounds) {
                    const lBounds = l.getBounds();
                    const isSameBounds = 
                      Math.abs(lBounds.getNorth() - newBounds.getNorth()) < 1e-6 &&
                      Math.abs(lBounds.getSouth() - newBounds.getSouth()) < 1e-6 &&
                      Math.abs(lBounds.getEast() - newBounds.getEast()) < 1e-6 &&
                      Math.abs(lBounds.getWest() - newBounds.getWest()) < 1e-6;
                    
                    if (isSameBounds) {
                      console.warn('[TextRectangle] Found existing rectangle with same bounds:', {
                        existingId: (l as any)._leaflet_id || 'unknown',
                        newId: (layer as any)._leaflet_id || 'unknown',
                        bounds: lBounds.toBBoxString()
                      });
                    }
                    
                    return isSameBounds;
                  }
                  return false;
                });
                
                if (existingRectangles.length > 0) {
                  console.warn(`[TextRectangle] ALERT: ${existingRectangles.length} rectangles already exist with the same bounds!`);
                }
              }
              
              // Make sure we first remove the original layer properly
              if (featureGroup.value && layer) {
                // Get bounds before removing to ensure we have data for the TextRectangle
                const bounds = layer.getBounds();
                const options = {
                  color: '#3388ff',
                  weight: 2,
                  fillColor: '#3388ff',
                  fillOpacity: 0.2,
                  // Copy any other options from the original layer
                  ...layer.options
                };
                
                // Properly remove the rectangle from all groups to prevent duplicates
                console.log('[TextRectangle] Attempting to remove original Rectangle:', {
                  inFeatureGroup: featureGroup.value?.hasLayer(layer),
                  layerCount: featureGroup.value?.getLayers().length || 0
                });
                
                // Try a complete cleanup with better error handling and type assertions
                try {
                  // First try with removeFrom method to ensure proper cleanup
                  if (typeof layer.removeFrom === 'function') {
                    try {
                      layer.removeFrom(featureGroup.value);
                      console.log('[TextRectangle] Used removeFrom method for feature group');
                    } catch (error) {
                      console.error('[TextRectangle] Error using removeFrom method:', error);
                      // Fallback to removeLayer
                      if (featureGroup.value?.hasLayer(layer)) {
                        featureGroup.value.removeLayer(layer);
                        console.log('[TextRectangle] Removed from feature group using removeLayer after removeFrom failed');
                      }
                    }
                  } else {
                    // First, remove from feature group
                    if (featureGroup.value?.hasLayer(layer)) {
                      featureGroup.value.removeLayer(layer);
                      console.log('[TextRectangle] Removed from feature group using removeLayer');
                    }
                  }
                  
                  // Double-check removal
                  if (featureGroup.value?.hasLayer(layer)) {
                    console.warn('[TextRectangle] WARNING: Layer still in feature group after removal! Trying alternative methods...');
                    
                    // Try forcibly removing all rectangles with similar bounds
                    try {
                      const layersArray = featureGroup.value.getLayers();
                      let removedCount = 0;
                      
                      for (let i = layersArray.length - 1; i >= 0; i--) {
                        const currentLayer = layersArray[i];
                        if (currentLayer !== layer && 
                            currentLayer instanceof L.Rectangle && 
                            !(currentLayer instanceof TextRectangle) &&
                            currentLayer.getBounds) {
                          
                          const currentBounds = currentLayer.getBounds();
                          const originalBounds = layer.getBounds();
                          const isSameBounds = 
                            Math.abs(currentBounds.getNorth() - originalBounds.getNorth()) < 1e-6 &&
                            Math.abs(currentBounds.getSouth() - originalBounds.getSouth()) < 1e-6 &&
                            Math.abs(currentBounds.getEast() - originalBounds.getEast()) < 1e-6 &&
                            Math.abs(currentBounds.getWest() - originalBounds.getWest()) < 1e-6;
                          
                          if (isSameBounds) {
                            console.log('[TextRectangle] Removing duplicate rectangle:', (currentLayer as any)._leaflet_id || 'unknown');
                            featureGroup.value.removeLayer(currentLayer);
                            removedCount++;
                          }
                        }
                      }
                      
                      if (removedCount > 0) {
                        console.log(`[TextRectangle] Forcibly removed ${removedCount} duplicate rectangles`);
                      }
                    } catch (e) {
                      console.error('[TextRectangle] Error removing layer references:', e);
                    }
                  }
                  
                  // Then ensure removal from map
                  if (map.value && map.value.hasLayer(layer)) {
                    map.value.removeLayer(layer);
                    console.log('[TextRectangle] Removed from map');
                  }
                  
                  // Verify removal
                  console.log('[TextRectangle] After removal:', {
                    inFeatureGroup: featureGroup.value && featureGroup.value.hasLayer(layer),
                    onMap: map.value && map.value.hasLayer(layer),
                    layerCount: featureGroup.value?.getLayers().length || 0
                  });
                  
                  // Forcibly break any references
                  if ((layer as any)._map) (layer as any)._map = null;
                  if ((layer as any)._mapToAdd) (layer as any)._mapToAdd = null;
                  
                  // Wait a tick to ensure complete removal before creating TextRectangle
                  setTimeout(() => {
                    try {
                      // Final check - if there's already a TextRectangle with these bounds, don't create another one
                      if (featureGroup.value) {
                        const existingTextRectangles = featureGroup.value.getLayers().filter((l: any) => {
                          return l instanceof TextRectangle && l.getBounds && (() => {
                            const lBounds = l.getBounds();
                            const isSameBounds = 
                              Math.abs(lBounds.getNorth() - bounds.getNorth()) < 1e-6 &&
                              Math.abs(lBounds.getSouth() - bounds.getSouth()) < 1e-6 &&
                              Math.abs(lBounds.getEast() - bounds.getEast()) < 1e-6 &&
                              Math.abs(lBounds.getWest() - bounds.getWest()) < 1e-6;
                            return isSameBounds;
                          })();
                        });

                        if (existingTextRectangles.length > 0) {
                          console.log('[TextRectangle] A TextRectangle with these bounds already exists, not creating a new one');
                          selectedShape.value = existingTextRectangles[0];
                          return;
                        }
                      }
                      
                      // Check all layers in feature group before creating TextRectangle
                      console.log('[TextRectangle] BEFORE CREATING TEXTRECTANGLE - All layers in feature group:', 
                        featureGroup.value 
                          ? featureGroup.value.getLayers().map((l: any) => ({
                              id: (l as any)._leaflet_id || 'unknown',
                              type: l.constructor.name,
                              isOnMap: map.value?.hasLayer(l)
                            }))
                          : 'No feature group'
                      );
                      
                      console.log('[TextRectangle] Creating new TextRectangle with bounds:', bounds.toBBoxString());
                      
                      // Create the TextRectangle with the saved bounds and options
                      const textRect = new TextRectangle(
                        bounds,
                        'Double-cliquez pour éditer',
                        options
                      );
                      console.log('[TextRectangle] TextRectangle created:', {
                        id: (textRect as any)._leaflet_id || 'unknown',
                        instanceType: textRect.constructor.name,
                        hasTextElement: !!textRect.getTextElement()
                      });
                      
                      // Add TextRectangle to feature group and select it
                      if (featureGroup.value) {
                        featureGroup.value.addLayer(textRect);
                        console.log('[TextRectangle] Added to feature group, new count:', featureGroup.value.getLayers().length);
                        
                        // Check all layers in feature group after adding TextRectangle
                        console.log('[TextRectangle] AFTER ADDING TEXTRECTANGLE - All layers in feature group:', 
                          featureGroup.value.getLayers().map((l: any) => ({
                            id: (l as any)._leaflet_id || 'unknown',
                            type: l.constructor.name,
                            isOnMap: map.value?.hasLayer(l)
                          }))
                        );
                        
                        // Set selected shape
              selectedShape.value = textRect;
                      }
                      
                      // Custom event handlers for the TextRectangle
                      textRect.on('mouseover', () => {
                        // Skip generating temporary control points for TextRectangle
                        // Double-click will directly activate editing
                      });
                      
                      textRect.on('click', (e: L.LeafletMouseEvent) => {
                        L.DomEvent.stopPropagation(e);
                        selectedShape.value = textRect;
                      });
                      
                      // Auto-edit on creation for better UX
                      setTimeout(() => {
                        try {
                          textRect.fire('dblclick', { 
                            latlng: textRect.getCenter(),
                            originalEvent: new MouseEvent('dblclick')
                          } as L.LeafletMouseEvent);
                        } catch (err) {
                          console.error('[TextRectangle] Error starting auto-edit:', err);
                        }
                      }, 100);
                    } catch (error) {
                      console.error('Error creating TextRectangle:', error);
                    }
                  }, 50); // Increased from 0 to give more time for cleanup
                } catch (error) {
                  console.error('Error removing original rectangle:', error);
                }
              }
            });
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
    } else if (layer.properties.type === 'TextRectangle') {
      // Pour les TextRectangle, utiliser la méthode spécifique setTextStyle
      if (layer instanceof TextRectangle) {
        // Styles de texte
        const textStyles: any = {};
        if (style.textColor !== undefined) textStyles.textColor = style.textColor;
        if (style.fontSize !== undefined) textStyles.fontSize = style.fontSize;
        if (style.fontFamily !== undefined) textStyles.fontFamily = style.fontFamily;
        if (style.backgroundColor !== undefined) textStyles.backgroundColor = style.backgroundColor;
        if (style.backgroundOpacity !== undefined) textStyles.backgroundOpacity = style.backgroundOpacity;
        if (style.textAlign !== undefined) textStyles.textAlign = style.textAlign;
        if (style.bold !== undefined) textStyles.bold = style.bold;
        if (style.italic !== undefined) textStyles.italic = style.italic;
        
        // Styles visuels de la forme
        if (style.fillColor) textStyles.fillColor = style.fillColor;
        if (style.fillOpacity !== undefined) textStyles.fillOpacity = style.fillOpacity;
        if (style.strokeColor) textStyles.color = style.strokeColor;
        if (style.color) textStyles.color = style.color;
        if (style.strokeOpacity !== undefined) textStyles.opacity = style.strokeOpacity;
        if (style.strokeWidth !== undefined) textStyles.weight = style.strokeWidth;
        if (style.weight !== undefined) textStyles.weight = style.weight;
        if (style.dashArray) textStyles.dashArray = style.dashArray;
        
        // Appliquer les styles
        layer.setTextStyle(textStyles);
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

  const forceShapeUpdate = (layer: L.Layer) => {
    PerformanceTracker.start('useMapDrawing.forceShapeUpdate');
    console.log('[forceShapeUpdate] Début', {
      currentProperties: layer.properties,
      selectedShapeRef: selectedShape.value
    });

    // Réassigner directement selectedShape avec une nouvelle référence
    selectedShape.value = null; // Forcer un reset
    PerformanceTracker.start('useMapDrawing.forceShapeUpdate.nextTick');
    nextTick(() => {
      PerformanceTracker.start('useMapDrawing.forceShapeUpdate.setSelectedShape');
      selectedShape.value = layer;
      console.log('[forceShapeUpdate] Après mise à jour', {
        selectedShape: selectedShape.value,
        properties: selectedShape.value.properties
      });
      PerformanceTracker.end('useMapDrawing.forceShapeUpdate.setSelectedShape');
    });
    PerformanceTracker.end('useMapDrawing.forceShapeUpdate.nextTick');
    
    PerformanceTracker.end('useMapDrawing.forceShapeUpdate');
  };

  const updateLayerProperties = (layer: L.Layer, shapeType: string) => {
    PerformanceTracker.start('useMapDrawing.updateLayerProperties');
    console.log('[updateLayerProperties] Début', {
      layer,
      shapeType,
      currentProperties: layer.properties
    });

    // Utiliser debouncedCalculateProperties au lieu de calculateShapeProperties directement
    const debouncedCalculateProperties = debounce((layer: L.Layer, shapeType: string) => {
      PerformanceTracker.start('useMapDrawing.updateLayerProperties.calculate');
      const newProperties = calculateShapeProperties(layer, shapeType);
      console.log('[updateLayerProperties] Nouvelles propriétés calculées', {
        newProperties
      });

      // Créer une nouvelle référence pour les propriétés
      layer.properties = { ...newProperties };
      
      // Forcer la mise à jour de la forme sélectionnée
      PerformanceTracker.start('useMapDrawing.updateLayerProperties.forceUpdate');
      forceShapeUpdate(layer);
      PerformanceTracker.end('useMapDrawing.updateLayerProperties.forceUpdate');
      
      // Émettre l'événement avec les nouvelles propriétés
      layer.fire('properties:updated', {
        shape: layer,
        properties: layer.properties
      });

      console.log('[updateLayerProperties] Fin', {
        finalProperties: layer.properties,
        selectedShape: selectedShape.value
      });
      PerformanceTracker.end('useMapDrawing.updateLayerProperties.calculate');
    }, 100); // Délai de 100ms

    debouncedCalculateProperties(layer, shapeType);
    PerformanceTracker.end('useMapDrawing.updateLayerProperties');
  };

  // Fonction pour calculer le point milieu entre deux points
  const getMidPoint = (p1: L.LatLng, p2: L.LatLng): L.LatLng => {
    return L.latLng(
      (p1.lat + p2.lat) / 2,
      (p1.lng + p2.lng) / 2
    );
  };

  // Fonction pour mettre à jour les points de contrôle d'un cercle
  const updateCircleControlPoints = (layer: Circle) => {
    if (!map.value || !featureGroup.value) return;

    clearActiveControlPoints();
    const center = layer.getLatLng();
    const radius = layer.getRadius();

    // Point central (vert)
    const centerPoint = createControlPoint(center, '#059669') as ControlPoint;
    activeControlPoints.push(centerPoint);

    // Ajouter les mesures au point central
    addMeasureEvents(centerPoint, layer, () => {
      return [
        formatMeasure(radius, 'm', 'Rayon'),
        formatMeasure(radius * 2, 'm', 'Diamètre'),
        formatMeasure(Math.PI * Math.pow(radius, 2), 'm²', 'Surface')
      ].join('<br>');
    });

    // Points cardinaux (bleu)
    const cardinalPoints: ControlPoint[] = [];
    const cardinalAngles = [0, 45, 90, 135, 180, 225, 270, 315];
    
    cardinalAngles.forEach((angle) => {
      const point = layer.calculatePointOnCircle(angle);
      const controlPoint = createControlPoint(point, '#2563EB') as ControlPoint;
      cardinalPoints.push(controlPoint);
      activeControlPoints.push(controlPoint);

      // Ajouter les mesures aux points cardinaux
      addMeasureEvents(controlPoint, layer, () => {
        return formatMeasure(radius, 'm', 'Rayon');
      });

      // Gestion du redimensionnement via les points cardinaux
      controlPoint.on('mousedown', (e: L.LeafletMouseEvent) => {
        if (!map.value) return;
        L.DomEvent.stopPropagation(e);
        map.value.dragging.disable();

        let isDragging = true;

        const onMouseMove = (e: L.LeafletMouseEvent) => {
          if (!isDragging) return;

          // Utiliser la méthode pour redimensionner le cercle sans mise à jour des propriétés
          layer.resizeFromControlPoint(e.latlng);

          // Mettre à jour les positions de tous les points de contrôle
          cardinalPoints.forEach((point, i) => {
            const newPoint = layer.calculatePointOnCircle(cardinalAngles[i]);
            point.setLatLng(newPoint);
          });

          // Mettre à jour le point central
          centerPoint.setLatLng(layer.getLatLng());
          
          // Mettre à jour la mesure affichée si elle existe
          if (controlPoint.measureDiv) {
            controlPoint.measureDiv.innerHTML = formatMeasure(layer.getRadius(), 'm', 'Rayon');
          }
        };

        const onMouseUp = () => {
          isDragging = false;
          if (!map.value) return;
          map.value.off('mousemove', onMouseMove);
          document.removeEventListener('mouseup', onMouseUp);
          map.value.dragging.enable();
          
          // Mettre à jour les propriétés UNIQUEMENT à la fin du redimensionnement
          layer.updateProperties();
          
          // Mise à jour de selectedShape pour déclencher la réactivité
          selectedShape.value = null; // Forcer un reset
          nextTick(() => {
            selectedShape.value = layer;
            console.log('Circle resize complete, final properties:', layer.properties);
          });
          
          // Mettre à jour les propriétés via la méthode globale aussi
          updateLayerProperties(layer, 'Circle');
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
      const startLatLng = layer.getLatLng();
      const startMouseLatLng = e.latlng;
      
      const onMouseMove = (e: L.LeafletMouseEvent) => {
        if (!isDragging) return;
        
        // Calculer le déplacement
        const dx = e.latlng.lng - startMouseLatLng.lng;
        const dy = e.latlng.lat - startMouseLatLng.lat;
        
        // Déplacer le cercle sans mise à jour des propriétés
        const newLatLng = L.latLng(
          startLatLng.lat + dy,
          startLatLng.lng + dx
        );
        
        // Utiliser directement setLatLng du prototype de L.Circle pour éviter notre surcharge
        L.Circle.prototype.setLatLng.call(layer, newLatLng);
        centerPoint.setLatLng(newLatLng);
        
        // Mettre à jour les positions des points cardinaux
        cardinalPoints.forEach((point, i) => {
          const newPoint = layer.calculatePointOnCircle(cardinalAngles[i]);
          point.setLatLng(newPoint);
        });
        
        // Mettre à jour la mesure affichée si elle existe
        if (centerPoint.measureDiv) {
          centerPoint.measureDiv.innerHTML = [
            formatMeasure(layer.getRadius(), 'm', 'Rayon'),
            formatMeasure(layer.getRadius() * 2, 'm', 'Diamètre'),
            formatMeasure(Math.PI * Math.pow(layer.getRadius(), 2), 'm²', 'Surface')
          ].join('<br>');
        }
      };
      
      const onMouseUp = () => {
        isDragging = false;
        if (!map.value) return;
        map.value.off('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
        map.value.dragging.enable();
        
        // Mettre à jour les propriétés UNIQUEMENT à la fin du déplacement
        layer.updateProperties();
        
        // Mise à jour de selectedShape pour déclencher la réactivité
        selectedShape.value = null; // Forcer un reset
        nextTick(() => {
          selectedShape.value = layer;
        });
        
        // Mettre à jour les propriétés via la méthode globale
        updateLayerProperties(layer, 'Circle');
      };
      
      map.value.on('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);
    });

    // Écouter l'événement circle:resized pour mettre à jour les propriétés
    layer.on('circle:resized', (e) => {
      console.log('Circle resized event received:', e);
      updateLayerProperties(layer, 'Circle');
    });

    // Synchroniser selectedShape au démarrage de la fonction
    selectedShape.value = layer;
  };

  // Fonction pour mettre à jour les points de contrôle d'un rectangle
  const updateRectangleControlPoints = (layer: any) => {
    if (!map.value || !featureGroup.value) return;

    // Vérifier que la couche est bien une instance de notre classe Rectangle
    if (!(layer instanceof Rectangle)) {
      console.warn('La couche n\'est pas une instance de Rectangle');
      return;
    }

    // Cast de la couche vers notre type Rectangle pour accéder aux méthodes spécifiques
    const rectangleLayer = layer as Rectangle;

    clearActiveControlPoints();
    const bounds = rectangleLayer.getBounds();
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
    addMeasureEvents(centerPoint, rectangleLayer, () => {
      const { width, height } = rectangleLayer.getDimensions();
      const area = width * height;
      return [
        formatMeasure(width, 'm', 'Largeur'),
        formatMeasure(height, 'm', 'Hauteur'),
        formatMeasure(area, 'm²', 'Surface')
      ].join('<br>');
    });

    // Points de coin (rouge)
    const cornerPoints: L.CircleMarker[] = [];
    corners.forEach((corner, index) => {
      const cornerPoint = createControlPoint(corner, '#DC2626');
      cornerPoints.push(cornerPoint);
      activeControlPoints.push(cornerPoint);
      
      // Ajouter les mesures aux coins
      addMeasureEvents(cornerPoint, rectangleLayer, () => {
        const { width, height } = rectangleLayer.getDimensions();
        return [
          formatMeasure(width, 'm', 'Largeur'),
          formatMeasure(height, 'm', 'Hauteur')
        ].join('<br>');
      });

      // Gestion du redimensionnement via les points de coin
      cornerPoint.on('mousedown', (e: L.LeafletMouseEvent) => {
        if (!map.value) return;
        L.DomEvent.stopPropagation(e);
        map.value.dragging.disable();


        const onMouseMove = (e: L.LeafletMouseEvent) => {
          // Appliquer le redimensionnement
          rectangleLayer.resizeFromCorner(index, e.latlng);
          
          // Mettre à jour tous les points de contrôle
          const newBounds = rectangleLayer.getBounds();
          const newCorners = [
            newBounds.getNorthWest(),
            newBounds.getNorthEast(),
            newBounds.getSouthEast(),
            newBounds.getSouthWest()
          ];

          // Mettre à jour le point déplacé
          cornerPoint.setLatLng(e.latlng);

          // Mettre à jour le point central
          centerPoint.setLatLng(newBounds.getCenter());

          // Mettre à jour les autres points de coin
          cornerPoints.forEach((point, i) => {
            if (i !== index) {
              point.setLatLng(newCorners[i]);
            }
          });

          // Mettre à jour tous les points milieux
          const newMidPoints = rectangleLayer.getMidPoints();
          midPoints.forEach((point, i) => {
            point.setLatLng(newMidPoints[i]);
            
            // Mettre à jour les mesures
            const { width, height } = rectangleLayer.getDimensions();
            const sideLength = i % 2 === 0 ? width : height;
            if (point.measureDiv) {
              point.measureDiv.innerHTML = [
                formatMeasure(sideLength, 'm', 'Longueur du côté'),
                formatMeasure(sideLength/2, 'm', 'Distance au coin')
              ].join('<br>');
            }
          });
        };

        const onMouseUp = () => {
          if (!map.value) return;
          map.value.off('mousemove', onMouseMove);
          document.removeEventListener('mouseup', onMouseUp);
          map.value.dragging.enable();
          
          rectangleLayer.updateProperties();
          
          selectedShape.value = null;
          nextTick(() => {
            selectedShape.value = rectangleLayer;
          });
        };

        map.value.on('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
      });
    });

    // Points milieux (bleu)
    const midPoints: ControlPoint[] = [];
    
    const midPointPositions = rectangleLayer.getMidPoints();
    
    midPointPositions.forEach((midPoint, index) => {
      const midPointMarker = createControlPoint(midPoint, '#2563EB') as ControlPoint;
      midPoints.push(midPointMarker);
      activeControlPoints.push(midPointMarker);

      // Ajouter les mesures aux points milieux avec la longueur du côté
      addMeasureEvents(midPointMarker, rectangleLayer, () => {
        const { width, height } = rectangleLayer.getDimensions();
        // Déterminer quelle dimension afficher en fonction de l'index
        const sideLength = index % 2 === 0 ? width : height;
        
        return [
          formatMeasure(sideLength, 'm', 'Longueur du côté'),
          formatMeasure(sideLength/2, 'm', 'Distance au coin')
        ].join('<br>');
      });

      // Gestion du redimensionnement via les points milieux
      midPointMarker.on('mousedown', (e: L.LeafletMouseEvent) => {
        L.DomEvent.stopPropagation(e);
        map.value.dragging.disable();

        const onMouseMove = (e: L.LeafletMouseEvent) => {
          const mouseLatLng = map.value.mouseEventToLatLng(e.originalEvent);
          
          // Contraindre le déplacement selon l'axe approprié
          const bounds = rectangleLayer.getBounds();
          const nw = bounds.getNorthWest();
          const se = bounds.getSouthEast();
          let constrainedLatLng;
          
          if (index % 2 === 0) { // Points haut/bas - contraindre la longitude
            const midLng = (nw.lng + se.lng) / 2;
            constrainedLatLng = L.latLng(mouseLatLng.lat, midLng);
          } else { // Points gauche/droite - contraindre la latitude
            const midLat = (nw.lat + se.lat) / 2;
            constrainedLatLng = L.latLng(midLat, mouseLatLng.lng);
          }
          
          // Appliquer le redimensionnement
          rectangleLayer.resizeFromSide(index, constrainedLatLng);
          
          // Mettre à jour tous les points de contrôle
          const newBounds = rectangleLayer.getBounds();
          const newCorners = [
            newBounds.getNorthWest(),
            newBounds.getNorthEast(),
            newBounds.getSouthEast(),
            newBounds.getSouthWest()
          ];

          // Mettre à jour le point central
          centerPoint.setLatLng(newBounds.getCenter());

          // Mettre à jour tous les points de coin
          cornerPoints.forEach((point, i) => {
            point.setLatLng(newCorners[i]);
          });

          // Mettre à jour tous les points milieux
          const newMidPoints = rectangleLayer.getMidPoints();
          midPoints.forEach((point, i) => {
            point.setLatLng(newMidPoints[i]);
            
            // Mettre à jour les mesures
            const { width, height } = rectangleLayer.getDimensions();
            const sideLength = i % 2 === 0 ? width : height;
            if (point.measureDiv) {
              point.measureDiv.innerHTML = [
                formatMeasure(sideLength, 'm', 'Longueur du côté'),
                formatMeasure(sideLength/2, 'm', 'Distance au coin')
              ].join('<br>');
            }
          });
        };

        const onMouseUp = () => {
          map.value.dragging.enable();
          map.value.off('mousemove', onMouseMove);
          document.removeEventListener('mouseup', onMouseUp);
          
          rectangleLayer.updateProperties();
          
          selectedShape.value = null;
          nextTick(() => {
            selectedShape.value = rectangleLayer;
          });
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
        
        // Utiliser la méthode de Rectangle pour déplacer sans mise à jour des propriétés
        rectangleLayer.moveFromCenter(e.latlng);
        
        // Mettre à jour la position du point central
        centerPoint.setLatLng(e.latlng);
        
        // Recalculer les limites pour mettre à jour les autres points
        const newBounds = rectangleLayer.getBounds();
        const newCorners = [
          newBounds.getNorthWest(),
          newBounds.getNorthEast(),
          newBounds.getSouthEast(),
          newBounds.getSouthWest()
        ];

        // Mettre à jour les points de coin
        cornerPoints.forEach((point, i) => {
          point.setLatLng(newCorners[i]);
        });

        // Mettre à jour les points milieux
        const newMidPoints = rectangleLayer.getMidPoints();
        midPoints.forEach((point, i) => {
          point.setLatLng(newMidPoints[i]);
        });
        
        // Mettre à jour la mesure affichée si elle existe
        if ((centerPoint as any).measureDiv) {
          const { width, height } = rectangleLayer.getDimensions();
          const area = width * height;
          (centerPoint as any).measureDiv.innerHTML = [
            formatMeasure(width, 'm', 'Largeur'),
            formatMeasure(height, 'm', 'Hauteur'),
            formatMeasure(area, 'm²', 'Surface')
          ].join('<br>');
        }
      };
      
      const onMouseUp = () => {
        isDragging = false;
        if (!map.value) return;
        map.value.off('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
        map.value.dragging.enable();
        
        // Mise à jour des propriétés UNIQUEMENT à la fin du déplacement
        rectangleLayer.updateProperties();
        
        // Mise à jour de selectedShape pour déclencher la réactivité
        selectedShape.value = null; // Forcer un reset
        nextTick(() => {
          selectedShape.value = rectangleLayer;
          console.log('Rectangle move complete, final properties:', rectangleLayer.properties);
        });
      };
      
      map.value.on('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);
    });
  };

  // Fonction pour mettre à jour les points de contrôle d'une ligne
  const updateLineControlPoints = (layer: L.Polyline) => {
    PerformanceTracker.start('useMapDrawing.updateLineControlPoints');
    if (!map.value || !featureGroup.value) {
      PerformanceTracker.end('useMapDrawing.updateLineControlPoints');
      return;
    }

    clearActiveControlPoints();
    const points = layer.getLatLngs() as L.LatLng[];
    
    // Point central (vert) - Ajouter pour les lignes personnalisées
    let centerPoint: ControlPoint | null = null;
    if (layer instanceof Line) {
      PerformanceTracker.start('useMapDrawing.updateLineControlPoints.centerPoint');
      const center = layer.getCenter();
      centerPoint = createControlPoint(center, '#059669') as ControlPoint;
      activeControlPoints.push(centerPoint);
      
      // Ajouter les mesures au point central
      addMeasureEvents(centerPoint, layer, () => {
        const totalLength = (layer as Line).getLength() || 0;
        return formatMeasure(totalLength, 'm', 'Longueur totale');
      });
      
      // Gestion du déplacement via le point central
      centerPoint.on('mousedown', (e: L.LeafletMouseEvent) => {
        PerformanceTracker.start('useMapDrawing.centerPoint.mousedown');
        if (!map.value) {
          PerformanceTracker.end('useMapDrawing.centerPoint.mousedown');
          return;
        }
        L.DomEvent.stopPropagation(e);
        map.value.dragging.disable();
        
        let isDragging = true;
        const startPoint = e.latlng;
        // Sauvegarder les points originaux
        const originalLatLngs = [...(layer.getLatLngs() as L.LatLng[])];
        
        // Cacher tous les points de contrôle sauf le point central (index 0) pendant le déplacement
        PerformanceTracker.start('useMapDrawing.centerPoint.hideOtherPoints');
        activeControlPoints.forEach((point, index) => {
          if (index > 0) { // Ne pas cacher le point central
            point.setStyle({ opacity: 0, fillOpacity: 0 });
          }
        });
        PerformanceTracker.end('useMapDrawing.centerPoint.hideOtherPoints');
        
        const onMouseMove = (e: L.LeafletMouseEvent) => {
          PerformanceTracker.start('useMapDrawing.centerPoint.mouseMove');
          if (!isDragging) {
            PerformanceTracker.end('useMapDrawing.centerPoint.mouseMove');
            return;
          }
          
          // Calculer le déplacement par rapport au point initial
          const dx = e.latlng.lng - startPoint.lng;
          const dy = e.latlng.lat - startPoint.lat;
          
          // Créer une nouvelle liste de points déplacés
          PerformanceTracker.start('useMapDrawing.centerPoint.createNewPoints');
          const newLatLngs = originalLatLngs.map(point => 
            L.latLng(
              point.lat + dy,
              point.lng + dx
            )
          );
          PerformanceTracker.end('useMapDrawing.centerPoint.createNewPoints');
          
          // Mettre à jour directement les positions sans utiliser move()
          PerformanceTracker.start('useMapDrawing.centerPoint.updatePositions');
          L.Polyline.prototype.setLatLngs.call(layer, newLatLngs);
          PerformanceTracker.end('useMapDrawing.centerPoint.updatePositions');
          
          // Mise à jour du centre (toujours instantanée)
          centerPoint?.setLatLng(e.latlng);
          
          PerformanceTracker.end('useMapDrawing.centerPoint.mouseMove');
        };
        
        const onMouseUp = () => {
          PerformanceTracker.start('useMapDrawing.centerPoint.mouseUp');
          isDragging = false;
          if (!map.value) {
            PerformanceTracker.end('useMapDrawing.centerPoint.mouseUp');
            return;
          }
          map.value.off('mousemove', onMouseMove);
          document.removeEventListener('mouseup', onMouseUp);
          map.value.dragging.enable();
          
          // Supprimer complètement les points de contrôle et les recréer
          // pour éviter les problèmes de synchronisation
          PerformanceTracker.start('useMapDrawing.centerPoint.recreateControlPoints');
          clearActiveControlPoints();
          
          // Recréer tous les points de contrôle avec leurs positions correctes
          updateLineControlPoints(layer);
          PerformanceTracker.end('useMapDrawing.centerPoint.recreateControlPoints');
          
          // Mettre à jour les propriétés UNIQUEMENT à la fin du déplacement
          PerformanceTracker.start('useMapDrawing.centerPoint.updateProperties');
          if (layer instanceof Line) {
            layer.updateProperties();
            // Ajouter cet appel pour mettre à jour les propriétés de la couche
            updateLayerProperties(layer, 'Line');
          }
          PerformanceTracker.end('useMapDrawing.centerPoint.updateProperties');
          
          // Mise à jour de selectedShape pour déclencher la réactivité
          selectedShape.value = layer;
          
          PerformanceTracker.end('useMapDrawing.centerPoint.mouseUp');
        };
        
        map.value.on('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
        
        PerformanceTracker.end('useMapDrawing.centerPoint.mousedown');
      });
      PerformanceTracker.end('useMapDrawing.updateLineControlPoints.centerPoint');
    }

    // Points d'extrémité (rouge)
    PerformanceTracker.start('useMapDrawing.updateLineControlPoints.vertices');
    points.forEach((point, i) => {
      const pointMarker = createControlPoint(point, '#DC2626');
      activeControlPoints.push(pointMarker);

      // Ajouter les mesures aux points d'extrémité
      addMeasureEvents(pointMarker, layer, () => {
        let totalLength = 0;
        let distanceFromStart = 0;
        
        if (layer instanceof Line) {
          totalLength = layer.getLength() || 0;
          distanceFromStart = layer.getLengthToVertex(i);
        } else {
          totalLength = points.reduce((acc, curr, idx) => {
            if (idx === 0) return 0;
            return acc + curr.distanceTo(points[idx - 1]);
          }, 0);
          
          distanceFromStart = points.slice(0, i + 1).reduce((acc, curr, idx) => {
            if (idx === 0) return 0;
            return acc + curr.distanceTo(points[idx - 1]);
          }, 0);
        }

        return [
          formatMeasure(distanceFromStart, 'm', 'Distance depuis le début'),
          formatMeasure(totalLength, 'm', 'Longueur totale')
        ].join('<br>');
      });

      pointMarker.on('mousedown', (e: L.LeafletMouseEvent) => {
        PerformanceTracker.start(`useMapDrawing.vertex.mousedown.${i}`);
        if (!map.value) {
          PerformanceTracker.end(`useMapDrawing.vertex.mousedown.${i}`);
          return;
        }
        L.DomEvent.stopPropagation(e);
        map.value.dragging.disable();
        
        let isDragging = true;
        
        // Cacher le point central (vert) pendant le redimensionnement
        PerformanceTracker.start(`useMapDrawing.vertex.hideCenter.${i}`);
        if (centerPoint) {
          centerPoint.setStyle({ opacity: 0, fillOpacity: 0 });
          if (centerPoint.measureDiv) {
            centerPoint.measureDiv.style.display = 'none';
          }
        }
        PerformanceTracker.end(`useMapDrawing.vertex.hideCenter.${i}`);
        
        // Stocker les midpoints affectés par le déplacement de ce vertex
        const affectedMidPoints: number[] = [];
        if (i > 0) affectedMidPoints.push(i - 1);  // Midpoint précédent
        if (i < points.length - 1) affectedMidPoints.push(i);  // Midpoint suivant
        
        // Stocker les points de contrôle des midpoints affectés
        const midPointControlIndices = affectedMidPoints.map(idx => points.length + idx);
        
        const onMouseMove = (e: L.LeafletMouseEvent) => {
          PerformanceTracker.start(`useMapDrawing.vertex.mouseMove.${i}`);
          if (!isDragging) {
            PerformanceTracker.end(`useMapDrawing.vertex.mouseMove.${i}`);
            return;
          }
          
          // Déplacer le vertex sans mettre à jour les propriétés
          PerformanceTracker.start(`useMapDrawing.vertex.moveVertex.${i}`);
          if (layer instanceof Line) {
            layer.moveVertex(i, e.latlng, false);  // Pas de mise à jour des propriétés pendant le drag
          } else {
            points[i] = e.latlng;
            layer.setLatLngs(points);
          }
          PerformanceTracker.end(`useMapDrawing.vertex.moveVertex.${i}`);
          
          // Mettre à jour uniquement ce point marker de manière fiable
          pointMarker.setLatLng(e.latlng);
          
          // Mettre à jour uniquement les midpoints affectés
          PerformanceTracker.start(`useMapDrawing.vertex.updateAffectedMidPoints.${i}`);
          updateAffectedMidPoints(affectedMidPoints, midPointControlIndices);
          PerformanceTracker.end(`useMapDrawing.vertex.updateAffectedMidPoints.${i}`);
          
          PerformanceTracker.end(`useMapDrawing.vertex.mouseMove.${i}`);
        };
        
        const onMouseUp = () => {
          PerformanceTracker.start(`useMapDrawing.vertex.mouseUp.${i}`);
          isDragging = false;
          if (!map.value) {
            PerformanceTracker.end(`useMapDrawing.vertex.mouseUp.${i}`);
            return;
          }
          map.value.off('mousemove', onMouseMove);
          document.removeEventListener('mouseup', onMouseUp);
          map.value.dragging.enable();
          
          // Mise à jour des propriétés à la fin de l'édition
          PerformanceTracker.start(`useMapDrawing.vertex.updateProps.${i}`);
          if (layer instanceof Line) {
            layer.updateProperties();
            updateLayerProperties(layer, 'Line');
          }
          PerformanceTracker.end(`useMapDrawing.vertex.updateProps.${i}`);
          
          // Faire réapparaître le point central avec sa position mise à jour
          PerformanceTracker.start(`useMapDrawing.vertex.showCenter.${i}`);
          if (centerPoint && layer instanceof Line) {
            const newCenter = layer.getCenter();
            centerPoint.setLatLng(newCenter);
            centerPoint.setStyle({ opacity: 1, fillOpacity: 1 });
            if (centerPoint.measureDiv) {
              centerPoint.measureDiv.style.display = '';
            }
          }
          PerformanceTracker.end(`useMapDrawing.vertex.showCenter.${i}`);
          
          // Mise à jour de selectedShape pour déclencher la réactivité
          PerformanceTracker.start(`useMapDrawing.vertex.updateSelectedShape.${i}`);
          selectedShape.value = null; // Forcer un reset
          nextTick(() => {
            selectedShape.value = layer;
          });
          PerformanceTracker.end(`useMapDrawing.vertex.updateSelectedShape.${i}`);
          
          PerformanceTracker.end(`useMapDrawing.vertex.mouseUp.${i}`);
        };
        
        map.value.on('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
        
        PerformanceTracker.end(`useMapDrawing.vertex.mousedown.${i}`);
      });
    });
    PerformanceTracker.end('useMapDrawing.updateLineControlPoints.vertices');

    // Optimiser la mise à jour des midpoints

    // Points milieux (bleu)
    const updateMidPoints = () => {
      PerformanceTracker.start('useMapDrawing.updateMidPoints');
      // Récupérer les points à jour
      const currentPoints = layer.getLatLngs() as L.LatLng[];
      
      // Supprimer les anciens points milieux
      PerformanceTracker.start('useMapDrawing.updateMidPoints.removeOld');
      const vertexCount = layer instanceof Line ? currentPoints.length + 1 : currentPoints.length;
      activeControlPoints.slice(vertexCount).forEach(point => {
        if (point && typeof point.remove === 'function') {
          controlPointsGroup.value?.removeLayer(point);
        }
      });
      activeControlPoints = activeControlPoints.slice(0, vertexCount);
      PerformanceTracker.end('useMapDrawing.updateMidPoints.removeOld');

      // Créer les nouveaux points milieux
      PerformanceTracker.start('useMapDrawing.updateMidPoints.createNew');
      const midPoints = layer instanceof Line ? 
        (layer as Line).getMidPoints() : 
        Array.from({length: currentPoints.length - 1}, (_, i) => {
          const p1 = currentPoints[i];
          const p2 = currentPoints[i + 1];
          return L.latLng((p1.lat + p2.lat) / 2, (p1.lng + p2.lng) / 2);
        });
      PerformanceTracker.end('useMapDrawing.updateMidPoints.createNew');

      PerformanceTracker.start('useMapDrawing.updateMidPoints.addToMap');
      midPoints.forEach((midPoint, i) => {
        const midPointMarker = createControlPoint(midPoint, '#2563EB');
        activeControlPoints.push(midPointMarker);

        // Ajouter les mesures aux points milieux
        addMeasureEvents(midPointMarker, layer, () => {
          let segmentLength = 0;
          let totalLength = 0;
          let distanceFromStart = 0;

          if (layer instanceof Line) {
            // Utiliser les méthodes optimisées pour récupérer les informations spécifiques au segment
            segmentLength = (layer as Line).getSegmentLengthAt(i);
            totalLength = (layer as Line).getLength() || 0;
            distanceFromStart = (layer as Line).getLengthToVertex(i) + segmentLength/2;
          } else {
            const p1 = currentPoints[i];
            const p2 = currentPoints[i + 1];
            segmentLength = p1.distanceTo(p2);
            
            totalLength = currentPoints.reduce((acc, curr, idx) => {
              if (idx === 0) return 0;
              return acc + curr.distanceTo(currentPoints[idx - 1]);
            }, 0);
            
            distanceFromStart = currentPoints.slice(0, i + 1).reduce((acc, curr, idx) => {
              if (idx === 0) return 0;
              return acc + curr.distanceTo(currentPoints[idx - 1]);
            }, 0) + segmentLength / 2;
          }

          return [
            formatMeasure(segmentLength, 'm', 'Longueur du segment'),
            formatMeasure(segmentLength/2, 'm', 'Demi-segment'),
            formatMeasure(distanceFromStart, 'm', 'Distance depuis le début'),
            formatMeasure(totalLength, 'm', 'Longueur totale')
          ].join('<br>');
        });

        midPointMarker.on('mousedown', (e: L.LeafletMouseEvent) => {
          PerformanceTracker.start(`useMapDrawing.midPoint.mousedown.${i}`);
          if (!map.value) {
            PerformanceTracker.end(`useMapDrawing.midPoint.mousedown.${i}`);
            return;
          }
          L.DomEvent.stopPropagation(e);
          map.value.dragging.disable();

          let isDragging = true;
          const currentSegmentIndex = i;
          const currentPoints = layer.getLatLngs() as L.LatLng[];
          
          // Cacher le point central (vert) pendant l'opération d'ajout de vertex
          PerformanceTracker.start(`useMapDrawing.midPoint.hideCenter.${i}`);
          const centerControlPoint = activeControlPoints.find(cp => 
            cp.options && cp.options.color === '#059669'
          ) as ControlPoint | undefined;
          
          if (centerControlPoint) {
            centerControlPoint.setStyle({ opacity: 0, fillOpacity: 0 });
            if (centerControlPoint.measureDiv) {
              centerControlPoint.measureDiv.style.display = 'none';
            }
          }
          PerformanceTracker.end(`useMapDrawing.midPoint.hideCenter.${i}`);
          
          const onMouseMove = (e: L.LeafletMouseEvent) => {
            PerformanceTracker.start(`useMapDrawing.midPoint.mouseMove.${i}`);
            if (!isDragging) {
              PerformanceTracker.end(`useMapDrawing.midPoint.mouseMove.${i}`);
              return;
            }
            // Insérer un nouveau point sans mettre à jour les propriétés
            PerformanceTracker.start(`useMapDrawing.midPoint.addVertex.${i}`);
            if (layer instanceof Line) {
              layer.addVertex(currentSegmentIndex, e.latlng, false);  // Pas de mise à jour des propriétés pendant le drag
            } else {
              const current = currentPoints.slice();
              current.splice(currentSegmentIndex + 1, 0, e.latlng);
              layer.setLatLngs(current);
            }
            PerformanceTracker.end(`useMapDrawing.midPoint.addVertex.${i}`);
            
            // Réinitialiser complètement les points de contrôle
            PerformanceTracker.start(`useMapDrawing.midPoint.recreateControlPoints.${i}`);
            clearActiveControlPoints();
            updateLineControlPoints(layer);
            PerformanceTracker.end(`useMapDrawing.midPoint.recreateControlPoints.${i}`);
            
            isDragging = false;  // Arrêter le glisser-déposer après insertion
            PerformanceTracker.end(`useMapDrawing.midPoint.mouseMove.${i}`);
          };
          
          const onMouseUp = () => {
            PerformanceTracker.start(`useMapDrawing.midPoint.mouseUp.${i}`);
            isDragging = false;
            if (!map.value) {
              PerformanceTracker.end(`useMapDrawing.midPoint.mouseUp.${i}`);
              return;
            }
            map.value.off('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);
            map.value.dragging.enable();
            
            // Mise à jour des propriétés à la fin de l'édition
            PerformanceTracker.start(`useMapDrawing.midPoint.updateProps.${i}`);
            if (layer instanceof Line) {
              layer.updateProperties();
              // Ajouter cet appel pour mettre à jour les propriétés de la couche
              updateLayerProperties(layer, 'Line');
            }
            PerformanceTracker.end(`useMapDrawing.midPoint.updateProps.${i}`);
            
            // Le point central sera automatiquement recréé avec la bonne visibilité
            // lors de l'appel à updateLineControlPoints dans onMouseMove
            
            // Mise à jour de selectedShape pour déclencher la réactivité
            PerformanceTracker.start(`useMapDrawing.midPoint.updateSelectedShape.${i}`);
            selectedShape.value = null; // Forcer un reset
            nextTick(() => {
              selectedShape.value = layer;
            });
            PerformanceTracker.end(`useMapDrawing.midPoint.updateSelectedShape.${i}`);
            
            PerformanceTracker.end(`useMapDrawing.midPoint.mouseUp.${i}`);
          };
          
          map.value.on('mousemove', onMouseMove);
          document.addEventListener('mouseup', onMouseUp);
          
          PerformanceTracker.end(`useMapDrawing.midPoint.mousedown.${i}`);
        });
      });
      PerformanceTracker.end('useMapDrawing.updateMidPoints.addToMap');
      
      PerformanceTracker.end('useMapDrawing.updateMidPoints');
    };

    // Fonction pour mettre à jour uniquement les midpoints affectés par le déplacement d'un vertex
    const updateAffectedMidPoints = (segmentIndices: number[], controlPointIndices: number[]) => {
      PerformanceTracker.start('useMapDrawing.updateAffectedMidPoints');
      const currentPoints = layer.getLatLngs() as L.LatLng[];

      // Pour chaque segment affecté, mettre à jour le midpoint correspondant
      segmentIndices.forEach((segmentIndex, i) => {
        if (segmentIndex < 0 || segmentIndex >= currentPoints.length - 1) return;
        
        const controlPointIndex = controlPointIndices[i];
        if (controlPointIndex >= 0 && controlPointIndex < activeControlPoints.length) {
          // Calculer la nouvelle position du midpoint
          let newMidPoint: L.LatLng;
          
          if (layer instanceof Line) {
            const midPoint = (layer as Line).getMidPointAt(segmentIndex);
            if (!midPoint) return;
            newMidPoint = midPoint;
          } else {
            const p1 = currentPoints[segmentIndex];
            const p2 = currentPoints[segmentIndex + 1];
            newMidPoint = L.latLng(
              (p1.lat + p2.lat) / 2,
              (p1.lng + p2.lng) / 2
            );
          }
          
          // Mettre à jour la position du point de contrôle
          const controlPoint = activeControlPoints[controlPointIndex];
          if (controlPoint && controlPoint.setLatLng) {
            controlPoint.setLatLng(newMidPoint);
            
            // Mettre à jour la mesure affichée si nécessaire
            const midPointMarker = controlPoint as ControlPoint;
            if (midPointMarker.measureDiv) {
              let segmentLength = 0;
              let totalLength = 0;
              let distanceFromStart = 0;
  
              if (layer instanceof Line) {
                segmentLength = (layer as Line).getSegmentLengthAt(segmentIndex);
                totalLength = (layer as Line).getLength() || 0;
                distanceFromStart = (layer as Line).getLengthToVertex(segmentIndex) + segmentLength/2;
              } else {
                const p1 = currentPoints[segmentIndex];
                const p2 = currentPoints[segmentIndex + 1];
                segmentLength = p1.distanceTo(p2);
                
                // Calculs simplifiés pour la performance
                totalLength = 0;
                distanceFromStart = 0;
                for (let j = 0; j < currentPoints.length - 1; j++) {
                  const dist = currentPoints[j].distanceTo(currentPoints[j + 1]);
                  totalLength += dist;
                  if (j < segmentIndex) {
                    distanceFromStart += dist;
                  } else if (j === segmentIndex) {
                    distanceFromStart += dist / 2;
                  }
                }
              }
  
              midPointMarker.measureDiv.innerHTML = [
                formatMeasure(segmentLength, 'm', 'Longueur du segment'),
                formatMeasure(segmentLength/2, 'm', 'Demi-segment'),
                formatMeasure(distanceFromStart, 'm', 'Distance depuis le début'),
                formatMeasure(totalLength, 'm', 'Longueur totale')
              ].join('<br>');
            }
          }
        }
      });
      
      PerformanceTracker.end('useMapDrawing.updateAffectedMidPoints');
    };

    updateMidPoints();
    PerformanceTracker.end('useMapDrawing.updateLineControlPoints');
  };

  // Mettre à jour la fonction updatePolygonControlPoints pour ajouter plus de mesures
  const updatePolygonControlPoints = (layer: L.Polygon) => {
    PerformanceTracker.start('useMapDrawing.updatePolygonControlPoints');
    if (!map.value || !featureGroup.value) {
      PerformanceTracker.end('useMapDrawing.updatePolygonControlPoints');
      return;
    }

    clearActiveControlPoints();
    const points = (layer.getLatLngs()[0] as L.LatLng[]);
    
    PerformanceTracker.start('useMapDrawing.updatePolygonControlPoints.calculateProperties');
    // Convertir les points en format GeoJSON pour turf
    const coordinates = points.map(point => [point.lng, point.lat]);
    coordinates.push(coordinates[0]); // Fermer le polygone
    const polygon = turf.polygon([coordinates]);
    const area = turf.area(polygon);
    
    const perimeter = points.reduce((acc, curr, idx) => {
      const nextPoint = points[(idx + 1) % points.length];
      return acc + curr.distanceTo(nextPoint);
    }, 0);
    PerformanceTracker.end('useMapDrawing.updatePolygonControlPoints.calculateProperties');

    // Point central (vert)
    PerformanceTracker.start('useMapDrawing.updatePolygonControlPoints.createCenterPoint');
    let center: L.LatLng;
    if (typeof layer.getCenter === 'function') {
      try {
        center = layer.getCenter();
      } catch (error) {
        console.warn('Erreur lors de la récupération du centre du polygone via getCenter(), utilisation de la méthode alternative', error);
        // Calculer le centre manuellement
        const centroidPoint = centroid(polygon);
        center = L.latLng(centroidPoint.geometry.coordinates[1], centroidPoint.geometry.coordinates[0]);
      }
    } else {
      // Calculer le centre manuellement si la méthode getCenter n'existe pas
      const centroidPoint = centroid(polygon);
      center = L.latLng(centroidPoint.geometry.coordinates[1], centroidPoint.geometry.coordinates[0]);
    }

    // Créer le point central (vert)
    const centerPoint = createControlPoint(center, '#059669') as ControlPoint;
    activeControlPoints.push(centerPoint);
    PerformanceTracker.end('useMapDrawing.updatePolygonControlPoints.createCenterPoint');

    // Ajouter les mesures au point central
    addMeasureEvents(centerPoint, layer, () => {
      return [
        formatMeasure(perimeter, 'm', 'Périmètre'),
        formatMeasure(area, 'm²', 'Surface')
      ].join('<br>');
    });

    // Gestion du déplacement via le point central
    centerPoint.on('mousedown', (e: L.LeafletMouseEvent) => {
      PerformanceTracker.start('useMapDrawing.polygonCenterPoint.mousedown');
      if (!map.value) {
        PerformanceTracker.end('useMapDrawing.polygonCenterPoint.mousedown');
        return;
      }
      L.DomEvent.stopPropagation(e);
      map.value.dragging.disable();
      
      let isDragging = true;
      const startPoint = e.latlng;
      // Sauvegarder les points originaux
      const originalPoints = [...points];
      
      // Cacher tous les points de contrôle sauf le point central pendant le déplacement
      PerformanceTracker.start('useMapDrawing.polygonCenterPoint.hideControlPoints');
      activeControlPoints.forEach((point, index) => {
        if (index > 0) { // Ne pas cacher le point central
          point.setStyle({ opacity: 0, fillOpacity: 0 });
        }
      });
      PerformanceTracker.end('useMapDrawing.polygonCenterPoint.hideControlPoints');
      
      // Fonction throttlée pour limiter les mises à jour pendant le déplacement
      const throttledMove = throttle((moveEvent: L.LeafletMouseEvent) => {
        if (!isDragging) return;
        
        // Calculer le déplacement par rapport au point initial
        const dx = moveEvent.latlng.lng - startPoint.lng;
        const dy = moveEvent.latlng.lat - startPoint.lat;
        
        // Déplacer tous les points du polygone
        const newPoints = originalPoints.map(point => 
          L.latLng(
            point.lat + dy,
            point.lng + dx
          )
        );
        
        // Mettre à jour la géométrie sans triggering centroid recalculation
        L.Polygon.prototype.setLatLngs.call(layer, [newPoints]);
        
        // Mettre à jour uniquement le point central
        centerPoint.setLatLng(moveEvent.latlng);
      }, 16); // 60fps
      
      const onMouseMove = (e: L.LeafletMouseEvent) => {
        PerformanceTracker.start('useMapDrawing.polygonCenterPoint.mouseMove');
        if (!isDragging) {
          PerformanceTracker.end('useMapDrawing.polygonCenterPoint.mouseMove');
          return;
        }
        
        // Utiliser la version throttlée
        throttledMove(e);
        
        PerformanceTracker.end('useMapDrawing.polygonCenterPoint.mouseMove');
      };
      
      const onMouseUp = () => {
        PerformanceTracker.start('useMapDrawing.polygonCenterPoint.mouseUp');
        isDragging = false;
        if (!map.value) {
          PerformanceTracker.end('useMapDrawing.polygonCenterPoint.mouseUp');
          return;
        }
        map.value.off('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
        map.value.dragging.enable();
        
        // Forcer la mise à jour des propriétés de la forme à la fin de l'opération
        if (layer.properties) {
          // Récupérer les points actuels
          const currentPoints = (layer.getLatLngs()[0] as L.LatLng[]);
          
          // Recalculer les propriétés à jour
          const coords = currentPoints.map(p => [p.lng, p.lat]);
          coords.push(coords[0]); // Fermer le polygone
          const polygonFeature = turf.polygon([coords]);
          
          // Mettre à jour les propriétés importantes
          layer.properties.area = turf.area(polygonFeature);
          layer.properties.perimeter = currentPoints.reduce((acc, curr, idx) => {
            const nextPoint = currentPoints[(idx + 1) % currentPoints.length];
            return acc + curr.distanceTo(nextPoint);
          }, 0);
          layer.properties.surfaceInterieure = layer.properties.area;
          layer.properties.surfaceExterieure = layer.properties.area;
        }
        
        // Récréer tous les points de contrôle pour assurer la cohérence
        clearActiveControlPoints();
        updatePolygonControlPoints(layer);
        
        // Mise à jour de selectedShape pour déclencher la réactivité
        selectedShape.value = null; // Forcer un reset
        nextTick(() => {
          selectedShape.value = layer;
        });
        PerformanceTracker.end('useMapDrawing.polygonCenterPoint.mouseUp');
      };
      
      map.value.on('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);
      PerformanceTracker.end('useMapDrawing.polygonCenterPoint.mousedown');
    });

    // Points de sommet (rouge pour harmonisation)
    PerformanceTracker.start('useMapDrawing.updatePolygonControlPoints.createVertexPoints');
    points.forEach((point, i) => {
      const pointMarker = createControlPoint(point, '#DC2626');
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
        PerformanceTracker.start(`useMapDrawing.polygonVertex.mousedown.${i}`);
        L.DomEvent.stopPropagation(e);
        if (!map.value) {
          PerformanceTracker.end(`useMapDrawing.polygonVertex.mousedown.${i}`);
          return;
        }
        
        map.value.dragging.disable();
        let isDragging = true;
        
        // Cacher le point central pendant la modification
        if (centerPoint) {
          centerPoint.setStyle({ opacity: 0, fillOpacity: 0 });
          if (centerPoint.measureDiv) {
            centerPoint.measureDiv.style.display = 'none';
          }
        }
        
        // Fonction throttlée pour limiter les mises à jour pendant le déplacement du vertex
        const throttledDrag = throttle((dragEvent: L.LeafletMouseEvent) => {
          if (!isDragging) return;
          
          // Mettre à jour uniquement le point déplacé
          points[i] = dragEvent.latlng;
          L.Polygon.prototype.setLatLngs.call(layer, [points]);
          pointMarker.setLatLng(dragEvent.latlng);
          
          // Mettre à jour les deux points milieux adjacents uniquement
          const midPointMarkers = activeControlPoints.slice(points.length + 1);
          
          // Point milieu précédent
          const prevIdx = (i - 1 + points.length) % points.length;
          const prevMidPoint = midPointMarkers[prevIdx];
          if (prevMidPoint) {
            const p1 = points[prevIdx];
            const p2 = points[i];
            const midPoint = L.latLng(
              (p1.lat + p2.lat) / 2,
              (p1.lng + p2.lng) / 2
            );
            prevMidPoint.setLatLng(midPoint);
          }
          
          // Point milieu suivant
          const nextMidPoint = midPointMarkers[i];
          if (nextMidPoint) {
            const p1 = points[i];
            const p2 = points[(i + 1) % points.length];
            const midPoint = L.latLng(
              (p1.lat + p2.lat) / 2,
              (p1.lng + p2.lng) / 2
            );
            nextMidPoint.setLatLng(midPoint);
          }
        }, 16); // 60fps
        
        const onMouseMove = (e: L.LeafletMouseEvent) => {
          PerformanceTracker.start(`useMapDrawing.polygonVertex.mouseMove.${i}`);
          if (!isDragging) {
            PerformanceTracker.end(`useMapDrawing.polygonVertex.mouseMove.${i}`);
            return;
          }
          
          // Utiliser la version throttlée
          throttledDrag(e);
          
          PerformanceTracker.end(`useMapDrawing.polygonVertex.mouseMove.${i}`);
        };

        const onMouseUp = () => {
          PerformanceTracker.start(`useMapDrawing.polygonVertex.mouseUp.${i}`);
          isDragging = false;
          if (!map.value) {
            PerformanceTracker.end(`useMapDrawing.polygonVertex.mouseUp.${i}`);
            return;
          }
          map.value.off('mousemove', onMouseMove);
          document.removeEventListener('mouseup', onMouseUp);
          map.value.dragging.enable();
          
          // Forcer la mise à jour des propriétés de la forme à la fin de l'opération
          if (layer.properties) {
            // Recalculer les propriétés à jour
            const coords = (layer.getLatLngs()[0] as L.LatLng[]).map(p => [p.lng, p.lat]);
            coords.push(coords[0]); // Fermer le polygone
            const polygonFeature = turf.polygon([coords]);
            
            // Mettre à jour les propriétés importantes
            layer.properties.area = turf.area(polygonFeature);
            layer.properties.perimeter = points.reduce((acc, curr, idx) => {
              const nextPoint = points[(idx + 1) % points.length];
              return acc + curr.distanceTo(nextPoint);
            }, 0);
            layer.properties.surfaceInterieure = layer.properties.area;
            layer.properties.surfaceExterieure = layer.properties.area;
          }
          
          // Recréer tous les points de contrôle pour assurer la cohérence
          clearActiveControlPoints();
          updatePolygonControlPoints(layer);
          
          // Mise à jour de selectedShape pour déclencher la réactivité
          selectedShape.value = null; // Forcer un reset
          nextTick(() => {
            selectedShape.value = layer;
          });
          PerformanceTracker.end(`useMapDrawing.polygonVertex.mouseUp.${i}`);
        };

        map.value.on('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
        PerformanceTracker.end(`useMapDrawing.polygonVertex.mousedown.${i}`);
      });
    });
    PerformanceTracker.end('useMapDrawing.updatePolygonControlPoints.createVertexPoints');

    // Points milieux (bleu)
    const updateMidPoints = () => {
      PerformanceTracker.start('useMapDrawing.updatePolygonMidPoints');
      const points = (layer.getLatLngs()[0] as L.LatLng[]);
      
      // Supprimer les anciens points milieux
      PerformanceTracker.start('useMapDrawing.updatePolygonMidPoints.removeOld');
      activeControlPoints.slice(points.length + 1).forEach(point => {  // +1 pour le point central
        if (controlPointsGroup.value) {
          controlPointsGroup.value.removeLayer(point);
        }
      });
      activeControlPoints = activeControlPoints.slice(0, points.length + 1);  // +1 pour le point central
      PerformanceTracker.end('useMapDrawing.updatePolygonMidPoints.removeOld');

      // Créer tous les points milieux d'un coup pour améliorer les performances
      PerformanceTracker.start('useMapDrawing.updatePolygonMidPoints.createNew');
      // Calculer tous les points milieux d'avance
      const midPoints = new Array(points.length);
      for (let i = 0; i < points.length; i++) {
        const p1 = points[i];
        const p2 = points[(i + 1) % points.length];
        midPoints[i] = getMidPoint(p1, p2);
      }
      
      // Créer maintenant tous les markers
      midPoints.forEach((midPoint, i) => {
        const midPointMarker = createControlPoint(midPoint, '#2563EB');
        activeControlPoints.push(midPointMarker);

        // Ajouter les mesures aux points milieux
        addMeasureEvents(midPointMarker, layer, () => {
          const p1 = points[i];
          const p2 = points[(i + 1) % points.length];
          const segmentLength = p1.distanceTo(p2);
          return [
            formatMeasure(segmentLength, 'm', 'Longueur du segment'),
            formatMeasure(perimeter, 'm', 'Périmètre total'),
            formatMeasure(area, 'm²', 'Surface')
          ].join('<br>');
        });
        
        // Gestion de l'ajout de vertex
        midPointMarker.on('mousedown', (e: L.LeafletMouseEvent) => {
          PerformanceTracker.start(`useMapDrawing.polygonMidPoint.mousedown.${i}`);
          if (!map.value) {
            PerformanceTracker.end(`useMapDrawing.polygonMidPoint.mousedown.${i}`);
            return;
          }
          L.DomEvent.stopPropagation(e);
          map.value.dragging.disable();

          let isDragging = true;
          const currentIndex = i;
          
          // Cacher le point central pendant l'opération
          if (centerPoint) {
            centerPoint.setStyle({ opacity: 0, fillOpacity: 0 });
            if (centerPoint.measureDiv) {
              centerPoint.measureDiv.style.display = 'none';
            }
          }
          
          // Ajout initial du point à la position exacte du milieu
          const currentPoints = [...(layer.getLatLngs()[0] as L.LatLng[])];
          // Ajouter le nouveau point en position fixe
          currentPoints.splice((currentIndex + 1) % currentPoints.length, 0, midPoint);
          // Mettre à jour la géométrie avec le nouveau point
          layer.setLatLngs([currentPoints]);
          
          // Récréer immédiatement tous les points de contrôle
          // pour avoir accès au nouveau point créé
          clearActiveControlPoints();
            updatePolygonControlPoints(layer);
          
          // Récupérer le nouveau point dans la liste mise à jour des points actifs
          // Le nouveau point sera à la position i+1 dans la liste des sommets
          const newVertexIndex = currentIndex + 1;
          const newVertexOffset = 1 + newVertexIndex; // +1 pour le point central
          const newVertexMarker = newVertexIndex < activeControlPoints.length - 1 ? 
            activeControlPoints[newVertexOffset] : null;
          
          // Si on a bien trouvé le nouveau point, on va déplacer ce point spécifique
          if (newVertexMarker) {
            const onMouseMove = (e: L.LeafletMouseEvent) => {
              PerformanceTracker.start(`useMapDrawing.polygonMidPoint.mouseMove.${i}`);
              if (!isDragging) {
                PerformanceTracker.end(`useMapDrawing.polygonMidPoint.mouseMove.${i}`);
                return;
              }
              
              // Récupérer la liste actuelle des points
              const currentPoints = (layer.getLatLngs()[0] as L.LatLng[]);
              
              // Modifier uniquement la position du sommet concerné
              currentPoints[newVertexIndex] = e.latlng;
              
              // Appliquer les modifications avec la méthode standard pour déclencher les mises à jour
              layer.setLatLngs([currentPoints]);
              
              // Mettre à jour la position visuelle du marqueur
              newVertexMarker.setLatLng(e.latlng);
              
              // Mettre à jour uniquement les points milieu affectés (avant et après le nouveau point)
              const midPoints = activeControlPoints.slice(1 + currentPoints.length);
              const prevMidIndex = (newVertexIndex - 1 + currentPoints.length) % currentPoints.length;
              const nextMidIndex = newVertexIndex;
              
              // Mise à jour du point milieu précédent
              if (midPoints[prevMidIndex]) {
                const p1 = currentPoints[prevMidIndex];
                const p2 = currentPoints[newVertexIndex];
                const midPoint = L.latLng(
                  (p1.lat + p2.lat) / 2,
                  (p1.lng + p2.lng) / 2
                );
                midPoints[prevMidIndex].setLatLng(midPoint);
              }
              
              // Mise à jour du point milieu suivant
              if (midPoints[nextMidIndex]) {
                const p1 = currentPoints[newVertexIndex];
                const p2 = currentPoints[(newVertexIndex + 1) % currentPoints.length];
                const midPoint = L.latLng(
                  (p1.lat + p2.lat) / 2,
                  (p1.lng + p2.lng) / 2
                );
                midPoints[nextMidIndex].setLatLng(midPoint);
              }
              
              PerformanceTracker.end(`useMapDrawing.polygonMidPoint.mouseMove.${i}`);
          };
          
          const onMouseUp = () => {
              PerformanceTracker.start(`useMapDrawing.polygonMidPoint.mouseUp.${i}`);
            isDragging = false;
              if (!map.value) {
                PerformanceTracker.end(`useMapDrawing.polygonMidPoint.mouseUp.${i}`);
                return;
              }
            map.value.off('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);
            map.value.dragging.enable();
              
              // Forcer la mise à jour des propriétés de la forme
              if (layer.properties) {
                // Recalculer les propriétés à jour
                const coords = (layer.getLatLngs()[0] as L.LatLng[]).map(p => [p.lng, p.lat]);
                coords.push(coords[0]); // Fermer le polygone
                const polygonFeature = turf.polygon([coords]);
                
                // Mettre à jour les propriétés importantes
                layer.properties.area = turf.area(polygonFeature);
                layer.properties.perimeter = (layer.getLatLngs()[0] as L.LatLng[]).reduce((acc, curr, idx, arr) => {
                  const nextPoint = arr[(idx + 1) % arr.length];
                  return acc + curr.distanceTo(nextPoint);
                }, 0);
              }
              
              // Recréer tous les points de contrôle pour une cohérence complète
              clearActiveControlPoints();
              updatePolygonControlPoints(layer);
              
              // Mise à jour de selectedShape pour déclencher la réactivité
              selectedShape.value = null; 
              nextTick(() => {
                selectedShape.value = layer;
              });
              
              PerformanceTracker.end(`useMapDrawing.polygonMidPoint.mouseUp.${i}`);
          };
          
          map.value.on('mousemove', onMouseMove);
          document.addEventListener('mouseup', onMouseUp);
          } else {
            // Si on n'a pas trouvé le point (cas d'erreur), on nettoie
            map.value.dragging.enable();
            clearActiveControlPoints();
            updatePolygonControlPoints(layer);
          }
          
          PerformanceTracker.end(`useMapDrawing.polygonMidPoint.mousedown.${i}`);
        });
      });
      PerformanceTracker.end('useMapDrawing.updatePolygonMidPoints.createNew');
      PerformanceTracker.end('useMapDrawing.updatePolygonMidPoints');
    };

    updateMidPoints();
    PerformanceTracker.end('useMapDrawing.updatePolygonControlPoints');
  };

  // Fonction pour mettre à jour les points de contrôle d'un demi-cercle
  const updateSemicircleControlPoints = (layer: CircleArc) => {
    if (!map.value || !featureGroup.value) return;

    clearActiveControlPoints();
    const center = layer.getCenter();
    const radius = layer.getRadius();
    const startAngle = layer.getStartAngle();
    const stopAngle = layer.getStopAngle();
    const openingAngle = layer.getOpeningAngle();

    // Points de contrôle des angles (rouges) - Utiliser les nouvelles méthodes
    const startPoint = layer.calculatePointOnArc(startAngle);
    const stopPoint = layer.calculatePointOnArc(stopAngle);

    const startControl = createControlPoint(startPoint, '#DC2626');
    const stopControl = createControlPoint(stopPoint, '#DC2626');
    activeControlPoints.push(startControl, stopControl);

    // Ajouter les mesures aux points de contrôle des angles
    addMeasureEvents(startControl, layer, () => {
      return `Angle d'ouverture: ${formatAngle(openingAngle)}`;
    });

    addMeasureEvents(stopControl, layer, () => {
      return `Angle d'ouverture: ${formatAngle(openingAngle)}`;
    });

    // Point central (vert)
    const centerPoint = createControlPoint(center, '#059669');
    activeControlPoints.push(centerPoint);

    // Ajouter les mesures au point central
    addMeasureEvents(centerPoint, layer, () => {
      const area = layer.properties.area || 0;
      return [
        formatMeasure(radius, 'm', 'Rayon'),
        formatMeasure(area, 'm²', 'Surface'),
        `Angle: ${formatAngle(openingAngle)}`
      ].join('<br>');
    });

    // Point de contrôle du rayon au milieu de l'arc (bleu)
    // Ne pas afficher le point bleu si l'angle d'ouverture est trop petit
    if (openingAngle > 5) {
      // Utiliser la méthode de CircleArc pour trouver le point milieu sur l'arc
      const midPoint = layer.calculateMidpointPosition();
      
      const radiusControl = createControlPoint(midPoint, '#2563EB');
      activeControlPoints.push(radiusControl);

      // Ajouter les mesures au point de contrôle du rayon
      addMeasureEvents(radiusControl, layer, () => {
        return formatMeasure(layer.getRadius(), 'm', 'Rayon');
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

          // Recalculer les positions des points de contrôle
          const newStartPoint = layer.calculatePointOnArc(startAngle);
          const newStopPoint = layer.calculatePointOnArc(stopAngle);
          const newMidPoint = layer.calculateMidpointPosition();
          
          // Mettre à jour les positions des points de contrôle
          startControl.setLatLng(newStartPoint);
          stopControl.setLatLng(newStopPoint);
          radiusControl.setLatLng(newMidPoint);

          // Les propriétés sont automatiquement mises à jour par la méthode setRadius
          selectedShape.value = layer;
          
          // Forcer la mise à jour des tooltips pour refléter le nouveau rayon
          if (radiusControl) {
            const measureDiv = (radiusControl as ControlPoint).measureDiv;
            if (measureDiv) {
              measureDiv.innerHTML = formatMeasure(newRadius, 'm', 'Rayon');
            }
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

    // Gestion du déplacement des points de contrôle des angles
    [startControl, stopControl].forEach((angleControl, index) => {
      angleControl.on('mousedown', (e: L.LeafletMouseEvent) => {
        if (!map.value) return;
        L.DomEvent.stopPropagation(e);
        map.value.dragging.disable();
    
        let isDragging = true;
    
        // Référence au point bleu
        const radiusControl = activeControlPoints.find(pt => (pt as any).options?.color === '#2563EB');
        
        // On ne cache plus le point bleu pendant le déplacement
    
        const onMouseMove = (e: L.LeafletMouseEvent) => {
          if (!isDragging || !map.value) return;
    
          const newAngle = Math.atan2(
            e.latlng.lat - center.lat,
            e.latlng.lng - center.lng
          ) * 180 / Math.PI;
    
          // Mise à jour des angles selon le point déplacé
          if (index === 0) {
            layer.setAngles(newAngle, layer.getStopAngle());
          } else {
            layer.setAngles(layer.getStartAngle(), newAngle);
          }
    
          // Recalculer les positions des points de contrôle après mise à jour des angles
          const updatedStartAngle = layer.getStartAngle();
          const updatedStopAngle = layer.getStopAngle();
          const updatedOpeningAngle = layer.getOpeningAngle();
          
          const newStartPoint = layer.calculatePointOnArc(updatedStartAngle);
          const newStopPoint = layer.calculatePointOnArc(updatedStopAngle);
          
          // Mettre à jour les positions des points de contrôle rouges
          startControl.setLatLng(newStartPoint);
          stopControl.setLatLng(newStopPoint);
    
          // Maintenir visible et mettre à jour le point bleu en temps réel
          if (radiusControl && updatedOpeningAngle > 5) {
            const newMidPoint = layer.calculateMidpointPosition();
            radiusControl.setLatLng(newMidPoint);
            radiusControl.setStyle({ opacity: 1, fillOpacity: 1 }); // S'assurer qu'il est visible
          } else if (radiusControl) {
            // Si l'angle devient trop petit, masquer temporairement le point bleu
            radiusControl.setStyle({ opacity: 0, fillOpacity: 0 });
          }
    
          // Les propriétés sont automatiquement mises à jour par la méthode setAngles
          selectedShape.value = layer;
        };

        const onMouseUp = () => {
          isDragging = false;
          if (!map.value) return;
          map.value.off('mousemove', onMouseMove);
          document.removeEventListener('mouseup', onMouseUp);
          map.value.dragging.enable();
          
          // Réafficher et repositionner correctement tous les points de contrôle
          updateSemicircleControlPoints(layer);
        };

        map.value.on('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
      });
    });

    // Gestion du déplacement du point central
    centerPoint.on('mousedown', (e: L.LeafletMouseEvent) => {
      if (!map.value) return;
      L.DomEvent.stopPropagation(e);
      map.value.dragging.disable();

      let isDragging = true;

      const onMouseMove = (e: L.LeafletMouseEvent) => {
        if (!isDragging) return;
        
        // Utiliser la méthode de CircleArc pour déplacer le centre
        layer.setCenter(e.latlng);
        centerPoint.setLatLng(e.latlng);

        // Recalculer les positions des points de contrôle
        const updatedStartAngle = layer.getStartAngle();
        const updatedStopAngle = layer.getStopAngle();
        const updatedOpeningAngle = layer.getOpeningAngle();
        
        const newStartPoint = layer.calculatePointOnArc(updatedStartAngle);
        const newStopPoint = layer.calculatePointOnArc(updatedStopAngle);
        
        // Mettre à jour les positions des points de contrôle
        startControl.setLatLng(newStartPoint);
        stopControl.setLatLng(newStopPoint);
        
        // Mettre à jour le point de contrôle du rayon s'il existe
        const radiusControl = activeControlPoints.find(pt => (pt as any).options?.color === '#2563EB');
        if (radiusControl && updatedOpeningAngle > 5) {
          const newMidPoint = layer.calculateMidpointPosition();
          radiusControl.setLatLng(newMidPoint);
          radiusControl.setStyle({ opacity: 1, fillOpacity: 1 }); // S'assurer qu'il est visible
        } else if (radiusControl) {
          // Si l'angle devient trop petit, masquer temporairement le point bleu
          radiusControl.setStyle({ opacity: 0, fillOpacity: 0 });
        }

        // Les propriétés sont automatiquement mises à jour par la méthode setCenter
        selectedShape.value = layer;
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

  // Fonction pour générer les points de contrôle temporaires
  const generateTempControlPoints = (layer: L.Layer) => {
    PerformanceTracker.start('useMapDrawing.generateTempControlPoints');
    if (!map.value || !tempControlPointsGroup.value) {
      PerformanceTracker.end('useMapDrawing.generateTempControlPoints');
      return;
    }

    console.log('[generateTempControlPoints] Génération des points temporaires pour', {
      layerType: layer.constructor.name,
      properties: layer.properties
    });

    // Supprimer les points temporaires existants
    tempControlPointsGroup.value.clearLayers();
    
    // Pas de points de contrôle temporaires pour TextRectangle
    if (layer instanceof TextRectangle) {
      console.log('[generateTempControlPoints] Skipping control points for TextRectangle - use double click to edit');
      // Just add a simple hint to show it's hoverable
      if (layer.getCenter()) {
        const textHint = L.circleMarker(layer.getCenter(), {
          radius: 0,  // Invisible marker
          className: 'text-hint-marker',
          pmIgnore: true
        });
        tempControlPointsGroup.value.addLayer(textHint);
      }
      PerformanceTracker.end('useMapDrawing.generateTempControlPoints');
      return;
    }

    if (layer instanceof Circle) {
      const center = layer.getLatLng();
      
      // Point central temporaire (vert)
      const tempCenterPoint = createControlPoint(center, '#059669');
      tempControlPointsGroup.value.addLayer(tempCenterPoint);

      // Points cardinaux temporaires (bleu)
      layer.getCardinalPoints().forEach(point => {
        const tempControlPoint = createControlPoint(point, '#2563EB');
        tempControlPointsGroup.value.addLayer(tempControlPoint);
      });
    } else if (layer instanceof L.Circle) {
      // Pour les cercles standard de Leaflet (à conserver pour la compatibilité)
      const center = layer.getLatLng();
      const radius = layer.getRadius();

      // Point central temporaire (vert)
      const tempCenterPoint = createControlPoint(center, '#059669');
      tempControlPointsGroup.value.addLayer(tempCenterPoint);

      // Points cardinaux temporaires (bleu)
      [0, 45, 90, 135, 180, 225, 270, 315].forEach(angle => {
        const rad = (angle * Math.PI) / 180;
        const point = L.latLng(
          center.lat + (radius / 111319.9) * Math.sin(rad),
          center.lng + (radius / (111319.9 * Math.cos(center.lat * Math.PI / 180))) * Math.cos(rad)
        );
        const tempControlPoint = createControlPoint(point, '#2563EB');
        tempControlPointsGroup.value.addLayer(tempControlPoint);
      });
    } else if (layer instanceof Rectangle) {
      // Cast de la couche vers notre type Rectangle pour accéder aux méthodes spécifiques
      const rectangleLayer = layer as Rectangle;
      const bounds = rectangleLayer.getBounds();
      const center = bounds.getCenter();
      const corners = [
        bounds.getNorthWest(),
        bounds.getNorthEast(),
        bounds.getSouthEast(),
        bounds.getSouthWest()
      ];

      // Point central temporaire
      const tempCenterPoint = createControlPoint(center, '#059669');
      tempControlPointsGroup.value.addLayer(tempCenterPoint);

      // Points de coin temporaires
      corners.forEach(corner => {
        const tempCornerPoint = createControlPoint(corner, '#DC2626');
        tempControlPointsGroup.value.addLayer(tempCornerPoint);
      });

      // Points milieux temporaires
      rectangleLayer.getMidPoints().forEach(midPoint => {
        const tempMidPoint = createControlPoint(midPoint, '#2563EB');
        tempControlPointsGroup.value.addLayer(tempMidPoint);
      });
    } else if (layer instanceof CircleArc || layer.properties?.type === 'Semicircle') {
      // Utiliser les méthodes de CircleArc pour calculer les positions des points de contrôle
      const arc = layer as CircleArc;
      
      // Point central temporaire (vert)
      const tempCenterPoint = createControlPoint(arc.getCenter(), '#059669');
      tempControlPointsGroup.value.addLayer(tempCenterPoint);

      // Points de début et de fin d'arc temporaires (rouge)
      const startPoint = arc.calculatePointOnArc(arc.getStartAngle());
      const stopPoint = arc.calculatePointOnArc(arc.getStopAngle());
      
      const tempStartPoint = createControlPoint(startPoint, '#DC2626');
      const tempStopPoint = createControlPoint(stopPoint, '#DC2626');
      tempControlPointsGroup.value.addLayer(tempStartPoint);
      tempControlPointsGroup.value.addLayer(tempStopPoint);

      // Point de rayon au milieu de l'arc (bleu)
      if (arc.getOpeningAngle() > 5) {
        const midPoint = arc.calculateMidpointPosition();
        const tempMidPoint = createControlPoint(midPoint, '#2563EB');
        tempControlPointsGroup.value.addLayer(tempMidPoint);
      }
    } else if (layer instanceof L.Polyline) {
      const points = layer.getLatLngs() as L.LatLng[];

      // Centre temporaire pour les lignes personnalisées
      if (layer instanceof Line) {
        const center = (layer as Line).getCenter();
        const tempCenterPoint = createControlPoint(center, '#059669');
        tempControlPointsGroup.value.addLayer(tempCenterPoint);
      }

      // Points d'extrémité temporaires (rouge pour harmonisation)
      points.forEach(point => {
        const tempPoint = createControlPoint(point, '#DC2626');
        tempControlPointsGroup.value.addLayer(tempPoint);
      });

      // Points milieux temporaires pour les segments
      if (layer instanceof Line) {
        (layer as Line).getMidPoints().forEach(midPoint => {
          const tempMidPoint = createControlPoint(midPoint, '#2563EB');
          tempControlPointsGroup.value.addLayer(tempMidPoint);
        });
      } else {
        for (let i = 0; i < points.length - 1; i++) {
          const midPoint = getMidPoint(points[i], points[i + 1]);
          const tempMidPoint = createControlPoint(midPoint, '#2563EB');
          tempControlPointsGroup.value.addLayer(tempMidPoint);
        }
      }
    } else if (layer instanceof L.Polygon) {
      PerformanceTracker.start('useMapDrawing.generateTempControlPoints.polygon');
      const points = (layer.getLatLngs()[0] as L.LatLng[]);
      
      // Point central temporaire (vert)
      PerformanceTracker.start('useMapDrawing.generateTempControlPoints.polygon.center');
      let center: L.LatLng;
      try {
        if (typeof layer.getCenter === 'function') {
          center = layer.getCenter();
        } else {
          // Calculer le centre manuellement
          const coordinates = points.map(point => [point.lng, point.lat]);
          coordinates.push(coordinates[0]); // Fermer le polygone
          const polygonFeature = turf.polygon([coordinates]);
          const centroidPoint = centroid(polygonFeature);
          center = L.latLng(centroidPoint.geometry.coordinates[1], centroidPoint.geometry.coordinates[0]);
        }
        
        // Vérifier que le centre est valide
        if (center && typeof center.lat === 'number' && typeof center.lng === 'number' &&
            !isNaN(center.lat) && !isNaN(center.lng)) {
          const tempCenterPoint = createControlPoint(center, '#059669');
          tempControlPointsGroup.value.addLayer(tempCenterPoint);
        }
      } catch (error) {
        console.warn('Erreur lors du calcul du centre temporaire du polygone', error);
      }
      PerformanceTracker.end('useMapDrawing.generateTempControlPoints.polygon.center');
      
      // Points de sommet temporaires (rouge pour harmonisation)
      PerformanceTracker.start('useMapDrawing.generateTempControlPoints.polygon.vertices');
      points.forEach(point => {
        const tempPoint = createControlPoint(point, '#DC2626');
        tempControlPointsGroup.value.addLayer(tempPoint);
      });
      PerformanceTracker.end('useMapDrawing.generateTempControlPoints.polygon.vertices');

      // Points milieux temporaires pour les segments
      PerformanceTracker.start('useMapDrawing.generateTempControlPoints.polygon.midpoints');
      for (let i = 0; i < points.length; i++) {
        const nextPoint = points[(i + 1) % points.length];
        const midPoint = getMidPoint(points[i], nextPoint);
        const tempMidPoint = createControlPoint(midPoint, '#2563EB');
        tempControlPointsGroup.value.addLayer(tempMidPoint);
      }
      PerformanceTracker.end('useMapDrawing.generateTempControlPoints.polygon.midpoints');
      PerformanceTracker.end('useMapDrawing.generateTempControlPoints.polygon');
    }

    console.log('[generateTempControlPoints] Points temporaires générés', {
      count: tempControlPointsGroup.value.getLayers().length
    });
    PerformanceTracker.end('useMapDrawing.generateTempControlPoints');
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
    controlPointsGroup,
    tempControlPointsGroup,
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