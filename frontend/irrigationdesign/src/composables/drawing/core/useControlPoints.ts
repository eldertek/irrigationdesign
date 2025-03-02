/**
 * Composable pour la gestion des points de contrôle
 */
import { ref, Ref } from 'vue';
import L from 'leaflet';
import { formatMeasure } from '../../../utils/drawing/formatters';
import { showMeasureTooltip, updateMeasureTooltip, throttle } from '../../../utils/drawing/measurementHelpers';

export interface ControlPoint extends L.CircleMarker {
  measureDiv?: HTMLElement;
}

interface UseControlPointsOptions {
  map: Ref<L.Map | null>;
  controlPointsGroup: Ref<L.LayerGroup | null>;
  tempControlPointsGroup: Ref<L.LayerGroup | null>;
}

export function useControlPoints(options: UseControlPointsOptions) {
  const { map, controlPointsGroup, tempControlPointsGroup } = options;
  
  // Points de contrôle actifs
  const activeControlPoints = ref<ControlPoint[]>([]);

  /**
   * Crée un point de contrôle à une position donnée
   * @param position Position du point
   * @param color Couleur du point
   * @returns Point de contrôle créé
   */
  const createControlPoint = (position: L.LatLng, color: string = '#2563EB'): ControlPoint => {
    const point = L.circleMarker(position, {
      radius: 6,
      color: color,
      fillColor: color,
      fillOpacity: 1,
      weight: 2,
      className: 'control-point',
      pmIgnore: true
    } as L.CircleMarkerOptions) as ControlPoint;
    
    if (controlPointsGroup.value) {
      controlPointsGroup.value.addLayer(point);
    }
    
    return point;
  };

  /**
   * Crée un point de contrôle temporaire (affiché au survol)
   * @param position Position du point
   * @param color Couleur du point
   * @returns Point de contrôle temporaire
   */
  const createTempControlPoint = (position: L.LatLng, color: string = '#2563EB'): ControlPoint => {
    const point = L.circleMarker(position, {
      radius: 5, // Légèrement plus petit pour les distinguer
      color: color,
      fillColor: color,
      fillOpacity: 0.6, // Plus transparent
      weight: 1.5,
      className: 'temp-control-point',
      pmIgnore: true
    } as L.CircleMarkerOptions) as ControlPoint;
    
    if (tempControlPointsGroup.value) {
      tempControlPointsGroup.value.addLayer(point);
    }
    
    return point;
  };

  /**
   * Nettoie tous les points de contrôle actifs
   */
  const clearActiveControlPoints = () => {
    activeControlPoints.value.forEach(point => {
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
    activeControlPoints.value = [];

    // Nettoyer toutes les mesures restantes sur la carte
    document.querySelectorAll('.measure-tooltip').forEach(measure => {
      measure.remove();
    });
  };

  /**
   * Nettoie tous les points de contrôle temporaires
   */
  const clearTempControlPoints = () => {
    if (tempControlPointsGroup.value) {
      tempControlPointsGroup.value.clearLayers();
    }
  };

  /**
   * Ajoute les événements de mesure à un point de contrôle
   * @param point Point de contrôle
   * @param layer Couche associée
   * @param getMeasureText Fonction retournant le texte à afficher
   */
  const addMeasureEvents = (point: ControlPoint, layer: L.Layer, getMeasureText: () => string) => {
    point.on('mouseover', () => {
      const measureDiv = showMeasureTooltip(point.getLatLng(), getMeasureText(), map.value);
      point.measureDiv = measureDiv;
    });

    // Version throttlée pour la mise à jour des mesures
    const throttledUpdateMeasure = throttle((measureDiv: HTMLElement, position: L.LatLng, text: string) => {
      updateMeasureTooltip(measureDiv, position, text, map.value);
    }, 100); // Limiter à une mise à jour tous les 100ms

    point.on('mousemove', (e: L.LeafletMouseEvent) => {
      if (point.measureDiv && map.value) {
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

  return {
    activeControlPoints,
    createControlPoint,
    createTempControlPoint,
    clearActiveControlPoints,
    clearTempControlPoints,
    addMeasureEvents
  };
} 