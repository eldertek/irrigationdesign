import L from 'leaflet';
import '@geoman-io/leaflet-geoman-free';
declare module 'leaflet' {
  interface Layer {
    properties?: any;
    pm?: any;
    _map?: L.Map | undefined;
    _textLayer?: L.Marker;
  }
  interface Map {
    pm: PMMap;
    dragging: any;
    getZoom(): number;
  }
  interface DivIcon {
    options: {
      html: string;
      className: string;
      iconSize: [number | null, number | null];
    }
  }
  interface MarkerOptions {
    icon: L.DivIcon;
    draggable?: boolean;
    pmIgnore?: boolean;
  }
}
export interface TextStyle {
  fontSize: string;
  color: string;
  backgroundColor: string;
  backgroundOpacity: number;
  borderColor: string;
  borderWidth: string;
  borderOpacity: number;
  padding: string;
  borderRadius: string;
  hasBorder: boolean;
  rotation: number;
  physicalSize: number;  // Taille physique en mètres
  fontFamily?: string;
  fontWeight?: string;
  textAlign?: string;
  textDecoration?: string;
  textTransform?: string;
  letterSpacing?: string;
  lineHeight?: string;
  maxWidth?: string;
  minWidth?: string;
  wordWrap?: string;
  overflow?: string;
  textShadow?: string;
}
export interface TextProperties {
  type: 'text';
  text: string;
  style: TextStyle;
  physicalWidth: number;
  physicalHeight: number;
  _textLayer?: L.Marker;
}
export interface TextRectangle extends L.Rectangle {
  properties: TextProperties;
  _textLayer?: L.Marker;
}
export interface TextMarker extends L.Marker {
  properties: TextProperties;
  getElement(): HTMLElement | undefined;
} 