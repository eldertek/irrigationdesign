import * as L from 'leaflet';
/**
 * Interface d'options étendues pour TextRectangle
 */
export interface TextRectangleOptions extends L.PolylineOptions {
  // Options spécifiques au texte
  textColor?: string;
  fontSize?: string;
  fontFamily?: string;
  textAlign?: string;
  backgroundColor?: string;
  backgroundOpacity?: number;
  bold?: boolean;
  italic?: boolean;
} 