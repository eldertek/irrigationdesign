import L from 'leaflet';
import { lineString, length } from '@turf/turf';
import along from '@turf/along';

/**
 * Custom Line class that extends L.Polyline to add specific
 * functionality for our application.
 */
export class Line extends L.Polyline {
  properties: any;

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
      console.log('Line added to map, updating properties');
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
      
      // Emit an event to notify changes
      this.fire('properties:updated', {
        shape: this,
        properties: this.properties
      });
    } catch (error) {
      console.error('Failed to calculate line properties', error);
    }
  }

  /**
   * Override setLatLngs to update properties
   */
  setLatLngs(latlngs: L.LatLngExpression[] | L.LatLngExpression[][]): this {
    super.setLatLngs(latlngs);
    this.updateProperties();
    return this;
  }

  /**
   * Calculate midpoints of each segment of the line
   */
  getMidPoints(): L.LatLng[] {
    const latLngs = this.getLatLngs() as L.LatLng[];
    const midPoints: L.LatLng[] = [];
    
    if (latLngs.length < 2) return midPoints;
    
    for (let i = 0; i < latLngs.length - 1; i++) {
      const p1 = latLngs[i];
      const p2 = latLngs[i + 1];
      
      // Calculate midpoint
      midPoints.push(L.latLng(
        (p1.lat + p2.lat) / 2,
        (p1.lng + p2.lng) / 2
      ));
    }
    
    return midPoints;
  }

  /**
   * Move a vertex without updating properties
   * @param vertexIndex The index of the vertex to move
   * @param newLatLng The new position of the vertex
   */
  moveVertex(vertexIndex: number, newLatLng: L.LatLng): void {
    const latLngs = this.getLatLngs() as L.LatLng[];
    if (vertexIndex >= 0 && vertexIndex < latLngs.length) {
      latLngs[vertexIndex] = newLatLng;
      
      // Update geometry without triggering updateProperties
      L.Polyline.prototype.setLatLngs.call(this, latLngs);
    }
  }

  /**
   * Add a new vertex between two existing vertices
   * @param segmentIndex The index of the segment where to insert the vertex (between segmentIndex and segmentIndex+1)
   * @param newLatLng The position of the new vertex
   */
  addVertex(segmentIndex: number, newLatLng: L.LatLng): void {
    const latLngs = this.getLatLngs() as L.LatLng[];
    if (segmentIndex >= 0 && segmentIndex < latLngs.length - 1) {
      // Insert the new point
      latLngs.splice(segmentIndex + 1, 0, newLatLng);
      
      // Update geometry without triggering updateProperties
      L.Polyline.prototype.setLatLngs.call(this, latLngs);
    }
  }

  /**
   * Move the entire line
   * @param deltaLatLng The offset to apply to all vertices
   */
  move(deltaLatLng: L.LatLng): this {
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
    
    return this;
  }

  /**
   * Calculate the center of the line (can be used for moving the shape)
   */
  getCenter(): L.LatLng {
    const latLngs = this.getLatLngs() as L.LatLng[];
    
    if (latLngs.length < 2) {
      return latLngs[0] || new L.LatLng(0, 0);
    }
    
    try {
      // Use turf.js for more accurate center calculation (point at half distance)
      const coordinates = latLngs.map((ll: L.LatLng) => [ll.lng, ll.lat]);
      const line = lineString(coordinates);
      const lengthValue = length(line, { units: 'meters' });
      const alongPoint = along(line, lengthValue / 2, { units: 'meters' });
      
      return L.latLng(alongPoint.geometry.coordinates[1], alongPoint.geometry.coordinates[0]);
    } catch (error) {
      console.warn('Error calculating line center with turf.js, using simple method', error);
      
      // In case of error, use simple average of coordinates
      const lat = latLngs.reduce((sum, p) => sum + p.lat, 0) / latLngs.length;
      const lng = latLngs.reduce((sum, p) => sum + p.lng, 0) / latLngs.length;
      
      return new L.LatLng(lat, lng);
    }
  }

  /**
   * Return distances between consecutive vertices
   */
  getSegmentLengths(): number[] {
    const latLngs = this.getLatLngs() as L.LatLng[];
    const distances: number[] = [];
    
    if (latLngs.length < 2) return distances;
    
    for (let i = 0; i < latLngs.length - 1; i++) {
      const p1 = latLngs[i];
      const p2 = latLngs[i + 1];
      
      distances.push(p1.distanceTo(p2));
    }
    
    return distances;
  }
  
  /**
   * Calculate the total length of the line up to a specific vertex
   * @param vertexIndex The index of the vertex
   */
  getLengthToVertex(vertexIndex: number): number {
    const latLngs = this.getLatLngs() as L.LatLng[];
    let length = 0;
    
    if (vertexIndex <= 0 || latLngs.length < 2) return 0;
    
    for (let i = 0; i < Math.min(vertexIndex, latLngs.length - 1); i++) {
      length += latLngs[i].distanceTo(latLngs[i + 1]);
    }
    
    return length;
  }
} 