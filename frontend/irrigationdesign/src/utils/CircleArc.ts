import L from 'leaflet';
interface CircleArcProperties {
  type: string;
  radius: number;
  startAngle: number;
  stopAngle: number;
  orientation?: number;
  openingAngle?: number;
  area?: number;
  arcLength?: number;
  perimeter?: number;
  surfaceInterieure?: number;
  surfaceExterieure?: number;
  diameter?: number;
  center?: L.LatLng;
  style: {
    fillColor?: string;
    fillOpacity?: number;
    color?: string;
    weight?: number;
    startAngle?: number;
    stopAngle?: number;
  };
}
export class CircleArc extends L.Polygon {
  private center: L.LatLng;
  private radius: number;
  private startAngle: number;
  private stopAngle: number;
  private numPoints: number;
  public properties: CircleArcProperties;
  public pm: any;
  constructor(
    center: L.LatLng,
    radius: number,
    startAngle: number = 0,
    stopAngle: number = 180,
    options: L.PolylineOptions = {}
  ) {
    super([[]], {
      ...options,
      pmIgnore: false,
      interactive: true,
      className: 'leaflet-semicircle'
    });
    this.center = center;
    this.radius = radius;
    this.startAngle = this.normalizeAngle(startAngle);
    this.stopAngle = this.normalizeAngle(stopAngle);
    this.numPoints = 64;
    this.properties = {
      type: 'Semicircle',
      radius: this.radius,
      startAngle: this.startAngle,
      stopAngle: this.stopAngle,
      style: {
        ...options,
        startAngle: this.startAngle,
        stopAngle: this.stopAngle
      }
    };
    this.on('pm:enable', () => {
      if (this.pm) {
        this.pm._layers = [];
        this.pm._markers = [];
        this.pm._markerGroup?.clearLayers();
      }
    });
    this.on('pm:vertexadded', () => {
      if (this.pm) {
        this.pm._markerGroup?.clearLayers();
      }
    });
    this.on('add', () => {
      if (this._map) {
        this.updateGeometry();
        if (this.pm) {
          this.pm.enable({
            allowSelfIntersection: false,
            preventMarkerRemoval: true
          });
        }
      }
    });
    // Calculer les propriétés géométriques initiales
    this.updateProperties();
  }
  /**
   * Normalise un angle entre 0 et 360 degrés
   */
  private normalizeAngle(angle: number): number {
    return ((angle % 360) + 360) % 360;
  }
  /**
   * Calcule les points qui composent l'arc
   */
  private calculateArcPoints(): L.LatLng[] {
    if (!this._map) return [];
    const points: L.LatLng[] = [];
    const angleRange = this.getOpeningAngle();
    points.push(this.center);
    for (let i = 0; i <= this.numPoints; i++) {
      const angle = this.startAngle + (angleRange * i) / this.numPoints;
      const rad = (angle * Math.PI) / 180;
      const dx = this.radius * Math.cos(rad);
      const dy = this.radius * Math.sin(rad);
      const latOffset = (dy / 111319.9);
      const lngOffset = (dx / (111319.9 * Math.cos(this.center.lat * Math.PI / 180)));
      const point = L.latLng(
        this.center.lat + latOffset,
        this.center.lng + lngOffset
      );
      points.push(point);
    }
    points.push(this.center);
    return points;
  }
  /**
   * Définit le rayon du demi-cercle
   */
  setRadius(radius: number): this {
    if (radius <= 0) return this;
    this.radius = radius;
    this.properties.radius = radius;
    this.updateGeometry();
    this.updateProperties();
    return this;
  }
  /**
   * Définit les angles de début et de fin du demi-cercle
   */
  setAngles(startAngle: number, stopAngle: number): this {
    // Normaliser les angles entre 0 et 360 degrés
    const normalizedStart = this.normalizeAngle(startAngle);
    const normalizedStop = this.normalizeAngle(stopAngle);

    // Calculer l'angle d'ouverture actuel
    const currentOpeningAngle = this.getOpeningAngle();

    // Calculer le nouvel angle d'ouverture
    let newOpeningAngle = (normalizedStop - normalizedStart + 360) % 360;

    // Si l'angle d'ouverture change trop brutalement, le limiter
    const maxAngleChange = 45; // Degrés maximum de changement par mouvement
    if (Math.abs(newOpeningAngle - currentOpeningAngle) > maxAngleChange) {
      if (newOpeningAngle > currentOpeningAngle) {
        newOpeningAngle = currentOpeningAngle + maxAngleChange;
      } else {
        newOpeningAngle = currentOpeningAngle - maxAngleChange;
      }
    }

    // Limiter l'angle d'ouverture entre 5° et 355°
    newOpeningAngle = Math.max(5, Math.min(355, newOpeningAngle));

    // Mettre à jour les angles en fonction du point déplacé
    if (this.startAngle === startAngle) {
      // Si on déplace le point de fin
      this.stopAngle = (this.startAngle + newOpeningAngle) % 360;
    } else {
      // Si on déplace le point de début
      this.startAngle = normalizedStart;
      this.stopAngle = (normalizedStart + newOpeningAngle) % 360;
    }

    // Mettre à jour les propriétés
    this.properties.startAngle = this.startAngle;
    this.properties.stopAngle = this.stopAngle;
    this.properties.openingAngle = newOpeningAngle;
    this.properties.style.startAngle = this.startAngle;
    this.properties.style.stopAngle = this.stopAngle;

    // Mettre à jour la géométrie
    this.updateGeometry();
    return this;
  }
  /**
   * Définit l'angle d'ouverture du demi-cercle
   */
  setOpeningAngle(angle: number): this {
    if (angle < 5 || angle > 355) return this;
    this.stopAngle = (this.startAngle + angle) % 360;
    this.properties.openingAngle = angle;
    this.updateGeometry();
    this.updateProperties();
    return this;
  }
  /**
   * Définit le centre du demi-cercle
   */
  setCenter(center: L.LatLng): this {
    if (!center.lat || !center.lng) return this;
    this.center = center;
    this.updateGeometry();
    this.updateProperties();
    return this;
  }
  /**
   * Retourne le centre du demi-cercle
   */
  getCenter(): L.LatLng {
    return this.center;
  }
  /**
   * Retourne le rayon du demi-cercle
   */
  getRadius: () => number = () => {
    return this.radius;
  };
  /**
   * Retourne l'angle de début de l'arc
   */
  getStartAngle: () => number = () => {
    return this.startAngle;
  };
  /**
   * Retourne l'angle de fin de l'arc
   */
  getStopAngle: () => number = () => {
    return this.stopAngle;
  };
  /**
   * Retourne l'angle d'ouverture entre le début et la fin de l'arc
   */
  getOpeningAngle(): number {
    return (this.stopAngle - this.startAngle + 360) % 360;
  }
  /**
   * Calcule la position d'un point sur l'arc en fonction d'un angle donné
   */
  calculatePointOnArc(angle: number): L.LatLng {
    const rad = (angle * Math.PI) / 180;
    const dx = this.radius * Math.cos(rad);
    const dy = this.radius * Math.sin(rad);
    const latOffset = (dy / 111319.9);
    const lngOffset = (dx / (111319.9 * Math.cos(this.center.lat * Math.PI / 180)));
    return L.latLng(
      this.center.lat + latOffset,
      this.center.lng + lngOffset
    );
  }
  /**
   * Calcule la position du point au milieu de l'arc
   */
  calculateMidpointPosition(): L.LatLng {
    const openingAngle = this.getOpeningAngle();
    // Calculer l'angle au milieu de l'arc visible
    const midAngle = (this.startAngle + (openingAngle / 2)) % 360;
    return this.calculatePointOnArc(midAngle);
  }
  /**
   * Calcule l'angle depuis le centre vers un point
   */
  calculateAngleToPoint(point: L.LatLng): number {
    return Math.atan2(
      point.lat - this.center.lat,
      point.lng - this.center.lng
    ) * 180 / Math.PI;
  }
  /**
   * Crée les points de contrôle pour l'édition de l'arc
   */
  createControlPoints(map: L.Map, callback: (controlPoints: any[]) => void): void {
    const controlPoints = [];
    // Calculer les positions des points
    const startPoint = this.calculatePointOnArc(this.startAngle);
    const stopPoint = this.calculatePointOnArc(this.stopAngle);
    const midPoint = this.calculateMidpointPosition();
    // Créer les points de contrôle
    // Point central (vert)
    const centerPoint = this.createControlPoint(map, this.center, '#059669');
    // Points d'extrémité (rouge)
    const startControl = this.createControlPoint(map, startPoint, '#DC2626');
    const stopControl = this.createControlPoint(map, stopPoint, '#DC2626');
    // Point de rayon (bleu)
    const radiusControl = this.createControlPoint(map, midPoint, '#2563EB');
    // Ajouter les points de contrôle au tableau
    controlPoints.push(centerPoint, startControl, stopControl, radiusControl);
    // Appeler le callback avec les points de contrôle
    callback(controlPoints);
  }
  /**
   * Crée un point de contrôle avec un style spécifique
   */
  private createControlPoint(map: L.Map, position: L.LatLng, color: string): L.CircleMarker {
    return L.circleMarker(position, {
      radius: 6,
      color: color,
      fillColor: color,
      fillOpacity: 1,
      weight: 2,
      className: 'control-point',
      pmIgnore: true
    } as L.CircleMarkerOptions).addTo(map);
  }
  /**
   * Calcule et met à jour toutes les propriétés géométriques
   */
  updateProperties(): void {
    const openingAngle = this.getOpeningAngle();
    // Calculer l'aire
    const area = (Math.PI * Math.pow(this.radius, 2) * openingAngle) / 360;
    // Calculer la longueur d'arc
    const arcLength = (2 * Math.PI * this.radius * openingAngle) / 360;
    // Calculer le périmètre (arc + 2 rayons)
    const perimeter = arcLength + 2 * this.radius;
    // Mettre à jour les propriétés
    this.properties.area = area;
    this.properties.arcLength = arcLength;
    this.properties.perimeter = perimeter;
    this.properties.openingAngle = openingAngle;
    this.properties.surfaceInterieure = area;
    this.properties.surfaceExterieure = area;
    this.properties.diameter = this.radius * 2;
    this.properties.center = this.center;
    // Émettre un événement pour signaler que les propriétés ont été mises à jour
    this.fire('properties:updated', {
      shape: this,
      properties: this.properties
    });
  }
  /**
   * Met à jour la géométrie de l'arc sur la carte
   */
  private updateGeometry(): void {
    if (!this._map) return;
    const points = this.calculateArcPoints();
    if (points.length > 0) {
      this.setLatLngs([points]);
      this.updateProperties();
    }
  }
  /**
   * Convertit l'arc en GeoJSON
   */
  toGeoJSON() {
    const geoJSON = super.toGeoJSON();
    return {
      ...geoJSON,
      properties: {
        ...geoJSON.properties,
        type: 'Semicircle',
        radius: this.radius,
        startAngle: this.startAngle,
        stopAngle: this.stopAngle,
        openingAngle: this.getOpeningAngle()
      }
    };
  }
}