import type L from 'leaflet';

// Interface for drawable layers
export interface DrawableLayer extends L.Layer {
  getBounds(): L.LatLngBounds;
  getLatLng?(): L.LatLng;
  getRadius?(): number;
  properties?: any;
  startResize?(): void;
  updateResizePreview?(bounds: L.LatLngBounds): void;
  endResize?(bounds: L.LatLngBounds): void;
}

export interface Style {
  color?: string;
  fillColor?: string;
  fillOpacity?: number;
  weight?: number;
  opacity?: number;
  fontSize?: string;
  dashArray?: string;
}

export interface TextStyle {
  color: string;
  fontSize: string;
  fontFamily: string;
  textAlign: 'left' | 'center' | 'right';
  backgroundColor: string;
  backgroundOpacity: number;
  bold: boolean;
  italic: boolean;
}

export interface TextRectangleStyle extends Style {
  textStyle: TextStyle;
}

export interface Bounds {
  southWest: [number, number];
  northEast: [number, number];
}

export interface BaseData {
  style: Style;
  rotation?: number;
}

export interface CircleData extends BaseData {
  center: [number, number];  // [longitude, latitude]
  radius: number;
  style: Style;
}

export interface RectangleData extends BaseData {
  bounds: Bounds;
  style: Style;
}

export interface SemicircleData extends BaseData {
  center: [number, number];  // [longitude, latitude]
  radius: number;
  startAngle: number;
  endAngle: number;
  style: Style;
}

export interface LineData extends BaseData {
  points: [number, number][];  // Array of [longitude, latitude]
  style: Style;
}

export interface TextData {
  bounds: Bounds;
  content: string;
  style: TextRectangleStyle;
  rotation?: number;
}

export interface PolygonData extends BaseData {
  points: [number, number][];  // Array of [longitude, latitude]
}

export type ShapeData = CircleData | RectangleData | SemicircleData | LineData | TextData | PolygonData;

export interface DrawingElement {
  id?: number;
  type_forme: 'CERCLE' | 'RECTANGLE' | 'DEMI_CERCLE' | 'LIGNE' | 'TEXTE' | 'POLYGON' | 'UNKNOWN';
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