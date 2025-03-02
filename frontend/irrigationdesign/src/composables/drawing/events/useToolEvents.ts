/**
 * Composable pour la gestion des événements liés aux outils de dessin
 */
import { Ref } from 'vue';
import L from 'leaflet';
import { showHelpMessage } from '../../../utils/drawing/measurementHelpers';
import { TextRectangle } from '../../../utils/TextRectangle';
import { Circle } from '../../../utils/Circle';
import { Rectangle } from '../../../utils/Rectangle';
import { Line } from '../../../utils/Line';
import { CircleArc } from '../../../utils/CircleArc';

interface UseToolEventsOptions {
  map: Ref<L.Map | null>;
  featureGroup: Ref<L.FeatureGroup | null>;
  currentTool: Ref<string>;
  selectedShape: Ref<any>;
  isDrawing: Ref<boolean>;
  createTextRectangleFromRectangle: (layer: L.Rectangle) => TextRectangle | null;
  updateCircleControlPoints: (layer: Circle) => void;
  updateRectangleControlPoints: (layer: Rectangle) => void;
  updateLineControlPoints: (layer: Line) => void;
  updatePolygonControlPoints: (layer: L.Polygon) => void;
  updateSemicircleControlPoints: (layer: CircleArc) => void;
  clearActiveControlPoints: () => void;
  createTextMarker?: (latlng: L.LatLng, text?: string) => L.Marker;
}

