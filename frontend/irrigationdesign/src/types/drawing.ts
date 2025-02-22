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

export interface TextData extends BaseData {
  position: [number, number];  // [longitude, latitude]
  content: string;
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