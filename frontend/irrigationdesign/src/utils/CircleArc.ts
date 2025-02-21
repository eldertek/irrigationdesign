import L from 'leaflet';

export class CircleArc extends L.Polygon {
  private center: L.LatLng;
  private radius: number;
  private startAngle: number;
  private stopAngle: number;
  private numPoints: number;

  constructor(
    center: L.LatLng,
    radius: number,
    startAngle: number = 0,
    stopAngle: number = 180,
    numPoints: number = 64
  ) {
    // Initialiser avec un tableau vide de points
    super([[]]);

    this.center = center;
    this.radius = radius;
    this.startAngle = startAngle;
    this.stopAngle = stopAngle;
    this.numPoints = numPoints;

    // Mettre à jour la géométrie une fois que la couche est ajoutée à la carte
    this.on('add', () => {
      if (this._map) {
        this.updateGeometry();
      }
    });
  }

  private calculateArcPoints(): L.LatLng[] {
    if (!this._map) return [];

    const points: L.LatLng[] = [];
    const angleRange = this.stopAngle - this.startAngle;
    
    // Ajouter le centre comme premier point
    points.push(this.center);

    // Convertir le centre en pixels
    const centerPoint = this._map.latLngToLayerPoint(this.center);

    // Calculer les points de l'arc en pixels pour éviter la déformation
    for (let i = 0; i <= this.numPoints; i++) {
      const angle = this.startAngle + (angleRange * i) / this.numPoints;
      const rad = (angle * Math.PI) / 180;
      
      // Calculer le point en pixels
      const x = centerPoint.x + (this.radius * Math.cos(rad));
      const y = centerPoint.y + (this.radius * Math.sin(rad));
      
      // Reconvertir en coordonnées géographiques
      const latLng = this._map.layerPointToLatLng(new L.Point(x, y));
      points.push(latLng);
    }

    // Fermer le polygone en revenant au centre
    points.push(this.center);

    return points;
  }

  setRadius(radius: number): this {
    this.radius = radius;
    this.updateGeometry();
    return this;
  }

  setAngles(startAngle: number, stopAngle: number): this {
    // Normaliser les angles entre 0 et 360
    this.startAngle = ((startAngle % 360) + 360) % 360;
    this.stopAngle = ((stopAngle % 360) + 360) % 360;
    
    // S'assurer que stopAngle est toujours supérieur à startAngle
    if (this.stopAngle <= this.startAngle) {
      this.stopAngle += 360;
    }
    
    this.updateGeometry();
    return this;
  }

  setOpeningAngle(angle: number): this {
    // Angle d'ouverture en degrés (entre 0 et 360)
    const normalizedAngle = Math.max(0, Math.min(360, angle));
    this.stopAngle = this.startAngle + normalizedAngle;
    this.updateGeometry();
    return this;
  }

  setCenter(center: L.LatLng): this {
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
    this.setLatLngs([points]);
  }
} 