import { ref, computed } from 'vue';
import * as turf from '@turf/turf';

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
      const coords = layer.getLatLngs();
      const turfPolygon = turf.polygon([coords[0].map((ll: any) => [ll.lng, ll.lat])]);
      return turf.area(turfPolygon);
    }
    return 0;
  };

  const calculateLength = (layer: L.Layer): number => {
    if ('getLatLngs' in layer) {
      const coords = layer.getLatLngs();
      if (Array.isArray(coords)) {
        const turfLine = turf.lineString(coords.map((ll: any) => [ll.lng, ll.lat]));
        return turf.length(turfLine, { units: 'meters' });
      }
    }
    return 0;
  };

  const calculatePerimeter = (layer: L.Layer): number => {
    if ('getLatLngs' in layer) {
      const coords = layer.getLatLngs();
      const turfLine = turf.lineString([...coords[0].map((ll: any) => [ll.lng, ll.lat]), [coords[0][0].lng, coords[0][0].lat]]);
      return turf.length(turfLine, { units: 'meters' });
    }
    return 0;
  };

  const calculateRadius = (layer: any): number => {
    if (layer._mRadius) {
      return layer._mRadius;
    }
    return 0;
  };

  const calculateProperties = (layer: any, type: string) => {
    const properties: any = {
      type,
      style: layer.options
    };

    switch (type) {
      case 'Circle':
        properties.radius = calculateRadius(layer);
        properties.diameter = properties.radius * 2;
        properties.area = Math.PI * Math.pow(properties.radius, 2);
        properties.perimeter = 2 * Math.PI * properties.radius;
        properties.center = layer.getLatLng();
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
        break;

      case 'Rectangle':
      case 'Polygon':
        properties.area = calculateArea(layer);
        properties.perimeter = calculatePerimeter(layer);
        break;

      case 'Line':
      case 'Polyline':
        properties.length = calculateLength(layer);
        if (layer.elevation) {
          const elevationGain = layer.elevation.gain;
          const distance = properties.length;
          properties.slope = elevationGain / distance;
        }
        break;
    }

    return properties;
  };

  const updateSelectedShape = (shape: any) => {
    selectedShape.value = shape;
    if (shape) {
      shapeProperties.value = calculateProperties(shape.layer, shape.type);
    } else {
      shapeProperties.value = null;
    }
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