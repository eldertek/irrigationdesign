/**
 * Utilitaires pour la gestion des styles et des transformations de couleurs
 */
import type { TextStyle } from '../../types/leaflet';

/**
 * Convertit une couleur hexadécimale en RGBA avec une opacité donnée
 * @param hex Couleur au format hexadécimal (ex: "#FF0000")
 * @param opacity Valeur d'opacité entre 0 et 1
 * @returns Chaîne RGBA (ex: "rgba(255, 0, 0, 0.5)")
 */
export const hexToRgba = (hex: string | undefined, opacity: number): string => {
  if (!hex || typeof hex !== 'string' || !hex.startsWith('#')) {
    return `rgba(0, 0, 0, ${opacity})`; // Couleur par défaut
  }
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${opacity})`;
};

/**
 * Met à jour les styles d'un élément HTML représentant du texte
 * @param element Élément HTML à modifier
 * @param style Objet de style contenant les propriétés à appliquer
 */
export const updateTextStyle = (element: HTMLElement, style: TextStyle) => {
  element.style.fontSize = style.fontSize;
  element.style.color = style.color;
  element.style.backgroundColor = hexToRgba(style.backgroundColor, style.backgroundOpacity);
  if (style.hasBorder) {
    element.style.border = `${style.borderWidth} solid ${hexToRgba(style.borderColor, style.borderOpacity)}`;
  } else {
    element.style.border = 'none';
  }
  element.style.padding = style.padding;
  element.style.borderRadius = style.borderRadius;
};

/**
 * Convertit des mètres en pixels selon la latitude et le zoom
 * @param meters Distance en mètres
 * @param latitude Latitude en degrés
 * @param zoom Niveau de zoom de la carte
 * @returns Nombre de pixels correspondant
 */
export const metersToPixels = (meters: number, latitude: number, zoom: number): number => {
  const resolution = 156543.03392 * Math.cos(latitude * Math.PI / 180) / Math.pow(2, zoom);
  return meters / resolution;
};

/**
 * Ajoute la bordure d'un dash-array en fonction d'un style prédéfini
 * @param style Style de bordure ("solid", "dashed", "dotted", "dashdot")
 * @returns Chaîne de caractères pour le dash-array
 */
export const getDashArrayFromStyle = (style: string): string => {
  switch (style) {
    case 'dashed': return '10,10';
    case 'dotted': return '2,5';
    case 'dashdot': return '10,5,2,5';
    default: return '';
  }
}; 