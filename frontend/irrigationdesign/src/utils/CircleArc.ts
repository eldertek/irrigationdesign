import L from 'leaflet';

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
  }

  private normalizeAngle(angle: number): number {
    return ((angle % 360) + 360) % 360;
  }

  private calculateArcPoints(): L.LatLng[] {
    if (!this._map) return [];

    const points: L.LatLng[] = [];
    const angleRange = (this.stopAngle - this.startAngle + 360) % 360;
    
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

  setRadius(radius: number): this {
    if (radius <= 0) return this;
    this.radius = radius;
    this.properties.radius = radius;
    this.updateGeometry();
    return this;
  }

  setAngles(startAngle: number, stopAngle: number): this {
    // Normaliser les angles
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
    
    // Limiter l'angle d'ouverture entre 0° et 360°
    newOpeningAngle = Math.max(0, Math.min(360, newOpeningAngle));
    
    // Mettre à jour les angles
    this.startAngle = normalizedStart;
    this.stopAngle = (normalizedStart + newOpeningAngle) % 360;
    
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