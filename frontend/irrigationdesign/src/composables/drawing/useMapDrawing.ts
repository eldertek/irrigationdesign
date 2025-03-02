/**
 * Composable principal pour la gestion du dessin sur carte
 * Version refactorisée et optimisée
 */
import { ref, onUnmounted, nextTick, type Ref } from 'vue';
import L from 'leaflet';
import '@geoman-io/leaflet-geoman-free';
import { CircleArc } from '../../utils/CircleArc';
import { Circle } from '../../utils/Circle';
import { Rectangle } from '../../utils/Rectangle';
import { TextRectangle } from '../../utils/TextRectangle';
import { Line } from '../../utils/Line';
import type { TextStyle, TextMarker } from '../../types/leaflet';
import { metersToPixels, updateTextStyle, hexToRgba } from '../../utils/drawing/styleHelpers';
import { showHelpMessage } from '../../utils/drawing/measurementHelpers';
import { useControlPoints } from './core/useControlPoints';
import { useShapeProperties } from './core/useShapeProperties';
import { useCircleControls } from './shapes/useCircleControls';
import { useTextRectangleControls } from './shapes/useTextRectangleControls';
import { useToolEvents } from './events/useToolEvents';

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

export function useMapDrawing(): MapDrawingReturn {
  // Références aux éléments de la carte
  const map = ref<any>(null);
  const featureGroup = ref<any>(null);
  const controlPointsGroup = ref<any>(null);
  const tempControlPointsGroup = ref<any>(null);
  
  // État de l'outil et de la forme sélectionnée
  const currentTool = ref<string>('');
  const selectedShape = ref<any>(null);
  const isDrawing = ref<boolean>(false);

  // Composables spécifiques
  const { updateLayerProperties } = useShapeProperties({ selectedShape });
  
  const { 
    activeControlPoints,
    createControlPoint,
    clearActiveControlPoints,
    addMeasureEvents
  } = useControlPoints({ map, controlPointsGroup, tempControlPointsGroup });

  const { 
    updateCircleControlPoints, 
    generateTempCircleControlPoints 
  } = useCircleControls({ 
    map, 
    controlPointsGroup, 
    tempControlPointsGroup, 
    selectedShape, 
    updateLayerProperties 
  });

  // Module pour TextRectangle
  const { 
    selectTextRectangle, 
    createTextRectangleFromRectangle, 
    generateTempTextRectangleControlPoints 
  } = useTextRectangleControls({
    map,
    controlPointsGroup,
    tempControlPointsGroup,
    selectedShape,
    updateLayerProperties,
    featureGroup
  });

  // Module des événements pour les outils
  const { setDrawingTool: setTool } = useToolEvents({
    map,
    featureGroup,
    currentTool,
    selectedShape,
    isDrawing,
    createTextRectangleFromRectangle,
    updateCircleControlPoints,
    clearActiveControlPoints
  });

  /**
   * Crée et renvoie un marqueur de texte
   * @param latlng Position du marqueur
   * @param text Texte à afficher (par défaut: "Double-cliquez pour éditer")
   * @returns Le marqueur créé
   */
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
      if (!map.value) return;

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
        const mouseEvent = {
          ...e,
          clientX: e.clientX,
          clientY: e.clientY,
          button: e.button || 0,
          buttons: e.buttons || 0,
          altKey: e.altKey || false,
        } as MouseEvent;
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
          control.addEventListener('mousedown', onMouseDown);
        });
      }
    });

    marker.on('remove', () => {
      const element = marker.getElement();
      if (element) {
        const controls = element.querySelectorAll('.control-button');
        controls.forEach((control: Element) => {
          control.removeEventListener('mousedown', onMouseDown);
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

  /**
   * Initialise la carte
   * @param element Élément HTML qui contiendra la carte
   * @param center Centre initial de la carte
   * @param zoom Niveau de zoom initial
   * @returns Instance de la carte Leaflet
   */
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

    // Configurer les événements principaux via useToolEvents
    // événements déjà configurés par le module de gestion des outils

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

      // Gérer spécifiquement le TextRectangle
      if (layer instanceof TextRectangle) {
        selectTextRectangle(layer);
        return;
      }

      // Sinon, afficher les points de contrôle en fonction du type de forme
      if (layer instanceof CircleArc || layer.properties?.type === 'Semicircle') {
        // updateSemicircleControlPoints(layer as CircleArc);
      } else if (layer instanceof Circle) {
        updateCircleControlPoints(layer);
      } else if (layer instanceof Rectangle) {
        // updateRectangleControlPoints(layer);
      } else if (layer instanceof L.Rectangle) {
        // Si c'est un rectangle standard, le convertir en notre Rectangle personnalisé
        const rectangle = new Rectangle(layer.getBounds(), {
          ...layer.options
        });
        rectangle.updateProperties();
        featureGroup.value?.removeLayer(layer);
        featureGroup.value?.addLayer(rectangle);
        selectedShape.value = rectangle;
        // updateRectangleControlPoints(rectangle);
      } else if (layer instanceof L.Polygon) {
        // updatePolygonControlPoints(layer);
      } else if (layer instanceof Line) {
        // updateLineControlPoints(layer);
      } else if (layer instanceof L.Polyline && !(layer instanceof L.Polygon)) {
        // updateLineControlPoints(layer);
      }
    });

    return mapInstance;
  };

  /**
   * Ajuste la vue pour afficher toutes les formes
   */
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

  /**
   * Met à jour le style d'une forme
   * @param style Propriétés de style à mettre à jour
   */
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

  /**
   * Met à jour les propriétés d'une forme
   * @param properties Propriétés à mettre à jour
   */
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

  /**
   * Met à jour la taille physique du texte
   * @param textMarker Marqueur de texte
   * @param physicalSizeInMeters Taille physique en mètres
   */
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

  // Nettoyer les ressources à la destruction du composant
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
    setDrawingTool: setTool,
    updateShapeStyle,
    updateShapeProperties,
    updateTextFixedSize,
    adjustView,
    clearActiveControlPoints
  };
} 