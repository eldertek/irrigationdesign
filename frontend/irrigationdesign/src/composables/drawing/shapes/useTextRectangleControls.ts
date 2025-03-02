/**
 * Composable pour la gestion des points de contrôle des rectangles avec texte
 */
import { Ref, nextTick } from 'vue';
import L from 'leaflet';
import { formatMeasure, formatArea, formatAngle } from '../../../utils/drawing/formatters';
import { showHelpMessage } from '../../../utils/drawing/measurementHelpers';
import { useControlPoints } from '../core/useControlPoints';
import { TextRectangle } from '../../../utils/TextRectangle';

interface UseTextRectangleControlsOptions {
  map: Ref<L.Map | null>;
  controlPointsGroup: Ref<L.LayerGroup | null>;
  tempControlPointsGroup: Ref<L.LayerGroup | null>;
  selectedShape: Ref<any>;
  updateLayerProperties: (layer: L.Layer, shapeType: string) => void;
  featureGroup: Ref<L.FeatureGroup | null>;
}

export function useTextRectangleControls(options: UseTextRectangleControlsOptions) {
  const { 
    map, 
    controlPointsGroup, 
    tempControlPointsGroup, 
    selectedShape,
    updateLayerProperties,
    featureGroup
  } = options;
  
  // Utiliser le composable des points de contrôle
  const { 
    createTempControlPoint, 
    clearTempControlPoints
  } = useControlPoints({ map, controlPointsGroup, tempControlPointsGroup });

  /**
   * Affiche un message d'aide pour TextRectangle et prépare l'édition
   * @param layer TextRectangle à manipuler
   */
  const selectTextRectangle = (layer: TextRectangle) => {
    if (!map.value) return;
    
    // Log pour aider au débogage de la sélection de TextRectangle
    console.log('[TextRectangle] Sélection de TextRectangle', {
      id: (layer as any)._leaflet_id,
      bounds: layer.getBounds(),
      hasTextContainer: !!layer.getTextElement(),
      properties: layer.properties
    });
    
    // Afficher un message d'aide spécifique pour le TextRectangle
    showHelpMessage('Double-cliquez sur le texte pour le modifier. Cliquez et glissez pour déplacer.');
    
    // S'assurer que les modes d'édition en cours sont annulés
    if (map.value && map.value.pm) {
      try {
        // Annuler les modes d'édition actifs
        if (map.value.pm.globalEditModeEnabled()) {
          map.value.pm.disableGlobalEditMode();
        }
        
        // Vérifier les rectangles standards qui pourraient être des doublons
        if (featureGroup.value) {
          const allLayers = featureGroup.value.getLayers();
          console.log('[TextRectangle] Vérification des doublons. Couches totales:', allLayers.length);
          
          const textRectBounds = layer.getBounds();
          console.log('[TextRectangle] Limites du TextRectangle sélectionné:', textRectBounds.toBBoxString());
          
          // Chercher les couches Rectangle ayant les mêmes limites
          const duplicateRectangles = allLayers.filter((otherLayer: L.Layer) => {
            if (otherLayer !== layer && 
                otherLayer instanceof L.Rectangle && 
                !(otherLayer instanceof TextRectangle)) {
              // Comparer les limites pour voir si c'est un doublon
              const otherBounds = (otherLayer as L.Rectangle).getBounds();
              const isSameBounds = 
                Math.abs(otherBounds.getNorth() - textRectBounds.getNorth()) < 1e-6 &&
                Math.abs(otherBounds.getSouth() - textRectBounds.getSouth()) < 1e-6 &&
                Math.abs(otherBounds.getEast() - textRectBounds.getEast()) < 1e-6 &&
                Math.abs(otherBounds.getWest() - textRectBounds.getWest()) < 1e-6;
              
              console.log('[TextRectangle] Comparaison avec Rectangle:', {
                id: (otherLayer as any)._leaflet_id,
                bounds: otherBounds.toBBoxString(),
                isSameBounds: isSameBounds
              });
              
              return isSameBounds;
            }
            return false;
          });
          
          // Supprimer les doublons trouvés
          if (duplicateRectangles.length > 0) {
            console.warn(`[TextRectangle] ${duplicateRectangles.length} rectangle(s) en double trouvé(s) avec TextRectangle, suppression...`);
            duplicateRectangles.forEach((duplicate: L.Layer) => {
              console.log('[TextRectangle] Suppression du doublon:', (duplicate as any)._leaflet_id);
              featureGroup.value?.removeLayer(duplicate);
              if (map.value) {
                map.value.removeLayer(duplicate);
              }
            });
            console.log('[TextRectangle] Après suppression des doublons, couches totales:', featureGroup.value.getLayers().length);
          } else {
            console.log('[TextRectangle] Aucun doublon trouvé');
          }
        }
      } catch (e) {
        console.error('Erreur lors de la désactivation du mode d\'édition:', e);
      }
    }
    
    // Définir la forme sélectionnée
    selectedShape.value = layer;
  };

  /**
   * Crée un TextRectangle à partir d'un Rectangle standard
   * @param layer Rectangle standard à convertir en TextRectangle
   * @returns Le nouveau TextRectangle créé
   */
  const createTextRectangleFromRectangle = (layer: L.Rectangle): TextRectangle | null => {
    if (!map.value || !featureGroup.value) return null;
    
    try {
      // Récupérer les limites avant de supprimer pour s'assurer d'avoir des données pour le TextRectangle
      const bounds = layer.getBounds();
      const options = {
        color: '#3388ff',
        weight: 2,
        fillColor: '#3388ff',
        fillOpacity: 0.2,
        // Copier les autres options de la couche originale
        ...layer.options
      };
      
      // Supprimer correctement le rectangle de tous les groupes pour éviter les doublons
      console.log('[TextRectangle] Tentative de suppression du Rectangle original:', {
        inFeatureGroup: featureGroup.value?.hasLayer(layer),
        layerCount: featureGroup.value?.getLayers().length || 0
      });
      
      // Nettoyage complet avec une meilleure gestion des erreurs
      try {
        // D'abord essayer avec removeFrom pour un nettoyage approprié
        if (typeof layer.removeFrom === 'function') {
          try {
            layer.removeFrom(featureGroup.value);
            console.log('[TextRectangle] Méthode removeFrom utilisée pour feature group');
          } catch (error) {
            console.error('[TextRectangle] Erreur avec la méthode removeFrom:', error);
            // Fallback à removeLayer
            if (featureGroup.value?.hasLayer(layer)) {
              featureGroup.value.removeLayer(layer);
              console.log('[TextRectangle] Supprimé du feature group avec removeLayer après échec de removeFrom');
            }
          }
        } else {
          // D'abord, supprimer du feature group
          if (featureGroup.value?.hasLayer(layer)) {
            featureGroup.value.removeLayer(layer);
            console.log('[TextRectangle] Supprimé du feature group avec removeLayer');
          }
        }
        
        // Vérification de la suppression
        if (featureGroup.value?.hasLayer(layer)) {
          console.warn('[TextRectangle] AVERTISSEMENT: Couche toujours dans feature group après suppression! Essai de méthodes alternatives...');
          
          // Essayer de supprimer tous les rectangles avec des limites similaires
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
                  console.log('[TextRectangle] Suppression du rectangle en double:', (currentLayer as any)._leaflet_id || 'unknown');
                  featureGroup.value.removeLayer(currentLayer);
                  removedCount++;
                }
              }
            }
            
            if (removedCount > 0) {
              console.log(`[TextRectangle] ${removedCount} rectangle(s) en double supprimé(s) de force`);
            }
          } catch (e) {
            console.error('[TextRectangle] Erreur lors de la suppression des références de couche:', e);
          }
        }
        
        // Ensuite s'assurer de la suppression de la carte
        if (map.value && map.value.hasLayer(layer)) {
          map.value.removeLayer(layer);
          console.log('[TextRectangle] Supprimé de la carte');
        }
        
        // Vérifier la suppression
        console.log('[TextRectangle] Après suppression:', {
          inFeatureGroup: featureGroup.value && featureGroup.value.hasLayer(layer),
          onMap: map.value && map.value.hasLayer(layer),
          layerCount: featureGroup.value?.getLayers().length || 0
        });
        
        // Forcer la rupture des références
        if ((layer as any)._map) (layer as any)._map = null;
        if ((layer as any)._mapToAdd) (layer as any)._mapToAdd = null;
      } catch (error) {
        console.error('Erreur lors de la suppression du rectangle original:', error);
      }
      
      // Vérification finale - s'il y a déjà un TextRectangle avec ces limites, ne pas en créer un autre
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
        console.log('[TextRectangle] Un TextRectangle avec ces limites existe déjà, pas besoin d\'en créer un nouveau');
        selectedShape.value = existingTextRectangles[0];
        return existingTextRectangles[0] as TextRectangle;
      }
      
      console.log('[TextRectangle] Création d\'un nouveau TextRectangle avec les limites:', bounds.toBBoxString());
      
      // Créer le TextRectangle avec les limites et options sauvegardées
      const textRect = new TextRectangle(
        bounds,
        'Double-cliquez pour éditer',
        options
      );
      console.log('[TextRectangle] TextRectangle créé:', {
        id: (textRect as any)._leaflet_id || 'unknown',
        instanceType: textRect.constructor.name,
        hasTextElement: !!textRect.getTextElement()
      });
      
      // Ajouter TextRectangle au feature group et le sélectionner
      featureGroup.value.addLayer(textRect);
      console.log('[TextRectangle] Ajouté au feature group, nouveau compte:', featureGroup.value.getLayers().length);
      
      // Définir la forme sélectionnée
      selectedShape.value = textRect;
      
      // Édition auto au moment de la création pour une meilleure UX
      setTimeout(() => {
        try {
          textRect.fire('dblclick', { 
            latlng: textRect.getCenter(),
            originalEvent: new MouseEvent('dblclick')
          } as L.LeafletMouseEvent);
        } catch (err) {
          console.error('[TextRectangle] Erreur lors du démarrage de l\'édition auto:', err);
        }
      }, 100);
      
      return textRect;
    } catch (error) {
      console.error('Erreur lors de la création du TextRectangle:', error);
      return null;
    }
  };

  /**
   * Génère des points de contrôle temporaires pour un TextRectangle (affiché au survol)
   * @param layer TextRectangle survolé
   */
  const generateTempTextRectangleControlPoints = (layer: TextRectangle) => {
    if (!map.value || !tempControlPointsGroup.value) return;
    
    console.log('[TextRectangle] Pas de points de contrôle temporaires pour TextRectangle - utiliser double-clic pour éditer');
    
    // Juste ajouter un indice simple pour montrer qu'il est survolable
    if (layer.getCenter()) {
      const textHint = L.circleMarker(layer.getCenter(), {
        radius: 0,  // Marqueur invisible
        className: 'text-hint-marker',
        pmIgnore: true
      });
      tempControlPointsGroup.value.addLayer(textHint);
    }
  };

  return {
    selectTextRectangle,
    createTextRectangleFromRectangle,
    generateTempTextRectangleControlPoints
  };
} 