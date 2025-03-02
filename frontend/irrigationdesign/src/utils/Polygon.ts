import L from 'leaflet';
import { polygon, area, length, lineString } from '@turf/turf';
import centroid from '@turf/centroid';
import { PerformanceTracker } from './PerformanceTracker';

/**
 * Classe Polygon personnalisée qui étend L.Polygon pour ajouter des fonctionnalités
 * spécifiques à notre application.
 */
export class Polygon extends L.Polygon {
  properties: any;

  constructor(
    latlngs: L.LatLngExpression[] | L.LatLngExpression[][] | L.LatLngExpression[][][],
    options: L.PolylineOptions = {}
  ) {
    PerformanceTracker.start('Polygon.constructor');
    super(latlngs, {
      ...options,
      pmIgnore: false,
      interactive: true
    });
    
    this.properties = {
      type: 'Polygon',
      style: options || {}
    };
    
    // Initialiser les propriétés au moment de la création
    this.updateProperties();
    
    // Écouter uniquement les événements qui indiquent la fin d'une modification
    this.on('add', () => {
      console.log('Polygon added to map, updating properties');
      this.updateProperties();
    });
    PerformanceTracker.end('Polygon.constructor');
  }

  /**
   * Calcule et met à jour les propriétés du polygone
   */
  updateProperties(): void {
    PerformanceTracker.start('Polygon.updateProperties');
    const latLngs = this.getLatLngs()[0] as L.LatLng[];
    
    if (!latLngs || latLngs.length < 3) {
      console.warn('Polygon has less than 3 points, cannot calculate properties');
      PerformanceTracker.end('Polygon.updateProperties');
      return;
    }
    
    // Convertir les points en format GeoJSON pour turf
    PerformanceTracker.start('Polygon.updateProperties.convertCoordinates');
    const coordinates = latLngs.map((ll: L.LatLng) => [ll.lng, ll.lat]);
    coordinates.push(coordinates[0]); // Fermer le polygone
    PerformanceTracker.end('Polygon.updateProperties.convertCoordinates');
    
    try {
      PerformanceTracker.start('Polygon.updateProperties.turf');
      const polygonFeature = polygon([coordinates]);
      const areaValue = area(polygonFeature);
      const perimeterValue = length(lineString([...coordinates]), { units: 'meters' });
      
      // Calculer le centroid
      const centroidPoint = centroid(polygonFeature);
      const center = L.latLng(centroidPoint.geometry.coordinates[1], centroidPoint.geometry.coordinates[0]);
      PerformanceTracker.end('Polygon.updateProperties.turf');
      
      PerformanceTracker.start('Polygon.updateProperties.assignProperties');
      this.properties = {
        ...this.properties,
        area: areaValue,
        perimeter: perimeterValue,
        center: center,
        vertices: latLngs.length,
        surfaceInterieure: areaValue,
        surfaceExterieure: areaValue,
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
      PerformanceTracker.end('Polygon.updateProperties.assignProperties');
      
      // Émettre un événement pour notifier les changements
      this.fire('properties:updated', {
        shape: this,
        properties: this.properties
      });
    } catch (error) {
      console.error('Failed to calculate polygon properties', error);
    }
    PerformanceTracker.end('Polygon.updateProperties');
  }

  /**
   * Surcharge de la méthode setLatLngs pour mettre à jour les propriétés
   */
  setLatLngs(latlngs: L.LatLngExpression[] | L.LatLngExpression[][] | L.LatLngExpression[][][]): this {
    PerformanceTracker.start('Polygon.setLatLngs');
    super.setLatLngs(latlngs);
    this.updateProperties();
    PerformanceTracker.end('Polygon.setLatLngs');
    return this;
  }

  /**
   * Calcule les points milieu de chaque segment du polygone
   */
  getMidPoints(): L.LatLng[] {
    PerformanceTracker.start('Polygon.getMidPoints');
    const latLngs = this.getLatLngs()[0] as L.LatLng[];
    const midPoints: L.LatLng[] = [];
    
    if (latLngs.length < 2) {
      PerformanceTracker.end('Polygon.getMidPoints');
      return midPoints;
    }
    
    for (let i = 0; i < latLngs.length; i++) {
      const p1 = latLngs[i];
      const p2 = latLngs[(i + 1) % latLngs.length]; // Boucle pour le dernier point
      
      // Calculer le point milieu
      midPoints.push(L.latLng(
        (p1.lat + p2.lat) / 2,
        (p1.lng + p2.lng) / 2
      ));
    }
    
    PerformanceTracker.end('Polygon.getMidPoints');
    return midPoints;
  }

  /**
   * Déplace un vertex sans mettre à jour les propriétés
   * @param vertexIndex L'index du vertex à déplacer
   * @param newLatLng La nouvelle position du vertex
   */
  moveVertex(vertexIndex: number, newLatLng: L.LatLng): void {
    PerformanceTracker.start('Polygon.moveVertex');
    const latLngs = this.getLatLngs()[0] as L.LatLng[];
    if (vertexIndex >= 0 && vertexIndex < latLngs.length) {
      latLngs[vertexIndex] = newLatLng;
      
      // Mettre à jour la géométrie sans déclencher updateProperties
      L.Polygon.prototype.setLatLngs.call(this, [latLngs]);
    }
    PerformanceTracker.end('Polygon.moveVertex');
  }

  /**
   * Ajoute un nouveau vertex entre deux vertices existants
   * @param segmentIndex L'index du segment où insérer le vertex (entre segmentIndex et segmentIndex+1)
   * @param newLatLng La position du nouveau vertex
   */
  addVertex(segmentIndex: number, newLatLng: L.LatLng): void {
    PerformanceTracker.start('Polygon.addVertex');
    const latLngs = this.getLatLngs()[0] as L.LatLng[];
    if (segmentIndex >= 0 && segmentIndex < latLngs.length) {
      // Insérer le nouveau point
      latLngs.splice((segmentIndex + 1) % latLngs.length, 0, newLatLng);
      
      // Mettre à jour la géométrie sans déclencher updateProperties
      L.Polygon.prototype.setLatLngs.call(this, [latLngs]);
    }
    PerformanceTracker.end('Polygon.addVertex');
  }

  /**
   * Déplace le polygone entier
   * @param deltaLatLng Le décalage à appliquer à tous les vertices
   */
  move(deltaLatLng: L.LatLng): this {
    PerformanceTracker.start('Polygon.move');
    const latLngs = this.getLatLngs()[0] as L.LatLng[];
    
    // Créer un nouveau tableau avec les coordonnées déplacées
    const newLatLngs = latLngs.map(point => 
      L.latLng(
        point.lat + deltaLatLng.lat, 
        point.lng + deltaLatLng.lng
      )
    );
    
    // Mettre à jour la géométrie sans déclencher updateProperties
    L.Polygon.prototype.setLatLngs.call(this, [newLatLngs]);
    PerformanceTracker.end('Polygon.move');
    return this;
  }

  /**
   * Calcule le barycentre du polygone (point pouvant servir pour déplacer la forme)
   */
  getCenter(): L.LatLng {
    PerformanceTracker.start('Polygon.getCenter');
    const latLngs = this.getLatLngs()[0] as L.LatLng[];
    if (!latLngs || latLngs.length === 0) {
        PerformanceTracker.end('Polygon.getCenter');
        return new L.LatLng(0, 0);
    }
    
    try {
        PerformanceTracker.start('Polygon.getCenter.validate');
        // Vérifions si les coordonnées sont valides
        const validPoints = latLngs.filter(point => 
            point && typeof point.lat === 'number' && typeof point.lng === 'number' &&
            !isNaN(point.lat) && !isNaN(point.lng) &&
            Math.abs(point.lat) <= 90 && Math.abs(point.lng) <= 180
        );
        
        if (validPoints.length === 0) {
            console.warn('Aucun point valide dans le polygone pour calculer le centre');
            PerformanceTracker.end('Polygon.getCenter.validate');
            PerformanceTracker.end('Polygon.getCenter');
            return new L.LatLng(0, 0);
        }
        PerformanceTracker.end('Polygon.getCenter.validate');
        
        PerformanceTracker.start('Polygon.getCenter.turf');
        const coordinates = validPoints.map((ll: L.LatLng) => [ll.lng, ll.lat]);
        coordinates.push(coordinates[0]); // Fermer le polygone
        
        const polygonFeature = polygon([coordinates]);
        const centroidPoint = centroid(polygonFeature);
        
        // Vérifier que le résultat du centroid est valide
        const centerLat = centroidPoint.geometry.coordinates[1];
        const centerLng = centroidPoint.geometry.coordinates[0];
        
        if (typeof centerLat !== 'number' || typeof centerLng !== 'number' || 
            isNaN(centerLat) || isNaN(centerLng) ||
            Math.abs(centerLat) > 90 || Math.abs(centerLng) > 180) {
            throw new Error('Centroid calculé invalide');
        }
        
        PerformanceTracker.end('Polygon.getCenter.turf');
        PerformanceTracker.end('Polygon.getCenter');
        return L.latLng(centerLat, centerLng);
    } catch (error) {
        console.warn('Erreur lors du calcul du centroïde avec turf.js, utilisation de la méthode simple', error);
        
        PerformanceTracker.start('Polygon.getCenter.fallback');
        // Méthode alternative: moyenne des coordonnées valides
        let totalLat = 0, totalLng = 0, count = 0;
        
        for (const point of latLngs) {
            if (point && typeof point.lat === 'number' && typeof point.lng === 'number' &&
                !isNaN(point.lat) && !isNaN(point.lng) &&
                Math.abs(point.lat) <= 90 && Math.abs(point.lng) <= 180) {
                totalLat += point.lat;
                totalLng += point.lng;
                count++;
            }
        }
        
        if (count === 0) {
            console.error('Impossible de calculer un centre valide pour le polygone');
            PerformanceTracker.end('Polygon.getCenter.fallback');
            PerformanceTracker.end('Polygon.getCenter');
            return new L.LatLng(0, 0);
        }
        
        PerformanceTracker.end('Polygon.getCenter.fallback');
        PerformanceTracker.end('Polygon.getCenter');
        return new L.LatLng(totalLat / count, totalLng / count);
    }
  }

  /**
   * Retourne les distances entre les vertices consécutifs
   */
  getSegmentLengths(): number[] {
    PerformanceTracker.start('Polygon.getSegmentLengths');
    const latLngs = this.getLatLngs()[0] as L.LatLng[];
    const distances: number[] = [];
    
    if (latLngs.length < 2) {
      PerformanceTracker.end('Polygon.getSegmentLengths');
      return distances;
    }
    
    for (let i = 0; i < latLngs.length; i++) {
      const p1 = latLngs[i];
      const p2 = latLngs[(i + 1) % latLngs.length]; // Boucle pour le dernier point
      
      distances.push(p1.distanceTo(p2));
    }
    
    PerformanceTracker.end('Polygon.getSegmentLengths');
    return distances;
  }
} 