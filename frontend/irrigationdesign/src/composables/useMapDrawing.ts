import { ref, onUnmounted, nextTick, type Ref } from 'vue';
import L from 'leaflet';
import '@geoman-io/leaflet-geoman-free';
import { CircleArc } from '../utils/CircleArc';
import { Circle } from '../utils/Circle';
import { Rectangle } from '../utils/Rectangle';
import { TextRectangle } from '../utils/TextRectangle';
import { Line } from '../utils/Line';
import { Polygon } from '../utils/Polygon';
import { ElevationLine } from '../utils/ElevationLine';
import type { TextStyle, TextMarker } from '../types/leaflet';
import type { DrawableLayer } from '../types/drawing';
import * as turf from '@turf/turf';
import centroid from '@turf/centroid';
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
  // Ajouter l'écouteur d'événement pour le nettoyage
  window.addEventListener('clearControlPoints', () => {
    // Désélectionner la forme active
    selectedShape.value = null;
    // Nettoyer les points de contrôle
    if (controlPointsGroup.value) {
      controlPointsGroup.value.clearLayers();
    }
    if (tempControlPointsGroup.value) {
      tempControlPointsGroup.value.clearLayers();
    }
    // Supprimer tous les tooltips de mesure
    document.querySelectorAll('.measure-tooltip').forEach(el => el.remove());
    // Supprimer tous les messages d'aide
    document.querySelectorAll('.drawing-help-message').forEach(el => el.remove());
  });
  // Nettoyer l'écouteur lors du démontage
  onUnmounted(() => {
    window.removeEventListener('clearControlPoints', () => {});
    if (map.value) {
      map.value.remove();
      map.value = null;
    }
  });
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
    console.log('Input layer:', {
      type,
      instanceof: {
        Circle: layer instanceof L.Circle,
        Rectangle: layer instanceof L.Rectangle,
        Polygon: layer instanceof L.Polygon,
        Polyline: layer instanceof L.Polyline,
        CircleArc: layer instanceof CircleArc,
        TextRectangle: layer instanceof TextRectangle,
        ElevationLine: layer instanceof ElevationLine,
        Line: layer instanceof Line
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
      }
      else if (layer instanceof L.Polyline && !(layer instanceof L.Polygon)) {
        // Vérifier d'abord si c'est un ElevationLine
        if (layer instanceof ElevationLine) {
          // Conserver le type ElevationLine et ses propriétés spécifiques
          layer.updateProperties();
          Object.assign(properties, {
            ...layer.properties,
            type: 'ElevationLine'
          });
          console.log('[calculateShapeProperties] ElevationLine properties:', properties);
        } else if (layer instanceof Line) {
          // Si c'est notre classe Line personnalisée
          layer.updateProperties();
          // Utiliser les propriétés calculées par la classe
          Object.assign(properties, {
            ...layer.properties,
            type: 'Line'
          });
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
          properties.type = 'Line';
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

      // Émettre un événement pour notifier la création
      window.dispatchEvent(new CustomEvent('shape:created', {
        detail: {
          shape: layer,
          type: shapeType,
          properties: layer.properties
        }
      }));

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
        // Convertir en notre Polygon personnalisé
        const latLngs = layer.getLatLngs()[0] as L.LatLngExpression[];
        const polygon = new Polygon([latLngs], {
          ...layer.options
        });
        polygon.updateProperties();
        featureGroup.value?.removeLayer(layer);
        featureGroup.value?.addLayer(polygon);
        selectedShape.value = polygon;
        updatePolygonControlPoints(polygon);
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
      // Nettoyer les points temporaires et les points de contrôle existants
      tempControlPointsGroup.value?.clearLayers();
      clearActiveControlPoints();
      document.querySelector('.drawing-help-message')?.remove();
      // Mettre à jour la forme sélectionnée
      selectedShape.value = layer;
      if (layer instanceof TextRectangle) {
        console.log('[featureGroup click] TextRectangle sélectionné', {
          id: (layer as any)._leaflet_id,
          bounds: layer.getBounds(),
          hasTextContainer: !!layer.getTextElement(),
          properties: layer.properties
        });
        // Désactiver le mode d'édition Geoman si actif
        if (map.value?.pm.globalEditModeEnabled()) {
          map.value.pm.disableGlobalEditMode();
        }
        // Ajouter les points de contrôle
        updateTextRectangleControlPoints(layer);
        showHelpMessage('Double-cliquez pour éditer le texte. Utilisez les points rouges pour redimensionner.');
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
    // Désélectionner la forme et ses points de contrôle lors du zoom/dézoom
    mapInstance.on('zoomstart', () => {
      if (selectedShape.value) {
        clearActiveControlPoints();
        selectedShape.value = null;
        document.querySelectorAll('.drawing-help-message').forEach(msg => msg.remove());
      }
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
    // Désactiver tous les modes et nettoyer les points de contrôle
    try {
      const pm = map.value.pm;
      if (pm.globalEditModeEnabled()) {
        pm.disableGlobalEditMode();
      }
      if (pm.globalRemovalModeEnabled()) {
        pm.disableGlobalRemovalMode();
      }
      pm.disableDraw();
      clearActiveControlPoints();
      tempControlPointsGroup.value?.clearLayers();
    } catch (error) {
      console.error('Error disabling modes:', error);
    }
    currentTool.value = tool;
    // Si aucun outil n'est sélectionné
    if (!tool) {
      clearActiveControlPoints();
      return;
    }
    // Attendre un court instant avant d'afficher le nouveau message
    setTimeout(() => {
      try {
        switch (tool) {
          case 'Circle':
          case 'Semicircle':
            // Identifier tous les rectangles dans featureGroup
            const rectangles = featureGroup.value?.getLayers().filter((layer: DrawableLayer) => 
              layer instanceof Rectangle || layer instanceof TextRectangle
            );
            if (rectangles && rectangles.length > 0) {
              // Pour chaque rectangle, ajouter des points de contrôle temporaires
              rectangles.forEach((rect: DrawableLayer) => {
                if (!rect.getBounds) return;
                // Points des sommets (rouge)
                const bounds = rect.getBounds();
                const corners = [
                  bounds.getNorthWest(),
                  bounds.getNorthEast(),
                  bounds.getSouthEast(),
                  bounds.getSouthWest()
                ];
                corners.forEach(corner => {
                  const cornerMarker = L.circleMarker(corner, {
                    radius: 4,
                    color: '#DC2626', // Rouge
                    fillColor: '#DC2626',
                    fillOpacity: 0.4,
                    weight: 2,
                    className: 'temp-corner-marker',
                    pmIgnore: true
                  });
                  tempControlPointsGroup.value?.addLayer(cornerMarker);
                });
                // Points milieux (bleu)
                const midPoints = rect instanceof Rectangle ? 
                  rect.getMidPoints() : 
                  [
                    L.latLng((bounds.getNorth() + bounds.getSouth()) / 2, bounds.getWest()),
                    L.latLng(bounds.getNorth(), (bounds.getEast() + bounds.getWest()) / 2),
                    L.latLng((bounds.getNorth() + bounds.getSouth()) / 2, bounds.getEast()),
                    L.latLng(bounds.getSouth(), (bounds.getEast() + bounds.getWest()) / 2)
                  ];
                midPoints.forEach(midPoint => {
                  const midMarker = L.circleMarker(midPoint, {
                    radius: 5,
                    color: '#2563EB', // Bleu
                    fillColor: '#2563EB',
                    fillOpacity: 0.6,
                    weight: 2,
                    className: 'temp-midpoint-marker',
                    pmIgnore: true
                  });
                  tempControlPointsGroup.value?.addLayer(midMarker);
                });
                // Point central (vert)
                const center = bounds.getCenter();
                const centerMarker = L.circleMarker(center, {
                  radius: 4,
                  color: '#059669', // Vert
                  fillColor: '#059669',
                  fillOpacity: 0.4,
                  weight: 2,
                  className: 'temp-center-marker',
                  pmIgnore: true
                });
                tempControlPointsGroup.value?.addLayer(centerMarker);
              });
            }
            // Configurer le snapping
            map.value.pm.setGlobalOptions({
              snapDistance: 20,
              snapSegment: true,
              snapLayers: [featureGroup.value, tempControlPointsGroup.value]
            } as any);
            showHelpMessage(
              tool === 'Circle' 
                ? 'Positionnez le centre du cercle. Points bleus : milieu des côtés, Points rouges : sommets, Point vert : centre'
                : 'Positionnez le centre du demi-cercle. Points bleus : milieu des côtés, Points rouges : sommets, Point vert : centre'
            );
            map.value.pm.enableDraw('Circle', {
              finishOn: 'mouseup',
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
          case 'delete':
            showHelpMessage('Cliquez sur une forme pour la supprimer');
            map.value?.pm.enableGlobalRemovalMode();
            break;
          case 'TextRectangle':
            showHelpMessage('Cliquez et maintenez pour dessiner un rectangle avec texte, relâchez pour terminer');
            // Désactiver tout mode d'édition actif
            if (map.value?.pm.globalEditModeEnabled()) {
              map.value.pm.disableGlobalEditMode();
            }
            // Configurer le mode dessin avec des styles spécifiques
            map.value?.pm.enableDraw('Rectangle', {
              finishOn: 'mouseup' as any,
              continueDrawing: false,
              templineStyle: {
                color: '#3B82F6',
                weight: 2,
                dashArray: '5,5'
              }
            });
            // Supprimer l'ancien gestionnaire d'événements s'il existe
            map.value?.off('pm:create');
            // Ajouter le nouveau gestionnaire
            map.value?.on('pm:create', (e: any) => {
              if (e.shape === 'Rectangle' && e.layer) {
                const bounds = e.layer.getBounds();
                // Vérifier s'il existe déjà un TextRectangle avec les mêmes limites
                let duplicateFound = false;
                if (featureGroup.value) {
                  featureGroup.value.eachLayer((layer: any) => {
                    if (layer instanceof TextRectangle) {
                      const existingBounds = layer.getBounds();
                      const tolerance = 1e-8;
                      if (
                        Math.abs(existingBounds.getNorth() - bounds.getNorth()) < tolerance &&
                        Math.abs(existingBounds.getSouth() - bounds.getSouth()) < tolerance &&
                        Math.abs(existingBounds.getEast() - bounds.getEast()) < tolerance &&
                        Math.abs(existingBounds.getWest() - bounds.getWest()) < tolerance
                      ) {
                        duplicateFound = true;
                        selectedShape.value = layer;
                        console.log('[TextRectangle] Rectangle existant trouvé, sélection au lieu de création');
                      }
                    }
                  });
                }
                if (!duplicateFound) {
                  // Supprimer immédiatement le rectangle temporaire
                  map.value?.removeLayer(e.layer);
                  if (featureGroup.value?.hasLayer(e.layer)) {
                    featureGroup.value.removeLayer(e.layer);
                  }
                  // Créer un nouveau TextRectangle avec des options par défaut
                  const rect = new TextRectangle(bounds, 'Double-cliquez pour éditer', {
                    color: '#3B82F6',
                    weight: 2,
                    fillColor: '#F9FAFB',
                    fillOpacity: 0.8,
                    textColor: '#000000',
                    fontFamily: 'Arial, sans-serif',
                    textAlign: 'center',
                    bold: false,
                    italic: false
                  });
                  // Ajouter le TextRectangle au groupe de fonctionnalités
                  if (featureGroup.value) {
                    featureGroup.value.addLayer(rect);
                    selectedShape.value = rect;
                    rect.updateProperties();
                    // Ajouter les points de contrôle immédiatement
                    updateTextRectangleControlPoints(rect);
                    console.log('[TextRectangle] Nouveau rectangle créé avec succès', {
                      bounds: rect.getBounds(),
                      properties: rect.properties,
                      style: rect.properties.style
                    });
                  }
                }
                // Désactiver le mode dessin
                map.value?.pm.disableDraw();
              }
            });
            break;
          case 'ElevationLine':
            showHelpMessage('Cliquez et maintenez pour tracer le profil altimétrique');
            map.value?.pm.enableDraw('Line', {
              finishOn: 'mouseup',
              continueDrawing: false, // Désactiver la continuation
              allowSelfIntersection: false,
              templineStyle: {
                color: '#FF4500',
                weight: 4,
                opacity: 0.8
              }
            });

            // Désactiver explicitement la continuation après le dessin
            map.value?.pm.setGlobalOptions({
              continueDrawing: false,
              finishOn: 'mouseup'
            } as any);

            // Supprimer l'ancien gestionnaire d'événements s'il existe
            map.value?.off('pm:create');
            // Ajouter le nouveau gestionnaire
            map.value?.on('pm:create', async (e: any) => {
              if (e.shape === 'Line' && e.layer) {
                const latLngs = e.layer.getLatLngs();
                // Supprimer la ligne temporaire
                map.value?.removeLayer(e.layer);
                if (featureGroup.value?.hasLayer(e.layer)) {
                  featureGroup.value.removeLayer(e.layer);
                }

                // Créer une nouvelle ligne d'élévation
                const elevationLine = new ElevationLine(latLngs, {
                  color: '#FF4500',
                  weight: 4,
                  opacity: 0.8
                });

                // Ajouter la ligne au groupe de fonctionnalités
                if (featureGroup.value) {
                  featureGroup.value.addLayer(elevationLine);
                  selectedShape.value = elevationLine;
                  // Initialiser le profil d'élévation
                  await elevationLine.updateElevationProfile();
                  // Ajouter les points de contrôle
                  updateLineControlPoints(elevationLine);
                }

                // Désactiver le mode dessin et réinitialiser l'outil
                map.value?.pm.disableDraw();
                currentTool.value = '';
              }
            });
            break;
        }
      } catch (error) {
        console.error('Error enabling tool:', error);
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
    layer.on('circle:resized', () => {
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
        });
      };
      map.value.on('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);
    });
  };
  // Fonction pour mettre à jour les points de contrôle d'une ligne
  const updateLineControlPoints = (layer: L.Polyline) => {
    if (!map.value || !featureGroup.value) {
      return;
    }
    clearActiveControlPoints();
    const points = layer.getLatLngs() as L.LatLng[];
    // Point central (vert) - Ajouter pour les lignes personnalisées
    let centerPoint: ControlPoint | null = null;
    if (layer instanceof Line) {
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
        if (!map.value) {
          return;
        }
        L.DomEvent.stopPropagation(e);
        map.value.dragging.disable();
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
          if (!isDragging) {
            return;
          }
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
          centerPoint?.setLatLng(e.latlng);
        };
        const onMouseUp = () => {
          isDragging = false;
          if (!map.value) {
            return;
          }
          map.value.off('mousemove', onMouseMove);
          document.removeEventListener('mouseup', onMouseUp);
          map.value.dragging.enable();
          // Supprimer complètement les points de contrôle et les recréer
          // pour éviter les problèmes de synchronisation
          clearActiveControlPoints();
          // Recréer tous les points de contrôle avec leurs positions correctes
          updateLineControlPoints(layer);
          // Mettre à jour les propriétés UNIQUEMENT à la fin du déplacement
          if (layer instanceof Line) {
            layer.updateProperties();
            // Ajouter cet appel pour mettre à jour les propriétés de la couche
            updateLayerProperties(layer, 'Line');
          }
          // Mise à jour de selectedShape pour déclencher la réactivité
          selectedShape.value = layer;
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
        if (!map.value) {
          return;
        }
        L.DomEvent.stopPropagation(e);
        map.value.dragging.disable();
        let isDragging = true;
        // Cacher le point central (vert) pendant le redimensionnement
        if (centerPoint) {
          centerPoint.setStyle({ opacity: 0, fillOpacity: 0 });
          if (centerPoint.measureDiv) {
            centerPoint.measureDiv.style.display = 'none';
          }
        }
        // Stocker les midpoints affectés par le déplacement de ce vertex
        const affectedMidPoints: number[] = [];
        if (i > 0) affectedMidPoints.push(i - 1);  // Midpoint précédent
        if (i < points.length - 1) affectedMidPoints.push(i);  // Midpoint suivant
        // Stocker les points de contrôle des midpoints affectés
        const midPointControlIndices = affectedMidPoints.map(idx => points.length + idx);
        const onMouseMove = (e: L.LeafletMouseEvent) => {
          if (!isDragging) {
            return;
          }
          // Déplacer le vertex sans mettre à jour les propriétés
          if (layer instanceof Line) {
            layer.moveVertex(i, e.latlng, false);  // Pas de mise à jour des propriétés pendant le drag
          } else {
            points[i] = e.latlng;
            layer.setLatLngs(points);
          }
          // Mettre à jour uniquement ce point marker de manière fiable
          pointMarker.setLatLng(e.latlng);
          // Mettre à jour uniquement les midpoints affectés
          updateAffectedMidPoints(affectedMidPoints, midPointControlIndices);
        };
        const onMouseUp = () => {
          isDragging = false;
          if (!map.value) {
            return;
          }
          map.value.off('mousemove', onMouseMove);
          document.removeEventListener('mouseup', onMouseUp);
          map.value.dragging.enable();
          // Mise à jour des propriétés à la fin de l'édition
          if (layer instanceof Line) {
            layer.updateProperties();
            updateLayerProperties(layer, 'Line');
          }
          // Faire réapparaître le point central avec sa position mise à jour
          if (centerPoint && layer instanceof Line) {
            const newCenter = layer.getCenter();
            centerPoint.setLatLng(newCenter);
            centerPoint.setStyle({ opacity: 1, fillOpacity: 1 });
            if (centerPoint.measureDiv) {
              centerPoint.measureDiv.style.display = '';
            }
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
    // Optimiser la mise à jour des midpoints
    // Points milieux (bleu)
    const updateMidPoints = () => {
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
          if (!map.value) {
            return;
          }
          L.DomEvent.stopPropagation(e);
          map.value.dragging.disable();
          let isDragging = true;
          const currentSegmentIndex = i;
          const currentPoints = layer.getLatLngs() as L.LatLng[];
          // Cacher le point central (vert) pendant l'opération d'ajout de vertex
          const centerControlPoint = activeControlPoints.find(cp => 
            cp.options && cp.options.color === '#059669'
          ) as ControlPoint | undefined;
          if (centerControlPoint) {
            centerControlPoint.setStyle({ opacity: 0, fillOpacity: 0 });
            if (centerControlPoint.measureDiv) {
              centerControlPoint.measureDiv.style.display = 'none';
            }
          }
          const onMouseMove = (e: L.LeafletMouseEvent) => {
            if (!isDragging) {
              return;
            }
            // Insérer un nouveau point sans mettre à jour les propriétés
            if (layer instanceof Line) {
              layer.addVertex(currentSegmentIndex, e.latlng, false);  // Pas de mise à jour des propriétés pendant le drag
            } else {
              const current = currentPoints.slice();
              current.splice(currentSegmentIndex + 1, 0, e.latlng);
              layer.setLatLngs(current);
            }
            // Réinitialiser complètement les points de contrôle
            clearActiveControlPoints();
            updateLineControlPoints(layer);
            // Simuler un mouseUp pour nettoyer proprement les écouteurs
            onMouseUp();
          };
          const onMouseUp = () => {
            isDragging = false;
            if (!map.value) {
              return;
            }
            map.value.off('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);
            map.value.dragging.enable();
            // Mise à jour des propriétés à la fin de l'édition
            if (layer instanceof Line) {
              layer.updateProperties();
              // Ajouter cet appel pour mettre à jour les propriétés de la couche
              updateLayerProperties(layer, 'Line');
            }
            // Le point central sera automatiquement recréé avec la bonne visibilité
            // lors de l'appel à updateLineControlPoints dans onMouseMove
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
    };
    // Fonction pour mettre à jour uniquement les midpoints affectés par le déplacement d'un vertex
    const updateAffectedMidPoints = (segmentIndices: number[], controlPointIndices: number[]) => {
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
    };
    updateMidPoints();

    // Gestion spécifique pour ElevationLine
    if (layer instanceof ElevationLine) {
      // Force la mise à jour du profil après toute modification
      layer.updateElevationProfile().then(() => {
        console.log('[useMapDrawing] ElevationLine properties updated:', {
          length: layer.properties.length,
          elevationData: layer.getElevationData()
        });
      });

      // Ajouter les mesures d'élévation aux points de contrôle
      activeControlPoints.forEach((point, index) => {
        const elevationData = layer.getElevationData();
        if (elevationData[index]) {
          addMeasureEvents(point as ControlPoint, layer, () => {
            const data = elevationData[index];
            return [
              formatMeasure(data.distance, 'm', 'Distance'),
              formatMeasure(data.elevation, 'm', 'Altitude'),
              formatMeasure(layer.properties.elevationGain, 'm', 'Dénivelé +'),
              formatMeasure(layer.properties.elevationLoss, 'm', 'Dénivelé -')
            ].join('<br>');
          });

          // Modifier le comportement des points de contrôle pour ElevationLine
          point.on('mousedown', (e: L.LeafletMouseEvent) => {
            if (!map.value) return;
            L.DomEvent.stopPropagation(e);
            map.value.dragging.disable();

            const onMouseMove = (e: L.LeafletMouseEvent) => {
              // Utiliser la méthode spécifique d'ElevationLine pour le déplacement
              layer.moveVertex(index, e.latlng, false);
              // Mettre à jour la position du point de contrôle
              point.setLatLng(e.latlng);
            };

            const onMouseUp = () => {
              if (!map.value) return;
              map.value.off('mousemove', onMouseMove);
              document.removeEventListener('mouseup', onMouseUp);
              map.value.dragging.enable();

              // S'assurer que c'est toujours une ElevationLine
              if (layer instanceof ElevationLine) {
                layer.updateElevationProfile();
                // Forcer la mise à jour des propriétés
                selectedShape.value = null;
                nextTick(() => {
                  selectedShape.value = layer;
                });
              }
            };

            map.value.on('mousemove', onMouseMove);
            document.addEventListener('mouseup', onMouseUp);
          });
        }
      });

      // Écouter les événements de mise à jour du profil
      layer.on('elevation:updated', () => {
        // Mettre à jour les mesures affichées
        activeControlPoints.forEach((point, index) => {
          const elevationData = layer.getElevationData();
          if (elevationData[index] && (point as any).measureDiv) {
            const data = elevationData[index];
            (point as any).measureDiv.innerHTML = [
              formatMeasure(data.distance, 'm', 'Distance'),
              formatMeasure(data.elevation, 'm', 'Altitude'),
              formatMeasure(layer.properties.elevationGain, 'm', 'Dénivelé +'),
              formatMeasure(layer.properties.elevationLoss, 'm', 'Dénivelé -')
            ].join('<br>');
          }
        });
      });

      // Désactiver l'ajout de points intermédiaires pour ElevationLine
      if (map.value) {
        map.value.pm.setGlobalOptions({
          preventMarkerRemoval: true,
          preventVertexEdit: true
        } as any);
      }
    }
  };
  // Mettre à jour la fonction updatePolygonControlPoints pour ajouter plus de mesures
  const updatePolygonControlPoints = (layer: L.Polygon) => {
    if (!map.value || !featureGroup.value) {
      return;
    }
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
    // Point central (vert)
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
    // Ajouter les mesures au point central
    addMeasureEvents(centerPoint, layer, () => {
      return [
        formatMeasure(perimeter, 'm', 'Périmètre'),
        formatMeasure(area, 'm²', 'Surface')
      ].join('<br>');
    });
    // Gestion du déplacement via le point central
    centerPoint.on('mousedown', (e: L.LeafletMouseEvent) => {
      if (!map.value) {
        return;
      }
      L.DomEvent.stopPropagation(e);
      map.value.dragging.disable();
      let isDragging = true;
      const startPoint = e.latlng;
      // Sauvegarder les points originaux
      const originalPoints = [...points];
      // Cacher tous les points de contrôle sauf le point central pendant le déplacement
      activeControlPoints.forEach((point, index) => {
        if (index > 0) { // Ne pas cacher le point central
          point.setStyle({ opacity: 0, fillOpacity: 0 });
        }
      });
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
        if (!isDragging) {
          return;
        }
        // Utiliser la version throttlée
        throttledMove(e);
      };
      const onMouseUp = () => {
        isDragging = false;
        if (!map.value) {
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
      };
      map.value.on('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);
    });
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
        if (!map.value) {
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
          if (!isDragging) {
            return;
          }
          // Utiliser la version throttlée
          throttledDrag(e);
        };
        const onMouseUp = () => {
          isDragging = false;
          if (!map.value) {
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
        };
        map.value.on('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
      });
    });
    // Points milieux (bleu)
    const updateMidPoints = () => {
      const points = (layer.getLatLngs()[0] as L.LatLng[]);
      // Supprimer les anciens points milieux
      activeControlPoints.slice(points.length + 1).forEach(point => {  // +1 pour le point central
        if (controlPointsGroup.value) {
          controlPointsGroup.value.removeLayer(point);
        }
      });
      activeControlPoints = activeControlPoints.slice(0, points.length + 1);  // +1 pour le point central
      // Créer tous les points milieux d'un coup pour améliorer les performances
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
          if (!map.value) {
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
              if (!isDragging) {
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
          };
          const onMouseUp = () => {
            isDragging = false;
              if (!map.value) {
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
          };
          map.value.on('mousemove', onMouseMove);
          document.addEventListener('mouseup', onMouseUp);
          } else {
            // Si on n'a pas trouvé le point (cas d'erreur), on nettoie
            map.value.dragging.enable();
            clearActiveControlPoints();
            updatePolygonControlPoints(layer);
          }
        });
      });
    };
    updateMidPoints();
  };
  // Fonction pour mettre à jour les points de contrôle d'un demi-cercle
  const updateSemicircleControlPoints = (layer: CircleArc) => {
    if (!map.value || !featureGroup.value) return;
    clearActiveControlPoints();
    const center = layer.getCenter();
    const startAngle = layer.getStartAngle();
    const stopAngle = layer.getStopAngle();
    const openingAngle = layer.getOpeningAngle();

    // Points de contrôle des angles (rouges)
    const startPoint = layer.calculatePointOnArc(startAngle);
    const stopPoint = layer.calculatePointOnArc(stopAngle);
    const startControl = createControlPoint(startPoint, '#DC2626');
    const stopControl = createControlPoint(stopPoint, '#DC2626');
    activeControlPoints.push(startControl, stopControl);

    // Point central (vert)
    const centerPoint = createControlPoint(center, '#059669');
    activeControlPoints.push(centerPoint);

    // Point de contrôle du rayon au milieu de l'arc (bleu)
    let radiusControl: L.CircleMarker | null = null;
    if (openingAngle > 5) {
      const midPoint = layer.calculateMidpointPosition();
      radiusControl = createControlPoint(midPoint, '#2563EB');
      activeControlPoints.push(radiusControl);

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
          radiusControl?.setLatLng(newMidPoint);

          // Forcer la mise à jour des propriétés pendant le déplacement
          layer.updateProperties();
          selectedShape.value = layer;
        };

        const onMouseUp = () => {
          isDragging = false;
          if (!map.value) return;
          map.value.off('mousemove', onMouseMove);
          document.removeEventListener('mouseup', onMouseUp);
          map.value.dragging.enable();

          // Forcer la mise à jour des propriétés à la fin du redimensionnement
          layer.updateProperties();
          selectedShape.value = null;
          nextTick(() => {
            selectedShape.value = layer;
          });
          // Mettre à jour les propriétés via la méthode globale
          updateLayerProperties(layer, 'Semicircle');
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

        const onMouseMove = (e: L.LeafletMouseEvent) => {
          if (!isDragging || !map.value) return;

          // Calculer l'angle en degrés entre le centre et la position de la souris
          const dx = e.latlng.lng - center.lng;
          const dy = e.latlng.lat - center.lat;
          let newAngle = (Math.atan2(dy, dx) * 180 / Math.PI + 360) % 360;

          // Mise à jour des angles selon le point déplacé
          if (index === 0) {
            layer.setAngles(newAngle, layer.getStopAngle());
          } else {
            layer.setAngles(layer.getStartAngle(), newAngle);
          }

          // Recalculer les positions des points de contrôle
          const updatedStartAngle = layer.getStartAngle();
          const updatedStopAngle = layer.getStopAngle();
          const updatedOpeningAngle = layer.getOpeningAngle();

          // Calculer les nouvelles positions des points de contrôle
          const newStartPoint = layer.calculatePointOnArc(updatedStartAngle);
          const newStopPoint = layer.calculatePointOnArc(updatedStopAngle);

          // Mettre à jour les positions des points de contrôle
          startControl.setLatLng(newStartPoint);
          stopControl.setLatLng(newStopPoint);

          // Maintenir visible et mettre à jour le point bleu en temps réel
          if (radiusControl && updatedOpeningAngle > 5) {
            const newMidPoint = layer.calculateMidpointPosition();
            radiusControl.setLatLng(newMidPoint);
            radiusControl.setStyle({ opacity: 1, fillOpacity: 1 });
          } else if (radiusControl) {
            radiusControl.setStyle({ opacity: 0, fillOpacity: 0 });
          }

          // Forcer la mise à jour des propriétés pendant le déplacement
          layer.updateProperties();
          selectedShape.value = layer;
        };

        const onMouseUp = () => {
          isDragging = false;
          if (!map.value) return;
          map.value.off('mousemove', onMouseMove);
          document.removeEventListener('mouseup', onMouseUp);
          map.value.dragging.enable();

          // Forcer la mise à jour des propriétés à la fin de la modification
          layer.updateProperties();
          selectedShape.value = null;
          nextTick(() => {
            selectedShape.value = layer;
          });
          // Mettre à jour les propriétés via la méthode globale
          updateLayerProperties(layer, 'Semicircle');

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
        if (radiusControl && updatedOpeningAngle > 5) {
          const newMidPoint = layer.calculateMidpointPosition();
          radiusControl.setLatLng(newMidPoint);
          radiusControl.setStyle({ opacity: 1, fillOpacity: 1 });
        } else if (radiusControl) {
          radiusControl.setStyle({ opacity: 0, fillOpacity: 0 });
        }

        // Forcer la mise à jour des propriétés pendant le déplacement
        layer.updateProperties();
        selectedShape.value = layer;
      };

      const onMouseUp = () => {
        isDragging = false;
        if (!map.value) return;
        map.value.off('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
        map.value.dragging.enable();

        // Forcer la mise à jour des propriétés à la fin du déplacement
        layer.updateProperties();
        selectedShape.value = null;
        nextTick(() => {
          selectedShape.value = layer;
        });
        // Mettre à jour les propriétés via la méthode globale
        updateLayerProperties(layer, 'Semicircle');
      };

      map.value.on('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);
    });
  };
  // Fonction pour générer les points de contrôle temporaires
  const generateTempControlPoints = (layer: L.Layer) => {
    if (!map.value || !tempControlPointsGroup.value) {
      return;
    }
    console.log('[generateTempControlPoints] Génération des points temporaires pour', {
      layerType: layer.constructor.name,
      properties: layer.properties,
      isPolygon: layer instanceof Polygon || layer instanceof L.Polygon
    });
    // Supprimer les points temporaires existants
    tempControlPointsGroup.value.clearLayers();
    // Pas de points de contrôle temporaires pour TextRectangle
    if (layer instanceof TextRectangle) {
      // Just add a simple hint to show it's hoverable
      const center = layer.getBounds?.().getCenter();
      if (center) {
        const textHint = L.circleMarker(center, {
          radius: 0,  // Invisible marker
          className: 'text-hint-marker',
          pmIgnore: true
        });
        tempControlPointsGroup.value.addLayer(textHint);
      }
      return;
    }
    try {
      if (layer instanceof Polygon || layer instanceof L.Polygon) {
        // Récupérer les points du polygone de manière sûre
        let points: L.LatLng[] = [];
        try {
          if ('getLatLngs' in layer) {
            const latLngs = layer.getLatLngs();
            if (Array.isArray(latLngs) && latLngs.length > 0) {
              const firstLayer = latLngs[0];
              if (Array.isArray(firstLayer)) {
                points = firstLayer as L.LatLng[];
              } else if (firstLayer instanceof L.LatLng) {
                points = latLngs as L.LatLng[];
              }
            }
          }
        } catch (error) {
          console.error('[generateTempControlPoints] Erreur lors de la récupération des points du polygone:', error);
          return;
        }
        // Point central temporaire (vert)
        let center: L.LatLng | null = null;
        try {
          if (layer instanceof Polygon && typeof layer.getCenter === 'function') {
            center = layer.getCenter();
          } else {
            // Calculer le centre manuellement pour les polygones standard
            const coordinates = points.map(point => [point.lng, point.lat]);
            coordinates.push(coordinates[0]); // Fermer le polygone
            const polygonFeature = turf.polygon([coordinates]);
            const centroidPoint = centroid(polygonFeature);
            center = L.latLng(
              centroidPoint.geometry.coordinates[1],
              centroidPoint.geometry.coordinates[0]
            );
          }
          if (center && center.lat !== undefined && center.lng !== undefined) {
            const tempCenterPoint = createControlPoint(center, '#059669');
            tempControlPointsGroup.value.addLayer(tempCenterPoint);
          }
        } catch (error) {
          console.warn('[generateTempControlPoints] Erreur lors du calcul du centre du polygone:', error);
        }
        // Points de sommet temporaires (rouge)
        points.forEach(point => {
          if (point && point.lat !== undefined && point.lng !== undefined) {
            const tempPoint = createControlPoint(point, '#DC2626');
            tempControlPointsGroup.value.addLayer(tempPoint);
          }
        });
        // Points milieux temporaires
        for (let i = 0; i < points.length; i++) {
          const p1 = points[i];
          const p2 = points[(i + 1) % points.length];
          if (p1 && p2 && p1.lat !== undefined && p1.lng !== undefined && 
              p2.lat !== undefined && p2.lng !== undefined) {
            const midPoint = L.latLng(
              (p1.lat + p2.lat) / 2,
              (p1.lng + p2.lng) / 2
            );
            const tempMidPoint = createControlPoint(midPoint, '#2563EB');
            tempControlPointsGroup.value.addLayer(tempMidPoint);
          }
        }
      } else if (layer instanceof Circle) {
        // ... rest of the existing code for other shapes ...
      }
      console.log('[generateTempControlPoints] Points temporaires générés', {
        count: tempControlPointsGroup.value.getLayers().length
      });
    } catch (error) {
      console.error('[generateTempControlPoints] Erreur lors de la génération des points temporaires:', error);
    }
  };
  // Fonction pour gérer les points de contrôle du TextRectangle
  const updateTextRectangleControlPoints = (layer: DrawableLayer) => {
    if (!map.value || !featureGroup.value || !layer.getBounds) return;
    const textRect = layer as TextRectangle;
    clearActiveControlPoints();
    // Écouter les événements d'édition pour masquer/afficher les points de contrôle
    textRect.on('edit:start', () => {
      clearActiveControlPoints();
    });
    textRect.on('edit:end', () => {
      // Recréer les points de contrôle après l'édition
      updateTextRectangleControlPoints(textRect);
    });
    // Calculer les positions des points en tenant compte de la rotation
    const bounds = textRect.getBounds();
    const center = bounds.getCenter();
    const rotation = textRect.properties.rotation || 0;
    // Fonction pour appliquer la rotation à un point
    const rotatePoint = (point: L.LatLng): L.LatLng => {
      if (rotation === 0) return point;
      const rad = (rotation * Math.PI) / 180;
      const cos = Math.cos(rad);
      const sin = Math.sin(rad);
      const dx = point.lng - center.lng;
      const dy = point.lat - center.lat;
      const newX = dx * cos - dy * sin;
      const newY = dx * sin + dy * cos;
      return L.latLng(center.lat + newY, center.lng + newX);
    };
    // Calculer les coins avec rotation
    const corners = [
      bounds.getNorthWest(),
      bounds.getNorthEast(),
      bounds.getSouthEast(),
      bounds.getSouthWest()
    ].map(corner => rotatePoint(corner));
    // Calculer les points milieux avec rotation
    const midPoints = textRect.getMidPoints().map(point => rotatePoint(point));
    // Point central pour le déplacement (vert)
    const centerPoint = createControlPoint(center, '#059669');
    centerPoint.addTo(map.value);
    activeControlPoints.push(centerPoint);
    // Ajouter les mesures au point central
    addMeasureEvents(centerPoint, textRect, () => {
      const { width, height } = textRect.getDimensions();
      const area = width * height;
      return [
        formatMeasure(width, 'm', 'Largeur'),
        formatMeasure(height, 'm', 'Hauteur'),
        formatMeasure(area, 'm²', 'Surface'),
        `Rotation: ${rotation.toFixed(1)}°`
      ].join('<br>');
    });
    // Points de coin pour le redimensionnement (rouge)
    const cornerMarkers = corners.map((corner, index) => {
      const cornerPoint = createControlPoint(corner, '#DC2626');
      cornerPoint.addTo(map.value!);
      activeControlPoints.push(cornerPoint);
      // Ajouter les mesures aux points de coin
      addMeasureEvents(cornerPoint, textRect, () => {
        const { width, height } = textRect.getDimensions();
        return [
          formatMeasure(width, 'm', 'Largeur'),
          formatMeasure(height, 'm', 'Hauteur')
        ].join('<br>');
      });
      cornerPoint.on('mousedown', (e: L.LeafletMouseEvent) => {
        if (!map.value) return;
        L.DomEvent.stopPropagation(e);
        map.value.dragging.disable();
        const oppositeIndex = (index + 2) % 4;
        const oppositeCorner = corners[oppositeIndex];
        textRect.startResize();
        const throttledResize = throttle((e: L.LeafletMouseEvent) => {
          const newBounds = L.latLngBounds(oppositeCorner, e.latlng);
          textRect.updateResizePreview(newBounds);
        }, 16);
        const onMouseMove = (e: L.LeafletMouseEvent) => throttledResize(e);
        const onMouseUp = () => {
          if (!map.value) return;
          map.value.off('mousemove', onMouseMove);
          document.removeEventListener('mouseup', onMouseUp);
          map.value.dragging.enable();
          const finalBounds = L.latLngBounds(oppositeCorner, cornerPoint.getLatLng());
          textRect.endResize(finalBounds);
          selectedShape.value = null;
          nextTick(() => {
            selectedShape.value = textRect;
          });
        };
        map.value.on('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
      });
      return cornerPoint;
    });
    // Points milieux pour le redimensionnement proportionnel (bleu)
    const midPointMarkers = midPoints.map((midPoint, index) => {
      const midPointMarker = createControlPoint(midPoint, '#2563EB');
      midPointMarker.addTo(map.value!);
      activeControlPoints.push(midPointMarker);
      // Ajouter les mesures aux points milieux
      addMeasureEvents(midPointMarker, textRect, () => {
        const { width, height } = textRect.getDimensions();
        const sideLength = index % 2 === 0 ? width : height;
        return [
          formatMeasure(sideLength, 'm', 'Longueur du côté'),
          formatMeasure(sideLength/2, 'm', 'Distance au coin'),
          `Rotation: ${rotation.toFixed(1)}°`
        ].join('<br>');
      });
      midPointMarker.on('mousedown', (e: L.LeafletMouseEvent) => {
        if (!map.value) return;
        L.DomEvent.stopPropagation(e);
        map.value.dragging.disable();
        textRect.startResize();
        const throttledResize = throttle((e: L.LeafletMouseEvent) => {
          const bounds = textRect.getBounds();
          let newBounds: L.LatLngBounds;
          switch (index) {
            case 0: // Haut
              newBounds = L.latLngBounds(
                L.latLng(e.latlng.lat, bounds.getWest()),
                L.latLng(bounds.getSouth(), bounds.getEast())
              );
              break;
            case 1: // Droite
              newBounds = L.latLngBounds(
                L.latLng(bounds.getNorth(), bounds.getWest()),
                L.latLng(bounds.getSouth(), e.latlng.lng)
              );
              break;
            case 2: // Bas
              newBounds = L.latLngBounds(
                L.latLng(bounds.getNorth(), bounds.getWest()),
                L.latLng(e.latlng.lat, bounds.getEast())
              );
              break;
            case 3: // Gauche
              newBounds = L.latLngBounds(
                L.latLng(bounds.getNorth(), e.latlng.lng),
                L.latLng(bounds.getSouth(), bounds.getEast())
              );
              break;
            default:
              return;
          }
          textRect.updateResizePreview(newBounds);
        }, 16);
        const onMouseMove = (e: L.LeafletMouseEvent) => throttledResize(e);
        const onMouseUp = () => {
          if (!map.value) return;
          map.value.off('mousemove', onMouseMove);
          document.removeEventListener('mouseup', onMouseUp);
          map.value.dragging.enable();
          const bounds = textRect.getBounds();
          let finalBounds: L.LatLngBounds;
          switch (index) {
            case 0: // Haut
              finalBounds = L.latLngBounds(
                L.latLng(midPointMarker.getLatLng().lat, bounds.getWest()),
                L.latLng(bounds.getSouth(), bounds.getEast())
              );
              break;
            case 1: // Droite
              finalBounds = L.latLngBounds(
                L.latLng(bounds.getNorth(), bounds.getWest()),
                L.latLng(bounds.getSouth(), midPointMarker.getLatLng().lng)
              );
              break;
            case 2: // Bas
              finalBounds = L.latLngBounds(
                L.latLng(bounds.getNorth(), bounds.getWest()),
                L.latLng(midPointMarker.getLatLng().lat, bounds.getEast())
              );
              break;
            case 3: // Gauche
              finalBounds = L.latLngBounds(
                L.latLng(bounds.getNorth(), midPointMarker.getLatLng().lng),
                L.latLng(bounds.getSouth(), bounds.getEast())
              );
              break;
            default:
              return;
          }
          textRect.endResize(finalBounds);
          selectedShape.value = null;
          nextTick(() => {
            selectedShape.value = textRect;
          });
        };
        map.value.on('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
      });
      return midPointMarker;
    });
    // Gestion du déplacement via le point central
    centerPoint.on('mousedown', (e: L.LeafletMouseEvent) => {
      if (!map.value) return;
      L.DomEvent.stopPropagation(e);
      map.value.dragging.disable();
      const startLatLng = textRect.getBounds().getCenter();
      const startMouseLatLng = e.latlng;
      textRect.startResize();
      const throttledMove = throttle((e: L.LeafletMouseEvent) => {
        const dx = e.latlng.lng - startMouseLatLng.lng;
        const dy = e.latlng.lat - startMouseLatLng.lat;
        const newCenter = L.latLng(
          startLatLng.lat + dy,
          startLatLng.lng + dx
        );
        const bounds = textRect.getBounds();
        const width = bounds.getEast() - bounds.getWest();
        const height = bounds.getNorth() - bounds.getSouth();
        const newBounds = L.latLngBounds(
          L.latLng(newCenter.lat - height/2, newCenter.lng - width/2),
          L.latLng(newCenter.lat + height/2, newCenter.lng + width/2)
        );
        textRect.updateResizePreview(newBounds);
      }, 16);
      const onMouseMove = (e: L.LeafletMouseEvent) => throttledMove(e);
      const onMouseUp = () => {
        if (!map.value) return;
        map.value.off('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
        map.value.dragging.enable();
        const bounds = textRect.getBounds();
        const width = bounds.getEast() - bounds.getWest();
        const height = bounds.getNorth() - bounds.getSouth();
        const center = centerPoint.getLatLng();
        const finalBounds = L.latLngBounds(
          L.latLng(center.lat - height/2, center.lng - width/2),
          L.latLng(center.lat + height/2, center.lng + width/2)
        );
        textRect.endResize(finalBounds);
        selectedShape.value = null;
        nextTick(() => {
          selectedShape.value = textRect;
        });
      };
      map.value.on('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);
    });
    // Écouter les événements de redimensionnement
    textRect.on('resize:update', (e: any) => {
      const newBounds = e.bounds;
      const newCenter = newBounds.getCenter();
      // Calculer les nouvelles positions avec rotation
      const updatedCorners = [
        newBounds.getNorthWest(),
        newBounds.getNorthEast(),
        newBounds.getSouthEast(),
        newBounds.getSouthWest()
      ].map(corner => rotatePoint(corner));
      cornerMarkers.forEach((marker, i) => {
        marker.setLatLng(updatedCorners[i]);
      });
      centerPoint.setLatLng(newCenter);
      const newMidPoints = [
        L.latLng((updatedCorners[0].lat + updatedCorners[1].lat) / 2, (updatedCorners[0].lng + updatedCorners[1].lng) / 2),
        L.latLng((updatedCorners[1].lat + updatedCorners[2].lat) / 2, (updatedCorners[1].lng + updatedCorners[2].lng) / 2),
        L.latLng((updatedCorners[2].lat + updatedCorners[3].lat) / 2, (updatedCorners[2].lng + updatedCorners[3].lng) / 2),
        L.latLng((updatedCorners[3].lat + updatedCorners[0].lat) / 2, (updatedCorners[3].lng + updatedCorners[0].lng) / 2)
      ].map(point => rotatePoint(point));
      midPointMarkers.forEach((marker, i) => {
        marker.setLatLng(newMidPoints[i]);
      });
    });
    // Nettoyer les écouteurs d'événements lors du nettoyage des points de contrôle
    const cleanup = () => {
      textRect.off('edit:start');
      textRect.off('edit:end');
      textRect.off('resize:update');
    };
    // Ajouter la fonction de nettoyage à la liste des points de contrôle
    (activeControlPoints as any).cleanup = cleanup;
  };
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