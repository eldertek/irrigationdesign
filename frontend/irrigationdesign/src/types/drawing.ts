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
}
export interface RectangleData extends BaseData {
  bounds: Bounds;
  rotation?: number;
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
export interface TextData {
  bounds: Bounds;
  content: string;
  style: TextRectangleStyle;
  rotation?: number;
}
export interface PolygonData extends BaseData {
  points: [number, number][];  // Array of [longitude, latitude]
}
export interface ElevationLineData extends BaseData {
  points: [number, number][];
  elevationData?: Array<{ distance: number; elevation: number }>;
  samplePointStyle?: Style;
  minMaxPointStyle?: Style;
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

// Union type pour toutes les formes possibles
export type ShapeData = 
  | TextData 
  | PolygonData 
  | LineData 
  | RectangleData 
  | CircleData
  | ElevationLineData;

// Type pour les types de formes possibles
export type DrawingElementType = 
  | 'CERCLE'
  | 'RECTANGLE'
  | 'DEMI_CERCLE'
  | 'LIGNE'
  | 'TEXTE'
  | 'POLYGON'
  | 'ELEVATIONLINE'
  | 'UNKNOWN';

// Interface principale pour un élément de dessin
export interface DrawingElement {
  id?: number;
  type_forme: DrawingElementType;
  data: ShapeData;
} 