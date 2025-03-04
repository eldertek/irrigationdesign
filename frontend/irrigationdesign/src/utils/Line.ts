import L from 'leaflet';
import { lineString, length } from '@turf/turf';
import along from '@turf/along';
/**
 * Custom Line class that extends L.Polyline to add specific
 * functionality for our application.
 */
export class Line extends L.Polyline {
  properties: any;
  private cachedProperties: {
    length?: number;
    midPoints?: L.LatLng[];
    segmentLengths?: number[];
    center?: L.LatLng;
  } = {};
  private needsUpdate: boolean = true;
  constructor(
    latlngs: L.LatLngExpression[] | L.LatLngExpression[][],
    options: L.PolylineOptions = {}
  ) {
    super(latlngs, {
      ...options,
      pmIgnore: false,
      interactive: true
    });
    this.properties = {
      type: 'Line',
      style: options || {}
    };
    // Initialize properties at creation
    this.updateProperties();
    // Listen only to events that indicate the end of a modification
    this.on('add', () => {
      this.updateProperties();
    });
  }
  /**
   * Calculates and updates line properties
   */
  updateProperties(): void {
    const latLngs = this.getLatLngs() as L.LatLng[];
    if (!latLngs || latLngs.length < 2) {
      console.warn('Line has less than 2 points, cannot calculate properties');
      return;
    }
    // Convert points to GeoJSON format for turf
    const coordinates = latLngs.map((ll: L.LatLng) => [ll.lng, ll.lat]);
    try {
      const line = lineString(coordinates);
      const lengthValue = length(line, { units: 'meters' });
      // Calculate the center (midpoint) of the line
      // For multi-segment lines, find a point at half the total length
      let center: L.LatLng;
      if (latLngs.length === 2) {
        // Simple midpoint for single-segment lines
        center = L.latLng(
          (latLngs[0].lat + latLngs[1].lat) / 2,
          (latLngs[0].lng + latLngs[1].lng) / 2
        );
      } else {
        // For multi-segment lines, use turf to get point at half distance
        const alongPoint = along(line, lengthValue / 2, { units: 'meters' });
        center = L.latLng(alongPoint.geometry.coordinates[1], alongPoint.geometry.coordinates[0]);
      }
      // Default influence width (for area calculation)
      const influenceWidth = 10; // 10 meters by default
      this.properties = {
        ...this.properties,
        length: lengthValue,
        center: center,
        vertices: latLngs.length,
        surfaceInfluence: lengthValue * influenceWidth,
        dimensions: {
          width: influenceWidth
        },
        style: {
          ...this.options,
          color: this.options.color || '#3388ff',
          weight: this.options.weight || 3,
          opacity: this.options.opacity || 1,
          dashArray: (this.options as any)?.dashArray || ''
        }
      };
      // Cache the computed values
      this.cachedProperties.length = lengthValue;
      this.cachedProperties.center = center;
      this.cachedProperties.midPoints = undefined;
      this.cachedProperties.segmentLengths = undefined;
      this.needsUpdate = false;
      // Emit an event to notify changes
      this.fire('properties:updated', {
        shape: this,
        properties: this.properties
      });
    } catch (error) {
      console.error('Failed to calculate line properties', error);
    } finally {
    }
  }
  /**
   * Invalidate cached properties to force recalculation
   */
  invalidateCache(): void {
    this.needsUpdate = true;
    this.cachedProperties = {};
  }
  /**
   * Override setLatLngs to update properties
   */
  setLatLngs(latlngs: L.LatLngExpression[] | L.LatLngExpression[][]): this {
    super.setLatLngs(latlngs);
    this.invalidateCache();
    this.updateProperties();
    return this;
  }
  /**
   * Calculate midpoints of each segment of the line
   */
  getMidPoints(): L.LatLng[] {
    // Return cached midpoints if available and valid
    if (!this.needsUpdate && this.cachedProperties.midPoints) {
      return this.cachedProperties.midPoints;
    }
    const latLngs = this.getLatLngs() as L.LatLng[];
    const midPoints: L.LatLng[] = [];
    if (latLngs.length < 2) {
      return midPoints;
    }
    // Parcourir tous les segments et calculer les midpoints
    for (let i = 0; i < latLngs.length - 1; i++) {
      const p1 = latLngs[i];
      const p2 = latLngs[i + 1];
      if (!p1 || !p2) {
        console.warn('Points invalides détectés pour le segment', i);
        continue;
      }
      // Calculate midpoint
      midPoints.push(L.latLng(
        (p1.lat + p2.lat) / 2,
        (p1.lng + p2.lng) / 2
      ));
    }
    // Cache the result
    this.cachedProperties.midPoints = midPoints;
    return midPoints;
  }
  /**
   * Get a specific midpoint by segment index
   */
  getMidPointAt(segmentIndex: number): L.LatLng | null {
    const latLngs = this.getLatLngs() as L.LatLng[];
    if (segmentIndex < 0 || segmentIndex >= latLngs.length - 1 || latLngs.length < 2) {
      return null;
    }
    // Récupérer toujours les points à partir de la géométrie actuelle
    // pour garantir que les midpoints sont à jour
    const p1 = latLngs[segmentIndex];
    const p2 = latLngs[segmentIndex + 1];
    if (!p1 || !p2) {
      console.warn('Points invalides pour calcul du midpoint au segment', segmentIndex);
      return null;
    }
    const midPoint = L.latLng(
      (p1.lat + p2.lat) / 2,
      (p1.lng + p2.lng) / 2
    );
    return midPoint;
  }
  /**
   * Move a vertex without updating properties
   * @param vertexIndex The index of the vertex to move
   * @param newLatLng The new position of the vertex
   * @param updateProps Whether to update properties (default: false)
   */
  moveVertex(vertexIndex: number, newLatLng: L.LatLng, updateProps: boolean = false): void {
    const latLngs = this.getLatLngs() as L.LatLng[];
    if (vertexIndex >= 0 && vertexIndex < latLngs.length) {
      latLngs[vertexIndex] = newLatLng;
      // Update geometry without triggering updateProperties
      L.Polyline.prototype.setLatLngs.call(this, latLngs);
      // Invalidate cache but don't update properties yet
      this.needsUpdate = true;
      // Invalider spécifiquement les propriétés qui dépendent directement des vertex
      this.cachedProperties.midPoints = undefined;
      this.cachedProperties.segmentLengths = undefined;
      this.cachedProperties.center = undefined;
      this.cachedProperties.length = undefined;
      // Only update properties if explicitly requested
      if (updateProps) {
        this.updateProperties();
      }
    }
  }
  /**
   * Add a new vertex between two existing vertices
   * @param segmentIndex The index of the segment where to insert the vertex (between segmentIndex and segmentIndex+1)
   * @param newLatLng The position of the new vertex
   * @param updateProps Whether to update properties (default: false)
   */
  addVertex(segmentIndex: number, newLatLng: L.LatLng, updateProps: boolean = false): void {
    const latLngs = this.getLatLngs() as L.LatLng[];
    if (segmentIndex >= 0 && segmentIndex < latLngs.length - 1) {
      // Insert the new point
      latLngs.splice(segmentIndex + 1, 0, newLatLng);
      // Update geometry without triggering updateProperties
      L.Polyline.prototype.setLatLngs.call(this, latLngs);
      // Invalidate cache
      this.needsUpdate = true;
      // Invalider spécifiquement les propriétés qui dépendent du nombre de vertex
      this.cachedProperties.midPoints = undefined;
      this.cachedProperties.segmentLengths = undefined;
      this.cachedProperties.center = undefined;
      this.cachedProperties.length = undefined;
      // Only update properties if explicitly requested
      if (updateProps) {
        this.updateProperties();
      }
    }
  }
  /**
   * Move the entire line
   * @param deltaLatLng The offset to apply to all vertices
   * @param updateProps Whether to update properties (default: true)
   */
  move(deltaLatLng: L.LatLng, updateProps: boolean = true): this {
    const latLngs = this.getLatLngs() as L.LatLng[];
    // Create a new array with moved coordinates
    const newLatLngs = latLngs.map(point => 
      L.latLng(
        point.lat + deltaLatLng.lat, 
        point.lng + deltaLatLng.lng
      )
    );
    // Update geometry without triggering updateProperties
    L.Polyline.prototype.setLatLngs.call(this, newLatLngs);
    // Force fire an event so Leaflet knows the shape has changed
    this.fire('move');
    // Invalidate cache
    this.needsUpdate = true;
    // Lors d'un déplacement, seul le centre change
    this.cachedProperties.center = undefined;
    // Only update properties if requested
    if (updateProps) {
      this.updateProperties();
    }
    return this;
  }
  /**
   * Calculate the center of the line (can be used for moving the shape)
   */
  getCenter(): L.LatLng {
    // Return cached center if available and valid
    if (!this.needsUpdate && this.cachedProperties.center) {
      return this.cachedProperties.center;
    }
    const latLngs = this.getLatLngs() as L.LatLng[];
    if (latLngs.length < 2) {
      const result = latLngs[0] || new L.LatLng(0, 0);
      return result;
    }
    try {
      // Use turf.js for more accurate center calculation (point at half distance)
      const coordinates = latLngs.map((ll: L.LatLng) => [ll.lng, ll.lat]);
      const line = lineString(coordinates);
      const lengthValue = length(line, { units: 'meters' });
      const alongPoint = along(line, lengthValue / 2, { units: 'meters' });
      const result = L.latLng(alongPoint.geometry.coordinates[1], alongPoint.geometry.coordinates[0]);
      // Cache the result
      this.cachedProperties.center = result;
      return result;
    } catch (error) {
      console.warn('Error calculating line center with turf.js, using simple method', error);
      // In case of error, use simple average of coordinates
      const lat = latLngs.reduce((sum, p) => sum + p.lat, 0) / latLngs.length;
      const lng = latLngs.reduce((sum, p) => sum + p.lng, 0) / latLngs.length;
      const result = new L.LatLng(lat, lng);
      // Cache the result
      this.cachedProperties.center = result;
      return result;
    }
  }
  /**
   * Return distances between consecutive vertices
   */
  getSegmentLengths(): number[] {
    // Return cached segment lengths if available and valid
    if (!this.needsUpdate && this.cachedProperties.segmentLengths) {
      return this.cachedProperties.segmentLengths;
    }
    const latLngs = this.getLatLngs() as L.LatLng[];
    const distances: number[] = [];
    if (latLngs.length < 2) {
      return distances;
    }
    for (let i = 0; i < latLngs.length - 1; i++) {
      const p1 = latLngs[i];
      const p2 = latLngs[i + 1];
      distances.push(p1.distanceTo(p2));
    }
    // Cache the result
    this.cachedProperties.segmentLengths = distances;
    return distances;
  }
  /**
   * Get the length of a specific segment
   */
  getSegmentLengthAt(segmentIndex: number): number {
    const latLngs = this.getLatLngs() as L.LatLng[];
    if (segmentIndex < 0 || segmentIndex >= latLngs.length - 1 || latLngs.length < 2) {
      return 0;
    }
    const p1 = latLngs[segmentIndex];
    const p2 = latLngs[segmentIndex + 1];
    const distance = p1.distanceTo(p2);
    return distance;
  }
  /**
   * Calculate the total length of the line up to a specific vertex
   * @param vertexIndex The index of the vertex
   */
  getLengthToVertex(vertexIndex: number): number {
    const latLngs = this.getLatLngs() as L.LatLng[];
    let length = 0;
    if (vertexIndex <= 0 || latLngs.length < 2) {
      return 0;
    }
    for (let i = 0; i < Math.min(vertexIndex, latLngs.length - 1); i++) {
      length += latLngs[i].distanceTo(latLngs[i + 1]);
    }
    return length;
  }
  /**
   * Get the total length of the line
   * Uses cached value if available
   */
  getLength(): number {
    // Return cached length if available and valid
    if (!this.needsUpdate && this.cachedProperties.length) {
      return this.cachedProperties.length;
    }
    // Use direct calculation without Turf.js for better performance
    const latLngs = this.getLatLngs() as L.LatLng[];
    let totalLength = 0;
    for (let i = 0; i < latLngs.length - 1; i++) {
      totalLength += latLngs[i].distanceTo(latLngs[i + 1]);
    }
    // Cache the result
    this.cachedProperties.length = totalLength;
    return totalLength;
  }
} 