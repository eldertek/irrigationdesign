import L from 'leaflet';
import * as turf from '@turf/turf';
/**
 * Classe Rectangle personnalisée qui utilise L.Polygon pour permettre une vraie rotation
 * en utilisant les coordonnées pixels de la carte pour garantir un rectangle visuellement correct
 */
export class Rectangle extends L.Polygon {
  private _width: number;
  private _height: number;
  private _center: L.LatLng;
  private _rotation: number;
  private _isMapReady: boolean = false;
  properties: any;

  constructor(
    bounds: L.LatLngBoundsExpression,
    options: L.PolylineOptions = {}
  ) {
    // Initialiser avec un polygone vide
    super([], {
      ...options,
      pmIgnore: false,
      interactive: true
    });

    // Convertir bounds en LatLngBounds
    const latLngBounds = L.latLngBounds(bounds);
    
    // Initialiser les propriétés
    this._center = latLngBounds.getCenter();
    this._rotation = 0;

    // Calculer les dimensions initiales en mètres
    const sw = latLngBounds.getSouthWest();
    const ne = latLngBounds.getNorthEast();
    this._width = turf.distance([sw.lng, sw.lat], [ne.lng, sw.lat], { units: 'meters' });
    this._height = turf.distance([sw.lng, sw.lat], [sw.lng, ne.lat], { units: 'meters' });

    // Initialiser les propriétés
    this.properties = {
      type: 'Rectangle',
      style: options || {},
      rotation: this._rotation
    };

    // Écouter les événements
    this.on('add', (e) => {
      this._isMapReady = true;
      this._updatePolygonCoordinates();
      this.updateProperties();
    });

    this.on('remove', () => {
      this._isMapReady = false;
    });
  }

  /**
   * Met à jour les coordonnées du polygone en fonction des dimensions et de la rotation
   * en utilisant les coordonnées pixels de la carte
   */
  private _updatePolygonCoordinates(): void {
    if (!this._isMapReady || !this._map) return;

    // Convertir le centre en pixels
    const centerPoint = this._map.latLngToContainerPoint(this._center);

    // Calculer les coins en pixels (non pivotés)
    const pixelsPerMeter = this._getPixelsPerMeter();
    const halfWidthPx = (this._width * pixelsPerMeter) / 2;
    const halfHeightPx = (this._height * pixelsPerMeter) / 2;

    const unrotatedCorners = [
      L.point(centerPoint.x - halfWidthPx, centerPoint.y + halfHeightPx), // SW
      L.point(centerPoint.x + halfWidthPx, centerPoint.y + halfHeightPx), // SE
      L.point(centerPoint.x + halfWidthPx, centerPoint.y - halfHeightPx), // NE
      L.point(centerPoint.x - halfWidthPx, centerPoint.y - halfHeightPx)  // NW
    ];

    // Appliquer la rotation en pixels
    const rad = (-this._rotation * Math.PI) / 180;
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);

    const rotatedCorners = unrotatedCorners.map(point => {
      const dx = point.x - centerPoint.x;
      const dy = point.y - centerPoint.y;
      return L.point(
        centerPoint.x + (dx * cos - dy * sin),
        centerPoint.y + (dx * sin + dy * cos)
      );
    });

    // Convertir les points pixels en LatLng
    const latLngs = rotatedCorners.map(point => 
      this._map!.containerPointToLatLng(point)
    );

