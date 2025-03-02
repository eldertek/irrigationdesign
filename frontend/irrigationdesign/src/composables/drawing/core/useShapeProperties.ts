/**
 * Composable pour la gestion des propriétés des formes
 */
import { Ref, nextTick } from 'vue';
import L from 'leaflet';
import * as turf from '@turf/turf';
import centroid from '@turf/centroid';
import { debounce } from '../../../utils/drawing/measurementHelpers';
import { Circle } from '../../../utils/Circle';
import { Rectangle } from '../../../utils/Rectangle';
import { Line } from '../../../utils/Line';
import { CircleArc } from '../../../utils/CircleArc';
import { TextRectangle } from '../../../utils/TextRectangle';

interface UseShapePropertiesOptions {
  selectedShape: Ref<any>;
}

export function useShapeProperties(options: UseShapePropertiesOptions) {
  const { selectedShape } = options;

  /**
   * Force la mise à jour de selectedShape avec une nouvelle référence
   * @param layer La couche à affecter
   */
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

  /**
   * Met à jour les propriétés d'une couche selon son type
   * @param layer Couche à mettre à jour
   * @param shapeType Type de forme
   */
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

  /**
   * Calcule les propriétés d'une forme selon son type
   * @param layer Couche à analyser
   * @param type Type de forme
   * @returns Propriétés calculées
   */
  const calculateShapeProperties = (layer: L.Layer, type: string): any => {
    console.log('=== CALCULATING SHAPE PROPERTIES START ===');
    console.log('Input layer:', {
      type,
      instanceof: {
        Circle: layer instanceof Circle,
        Rectangle: layer instanceof Rectangle,
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
      } else if (layer instanceof Circle) {
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
      else if (layer instanceof Rectangle) {
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

  return {
    updateLayerProperties,
    calculateShapeProperties,
    forceShapeUpdate
  };
} 