import { ref, onUnmounted } from 'vue';
import L from 'leaflet';
import '@geoman-io/leaflet-geoman-free';
import { useShapeProperties } from './useShapeProperties';
import { useElevationApi } from './useElevationApi';
import { CircleArc } from '../utils/CircleArc';

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
          center = e.latlng;
          drawingState = 'radius';
          
          // Créer l'arc temporaire
          tempArc = new CircleArc(map.value!, center, 0, 0, 180);
          tempArc.addTo(map.value!);
          
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
            drawingState = 'orientation';
            
            // Mettre à jour le message d'aide
            helpMsg.innerHTML = 'Déplacez la souris pour orienter le demi-cercle, cliquez pour valider';
            
            // Supprimer les gestionnaires précédents
            map.value?.off('mousemove', onMouseMove);
            map.value?.off('click', onSecondClick);
            
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
              drawingState = 'opening';
              
              // Mettre à jour le message d'aide
              helpMsg.innerHTML = 'Déplacez la souris pour ajuster l\'angle d\'ouverture, cliquez pour terminer';
              
              // Supprimer les gestionnaires précédents
              map.value?.off('mousemove', onOrientationMove);
              map.value?.off('click', onThirdClick);
              
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
                // Nettoyer
                map.value?.off('mousemove', onOpeningMove);
                map.value?.off('click', onFinalClick);
                document.querySelector('.drawing-help-message')?.remove();
                
                if (tempArc) {
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
                  map.value?.fire('pm:create', { 
                    layer: tempArc,
                    shape: 'Semicircle',
                    workingLayer: tempArc
                  });
                }
              };
              
              map.value?.on('mousemove', onOpeningMove);
              map.value?.once('click', onFinalClick);
            };
            
            map.value?.on('mousemove', onOrientationMove);
            map.value?.once('click', onThirdClick);
          };
          
          map.value?.on('mousemove', onMouseMove);
          map.value?.once('click', onSecondClick);
        };
        
        map.value?.once('click', onFirstClick);
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
        // Désactiver tous les modes de dessin
        map.value.pm.disableDraw();
        
        // Désactiver temporairement le déplacement de la carte
        map.value.dragging.disable();
        
        // Afficher un message d'aide
        const textHelpMsg = L.DomUtil.create('div', 'drawing-help-message');
        textHelpMsg.innerHTML = 'Cliquez sur la carte pour placer le texte';
        document.body.appendChild(textHelpMsg);
        
        // Écouter un clic unique pour placer le texte
        map.value.once('click', (e: L.LeafletMouseEvent) => {
          // Créer un marqueur avec une icône div personnalisée
          const textMarker = L.marker(e.latlng, {
            icon: L.divIcon({
              html: '<div class="text-annotation">Nouveau texte</div>',
              className: ''
            }),
            draggable: true
          });
          
          // Ajouter les propriétés du texte
          textMarker.properties = {
            type: 'text',
            text: 'Nouveau texte',
            style: {
              fontSize: '14px',
              backgroundColor: '#FFFFFF',
              backgroundOpacity: 1,
              borderColor: '#000000',
              borderOpacity: 1,
              padding: '5px 10px',
              borderRadius: '3px'
            }
          };
          
          // Ajouter le marqueur à la carte
          textMarker.addTo(map.value!);
          
          // Émettre l'événement de création
          map.value.fire('pm:create', {
            layer: textMarker,
            shape: 'Text',
            workingLayer: textMarker
          });
          
          // Nettoyer
          map.value.dragging.enable();
          document.querySelector('.drawing-help-message')?.remove();
        });
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