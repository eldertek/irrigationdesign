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
import { performanceMonitor } from '../utils/PerformanceMonitor';


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
        return layer.properties;
      } else if (layer instanceof L.Circle) {
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
            map.value?.pm.enableDraw('Rectangle', {
              finishOn: 'mouseup' as any,
              continueDrawing: false
            });

            // Intercepter l'événement de création du rectangle
            map.value.once('pm:create', (e: any) => {
              const layer = e.layer;
              // Supprimer le rectangle standard
              featureGroup.value?.removeLayer(layer);
              
              // Créer un TextRectangle à la place
              const textRect = new TextRectangle(
                layer.getBounds(),
                'Double-cliquez pour éditer',
                {
                  color: '#3388ff',
                  weight: 2,
                  fillColor: '#3388ff',
                  fillOpacity: 0.2
                }
              );
              
              featureGroup.value?.addLayer(textRect);
              selectedShape.value = textRect;
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
    console.log('[forceShapeUpdate] Début', {
      currentProperties: layer.properties,
      selectedShapeRef: selectedShape.value
    });

    // Réassigner directement selectedShape avec une nouvelle référence
    selectedShape.value = null; // Forcer un reset
    nextTick(() => {
      selectedShape.value = layer;
      console.log('[forceShapeUpdate] Après mise à jour', {
        selectedShape: selectedShape.value,
        properties: selectedShape.value.properties
      });
    });
  };

  const updateLayerProperties = (layer: L.Layer, shapeType: string) => {
    console.log('[updateLayerProperties] Début', {
      layer,
      shapeType,
      currentProperties: layer.properties
    });

    // Utiliser debouncedCalculateProperties au lieu de calculateShapeProperties directement
    const debouncedCalculateProperties = debounce((layer: L.Layer, shapeType: string) => {
      const newProperties = calculateShapeProperties(layer, shapeType);
      console.log('[updateLayerProperties] Nouvelles propriétés calculées', {
        newProperties
      });

      // Créer une nouvelle référence pour les propriétés
      layer.properties = { ...newProperties };
      
      // Forcer la mise à jour de la forme sélectionnée
      forceShapeUpdate(layer);
      
      // Émettre l'événement avec les nouvelles propriétés
      layer.fire('properties:updated', {
        shape: layer,
        properties: layer.properties
      });

      console.log('[updateLayerProperties] Fin', {
        finalProperties: layer.properties,
        selectedShape: selectedShape.value
      });
    }, 100); // Délai de 100ms

    debouncedCalculateProperties(layer, shapeType);
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
    performance.mark('updateLineControlPoints-start');
    
    if (!map.value || !featureGroup.value) return;

    clearActiveControlPoints();
    const points = layer.getLatLngs() as L.LatLng[];
    
    // Point central (vert) - Ajouter pour les lignes personnalisées
    if (layer instanceof Line) {
      performance.mark('getCenter-start');
      const center = layer.getCenter();
      performance.mark('getCenter-end');
      performance.measure('getCenter-in-updateLineControlPoints', 'getCenter-start', 'getCenter-end');
      
      const centerPoint = createControlPoint(center, '#059669');
      
      // Si la ligne est en mode déplacement de sommet, cacher le point central
      if (layer.shouldHideCenterPoint()) {
        centerPoint.setStyle({ opacity: 0, fillOpacity: 0 });
      }
      
      controlPointsGroup.value.addLayer(centerPoint);
      activeControlPoints.push(centerPoint);
      
      // Ajouter les mesures au point central
      addMeasureEvents(centerPoint, layer, () => {
        const totalLength = (layer as Line).properties.length || 0;
        return formatMeasure(totalLength, 'm', 'Longueur totale');
      });
      
      // Gestion du déplacement via le point central
      centerPoint.on('mousedown', (e: L.LeafletMouseEvent) => {
        if (!map.value) return;
        L.DomEvent.stopPropagation(e);
        map.value.dragging.disable();
        
        // Démarrer le monitoring des performances
        const observer = performanceMonitor.start();
        
        // Activer le mode d'optimisation pour la ligne
        if (layer instanceof Line) {
          layer.startVertexMove();
          
          // Cacher le point central (vert) pendant le déplacement
          activeControlPoints.forEach(cp => {
            if (cp.options && cp.options.color === '#059669') {
              cp.setStyle({ opacity: 0, fillOpacity: 0 });
            }
          });
        }
        
        let isDragging = true;
        const startPoint = e.latlng;
        // Sauvegarder les points originaux
        const originalLatLngs = [...(layer.getLatLngs() as L.LatLng[])];
        
        // Cacher tous les points de contrôle sauf le point central (index 0) pendant le déplacement
        activeControlPoints.forEach((point, index) => {
          if (index > 0) { // Ne pas cacher le point central
            point.setStyle({ opacity: 0, fillOpacity: 0 });
          }
        });
        
        const onMouseMove = (e: L.LeafletMouseEvent) => {
          if (!isDragging) return;
          
          // Incrémenter le compteur d'itérations pour le monitoring
          performanceMonitor.iteration();
          
          // Calculer le déplacement par rapport au point initial
          const dx = e.latlng.lng - startPoint.lng;
          const dy = e.latlng.lat - startPoint.lat;
          
          // Créer une nouvelle liste de points déplacés
          const newLatLngs = originalLatLngs.map(point => 
            L.latLng(
              point.lat + dy,
              point.lng + dx
            )
          );
          
          // Mettre à jour directement les positions sans utiliser move()
          L.Polyline.prototype.setLatLngs.call(layer, newLatLngs);
          
          // Mise à jour du centre (toujours instantanée)
          centerPoint.setLatLng(e.latlng);
          
          // Ne pas mettre à jour les autres points pendant le déplacement
        };
        
        const onMouseUp = () => {
          isDragging = false;
          if (!map.value) return;
          map.value.off('mousemove', onMouseMove);
          document.removeEventListener('mouseup', onMouseUp);
          map.value.dragging.enable();
          
          // Désactiver le mode d'optimisation et mettre à jour les propriétés
          if (layer instanceof Line) {
            layer.endVertexMove();
            
            // Réafficher le point central et mettre à jour sa position
            const newCenter = layer.getCenter();
            activeControlPoints.forEach(cp => {
              if (cp.options && cp.options.color === '#059669') {
                cp.setLatLng(newCenter);
                cp.setStyle({ opacity: 1, fillOpacity: 1 });
              }
            });
            
            updateLayerProperties(layer, 'Line');
          } else {
            // Mise à jour des propriétés à la fin de l'édition
            updateLayerProperties(layer, 'Line');
          }
          
          // Arrêter le monitoring des performances et afficher les résultats
          performanceMonitor.stop(observer);
          
          // Mise à jour de selectedShape pour déclencher la réactivité
          selectedShape.value = null; // Forcer un reset
          nextTick(() => {
            selectedShape.value = layer;
          });
        };
        
        map.value.on('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
      });
    }

    // Points d'extrémité (rouge)
    points.forEach((point, i) => {
      const pointMarker = createControlPoint(point, '#DC2626');
      activeControlPoints.push(pointMarker);

      // Ajouter les mesures aux points d'extrémité
      addMeasureEvents(pointMarker, layer, () => {
        let totalLength = 0;
        let distanceFromStart = 0;
        
        if (layer instanceof Line) {
          totalLength = layer.properties.length || 0;
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
        if (!map.value) return;
        L.DomEvent.stopPropagation(e);
        map.value.dragging.disable();
        
        // Démarrer le monitoring des performances
        const observer = performanceMonitor.start();
        
        // Activer le mode d'optimisation pour la ligne
        if (layer instanceof Line) {
          layer.startVertexMove();
          
          // Cacher le point central (vert) pendant le déplacement
          activeControlPoints.forEach(cp => {
            if (cp.options && cp.options.color === '#059669') {
              cp.setStyle({ opacity: 0, fillOpacity: 0 });
            }
          });
        }
        
        let isDragging = true;
        
        // Stocker les références aux points milieux adjacents
        // qui doivent être mis à jour pendant le déplacement
        const adjacentMidpointIndices: number[] = [];
        if (i > 0) adjacentMidpointIndices.push(i - 1); // Point milieu précédent
        if (i < points.length - 1) adjacentMidpointIndices.push(i); // Point milieu suivant
        
        const onMouseMove = (e: L.LeafletMouseEvent) => {
          if (!isDragging) return;
          
          // Incrémenter le compteur d'itérations pour le monitoring
          performanceMonitor.iteration();
          
          performance.mark('moveVertex-start');
          // Déplacer le vertex
          if (layer instanceof Line) {
            layer.moveVertex(i, e.latlng);
          } else {
            points[i] = e.latlng;
            layer.setLatLngs(points);
          }
          performance.mark('moveVertex-end');
          performance.measure('moveVertex', 'moveVertex-start', 'moveVertex-end');
          
          // Mettre à jour uniquement ce point marker
          pointMarker.setLatLng(e.latlng);
          
          performance.mark('updateMidPoints-start');
          // Mettre à jour uniquement les midpoints adjacents au point déplacé
          // plutôt que de tout recalculer
          if (layer instanceof Line) {
            const allMidPoints = layer.getMidPoints();
            
            // Mettre à jour uniquement les points milieux adjacents
            adjacentMidpointIndices.forEach(idx => {
              if (idx >= 0 && idx < allMidPoints.length && idx + points.length < activeControlPoints.length) {
                const midPointMarker = activeControlPoints[points.length + idx];
                midPointMarker.setLatLng(allMidPoints[idx]);
              }
            });
          } else {
            // Mise à jour pour les polylignes standard
            adjacentMidpointIndices.forEach(idx => {
              if (idx >= 0 && idx < points.length - 1 && idx + points.length < activeControlPoints.length) {
                const p1 = (layer.getLatLngs() as L.LatLng[])[idx];
                const p2 = (layer.getLatLngs() as L.LatLng[])[idx + 1];
                const midPoint = L.latLng((p1.lat + p2.lat) / 2, (p1.lng + p2.lng) / 2);
                activeControlPoints[points.length + idx].setLatLng(midPoint);
              }
            });
          }
          performance.mark('updateMidPoints-end');
          performance.measure('updateMidPoints', 'updateMidPoints-start', 'updateMidPoints-end');
        };
        
        const onMouseUp = () => {
          isDragging = false;
          if (!map.value) return;
          map.value.off('mousemove', onMouseMove);
          document.removeEventListener('mouseup', onMouseUp);
          map.value.dragging.enable();
          
          // Désactiver le mode d'optimisation et mettre à jour les propriétés
          if (layer instanceof Line) {
            layer.endVertexMove();
            
            // Réafficher le point central et mettre à jour sa position
            const newCenter = layer.getCenter();
            activeControlPoints.forEach(cp => {
              if (cp.options && cp.options.color === '#059669') {
                cp.setLatLng(newCenter);
                cp.setStyle({ opacity: 1, fillOpacity: 1 });
              }
            });
            
            updateLayerProperties(layer, 'Line');
          } else {
            // Mise à jour des propriétés à la fin de l'édition
            updateLayerProperties(layer, 'Line');
          }
          
          // Arrêter le monitoring des performances et afficher les résultats
          performanceMonitor.stop(observer);
          
          // Mise à jour de selectedShape pour déclencher la réactivité
          selectedShape.value = null; // Forcer un reset
          nextTick(() => {
            selectedShape.value = layer;
          });
        };
        
        map.value.on('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
      });
    });

    // Fonction pour mettre à jour les positions des vertex et midpoints

    // Points milieux (bleu)
    const updateMidPoints = () => {
      performance.mark('updateMidPoints-start');
      
      // Vérifier si on est en mode déplacement d'un vertex et si la ligne est une instance de Line
      if (layer instanceof Line && layer['_isMovingVertex']) {
        // Si on est en déplacement, la mise à jour est gérée dans onMouseMove
        // Ne pas recréer tous les points milieux
        performance.mark('updateMidPoints-end');
        performance.measure('updateMidPoints-skipped', 'updateMidPoints-start', 'updateMidPoints-end');
        return;
      }
      
      // Récupérer les points à jour
      const currentPoints = layer.getLatLngs() as L.LatLng[];
      
      // Supprimer les anciens points milieux
      const vertexCount = layer instanceof Line ? currentPoints.length + 1 : currentPoints.length;
      activeControlPoints.slice(vertexCount).forEach(point => {
        if (point && typeof point.remove === 'function') {
          controlPointsGroup.value?.removeLayer(point);
        }
      });
      activeControlPoints = activeControlPoints.slice(0, vertexCount);

      // Créer les nouveaux points milieux
      const midPoints = layer instanceof Line ? 
        (layer as Line).getMidPoints() : 
        Array.from({length: currentPoints.length - 1}, (_, i) => {
          const p1 = currentPoints[i];
          const p2 = currentPoints[i + 1];
          return L.latLng((p1.lat + p2.lat) / 2, (p1.lng + p2.lng) / 2);
        });
      
      midPoints.forEach((midPoint, i) => {
        const midPointMarker = createControlPoint(midPoint, '#2563EB');
        activeControlPoints.push(midPointMarker);

        // Ajouter les mesures aux points milieux
        addMeasureEvents(midPointMarker, layer, () => {
          let segmentLength = 0;
          let totalLength = 0;
          let distanceFromStart = 0;

          if (layer instanceof Line) {
            const segmentLengths = (layer as Line).getSegmentLengths();
            segmentLength = segmentLengths[i];
            totalLength = (layer as Line).properties.length || 0;
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
          if (!map.value) return;
          L.DomEvent.stopPropagation(e);
          map.value.dragging.disable();

          let isDragging = true;
          
          const onMouseMove = (e: L.LeafletMouseEvent) => {
            if (!isDragging) return;
            // Insérer un nouveau point
            if (layer instanceof Line) {
              layer.addVertex(i, e.latlng);
            } else {
              const current = currentPoints.slice();
              current.splice(i + 1, 0, e.latlng);
              layer.setLatLngs(current);
            }
            
            // Réinitialiser complètement les points de contrôle
            updateLineControlPoints(layer);
            isDragging = false;  // Arrêter le glisser-déposer après insertion
          };
          
          const onMouseUp = () => {
            isDragging = false;
            if (!map.value) return;
            map.value.off('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);
            map.value.dragging.enable();
            
            // Mise à jour des propriétés à la fin de l'édition
            if (layer instanceof Line) {
              layer.updateProperties();
              // Ajouter cet appel pour mettre à jour les propriétés de la couche
              updateLayerProperties(layer, 'Line');
            }
            
            // Mise à jour de selectedShape pour déclencher la réactivité
            selectedShape.value = null; // Forcer un reset
            nextTick(() => {
              selectedShape.value = layer;
            });
          };
          
          map.value.on('mousemove', onMouseMove);
          document.addEventListener('mouseup', onMouseUp);
        });
      });
      performance.mark('updateMidPoints-end');
      performance.measure('updateMidPoints', 'updateMidPoints-start', 'updateMidPoints-end');
    };

    updateMidPoints();
    
    performance.mark('updateLineControlPoints-end');
    performance.measure('updateLineControlPoints', 'updateLineControlPoints-start', 'updateLineControlPoints-end');
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

    // Points de sommet (rouge pour harmonisation)
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
        
        // Gestion de l'ajout de vertex
        midPointMarker.on('mousedown', (e: L.LeafletMouseEvent) => {
          if (!map.value) return;
          L.DomEvent.stopPropagation(e);
          map.value.dragging.disable();

          let isDragging = true;
          
          const onMouseMove = (e: L.LeafletMouseEvent) => {
            if (!isDragging) return;
            // Insérer un nouveau point
            points.splice((i + 1) % points.length, 0, e.latlng);
            layer.setLatLngs([points]);
            
            // Réinitialiser complètement les points de contrôle
            updatePolygonControlPoints(layer);
            isDragging = false;  // Arrêter le glisser-déposer après insertion
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
    if (!map.value || !tempControlPointsGroup.value) return;

    console.log('[generateTempControlPoints] Génération des points temporaires pour', {
      layerType: layer.constructor.name,
      properties: layer.properties
    });

    // Supprimer les points temporaires existants
    tempControlPointsGroup.value.clearLayers();

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
        
        // Si la ligne est en mode déplacement de sommet, ne pas afficher le point central
        if ((layer as Line).shouldHideCenterPoint()) {
          tempCenterPoint.setStyle({ opacity: 0, fillOpacity: 0 });
        }
        
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
      const points = (layer.getLatLngs()[0] as L.LatLng[]);
      
      // Points de sommet temporaires (rouge pour harmonisation)
      points.forEach(point => {
        const tempPoint = createControlPoint(point, '#DC2626');
        tempControlPointsGroup.value.addLayer(tempPoint);
      });

      // Points milieux temporaires pour les segments
      for (let i = 0; i < points.length; i++) {
        const nextPoint = points[(i + 1) % points.length];
        const midPoint = getMidPoint(points[i], nextPoint);
        const tempMidPoint = createControlPoint(midPoint, '#2563EB');
        tempControlPointsGroup.value.addLayer(tempMidPoint);
      }
    }

    console.log('[generateTempControlPoints] Points temporaires générés', {
      count: tempControlPointsGroup.value.getLayers().length
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