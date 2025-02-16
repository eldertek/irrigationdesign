import L from 'leaflet';

export class CircleArc extends L.Polygon {
  private center: L.LatLng;
  private radius: number;
  private startAngle: number;
  private stopAngle: number;
  private numPoints: number;
  private map: L.Map | null;

  constructor(
    map: L.Map,
    center: L.LatLng,
    radius: number,
    startAngle: number = 0,
    stopAngle: number = 180,
    numPoints: number = 64
  ) {
    const points = CircleArc.calculateArcPoints(
      map,
      center,
      radius,
      startAngle,
      stopAngle,
      numPoints
    );
    super([points]);

    this.map = map;
    this.center = center;
    this.radius = radius;
    this.startAngle = startAngle;
    this.stopAngle = stopAngle;
    this.numPoints = numPoints;
  }

  static calculateArcPoints(
    map: L.Map,
    center: L.LatLng,
    radius: number,
    startAngle: number,
    stopAngle: number,
    numPoints: number
  ): L.LatLng[] {
    const points: L.LatLng[] = [];
    const angleRange = stopAngle - startAngle;
    
    // Ajouter le centre comme premier point
    points.push(center);

    // Convertir le centre en pixels
    const centerPoint = map.latLngToLayerPoint(center);

    // Calculer les points de l'arc en pixels pour éviter la déformation
    for (let i = 0; i <= numPoints; i++) {
      const angle = startAngle + (angleRange * i) / numPoints;
      const rad = (angle * Math.PI) / 180;
      
      // Calculer le point en pixels
      const x = centerPoint.x + (radius * Math.cos(rad));
      const y = centerPoint.y + (radius * Math.sin(rad));
      
      // Reconvertir en coordonnées géographiques
      const latLng = map.layerPointToLatLng(new L.Point(x, y));
      points.push(latLng);
    }

    // Fermer le polygone en revenant au centre
    points.push(center);

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
    if (!this.map) return;

    const points = CircleArc.calculateArcPoints(
      this.map,
      this.center,
      this.radius,
      this.startAngle,
      this.stopAngle,
      this.numPoints
    );
    this.setLatLngs([points]);
  }
} 