    // Mettre à jour les coordonnées du polygone
    this.setLatLngs(latLngs);
  }

  /**
   * Calcule le nombre de pixels par mètre à la latitude actuelle et au zoom actuel
   */
  private _getPixelsPerMeter(): number {
    if (!this._isMapReady || !this._map) return 1;

    const centerPoint = this._map.latLngToContainerPoint(this._center);
    const testPoint = this._map.latLngToContainerPoint(
      L.latLng(this._center.lat, this._center.lng + 0.0001)
    );
    
    const pixelDistance = testPoint.x - centerPoint.x;
    const meterDistance = turf.distance(
      [this._center.lng, this._center.lat],
      [this._center.lng + 0.0001, this._center.lat],
      { units: 'meters' }
    );

    return Math.abs(pixelDistance / meterDistance);
  }

  /**
   * Obtient les coins du rectangle avec la rotation appliquée
   */
  getRotatedCorners(): L.LatLng[] {
    return this.getLatLngs()[0] as L.LatLng[];
  }

  /**
   * Calcule les points milieu de chaque côté du rectangle
   */
  getMidPoints(): L.LatLng[] {
    const corners = this.getRotatedCorners();
    return [
      this._getMidPoint(corners[3], corners[0]), // Milieu haut
      this._getMidPoint(corners[0], corners[1]), // Milieu droite
      this._getMidPoint(corners[1], corners[2]), // Milieu bas
      this._getMidPoint(corners[2], corners[3])  // Milieu gauche
    ];
  }

  /**
   * Calcule le point milieu entre deux points
   */
  private _getMidPoint(p1: L.LatLng, p2: L.LatLng): L.LatLng {
    return L.latLng(
      (p1.lat + p2.lat) / 2,
      (p1.lng + p2.lng) / 2
    );
  }

  /**
   * Obtient le centre du rectangle
   */
  getCenter(): L.LatLng {
    return this._center;
  }

  /**
   * Définit le centre du rectangle
   */
  setCenter(center: L.LatLng): void {
    this._center = center;
    this._updatePolygonCoordinates();
    this.updateProperties();
  }

  /**
   * Obtient l'angle de rotation actuel
   */
  getRotation(): number {
    return this._rotation;
  }

  /**
   * Calcule l'angle entre deux points en degrés (0-360)
   */
  private _calculateAngle(point: L.LatLng, center: L.LatLng): number {
    const dx = point.lng - center.lng;
    const dy = point.lat - center.lat;
    let angle = (Math.atan2(dy, dx) * 180 / Math.PI + 90) % 360;
    if (angle < 0) angle += 360;
    return angle;
  }

  /**
   * Définit l'angle de rotation
   */
  setRotation(angle: number): void {
    // Normaliser l'angle entre 0 et 360
    this._rotation = ((angle % 360) + 360) % 360;
    this._updatePolygonCoordinates();
    this.updateProperties();
  }

  /**
   * Obtient les dimensions du rectangle
   */
  getDimensions(): { width: number; height: number } {
    return {
      width: this._width,
      height: this._height
    };
  }

  /**
   * Définit les dimensions du rectangle
   */
  setDimensions(width: number, height: number): void {
    this._width = width;
    this._height = height;
    this._updatePolygonCoordinates();
    this.updateProperties();
  }

  /**
   * Redimensionne le rectangle depuis un point de contrôle de coin
   */
  resizeFromCorner(cornerIndex: number, newLatLng: L.LatLng): void {
    if (!this._isMapReady || !this._map) return;

    // Convertir les points en pixels
    const centerPoint = this._map.latLngToContainerPoint(this._center);
    const newPoint = this._map.latLngToContainerPoint(newLatLng);

    // Calculer le vecteur du centre au nouveau point
    const dx = newPoint.x - centerPoint.x;
    const dy = newPoint.y - centerPoint.y;

    // Appliquer la rotation inverse
    const rad = (-this._rotation * Math.PI) / 180;
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);
    const rotatedX = dx * cos - dy * sin;
    const rotatedY = dx * sin + dy * cos;

    // Calculer les nouvelles dimensions en pixels
    const pixelsPerMeter = this._getPixelsPerMeter();
    this._width = Math.abs(rotatedX * 2) / pixelsPerMeter;
    this._height = Math.abs(rotatedY * 2) / pixelsPerMeter;

    this._updatePolygonCoordinates();
    this.updateProperties();
  }

  /**
   * Redimensionne le rectangle depuis un point de contrôle de côté
   */
  resizeFromSide(sideIndex: number, newLatLng: L.LatLng): void {
    if (!this._isMapReady || !this._map) return;

    // Convertir les points en pixels
    const centerPoint = this._map.latLngToContainerPoint(this._center);
    const newPoint = this._map.latLngToContainerPoint(newLatLng);

    // Calculer le vecteur du centre au nouveau point
    const dx = newPoint.x - centerPoint.x;
    const dy = newPoint.y - centerPoint.y;

    // Appliquer la rotation inverse
    const rad = (-this._rotation * Math.PI) / 180;
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);
    const rotatedX = dx * cos - dy * sin;
    const rotatedY = dx * sin + dy * cos;

    // Calculer les nouvelles dimensions en pixels
    const pixelsPerMeter = this._getPixelsPerMeter();
    if (sideIndex % 2 === 0) { // Côtés haut/bas
      this._height = Math.abs(rotatedY * 2) / pixelsPerMeter;
    } else { // Côtés gauche/droite
      this._width = Math.abs(rotatedX * 2) / pixelsPerMeter;
    }

    this._updatePolygonCoordinates();
    this.updateProperties();
  }

  /**
   * Déplace le rectangle
   */
  moveFromCenter(newLatLng: L.LatLng): void {
    this._center = newLatLng;
    this._updatePolygonCoordinates();
    this.updateProperties();
  }

  /**
   * Met à jour les propriétés du rectangle
   */
  updateProperties(): void {
    this.properties = {
      ...this.properties,
      width: this._width,
      height: this._height,
      area: this._width * this._height,
      perimeter: 2 * (this._width + this._height),
      center: this._center,
      corners: this.getRotatedCorners(),
      surfaceInterieure: this._width * this._height,
      surfaceExterieure: this._width * this._height,
      rotation: this._rotation,
      style: {
        ...this.options,
        color: this.options.color || '#3388ff',
        weight: this.options.weight || 3,
        opacity: this.options.opacity || 1,
        fillColor: this.options.fillColor || '#3388ff',
        fillOpacity: this.options.fillOpacity || 0.2,
        dashArray: (this.options as any)?.dashArray || ''
      }
    };

    this.fire('properties:updated', {
      shape: this,
      properties: this.properties
    });
  }
} 