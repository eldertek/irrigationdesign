import type { LatLngTuple } from 'leaflet';

export interface Style {
  color?: string;
  fillColor?: string;
  fillOpacity?: number;
  weight?: number;
  opacity?: number;
  fontSize?: string;
}

export interface BaseData {
  style: Style;
  rotation?: number;
}

export interface CircleData extends BaseData {
  center: [number, number];  // [longitude, latitude]
  radius: number;
}

export interface RectangleData extends BaseData {
  bounds: {
    southWest: [number, number];  // [longitude, latitude]
    northEast: [number, number];  // [longitude, latitude]
  };
}

export interface SemicircleData extends BaseData {
  center: [number, number];  // [longitude, latitude]
  radius: number;
  startAngle: number;
  endAngle: number;
}

export interface LineData extends BaseData {
  points: [number, number][];  // Array of [longitude, latitude]
}

// Interface pour le style de texte
export interface TextStyle {
  color?: string;
  fillColor?: string;
  fillOpacity?: number;
  weight?: number;
  opacity?: number;
  fontSize?: string;
  textColor?: string;
  fontFamily?: string;
  textAlign?: string;
  backgroundColor?: string;
  backgroundOpacity?: number;
  bold?: boolean;
  italic?: boolean;
}

// Mise à jour de l'interface TextData pour inclure un style complet
export interface TextData {
  position: [number, number]; // [longitude, latitude]
  content: string;
  style?: TextStyle;
  width?: number;
  height?: number;
  rotation?: number;
  bounds?: {
    southWest: [number, number];
    northEast: [number, number];
  };
}

export type ShapeData = CircleData | RectangleData | SemicircleData | LineData | TextData;

export interface DrawingElement {
  id?: number;
  type_forme: 'CERCLE' | 'RECTANGLE' | 'DEMI_CERCLE' | 'LIGNE' | 'TEXTE';
  data: ShapeData;
}

export interface ShapeType {
  type: "unknown" | "Rectangle" | "Circle" | "Polygon" | "Line" | "Semicircle";
  properties: {
    type?: string;
    style?: any;
    dimensions?: {
      width?: number;
      height?: number;
      radius?: number;
      orientation?: number;
    };
    area?: number;
    perimeter?: number;
    length?: number;
    rotation?: number;
    [key: string]: any;
  };
  layer: any;
} 