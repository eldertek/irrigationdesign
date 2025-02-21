import { ref, onUnmounted } from 'vue';
import L from 'leaflet';
import '@geoman-io/leaflet-geoman-free';
import { useShapeProperties } from './useShapeProperties';
import { useElevationApi } from './useElevationApi';
import { CircleArc } from '../utils/CircleArc';
import type { TextStyle, TextProperties, TextMarker, TextRectangle } from '../types/leaflet';
import * as turf from '@turf/turf';

// Interface pour Leaflet-Geoman
interface PMMap {
  addControls: (options: any) => void;
  enableDraw: (shape: string) => void;
  disableDraw: () => void;
  enableGlobalEditMode: () => void;
  disableGlobalEditMode: () => void;
  enableGlobalDragMode: () => void;
  disableGlobalDragMode: () => void;
  enableGlobalRemovalMode: () => void;
  disableGlobalRemovalMode: () => void;
}

// Extension des types Leaflet
declare module 'leaflet' {
  interface Layer {
    properties?: any;
    pm?: any;
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

export function useMapDrawing() {
  const map = ref<L.Map | null>(null);
  const featureGroup = ref<L.FeatureGroup | null>(null);
  const currentTool = ref<string>('');
  const selectedShape = ref<L.Layer | null>(null);
  const isDrawing = ref<boolean>(false);

  const { calculateProperties } = useShapeProperties();
  const { fetchElevation } = useElevationApi();

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

    // Événements de dessin
    mapInstance.on('pm:drawstart', () => {
      isDrawing.value = true;
    });

    mapInstance.on('pm:drawend', () => {
      isDrawing.value = false;
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

      // Calculer les propriétés géométriques
      const props = calculateProperties(layer, map.value);
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
    mapInstance.on('click', (e: L.LeafletMouseEvent) => {
      const target = e.target;
      if (target === mapInstance) {
        selectedShape.value = null;
      }
    });

    featureGroup.value.on('click', (e: L.LeafletMouseEvent) => {
      L.DomEvent.stopPropagation(e);
      const layer = e.layer;
      selectedShape.value = layer;
    });

    // Événements d'édition
    mapInstance.on('pm:edit', (e: any) => {
      const layer = e.layer;
      if (layer) {
        const props = calculateProperties(layer, map.value);
        layer.properties = { ...layer.properties, ...props };
        if (layer === selectedShape.value) {
          selectedShape.value = layer;
        }
      }
    });

    return mapInstance;
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
        let drawingState = 'center'; // États: 'center', 'radius', 'orientation', 'opening'
        let center: L.LatLng | null = null;
        let radius = 0;
        let tempArc: CircleArc | null = null;
        let orientation = 0;
        let openingAngle = 180; // Angle d'ouverture par défaut

        // Désactiver le mode de dessin par défaut de Leaflet.PM
        map.value.pm.disableDraw();

        // Afficher le message d'aide initial
        const helpMsg = L.DomUtil.create('div', 'drawing-help-message');
        helpMsg.innerHTML = 'Cliquez pour placer le centre du demi-cercle';
        document.body.appendChild(helpMsg);

        // Gestionnaire de clic pour le centre
        const onFirstClick = (e: L.LeafletMouseEvent) => {
          if (!map.value) return;
          center = e.latlng;
          drawingState = 'radius';
          
          // Créer l'arc temporaire
          tempArc = new CircleArc(map.value, center, 0, 0, 180);
          tempArc.addTo(map.value);
          
          // Mettre à jour le message d'aide
          helpMsg.innerHTML = 'Déplacez la souris pour définir le rayon, cliquez pour valider';
          
          // Gestionnaire pour le rayon
          const onMouseMove = (e: L.LeafletMouseEvent) => {
            if (center && tempArc) {
              radius = center.distanceTo(e.latlng);
              tempArc.setRadius(radius);
            }
          };
          
          // Gestionnaire pour valider le rayon
          const onSecondClick = (e: L.LeafletMouseEvent) => {
            if (!map.value) return;
            drawingState = 'orientation';
            
            // Mettre à jour le message d'aide
            helpMsg.innerHTML = 'Déplacez la souris pour orienter le demi-cercle, cliquez pour valider';
            
            // Supprimer les gestionnaires précédents
            map.value.off('mousemove', onMouseMove);
            map.value.off('click', onSecondClick);
            
            // Gestionnaire pour l'orientation
            const onOrientationMove = (e: L.LeafletMouseEvent) => {
              if (center && tempArc) {
                orientation = Math.atan2(
                  e.latlng.lat - center.lat,
                  e.latlng.lng - center.lng
                ) * (180 / Math.PI);
                
                tempArc.setAngles(orientation, orientation + openingAngle);
              }
            };
            
            // Gestionnaire pour valider l'orientation
            const onThirdClick = (e: L.LeafletMouseEvent) => {
              if (!map.value) return;
              drawingState = 'opening';
              
              // Mettre à jour le message d'aide
              helpMsg.innerHTML = 'Déplacez la souris pour ajuster l\'angle d\'ouverture, cliquez pour terminer';
              
              // Supprimer les gestionnaires précédents
              map.value.off('mousemove', onOrientationMove);
              map.value.off('click', onThirdClick);
              
              // Point de référence pour le calcul de l'angle d'ouverture
              const startPoint = e.latlng;
              
              // Gestionnaire pour l'angle d'ouverture
              const onOpeningMove = (e: L.LeafletMouseEvent) => {
                if (center && tempArc) {
                  // Calculer l'angle entre le point de départ et la position actuelle
                  const startAngle = Math.atan2(
                    startPoint.lat - center.lat,
                    startPoint.lng - center.lng
                  ) * (180 / Math.PI);
                  
                  const currentAngle = Math.atan2(
                    e.latlng.lat - center.lat,
                    e.latlng.lng - center.lng
                  ) * (180 / Math.PI);
                  
                  // Calculer l'angle d'ouverture (entre 0° et 360°)
                  openingAngle = Math.abs(currentAngle - startAngle);
                  if (openingAngle > 360) openingAngle = 360;
                  
                  // Mettre à jour l'arc
                  tempArc.setAngles(orientation, orientation + openingAngle);
                }
              };
              
              // Gestionnaire pour finaliser la forme
              const onFinalClick = () => {
                if (!map.value || !tempArc) return;
                
                // Nettoyer
                map.value.off('mousemove', onOpeningMove);
                map.value.off('click', onFinalClick);
                document.querySelector('.drawing-help-message')?.remove();
                
                // Configurer les propriétés finales
                tempArc.properties = {
                  type: 'Semicircle',
                  radius,
                  orientation,
                  openingAngle,
                  style: {
                    fillColor: '#3B82F6',
                    fillOpacity: 0.2,
                    color: '#2563EB',
                    weight: 2,
                    startAngle: orientation,
                    stopAngle: orientation + openingAngle
                  }
                };
                
                // Émettre l'événement de création
                map.value.fire('pm:create', { 
                  layer: tempArc,
                  shape: 'Semicircle',
                  workingLayer: tempArc
                });
              };
              
              map.value.on('mousemove', onOpeningMove);
              map.value.once('click', onFinalClick);
            };
            
            map.value.on('mousemove', onOrientationMove);
            map.value.once('click', onThirdClick);
          };
          
          map.value.on('mousemove', onMouseMove);
          map.value.once('click', onSecondClick);
        };
        
        map.value.once('click', onFirstClick);
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
      case 'Text':
        map.value.pm.disableDraw();
        map.value.dragging.disable();

        const textHelpMsg = L.DomUtil.create('div', 'drawing-help-message');
        textHelpMsg.innerHTML = 'Cliquez pour placer le texte, redimensionnez ensuite';
        document.body.appendChild(textHelpMsg);

        const onMapClick = (e: L.LeafletMouseEvent) => {
          if (!map.value || !featureGroup.value) return;

          const latlng = e.latlng;
          const zoom = map.value.getZoom();
          const physicalWidthMeters = 5.0;
          const physicalHeightMeters = 2.0;
          const widthPx = metersToPixels(physicalWidthMeters, latlng.lat, zoom);
          const heightPx = metersToPixels(physicalHeightMeters, latlng.lat, zoom);

          // Calcul des coins du rectangle
          const latOffset = (physicalHeightMeters / 2) / 6378137 * (180 / Math.PI);
          const lngOffset = (physicalWidthMeters / 2) / 6378137 * (180 / Math.PI) / Math.cos(latlng.lat * Math.PI / 180);
          const bounds: L.LatLngBoundsExpression = L.latLngBounds(
            [latlng.lat - latOffset, latlng.lng - lngOffset],
            [latlng.lat + latOffset, latlng.lng + lngOffset]
          );

          // Créer le rectangle conteneur
          const textRect = L.rectangle(bounds, {
            color: defaultTextStyle.borderColor,
            weight: parseInt(defaultTextStyle.borderWidth || '1'),
            fillOpacity: 0,
            pmIgnore: false
          }) as TextRectangle;

          // Créer le texte à l'intérieur
          const textContent = L.divIcon({
            html: `
              <div class="text-annotation" 
                   contenteditable="true"
                   style="width: ${widthPx}px; height: ${heightPx}px; font-size: ${heightPx * 0.6}px;">
                Nouveau texte
              </div>`,
            className: 'text-container',
            iconSize: [widthPx, heightPx],
            iconAnchor: [widthPx / 2, heightPx / 2]
          });

          const textMarker = L.marker(latlng, {
            icon: textContent,
            draggable: false,
            pmIgnore: true
          }) as TextMarker;

          textRect.properties = {
            type: 'text',
            text: 'Nouveau texte',
            style: { ...defaultTextStyle, fontSize: `${heightPx * 0.6}px` },
            physicalWidth: physicalWidthMeters,
            physicalHeight: physicalHeightMeters,
            _textLayer: textMarker
          };

          textMarker.properties = textRect.properties;

          // Synchroniser le texte avec le rectangle
          const updateTextPositionAndSize = () => {
            if (!map.value) return;
            const bounds = textRect.getBounds();
            const center = bounds.getCenter();
            const zoom = map.value.getZoom();
            const widthPx = metersToPixels(textRect.properties.physicalWidth, center.lat, zoom);
            const heightPx = metersToPixels(textRect.properties.physicalHeight, center.lat, zoom);

            textMarker.setLatLng(center);
            const newIcon = L.divIcon({
              html: `
                <div class="text-annotation" 
                     contenteditable="true"
                     style="width: ${widthPx}px; height: ${heightPx}px; font-size: ${heightPx * 0.6}px;">
                  ${textRect.properties.text}
                </div>`,
              className: 'text-container',
              iconSize: [widthPx, heightPx],
              iconAnchor: [widthPx / 2, heightPx / 2]
            });
            textMarker.setIcon(newIcon);
            textRect.properties.style.fontSize = `${heightPx * 0.6}px`;
            updateTextStyle(textMarker.getElement()?.querySelector('.text-annotation') as HTMLElement, textRect.properties.style);
          };

          textRect.on('pm:edit', () => {
            const bounds = textRect.getBounds();
            const sw = bounds.getSouthWest();
            const ne = bounds.getNorthEast();
            textRect.properties.physicalWidth = turf.distance([sw.lng, sw.lat], [ne.lng, sw.lat], { units: 'meters' });
            textRect.properties.physicalHeight = turf.distance([sw.lng, sw.lat], [sw.lng, ne.lat], { units: 'meters' });
            updateTextPositionAndSize();
            if (textRect === selectedShape.value) {
              selectedShape.value = textRect;
            }
          });

          textRect.on('add', () => {
            featureGroup.value?.addLayer(textMarker);
            map.value?.on('zoomend', updateTextPositionAndSize);
            textRect.on('dragend', updateTextPositionAndSize);

            const element = textMarker.getElement()?.querySelector('.text-annotation') as HTMLElement;
            if (element) {
              updateTextStyle(element, textRect.properties.style);
              element.addEventListener('blur', () => {
                textRect.properties.text = element.textContent || 'Nouveau texte';
                map.value?.fire('pm:edit', { layer: textRect });
              });
              element.addEventListener('dblclick', (e) => {
                e.stopPropagation();
                element.focus();
                element.classList.add('editing');
              });
              element.addEventListener('blur', () => element.classList.remove('editing'));
              element.addEventListener('mousedown', (e) => e.stopPropagation());
              element.addEventListener('click', (e) => {
                e.stopPropagation();
                selectedShape.value = textRect;
                map.value?.fire('pm:select', { layer: textRect });
              });
            }
          });

          textRect.on('remove', () => {
            featureGroup.value?.removeLayer(textMarker);
            map.value?.off('zoomend', updateTextPositionAndSize);
          });

          featureGroup.value.addLayer(textRect);
          map.value.fire('pm:create', { layer: textRect, shape: 'Text', workingLayer: textRect });

          map.value.dragging.enable();
          document.querySelector('.drawing-help-message')?.remove();
          map.value.off('click', onMapClick);
        };
        
        map.value.once('click', onMapClick);
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
    updateTextFixedSize
  };
} 