/**
 * Composable pour la gestion des points de contrôle des cercles
 */
import { Ref, nextTick } from 'vue';
import L from 'leaflet';
import { formatMeasure, formatArea } from '../../../utils/drawing/formatters';
import { useControlPoints, type ControlPoint } from '../core/useControlPoints';
import { Circle } from '../../../utils/Circle';

interface UseCircleControlsOptions {
  map: Ref<L.Map | null>;
  controlPointsGroup: Ref<L.LayerGroup | null>;
  tempControlPointsGroup: Ref<L.LayerGroup | null>;
  selectedShape: Ref<any>;
  updateLayerProperties: (layer: L.Layer, shapeType: string) => void;
}

export function useCircleControls(options: UseCircleControlsOptions) {
  const { map, controlPointsGroup, tempControlPointsGroup, selectedShape, updateLayerProperties } = options;
  
  // Utiliser le composable des points de contrôle
  const { 
    activeControlPoints,
    createControlPoint, 
    createTempControlPoint,
    clearActiveControlPoints,
    addMeasureEvents 
  } = useControlPoints({ map, controlPointsGroup, tempControlPointsGroup });

  /**
   * Affiche les points de contrôle pour un cercle
   * @param layer Cercle à manipuler
   */
  const updateCircleControlPoints = (layer: Circle) => {
    if (!map.value) return;

    clearActiveControlPoints();
    const center = layer.getLatLng();
    const radius = layer.getRadius();

    // Point central (vert)
    const centerPoint = createControlPoint(center, '#059669') as ControlPoint;
    activeControlPoints.value.push(centerPoint);

    // Ajouter les mesures au point central
    addMeasureEvents(centerPoint, layer, () => {
      return [
        formatMeasure(radius, 'm', 'Rayon'),
        formatMeasure(radius * 2, 'm', 'Diamètre'),
        formatArea(Math.PI * Math.pow(radius, 2), 'Surface')
      ].join('<br>');
    });

    // Points cardinaux (bleu)
    const cardinalPoints: ControlPoint[] = [];
    const cardinalAngles = [0, 45, 90, 135, 180, 225, 270, 315];
    
    cardinalAngles.forEach((angle) => {
      const point = layer.calculatePointOnCircle(angle);
      const controlPoint = createControlPoint(point, '#2563EB') as ControlPoint;
      cardinalPoints.push(controlPoint);
      activeControlPoints.value.push(controlPoint);

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
            formatArea(Math.PI * Math.pow(layer.getRadius(), 2), 'Surface')
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

  /**
   * Génère des points de contrôle temporaires pour un cercle (affichés au survol)
   * @param layer Cercle survolé
   */
  const generateTempCircleControlPoints = (layer: Circle) => {
    if (!map.value || !tempControlPointsGroup.value) return;
    
    // Supprimer les points temporaires existants
    tempControlPointsGroup.value.clearLayers();
    
    const center = layer.getLatLng();
    
    // Point central temporaire (vert)
    const tempCenterPoint = createTempControlPoint(center, '#059669');
    tempControlPointsGroup.value.addLayer(tempCenterPoint);

    // Points cardinaux temporaires (bleu)
    layer.getCardinalPoints().forEach(point => {
      const tempControlPoint = createTempControlPoint(point, '#2563EB');
      tempControlPointsGroup.value.addLayer(tempControlPoint);
    });
  };

  return {
    updateCircleControlPoints,
    generateTempCircleControlPoints
  };
} 