import L from 'leaflet';
/**
 * Classe Circle personnalisée qui étend L.Circle pour ajouter des fonctionnalités
 * spécifiques à notre application.
 */
export class Circle extends L.Circle {
  properties: any;
  constructor(
    center: L.LatLngExpression,
    options: L.CircleOptions
  ) {
    // Extraire le rayon des options pour l'appel au constructeur parent
    const radius = options.radius || 10; // Valeur par défaut si non spécifiée
    super(center, radius, options);
    this.properties = {
      type: 'Circle',
      style: options || {}
    };
    // Initialiser les propriétés au moment de la création
    this.updateProperties();
    // Écouter uniquement les événements qui indiquent la fin d'une modification
    // pour ne pas surcharger avec des mises à jour constantes
    this.on('add', () => {
      this.updateProperties();
    });
  }
  /**
   * Calcule et met à jour les propriétés du cercle
   */
  updateProperties(): void {
    const radius = this.getRadius();
    const center = this.getLatLng();
    this.properties = {
      ...this.properties,
      radius: radius,
      diameter: radius * 2,
      area: Math.PI * Math.pow(radius, 2),
      perimeter: 2 * Math.PI * radius,
      center: center,
      surfaceInterieure: Math.PI * Math.pow(radius, 2),
      surfaceExterieure: Math.PI * Math.pow(radius, 2),
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
    // Émettre un événement pour notifier les changements
    this.fire('properties:updated', {
      shape: this,
      properties: this.properties
    });
  }
  /**
   * Surcharge de la méthode setRadius pour mettre à jour les propriétés
   */
  setRadius(radius: number): this {
    super.setRadius(radius);
    this.updateProperties();
    return this;
  }
  /**
   * Surcharge de la méthode setLatLng pour mettre à jour les propriétés
   */
  setLatLng(latlng: L.LatLngExpression): this {
    super.setLatLng(latlng);
    this.updateProperties();
    return this;
  }
  /**
   * Calcule la position d'un point sur le cercle à un angle donné
   */
  calculatePointOnCircle(angle: number): L.LatLng {
    const center = this.getLatLng();
    const radius = this.getRadius();
    const rad = (angle * Math.PI) / 180;
    return L.latLng(
      center.lat + (radius / 111319.9) * Math.sin(rad),
      center.lng + (radius / (111319.9 * Math.cos(center.lat * Math.PI / 180))) * Math.cos(rad)
    );
  }
  /**
   * Calcule les positions des points cardinaux du cercle
   */
  getCardinalPoints(): L.LatLng[] {
    return [0, 45, 90, 135, 180, 225, 270, 315].map(angle => 
      this.calculatePointOnCircle(angle)
    );
  }
  /**
   * Calcule l'angle d'un point par rapport au centre du cercle
   * @param point Le point dont on veut calculer l'angle
   * @returns L'angle en degrés (0-360)
   */
  calculateAngleFromPoint(point: L.LatLng): number {
    const center = this.getLatLng();
    const dx = point.lng - center.lng;
    const dy = point.lat - center.lat;
    // Calculer l'angle en radians puis convertir en degrés
    let angle = Math.atan2(dy, dx) * 180 / Math.PI;
    // Normaliser l'angle entre 0 et 360 degrés
    if (angle < 0) {
      angle += 360;
    }
    return angle;
  }
  /**
   * Redimensionne le cercle en gardant le point de contrôle sous la souris
   * @param mouseLatLng Position actuelle de la souris
   */
  resizeFromControlPoint(mouseLatLng: L.LatLng): void {
    const center = this.getLatLng();
    // Calculer la distance entre le centre et la position de la souris
    // Cette distance devient le nouveau rayon
    const newRadius = center.distanceTo(mouseLatLng);
    // Appliquer le nouveau rayon si valide
    if (newRadius > 0) {
      // Appliquer directement le nouveau rayon sans mettre à jour les propriétés
      // La mise à jour sera faite à la fin du redimensionnement
      super.setRadius(newRadius);
    }
  }
} 