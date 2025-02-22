import { ref, computed } from 'vue';
import * as turf from '@turf/turf';
import type { LatLng } from 'leaflet';

interface LeafletLayerWithLatLngs extends L.Layer {
  getLatLngs(): LatLng[] | LatLng[][] | LatLng[][][];
}

interface CircleLayerOptions extends L.LayerOptions {
  startAngle?: number;
  stopAngle?: number;
  [key: string]: any;
}

interface LeafletCircleLayer extends L.Layer {
  _mRadius: number;
  getLatLng(): LatLng;
  getRadius?(): number;
  options: CircleLayerOptions;
}

export function useShapeProperties() {
  const selectedShape = ref<any>(null);
  const shapeProperties = ref<any>(null);

  const formatSlope = (slope: number): string => {
    return `${(slope * 100).toFixed(1)}%`;
  };

  const formatAngle = (angle: number): string => {
    return `${((angle % 360 + 360) % 360).toFixed(1)}°`;
  };

  // Normaliser un angle entre 0 et 360 degrés
  const normalizeAngle = (angle: number): number => {
    return (angle % 360 + 360) % 360;
  };

  // Calculer la longueur d'un arc de cercle
  const calculateArcLength = (radius: number, startAngle: number, endAngle: number): number => {
    const normalizedStart = normalizeAngle(startAngle);
    const normalizedEnd = normalizeAngle(endAngle);
    let angleDiff = normalizedEnd - normalizedStart;
    if (angleDiff <= 0) angleDiff += 360;
    return (Math.PI * radius * angleDiff) / 180;
  };

  // Calculer l'aire d'un secteur circulaire
  const calculateSectorArea = (radius: number, startAngle: number, endAngle: number): number => {
    const normalizedStart = normalizeAngle(startAngle);
    const normalizedEnd = normalizeAngle(endAngle);
    let angleDiff = normalizedEnd - normalizedStart;
    if (angleDiff <= 0) angleDiff += 360;
    return (Math.PI * radius * radius * angleDiff) / 360;
  };

  const calculateArea = (layer: L.Layer): number => {
    if ('getLatLngs' in layer) {
      const polygonLayer = layer as LeafletLayerWithLatLngs;
      const coords = polygonLayer.getLatLngs();
      if (Array.isArray(coords) && coords[0]) {
        const coordArray = Array.isArray(coords[0]) ? coords[0] : coords;
        const points = coordArray.map((ll: any) => [ll.lng, ll.lat]);
        const turfPolygon = turf.polygon([points]);
        return turf.area(turfPolygon);
      }
    }
    return 0;
  };

  const calculateLength = (layer: L.Layer): number => {
    if ('getLatLngs' in layer) {
      const lineLayer = layer as LeafletLayerWithLatLngs;
      const coords = lineLayer.getLatLngs();
      if (Array.isArray(coords)) {
        const points = (Array.isArray(coords[0]) ? coords[0] : coords).map((ll: any) => [ll.lng, ll.lat]);
        const turfLine = turf.lineString(points);
        return turf.length(turfLine, { units: 'meters' });
      }
    }
    return 0;
  };

  const calculatePerimeter = (layer: L.Layer): number => {
    if ('getLatLngs' in layer) {
      const polygonLayer = layer as LeafletLayerWithLatLngs;
      const coords = polygonLayer.getLatLngs();
      if (Array.isArray(coords) && coords[0]) {
        const coordArray = Array.isArray(coords[0]) ? coords[0] : coords;
        const points = [...coordArray.map((ll: any) => [ll.lng, ll.lat])];
        // Fermer le polygone en ajoutant le premier point à la fin
        if (points.length > 0) {
          points.push(points[0]);
        }
        const turfLine = turf.lineString(points);
        return turf.length(turfLine, { units: 'meters' });
      }
    }
    return 0;
  };

  const calculateRadius = (layer: any): number => {
    const circleLayer = layer as LeafletCircleLayer;
    if (circleLayer._mRadius) {
      return circleLayer._mRadius;
    }
    if (circleLayer.getRadius) {
      return circleLayer.getRadius();
    }
    return 0;
  };

  const calculateProperties = (layer: any, type: string) => {
    console.log('=== CALCULATE PROPERTIES START ===');
    console.log('Input:', { 
      type, 
      layer: {
        constructor: layer?.constructor?.name,
        _mRadius: layer._mRadius,
        _latlng: layer._latlng,
        options: layer.options
      }
    });

    const properties: any = {
      type,
      style: layer.options
    };

    try {
      switch (type) {
        case 'Circle':
          const radius = calculateRadius(layer);
          console.log('Circle radius calculation:', {
            _mRadius: layer._mRadius,
            calculatedRadius: radius,
            getRadius: layer.getRadius?.()
          });
          
          properties.radius = radius;
          properties.diameter = properties.radius * 2;
          properties.area = Math.PI * Math.pow(properties.radius, 2);
          properties.perimeter = 2 * Math.PI * properties.radius;
          properties.center = layer.getLatLng();
          console.log('Circle properties calculated:', properties);
          break;

        case 'Semicircle':
          properties.radius = calculateRadius(layer);
          properties.diameter = properties.radius * 2;
          properties.center = layer.getLatLng();
          
          // Angles normalisés
          properties.startAngle = normalizeAngle(layer.options.startAngle || 0);
          properties.stopAngle = normalizeAngle(layer.options.stopAngle || 180);
          
          // Calculs précis pour le demi-cercle
          properties.arcLength = calculateArcLength(
            properties.radius,
            properties.startAngle,
            properties.stopAngle
          );
          
          properties.area = calculateSectorArea(
            properties.radius,
            properties.startAngle,
            properties.stopAngle
          );
          
          // Calcul de la corde
          properties.chordLength = 2 * properties.radius * Math.abs(
            Math.sin((properties.stopAngle - properties.startAngle) * Math.PI / 360)
          );
          console.log('Semicircle properties calculated:', properties);
          break;

        case 'Rectangle':
        case 'Polygon':
          properties.area = calculateArea(layer);
          properties.perimeter = calculatePerimeter(layer);
          console.log('Rectangle/Polygon properties calculated:', properties);
          break;

        case 'Line':
        case 'Polyline':
          properties.length = calculateLength(layer);
          if (layer.elevation) {
            const elevationGain = layer.elevation.gain;
            const distance = properties.length;
            properties.slope = elevationGain / distance;
          }
          console.log('Line/Polyline properties calculated:', properties);
          break;
      }
    } catch (error) {
      console.error('Error calculating properties:', error);
    }

    console.log('=== CALCULATE PROPERTIES END ===');
    console.log('Final properties:', properties);
    return properties;
  };

  const updateSelectedShape = (shape: any) => {
    console.log('=== UPDATE SELECTED SHAPE START ===');
    console.log('Input shape:', {
      type: shape?.type,
      properties: shape?.properties,
      layer: shape?.layer ? {
        type: shape.layer.constructor.name,
        options: shape.layer.options,
        _mRadius: shape.layer._mRadius,
        _latlng: shape.layer._latlng,
        bounds: shape.layer.getBounds?.()
      } : {
        type: shape?.constructor?.name,
        options: shape?.options,
        _mRadius: shape?._mRadius,
        _latlng: shape?._latlng,
        bounds: shape?.getBounds?.()
      }
    });

    // Nettoyer l'ancien écouteur si présent
    if (selectedShape.value?.off) {
      selectedShape.value.off('properties:updated');
    }

    selectedShape.value = shape;
    
    if (shape) {
      // Ajouter un écouteur pour les mises à jour de propriétés
      if (shape.on) {
        console.log('Adding properties:updated event listener');
        shape.on('properties:updated', (e: any) => {
          console.log('Properties updated event received:', {
            event: e,
            shape: {
              _mRadius: e.shape._mRadius,
              _latlng: e.shape._latlng,
              properties: e.shape.properties,
              constructor: e.shape.constructor.name
            }
          });
          
          // Recalculer les propriétés à partir de la forme actuelle
          const targetShape = e.shape;
          const shapeType = targetShape.properties?.type || 'unknown';
          
          console.log('Updating properties for shape:', {
            type: shapeType,
            _mRadius: targetShape._mRadius,
            _latlng: targetShape._latlng,
            currentProperties: targetShape.properties
          });
          
          const updatedProps = calculateProperties(targetShape, shapeType);
          console.log('Recalculated properties:', updatedProps);
          
          // Forcer une nouvelle référence pour déclencher la réactivité
          shapeProperties.value = { ...updatedProps };
          
          // Mettre à jour les propriétés de la forme avec une nouvelle référence
          targetShape.properties = { ...updatedProps };
          
          console.log('Updated shapeProperties:', shapeProperties.value);
        });
      }
      
      // Calculer les propriétés initiales
      const calculatedProps = calculateProperties(
        shape.layer || shape, 
        shape.type || shape.properties?.type
      );
      console.log('Initial calculated properties:', calculatedProps);
      
      // Forcer une nouvelle référence pour déclencher la réactivité
      shapeProperties.value = { ...calculatedProps };
      
      // Mettre à jour les propriétés de la forme avec une nouvelle référence
      if (shape.layer) {
        shape.layer.properties = { ...calculatedProps };
      } else {
        shape.properties = { ...calculatedProps };
      }
      
      console.log('Initial shapeProperties set:', shapeProperties.value);
    } else {
      console.log('No shape provided, clearing properties');
      shapeProperties.value = null;
    }
    console.log('=== UPDATE SELECTED SHAPE END ===');
  };

  const formattedProperties = computed(() => {
    if (!shapeProperties.value) return null;

    const formatted: any = { ...shapeProperties.value };

    if (formatted.area) {
      formatted.areaFormatted = `${(formatted.area / 10000).toFixed(2)} ha`;
    }
    if (formatted.length) {
      formatted.lengthFormatted = `${formatted.length.toFixed(1)} m`;
    }
    if (formatted.arcLength) {
      formatted.arcLengthFormatted = `${formatted.arcLength.toFixed(1)} m`;
    }
    if (formatted.perimeter) {
      formatted.perimeterFormatted = `${(formatted.perimeter / 1000).toFixed(2)} km`;
    }
    if (formatted.radius) {
      formatted.radiusFormatted = `${formatted.radius.toFixed(1)} m`;
    }
    if (formatted.diameter) {
      formatted.diameterFormatted = `${formatted.diameter.toFixed(1)} m`;
    }
    if (formatted.width) {
      formatted.widthFormatted = `${formatted.width.toFixed(1)} m`;
    }
    if (formatted.height) {
      formatted.heightFormatted = `${formatted.height.toFixed(1)} m`;
    }
    if (formatted.chordLength) {
      formatted.chordLengthFormatted = `${formatted.chordLength.toFixed(1)} m`;
    }
    if (formatted.slope) {
      formatted.slopeFormatted = formatSlope(formatted.slope);
    }
    if (formatted.startAngle) {
      formatted.startAngleFormatted = formatAngle(formatted.startAngle);
    }
    if (formatted.stopAngle) {
      formatted.stopAngleFormatted = formatAngle(formatted.stopAngle);
    }

    return formatted;
  });

  return {
    selectedShape,
    shapeProperties,
    formattedProperties,
    updateSelectedShape,
    calculateProperties,
    normalizeAngle,
    calculateArcLength,
    calculateSectorArea
  };
} 