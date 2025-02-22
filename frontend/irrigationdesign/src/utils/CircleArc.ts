import L from 'leaflet';

declare module 'leaflet' {
  interface Layer {
    pm?: PMLayer;
  }
}

interface PMLayer {
  enable: (options?: any) => void;
  disable: () => void;
  _markerGroup?: L.LayerGroup;
  _layers?: any[];
  _markers?: any[];
}

interface CircleArcProperties {
  type: string;
  radius: number;
  startAngle: number;
  stopAngle: number;
  orientation?: number;
  openingAngle?: number;
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
  public pm?: PMLayer;

  constructor(
    center: L.LatLng,
    radius: number,
    startAngle: number = 0,
    stopAngle: number = 180,
    options: L.PolylineOptions = {}
  ) {
    // Initialiser avec un tableau vide de points et les options
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

    // Initialiser les propriétés spécifiques au demi-cercle
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

    // Désactiver l'édition des sommets
    this.on('pm:enable', (e: any) => {
      if (this.pm) {
        this.pm._layers = [];
        this.pm._markers = [];
        this.pm._markerGroup?.clearLayers();
      }
    });

    // Empêcher la création de marqueurs d'édition
    this.on('pm:vertexadded', (e: any) => {
      if (this.pm) {
        this.pm._markerGroup?.clearLayers();
      }
    });

    // Mettre à jour la géométrie une fois que la couche est ajoutée à la carte
    this.on('add', () => {
      if (this._map) {
        this.updateGeometry();
        
        // Configurer Leaflet-Geoman pour cette forme
        if (this.pm) {
          this.pm.enable({
            allowSelfIntersection: false,
            preventMarkerRemoval: true
          });
        }
      }
    });
  }

  private normalizeAngle(angle: number): number {
    // Normaliser l'angle entre 0 et 360
    return ((angle % 360) + 360) % 360;
  }

  private calculateArcPoints(): L.LatLng[] {
    if (!this._map) return [];

    const points: L.LatLng[] = [];
    const angleRange = (this.stopAngle - this.startAngle + 360) % 360;
    
    // Ajouter le centre comme premier point
    points.push(this.center);

    // Calculer les points de l'arc en coordonnées géographiques
    for (let i = 0; i <= this.numPoints; i++) {
      const angle = this.startAngle + (angleRange * i) / this.numPoints;
      const rad = (angle * Math.PI) / 180;
      
      // Calculer le décalage en mètres
      const dx = this.radius * Math.cos(rad);
      const dy = this.radius * Math.sin(rad);
      
      // Convertir le décalage en degrés de latitude/longitude
      const latOffset = (dy / 111319.9);
      const lngOffset = (dx / (111319.9 * Math.cos(this.center.lat * Math.PI / 180)));
      
      // Créer le nouveau point
      const point = L.latLng(
        this.center.lat + latOffset,
        this.center.lng + lngOffset
      );
      
      points.push(point);
    }

    // Fermer le polygone en revenant au centre
    points.push(this.center);

    return points;
  }

  setRadius(radius: number): this {
    if (radius <= 0) return this;
    this.radius = radius;
    this.properties.radius = radius;
    this.updateGeometry();
    return this;
  }

  setAngles(startAngle: number, stopAngle: number): this {
    // Normaliser les angles
    this.startAngle = this.normalizeAngle(startAngle);
    this.stopAngle = this.normalizeAngle(stopAngle);
    
    // Mettre à jour les propriétés
    this.properties.startAngle = this.startAngle;
    this.properties.stopAngle = this.stopAngle;
    this.properties.style.startAngle = this.startAngle;
    this.properties.style.stopAngle = this.stopAngle;
    
    this.updateGeometry();
    return this;
  }

  setOpeningAngle(angle: number): this {
    if (angle < 0 || angle > 360) return this;
    this.stopAngle = this.normalizeAngle(this.startAngle + angle);
    this.updateGeometry();
    return this;
  }

  setCenter(center: L.LatLng): this {
    if (!center.lat || !center.lng) return this;
    this.center = center;
    this.updateGeometry();
    return this;
  }

  getCenter(): L.LatLng {
    return this.center;
  }

  getRadius(): number {
    return this.radius;
  }

  getStartAngle(): number {
    return this.startAngle;
  }

  getStopAngle(): number {
    return this.stopAngle;
  }

  getOpeningAngle(): number {
    return (this.stopAngle - this.startAngle + 360) % 360;
  }

  private updateGeometry(): void {
    if (!this._map) return;
    const points = this.calculateArcPoints();
    if (points.length > 0) {
      this.setLatLngs([points]);
    }
  }

  // Surcharger la méthode toGeoJSON pour identifier correctement le type
  toGeoJSON() {
    const geoJSON = super.toGeoJSON();
    return {
      ...geoJSON,
      properties: {
        ...geoJSON.properties,
        type: 'Semicircle',
        radius: this.radius,
        startAngle: this.startAngle,
        stopAngle: this.stopAngle
      }
    };
  }
} 