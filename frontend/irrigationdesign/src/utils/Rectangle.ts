import L from 'leaflet';
import * as turf from '@turf/turf';

/**
 * Classe Rectangle personnalisée qui étend L.Rectangle pour ajouter des fonctionnalités
 * spécifiques à notre application.
 */
export class Rectangle extends L.Rectangle {
  properties: any;

  constructor(
    bounds: L.LatLngBoundsExpression,
    options: L.PolylineOptions = {}
  ) {
    super(bounds, {
      ...options,
      pmIgnore: false,
      interactive: true
    });
    
    this.properties = {
      type: 'Rectangle',
      style: options || {}
    };
    
    // Initialiser les propriétés au moment de la création
    this.updateProperties();
    
    // Écouter uniquement les événements qui indiquent la fin d'une modification
    this.on('add', () => {

      this.updateProperties();
    });
  }

  /**
   * Calcule et met à jour les propriétés du rectangle
   */
  updateProperties(): void {
    const bounds = this.getBounds();
    const ne = bounds.getNorthEast();
    const sw = bounds.getSouthWest();
    
    // Utiliser turf.js pour calculer les distances en mètres
    const width = turf.distance([sw.lng, sw.lat], [ne.lng, sw.lat], { units: 'meters' });
    const height = turf.distance([sw.lng, sw.lat], [sw.lng, ne.lat], { units: 'meters' });
    
    this.properties = {
      ...this.properties,
      width: width,
      height: height,
      area: width * height,
      perimeter: 2 * (width + height),
      center: bounds.getCenter(),
      corners: {
        northEast: ne,
        northWest: bounds.getNorthWest(),
        southEast: bounds.getSouthEast(),
        southWest: sw
      },
      bounds: bounds,
      surfaceInterieure: width * height,
      surfaceExterieure: width * height,
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
   * Surcharge de la méthode setBounds pour mettre à jour les propriétés
   */
  setBounds(bounds: L.LatLngBoundsExpression): this {
    super.setBounds(bounds);
    this.updateProperties();
    return this;
  }

  /**
   * Calcule les points milieu de chaque côté du rectangle
   */
  getMidPoints(): L.LatLng[] {
    const bounds = this.getBounds();
    const nw = bounds.getNorthWest();
    const ne = bounds.getNorthEast();
    const se = bounds.getSouthEast();
    const sw = bounds.getSouthWest();
    
    // Points milieu des côtés
    return [
      L.latLng((nw.lat + ne.lat) / 2, (nw.lng + ne.lng) / 2), // Milieu haut
      L.latLng((ne.lat + se.lat) / 2, (ne.lng + se.lng) / 2), // Milieu droite
      L.latLng((sw.lat + se.lat) / 2, (sw.lng + se.lng) / 2), // Milieu bas
      L.latLng((nw.lat + sw.lat) / 2, (nw.lng + sw.lng) / 2)  // Milieu gauche
    ];
  }

  /**
   * Calcule les dimensions du rectangle
   */
  getDimensions(): { width: number, height: number } {
    const bounds = this.getBounds();
    const ne = bounds.getNorthEast();
    const sw = bounds.getSouthWest();
    
    const width = turf.distance([sw.lng, sw.lat], [ne.lng, sw.lat], { units: 'meters' });
    const height = turf.distance([sw.lng, sw.lat], [sw.lng, ne.lat], { units: 'meters' });
    
    return { width, height };
  }

  /**
   * Redimensionne le rectangle depuis un point de contrôle de coin
   * @param cornerIndex Index du coin (0: NW, 1: NE, 2: SE, 3: SW)
   * @param newLatLng Nouvelle position du coin
   */
  resizeFromCorner(cornerIndex: number, newLatLng: L.LatLng): void {
    const bounds = this.getBounds();
    const corners = [
      bounds.getNorthWest(),
      bounds.getNorthEast(),
      bounds.getSouthEast(),
      bounds.getSouthWest()
    ];
    
    // L'index opposé est (index + 2) % 4
    const oppositeIndex = (cornerIndex + 2) % 4;
    const oppositeCorner = corners[oppositeIndex];
    
    // Créer de nouvelles limites en gardant le coin opposé fixe
    // sans déclencher la mise à jour des propriétés
    const newBounds = L.latLngBounds(oppositeCorner, newLatLng);
    L.Rectangle.prototype.setBounds.call(this, newBounds);
  }

  /**
   * Redimensionne le rectangle depuis un point de contrôle de côté
   * @param sideIndex Index du côté (0: haut, 1: droite, 2: bas, 3: gauche)
   * @param newLatLng Nouvelle position du point milieu
   */
  resizeFromSide(sideIndex: number, newLatLng: L.LatLng): void {
    const bounds = this.getBounds();
    const nw = bounds.getNorthWest();
    const se = bounds.getSouthEast();
    const sw = bounds.getSouthWest();
    
    let newBounds;
    
    switch (sideIndex) {
      case 0: // Haut - ne déplacer que la latitude
        newBounds = L.latLngBounds(
          L.latLng(newLatLng.lat, nw.lng),
          L.latLng(sw.lat, se.lng)
        );
        break;
      case 1: // Droite - ne déplacer que la longitude
        newBounds = L.latLngBounds(
          L.latLng(nw.lat, nw.lng),
          L.latLng(se.lat, newLatLng.lng)
        );
        break;
      case 2: // Bas - ne déplacer que la latitude
        newBounds = L.latLngBounds(
          L.latLng(nw.lat, nw.lng),
          L.latLng(newLatLng.lat, se.lng)
        );
        break;
      case 3: // Gauche - ne déplacer que la longitude
        newBounds = L.latLngBounds(
          L.latLng(nw.lat, newLatLng.lng),
          L.latLng(se.lat, se.lng)
        );
        break;
    }
    
    if (newBounds) {
      // Appliquer les nouvelles limites sans déclencher la mise à jour des propriétés
      L.Rectangle.prototype.setBounds.call(this, newBounds);
      // Mettre à jour les propriétés après le redimensionnement
      this.updateProperties();
    }
  }
  
  /**
   * Déplace le rectangle depuis un point de contrôle central
   * @param newLatLng Nouvelle position du centre
   */
  moveFromCenter(newLatLng: L.LatLng): void {
    const bounds = this.getBounds();
    const currentCenter = bounds.getCenter();
    
    // Calculer le déplacement
    const dx = newLatLng.lng - currentCenter.lng;
    const dy = newLatLng.lat - currentCenter.lat;
    
    // Déplacer tous les coins
    const nw = bounds.getNorthWest();
    const se = bounds.getSouthEast();
    
    const newNW = L.latLng(nw.lat + dy, nw.lng + dx);
    const newSE = L.latLng(se.lat + dy, se.lng + dx);
    
    // Appliquer les nouvelles limites sans déclencher la mise à jour des propriétés
    L.Rectangle.prototype.setBounds.call(this, L.latLngBounds(newNW, newSE));
  }
} 