export function useToolEvents(options: UseToolEventsOptions) {
  const { 
    map, 
    featureGroup, 
    currentTool, 
    selectedShape, 
    isDrawing,
    createTextRectangleFromRectangle,
    updateCircleControlPoints,
    updateRectangleControlPoints,
    updateLineControlPoints,
    updatePolygonControlPoints,
    updateSemicircleControlPoints,
    clearActiveControlPoints,
    createTextMarker
  } = options;

  /**
   * Initialise les événements de la carte liés aux outils de dessin
   */
  const initToolEvents = () => {
    if (!map.value) return;
    
    // Événements de dessin
    map.value.on('pm:drawstart', (e: any) => {
      isDrawing.value = true;
      // Définir le curseur approprié
      if (e.shape === 'Circle' && currentTool.value === 'Semicircle') {
        map.value!.getContainer().style.cursor = 'crosshair';
      }
    });

    map.value.on('pm:drawend', () => {
      isDrawing.value = false;
      // Réinitialiser le curseur
      map.value!.getContainer().style.cursor = '';
      // Afficher le message d'aide uniquement si une forme a été créée
      if (selectedShape.value) {
        showHelpMessage('Cliquez sur la forme pour afficher les points de contrôle');
      }
    });

    map.value.on('pm:create', (e: any) => {
      const layer = e.layer;
      featureGroup.value?.addLayer(layer);
      
      // Déterminer le type de forme et traiter en conséquence
      handleShapeCreation(layer);
      
      // Afficher le message d'aide
      showHelpMessage('Cliquez sur la forme pour afficher les points de contrôle');
    });
    
    // Événements d'édition
    map.value.on('pm:edit', (e: any) => {
      handleShapeEdit(e.layer);
    });

    // Événements de glisser-déposer
    map.value.on('pm:dragstart', () => {
      // Supprimer les messages précédents avant d'afficher le nouveau
      document.querySelectorAll('.drawing-help-message').forEach(msg => msg.remove());
      showHelpMessage('Déplacez la forme à l\'endroit souhaité');
    });

    map.value.on('pm:dragend', (e: any) => {
      handleShapeDragEnd(e.layer);
      
      setTimeout(() => {
        showHelpMessage('Cliquez sur la forme pour afficher les points de contrôle');
      }, 100);
    });

    // Événements de suppression
    map.value.on('pm:remove', () => {
      document.querySelector('.drawing-help-message')?.remove();
    });

    // Événements de sélection/désélection
    map.value.on('pm:select', (e: any) => {
      const layer = e.layer;
      // Supprimer les messages précédents avant d'afficher le nouveau
      document.querySelectorAll('.drawing-help-message').forEach(msg => msg.remove());
      
      if (layer instanceof CircleArc || layer.properties?.type === 'Semicircle') {
        showHelpMessage('Points de contrôle : <span style="color: #059669">●</span> Ajuster le rayon, <span style="color: #2563EB">●</span> et <span style="color: #DC2626">●</span> Modifier l\'ouverture du demi-cercle');
      } else {
        showHelpMessage('Utilisez les points de contrôle pour modifier la forme');
      }
    });

    map.value.on('pm:unselect', () => {
      // Supprimer tous les messages d'aide à la désélection
      document.querySelectorAll('.drawing-help-message').forEach(msg => msg.remove());
    });
  };

  /**
   * Gère la création d'une nouvelle forme
   * @param layer Couche créée
   */
  const handleShapeCreation = (layer: L.Layer) => {
    // Déterminer le type de forme
    let shapeType = 'unknown';
    
    if (layer instanceof L.Circle) {
      shapeType = currentTool.value === 'Semicircle' ? 'Semicircle' : 'Circle';
    } else if (layer instanceof L.Rectangle) {
      shapeType = currentTool.value === 'TextRectangle' ? 'TextRectangle' : 'Rectangle';
    } else if (layer instanceof L.Polygon) {
      shapeType = 'Polygon';
    } else if (layer instanceof L.Polyline && !(layer instanceof L.Polygon)) {
      shapeType = 'Line';
    }

    // Ajouter les événements de survol
    addHoverEvents(layer, shapeType);

    // Traiter selon le type de forme
    if (shapeType === 'TextRectangle') {
      createTextRectangleFromRectangle(layer as L.Rectangle);
    } else if (shapeType === 'Semicircle') {
      const center = (layer as L.Circle).getLatLng();
      const radius = (layer as L.Circle).getRadius();
      
      // Supprimer le cercle original
      featureGroup.value?.removeLayer(layer);
      
      // Créer un nouveau demi-cercle
      const semicircle = new CircleArc(center, radius);
      semicircle.properties = { type: 'Semicircle' };
      featureGroup.value?.addLayer(semicircle);
      selectedShape.value = semicircle;
      updateSemicircleControlPoints(semicircle);
    } else if (shapeType === 'Circle') {
      // Supprimer le cercle standard de Leaflet
      featureGroup.value?.removeLayer(layer);
      
      // Créer notre cercle personnalisé
      const circle = new Circle(
        (layer as L.Circle).getLatLng(), 
        {
          ...(layer as L.Circle).options,
          radius: (layer as L.Circle).getRadius()
        }
      );
      circle.updateProperties();
      featureGroup.value?.addLayer(circle);
      selectedShape.value = circle;
      updateCircleControlPoints(circle);
    } else if (shapeType === 'Rectangle') {
      // Supprimer le rectangle standard de Leaflet
      featureGroup.value?.removeLayer(layer);
      
      // Créer notre rectangle personnalisé
      const rectangle = new Rectangle(
        (layer as L.Rectangle).getBounds(), 
        {
          ...(layer as L.Rectangle).options,
        }
      );
      rectangle.updateProperties();
      featureGroup.value?.addLayer(rectangle);
      selectedShape.value = rectangle;
      updateRectangleControlPoints(rectangle);
    } else if (layer instanceof L.Polygon) {
      updatePolygonControlPoints(layer);
    } else if (layer instanceof L.Polyline && !(layer instanceof L.Polygon)) {
      // Pour les polylines standard de Leaflet
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
  };

  /**
   * Gère l'édition d'une forme
   * @param layer Couche éditée
   */
  const handleShapeEdit = (layer: L.Layer) => {
    console.log('[pm:edit] Début', {
      layer,
      currentProperties: layer.properties
    });

    if (!layer) return;
    
    const shapeType = layer.properties?.type || 'unknown';
    
    // Mettre à jour les points de contrôle en fonction du type de forme
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
      updateLineControlPoints(layer);
    } else if (layer instanceof L.Polyline) {
      updateLineControlPoints(layer);
    }
  };

  /**
   * Gère la fin du déplacement d'une forme
   * @param layer Couche déplacée
   */
  const handleShapeDragEnd = (layer: L.Layer) => {
    console.log('[pm:dragend] Début', {
      layer,
      currentProperties: layer.properties
    });

    if (!layer) return;
    
    const shapeType = layer.properties?.type || 'unknown';
    
    // Cas spécifiques selon le type de forme
    if (layer instanceof L.Rectangle && !(layer instanceof Rectangle)) {
      // Si c'est un Rectangle standard Leaflet, le convertir en notre Rectangle personnalisé
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
      updateLineControlPoints(layer);
    } else {
      // Pour les autres types de formes, mettre à jour leurs propriétés si nécessaire
      if (layer.properties) {
        if (layer instanceof L.Circle) {
          layer.properties.radius = layer.getRadius();
        } else if (layer instanceof Rectangle) {
          rectangle.updateProperties();
        } else if (layer instanceof CircleArc) {
          // Le demi-cercle a sa propre méthode de mise à jour
          layer.updateProperties();
        }
      }
    }
  };

  /**
   * Active un outil de dessin spécifique
   * @param tool Nom de l'outil à activer
   */
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
            if (map.value && createTextMarker) {
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
            break;
        }
        console.log('Tool enabled successfully');
      } catch (error) {
        console.error('Error enabling tool:', error);
      }
    }, 100);
    console.log('=== SETTING DRAWING TOOL END ===');
  };

  /**
   * Ajoute des événements de survol à une forme
   * @param layer Couche à laquelle ajouter les événements
   * @param shapeType Type de forme
   */
  const addHoverEvents = (layer: L.Layer, shapeType: string) => {
    layer.on('mouseover', () => {
      console.log('[mouseover] Survol de la forme', {
        type: shapeType,
        isSelected: selectedShape.value === layer
      });

      // Ne pas générer de points de contrôle temporaires si la forme est déjà sélectionnée
      if (!selectedShape.value || selectedShape.value !== layer) {
        // La génération de points temporaires est gérée par d'autres fonctions 
        // qui seront appelées depuis useMapDrawing
      }
    });

    layer.on('mouseout', () => {
      console.log('[mouseout] Sortie de la forme', {
        type: shapeType,
        isSelected: selectedShape.value === layer
      });

      // Ne pas supprimer les points temporaires si la forme est déjà sélectionnée
      if (!selectedShape.value || selectedShape.value !== layer) {
        if (map.value?.pm.tempControlPointsGroup) {
          map.value.pm.tempControlPointsGroup.clearLayers();
        }
      }
    });
  };

  return {
    initToolEvents,
    setDrawingTool,
    handleShapeCreation,
    handleShapeEdit,
    handleShapeDragEnd
  };
} 