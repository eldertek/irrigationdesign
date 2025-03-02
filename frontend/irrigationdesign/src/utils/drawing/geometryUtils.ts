/**
 * Utilitaires pour les calculs géométriques
 */
import L from 'leaflet';
import * as turf from '@turf/turf';
import centroid from '@turf/centroid';

/**
 * Calcule le point milieu entre deux points
 * @param p1 Premier point
 * @param p2 Deuxième point
 * @returns Point milieu
 */
export const getMidPoint = (p1: L.LatLng, p2: L.LatLng): L.LatLng => {
  return L.latLng(
    (p1.lat + p2.lat) / 2,
    (p1.lng + p2.lng) / 2
  );
};

/**
 * Calcule le centre d'un polygone en utilisant turf.js
 * @param latlngs Tableau de coordonnées du polygone
 * @returns Le centre calculé
 */
export const calculatePolygonCenter = (latlngs: L.LatLng[]): L.LatLng => {
  try {
    // Convertir en format GeoJSON
    const coordinates = latlngs.map(ll => [ll.lng, ll.lat]);
    // Fermer le polygone si nécessaire
    if (coordinates.length > 0 && 
        (coordinates[0][0] !== coordinates[coordinates.length - 1][0] ||
         coordinates[0][1] !== coordinates[coordinates.length - 1][1])) {
      coordinates.push([...coordinates[0]]);
    }
    
    // Créer un polygone turf et calculer son centroïde
    const polygon = turf.polygon([coordinates]);
    const center = centroid(polygon);
    
    return L.latLng(
      center.geometry.coordinates[1],
      center.geometry.coordinates[0]
    );
  } catch (error) {
    console.error('Erreur dans le calcul du centre du polygone', error);
    
    // Méthode de secours: moyenne des coordonnées
    const sumLat = latlngs.reduce((sum, point) => sum + point.lat, 0);
    const sumLng = latlngs.reduce((sum, point) => sum + point.lng, 0);
    return L.latLng(sumLat / latlngs.length, sumLng / latlngs.length);
  }
};

/**
 * Calcule la longueur d'une ligne composée de segments
 * @param latlngs Tableau de coordonnées formant la ligne
 * @returns Longueur en mètres
 */
export const calculateLineLength = (latlngs: L.LatLng[]): number => {
  if (latlngs.length < 2) return 0;
  
  try {
    const coordinates = latlngs.map(ll => [ll.lng, ll.lat]);
    const line = turf.lineString(coordinates);
    return turf.length(line, { units: 'meters' });
  } catch (error) {
    console.error('Erreur dans le calcul de la longueur de la ligne', error);
    
    // Méthode de secours: somme des distances entre points consécutifs
    let length = 0;
    for (let i = 1; i < latlngs.length; i++) {
      length += latlngs[i-1].distanceTo(latlngs[i]);
    }
    return length;
  }
};

/**
 * Calcule la superficie d'un polygone
 * @param latlngs Tableau de coordonnées du polygone
 * @returns Superficie en mètres carrés
 */
export const calculatePolygonArea = (latlngs: L.LatLng[]): number => {
  if (latlngs.length < 3) return 0;
  
  try {
    const coordinates = latlngs.map(ll => [ll.lng, ll.lat]);
    // Fermer le polygone si nécessaire
    if (coordinates.length > 0 && 
        (coordinates[0][0] !== coordinates[coordinates.length - 1][0] ||
         coordinates[0][1] !== coordinates[coordinates.length - 1][1])) {
      coordinates.push([...coordinates[0]]);
    }
    
    const polygon = turf.polygon([coordinates]);
    return turf.area(polygon);
  } catch (error) {
    console.error('Erreur dans le calcul de la superficie du polygone', error);
    return 0;
  }
};

/**
 * Calcule le périmètre d'un polygone
 * @param latlngs Tableau de coordonnées du polygone
 * @returns Périmètre en mètres
 */
export const calculatePolygonPerimeter = (latlngs: L.LatLng[]): number => {
  if (latlngs.length < 3) return 0;
  
  try {
    // Ajouter le premier point à la fin pour former un anneau fermé
    const fullLatlngs = [...latlngs];
    if (latlngs.length > 0 && 
        (latlngs[0].lat !== latlngs[latlngs.length - 1].lat || 
         latlngs[0].lng !== latlngs[latlngs.length - 1].lng)) {
      fullLatlngs.push(latlngs[0]);
    }
    
    return fullLatlngs.reduce((acc, curr, idx, arr) => {
      if (idx === 0) return 0;
      return acc + curr.distanceTo(arr[idx - 1]);
    }, 0);
  } catch (error) {
    console.error('Erreur dans le calcul du périmètre du polygone', error);
    return 0;
  }
}; 