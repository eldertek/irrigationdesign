import L from 'leaflet';
import * as turf from '@turf/turf';
import { Polygon } from './Polygon';

interface TextRectangleProperties {
  type: string;
  text: string;
  width: number;
  height: number;
  area: number;
  rotation: number;
  center?: L.LatLng;
  style: {
    color?: string;
    weight?: number;
    fillColor?: string;
    fillOpacity?: number;
    textColor?: string;
    fontSize?: string;
    fontFamily?: string;
    backgroundColor?: string;
    textAlign?: string;
    bold?: boolean;
    italic?: boolean;
  };
}

export class TextRectangle extends Polygon {
  public properties: TextRectangleProperties;
  private originalLatLngs: L.LatLng[] = [];
  private _textContainer: HTMLDivElement | null = null;
  private _mapInstance: L.Map | null = null;
  private _initialized: boolean = false;
  private _isEditing: boolean = false;

  constructor(
    bounds: L.LatLngBoundsExpression,
    text: string = 'Double-cliquez pour éditer',
    options: L.PolylineOptions = {}
  ) {
    try {
      console.log('[TextRectangle] Constructor called with bounds:', bounds);
      
      // Ensure we have a valid bounds object
      const b = bounds instanceof L.LatLngBounds ? bounds : L.latLngBounds(bounds);
      
      // Validate bounds are not empty/invalid
      if (!b.isValid()) {
        console.warn('[TextRectangle] Initialized with invalid bounds, using default bounds');
        const center = L.latLng(0, 0);
        b.extend(L.latLng(center.lat + 0.001, center.lng + 0.001));
        b.extend(L.latLng(center.lat - 0.001, center.lng - 0.001));
      }
      
      const latLngs: L.LatLng[] = [
        b.getSouthWest(),
        b.getSouthEast(),
        b.getNorthEast(),
        b.getNorthWest()
      ];

      console.log('[TextRectangle] Created corners:', latLngs.map(ll => [ll.lat, ll.lng]));

      // Make sure options are properly initialized to avoid unexpected rendering
      const mergedOptions = {
        ...options,
        pmIgnore: false,
        interactive: true,
        fill: true,
        stroke: true,
        className: 'leaflet-text-rectangle'
      };

      super(latLngs, mergedOptions);
      console.log('[TextRectangle] Base Polygon initialized with ID:', (this as any)._leaflet_id);

      this.originalLatLngs = latLngs.slice();

      this.properties = {
        type: 'TextRectangle',
        text: text,
        width: 0,
        height: 0,
        area: 0,
        rotation: 0,
        style: {
          color: mergedOptions.color || '#3388ff',
          weight: mergedOptions.weight || 2,
          fillColor: mergedOptions.fillColor || '#3388ff',
          fillOpacity: mergedOptions.fillOpacity || 0.2,
          textColor: '#000000',
          fontSize: '14px',
          fontFamily: 'Arial, sans-serif',
          backgroundColor: '#FFFFFF',
          textAlign: 'center',
          bold: false,
          italic: false
        }
      };

      // Make sure we have a proper rectangle
      this.enforceRectangularShape();

      // Create the text container
      this._createTextContainer();

      // Setup event handlers
      this.on('pm:vertexremoved', this.enforceRectangularShape);
      this.on('pm:vertexadded', this.enforceRectangularShape);
      this.on('pm:dragend', this.enforceRectangularShape);
      this.on('pm:markerdragend', this.onMarkerDragEnd);

      // Event handlers for text container positioning
      this.on('move', this.updateTextPosition);
      this.on('drag', this.updateTextPosition);
      this.on('add', this.updateTextPosition);
      
      // Enable text editing via double-click
      this.on('dblclick', this.enableTextEditing);

      // Enable dragging via leaflet-geoman
      if (this.pm) {
        this.pm.enableLayerDrag();
      }

      this.updateProperties();
      console.log('[TextRectangle] Fully initialized with properties:', this.properties);
    } catch (e) {
      console.error('[TextRectangle] Error initializing TextRectangle:', e);
      // Initialize with fallback values if constructor fails
      super([[0, 0], [0, 0.001], [0.001, 0.001], [0.001, 0]], options);
      this.originalLatLngs = this.getLatLngs()[0] as L.LatLng[];
      this.properties = {
        type: 'TextRectangle',
        text: text || 'Error - Please try again',
        width: 0,
        height: 0,
        area: 0,
        rotation: 0,
        style: {
          color: '#ff0000',
          weight: 2,
          fillColor: '#ff0000',
          fillOpacity: 0.2,
          textColor: '#000000',
          fontSize: '14px',
          fontFamily: 'Arial, sans-serif',
          backgroundColor: '#FFFFFF',
          textAlign: 'center',
          bold: false,
          italic: false
        }
      };
      this._createTextContainer();
    }
  }

  private _createTextContainer(): void {
    if (this._textContainer) return;
    
    this._textContainer = document.createElement('div');
    this._textContainer.className = 'text-rectangle-container';
    this._textContainer.style.position = 'absolute';
    this._textContainer.style.transform = 'translate(-50%, -50%)';
    this._textContainer.style.pointerEvents = 'none'; // Pour permettre les événements de la carte en dessous
    this._textContainer.style.padding = '2px 5px';
    this._textContainer.style.borderRadius = '3px';
    this._textContainer.style.overflow = 'hidden';
    this._textContainer.style.userSelect = 'none';
    this._textContainer.style.maxWidth = '200px';
    this._textContainer.style.textAlign = this.properties.style.textAlign || 'center';
    this._textContainer.style.backgroundColor = this.properties.style.backgroundColor || '#FFFFFF';
    this._textContainer.style.color = this.properties.style.textColor || '#000000';
    this._textContainer.style.fontSize = this.properties.style.fontSize || '14px';
    this._textContainer.style.fontFamily = this.properties.style.fontFamily || 'Arial, sans-serif';
    this._textContainer.style.fontWeight = this.properties.style.bold ? 'bold' : 'normal';
    this._textContainer.style.fontStyle = this.properties.style.italic ? 'italic' : 'normal';
    this._textContainer.innerText = this.properties.text;
  }

  private enableTextEditing = (e: L.LeafletMouseEvent): void => {
    if (!this._textContainer || this._isEditing) return;
    
    L.DomEvent.stopPropagation(e);
    this._isEditing = true;
    
    // Make text editable
    this._textContainer.contentEditable = 'true';
    this._textContainer.style.pointerEvents = 'auto';
    this._textContainer.style.cursor = 'text';
    this._textContainer.style.outline = 'none';
    this._textContainer.style.boxShadow = '0 0 0 2px #3388ff';
    this._textContainer.classList.add('editing');
    
    // Select all text
    document.execCommand('selectAll', false, undefined);
    this._textContainer.focus();
    
    const finishEditing = (): void => {
      if (!this._textContainer) return;
      
      this._textContainer.contentEditable = 'false';
      this._textContainer.style.pointerEvents = 'none';
      this._textContainer.style.boxShadow = 'none';
      this._textContainer.classList.remove('editing');
      
      const newText = this._textContainer.innerText.trim();
      if (newText) {
        this.setText(newText);
      } else {
        // If empty text, revert to previous or default text
        this._textContainer.innerText = this.properties.text || 'Double-cliquez pour éditer';
      }
      
      this._isEditing = false;
      this._textContainer.removeEventListener('blur', finishEditing);
      this._textContainer.removeEventListener('keydown', onKeyDown);
    };

    const onKeyDown = (e: KeyboardEvent): void => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        finishEditing();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        this._textContainer!.innerText = this.properties.text; // Cancel edit
        finishEditing();
      }
    };

    this._textContainer.addEventListener('blur', finishEditing);
    this._textContainer.addEventListener('keydown', onKeyDown);
  };

  onAdd(map: L.Map): this {
    try {
      console.log('[TextRectangle] onAdd called with map:', !!map);
      super.onAdd(map);
      this._mapInstance = map;
      
      if (this._textContainer) {
        // Add the text container to the overlay pane to move with the map
        map.getPanes().overlayPane.appendChild(this._textContainer);
        this.updateTextPosition();
        this._initialized = true;
        console.log('[TextRectangle] Added to map and text container attached');
      }
    } catch (e) {
      console.error('[TextRectangle] Error adding TextRectangle to map:', e);
    }
    return this;
  }

  onRemove(map: L.Map): this {
    try {
      console.log('[TextRectangle] onRemove called');
      if (this._textContainer && this._textContainer.parentElement) {
        this._textContainer.parentElement.removeChild(this._textContainer);
        console.log('[TextRectangle] Text container removed from DOM');
      }
      this._mapInstance = null;
      this._initialized = false;
      super.onRemove(map);
    } catch (e) {
      console.error('[TextRectangle] Error removing TextRectangle from map:', e);
    }
    return this;
  }

  private updateTextPosition = (): void => {
    if (!this._textContainer || !this._mapInstance) return;
    
    try {
      const center = this.getCenter();
      if (!center) return;
      
      const pos = this._mapInstance.latLngToLayerPoint(center);
      
      this._textContainer.style.left = `${pos.x}px`;
      this._textContainer.style.top = `${pos.y}px`;
      
      // Apply rotation if defined
      if (this.properties.rotation !== 0) {
        this._textContainer.style.transform = `translate(-50%, -50%) rotate(${this.properties.rotation}deg)`;
      } else {
        this._textContainer.style.transform = 'translate(-50%, -50%)';
      }
    } catch (e) {
      console.error('Error updating text position:', e);
    }
  };

  public setText(text: string): void {
    this.properties.text = text;
    if (this._textContainer) {
      this._textContainer.innerText = text;
    }
    this.fire('properties:updated', { shape: this, properties: this.properties });
  }

  public setTextStyle(style: Partial<TextRectangleProperties['style']>): void {
    // Update style properties
    this.properties.style = { ...this.properties.style, ...style };
    
    // Update text container appearance
    if (this._textContainer) {
      if (style.textColor) this._textContainer.style.color = style.textColor;
      if (style.fontSize) this._textContainer.style.fontSize = style.fontSize;
      if (style.fontFamily) this._textContainer.style.fontFamily = style.fontFamily;
      if (style.backgroundColor) this._textContainer.style.backgroundColor = style.backgroundColor;
      if (style.textAlign) this._textContainer.style.textAlign = style.textAlign;
      
      // Handle bold and italic
      if (style.bold !== undefined) this._textContainer.style.fontWeight = style.bold ? 'bold' : 'normal';
      if (style.italic !== undefined) this._textContainer.style.fontStyle = style.italic ? 'italic' : 'normal';
    }
    
    // Update polygon style properties
    const polygonStyle: L.PathOptions = {};
    if (style.color) polygonStyle.color = style.color;
    if (style.weight !== undefined) polygonStyle.weight = style.weight;
    if (style.fillColor) polygonStyle.fillColor = style.fillColor;
    if (style.fillOpacity !== undefined) polygonStyle.fillOpacity = style.fillOpacity;
    
    // Apply styles to the underlying shape
    if (Object.keys(polygonStyle).length > 0) {
      this.setStyle(polygonStyle);
    }
    
    this.fire('properties:updated', { shape: this, properties: this.properties });
  }

  private enforceRectangularShape = (): void => {
    // Make sure we have a valid polygon with exactly 4 points
    try {
      const latLngs = this.getLatLngs();
      if (!latLngs || !Array.isArray(latLngs) || latLngs.length === 0) {
        console.warn('TextRectangle: Invalid latLngs structure - empty array');
        if (this.originalLatLngs.length === 4) {
          this.setLatLngs([this.originalLatLngs]);
        }
        return;
      }
      
      if (!Array.isArray(latLngs[0])) {
        console.warn('TextRectangle: Invalid latLngs structure - not nested array');
        if (this.originalLatLngs.length === 4) {
          this.setLatLngs([this.originalLatLngs]);
        }
        return;
      }
      
      const points = latLngs[0] as L.LatLng[];
      if (points.length !== 4) {
        console.warn('TextRectangle must have exactly 4 points, got:', points.length);
        if (this.originalLatLngs.length === 4) {
          this.setLatLngs([this.originalLatLngs]);
        }
        return;
      }

      // Validate all points are proper LatLng objects
      const validPoints = points.every(p => 
        p && typeof p.lat === 'number' && typeof p.lng === 'number' && 
        !isNaN(p.lat) && !isNaN(p.lng)
      );
      
      if (!validPoints) {
        console.warn('TextRectangle: Contains invalid LatLng points');
        if (this.originalLatLngs.length === 4) {
          this.setLatLngs([this.originalLatLngs]);
        }
        return;
      }

      // Calculate bounds and create a proper rectangle
      const bounds = this.getBounds();
      if (!bounds.isValid()) {
        console.warn('TextRectangle: Invalid bounds calculated');
        return;
      }
      
      const sw = bounds.getSouthWest();
      const se = L.latLng(bounds.getSouth(), bounds.getEast());
      const ne = bounds.getNorthEast();
      const nw = L.latLng(bounds.getNorth(), bounds.getWest());
      const newLatLngs = [sw, se, ne, nw];

      // Check if there's a significant change to avoid unnecessary updates
      const hasSignificantChange = newLatLngs.some((newLL, i) => {
        const oldLL = points[i];
        return Math.abs(newLL.lat - oldLL.lat) > 1e-6 || Math.abs(newLL.lng - oldLL.lng) > 1e-6;
      });

      if (hasSignificantChange) {
        // Use the base Polygon setLatLngs to avoid triggering our own override
        L.Polygon.prototype.setLatLngs.call(this, [newLatLngs]);
        this.originalLatLngs = newLatLngs.slice();
        this.updateTextPosition();
        this.updateProperties();
      }
    } catch (e) {
      console.error('Error in enforceRectangularShape:', e);
      // Attempt recovery by using original points if available
      if (this.originalLatLngs.length === 4) {
        try {
          L.Polygon.prototype.setLatLngs.call(this, [this.originalLatLngs]);
        } catch (e2) {
          console.error('Failed to recover TextRectangle shape:', e2);
        }
      }
    }
  };

  private onMarkerDragEnd = (e: any): void => {
    try {
      const marker = e.marker;
      const markerLatLng = marker.getLatLng();
      const vertices = this.getLatLngs()[0] as L.LatLng[];
      let minDist = Infinity;
      let closestIndex = 0;
      vertices.forEach((vertex, i) => {
        const dist = markerLatLng.distanceTo(vertex);
        if (dist < minDist) {
          minDist = dist;
          closestIndex = i;
        }
      });

      if (closestIndex % 2 === 0) {
        this.resizeFromCorner(closestIndex, markerLatLng);
      } else {
        this.resizeFromSide(closestIndex, markerLatLng);
      }
    } catch (e) {
      console.error('Error in onMarkerDragEnd:', e);
    }
  };

  public setLatLngs(latlngs: L.LatLngExpression[] | L.LatLngExpression[][]): this {
    super.setLatLngs(latlngs);
    this.enforceRectangularShape();
    this.updateTextPosition();
    return this;
  }

  public updateProperties(): void {
    try {
      const latLngs = this.getLatLngs()[0] as L.LatLng[];
      if (latLngs.length !== 4) {
        console.warn('TextRectangle doit avoir exactement 4 points');
        return;
      }

      const sw = latLngs[0];
      const se = latLngs[1];
      const nw = latLngs[3];

      // Calculate dimensions in meters
      const width = turf.distance([sw.lng, sw.lat], [se.lng, se.lat], { units: 'meters' });
      const height = turf.distance([sw.lng, sw.lat], [nw.lng, nw.lat], { units: 'meters' });
      const area = width * height;

      // Calculate rotation angle
      const deltaLng = se.lng - sw.lng;
      const deltaLat = se.lat - sw.lat;
      let rotation = Math.atan2(deltaLat, deltaLng) * (180 / Math.PI);
      rotation = (rotation + 360) % 360;

      // Update properties
      this.properties.width = width;
      this.properties.height = height;
      this.properties.area = area;
      this.properties.rotation = rotation;
      this.properties.center = this.getCenter();

      // Notify changes
      this.fire('properties:updated', {
        shape: this,
        properties: this.properties
      });
    } catch (e) {
      console.error('Error in updateProperties:', e);
    }
  }

  public resizeFromCorner(cornerIndex: number, newLatLng: L.LatLng): void {
    try {
      const latLngs = this.getLatLngs()[0] as L.LatLng[];
      if (latLngs.length !== 4) return;

      const adjacent1 = (cornerIndex + 1) % 4;
      const adjacent2 = (cornerIndex + 3) % 4;
      latLngs[cornerIndex] = newLatLng;

      if (cornerIndex === 0 || cornerIndex === 2) {
        latLngs[adjacent1] = L.latLng(latLngs[adjacent1].lat, newLatLng.lng);
        latLngs[adjacent2] = L.latLng(newLatLng.lat, latLngs[adjacent2].lng);
      } else {
        latLngs[adjacent1] = L.latLng(newLatLng.lat, latLngs[adjacent1].lng);
        latLngs[adjacent2] = L.latLng(latLngs[adjacent2].lat, newLatLng.lng);
      }

      L.Polygon.prototype.setLatLngs.call(this, [latLngs]);
      this.updateTextPosition();
      this.updateProperties();
    } catch (e) {
      console.error('Error in resizeFromCorner:', e);
    }
  }

  public resizeFromSide(sideIndex: number, newLatLng: L.LatLng): void {
    try {
      const latLngs = this.getLatLngs()[0] as L.LatLng[];
      if (latLngs.length !== 4) return;

      if (sideIndex === 0 || sideIndex === 2) {
        latLngs[sideIndex].lat = newLatLng.lat;
        latLngs[(sideIndex + 1) % 4].lat = newLatLng.lat;
      } else {
        latLngs[sideIndex].lng = newLatLng.lng;
        latLngs[(sideIndex + 1) % 4].lng = newLatLng.lng;
      }

      L.Polygon.prototype.setLatLngs.call(this, [latLngs]);
      this.updateTextPosition();
      this.updateProperties();
    } catch (e) {
      console.error('Error in resizeFromSide:', e);
    }
  }

  public moveFromCenter(newCenter: L.LatLng): void {
    try {
      const currentCenter = this.getCenter();
      if (!currentCenter) return;
      
      const deltaLat = newCenter.lat - currentCenter.lat;
      const deltaLng = newCenter.lng - currentCenter.lng;
      const latLngs = this.getLatLngs()[0] as L.LatLng[];
      const newLatLngs = latLngs.map(ll => L.latLng(ll.lat + deltaLat, ll.lng + deltaLng));
      
      L.Polygon.prototype.setLatLngs.call(this, [newLatLngs]);
      this.updateTextPosition();
      this.updateProperties();
    } catch (e) {
      console.error('Error in moveFromCenter:', e);
    }
  }

  public getMidPoints(): L.LatLng[] {
    return super.getMidPoints();
  }

  // Helper for tests and debugging
  public getTextElement(): HTMLDivElement | null {
    return this._textContainer;
  }

  // Toggle dragging
  public toggleDragging(enable: boolean): void {
    if (!this.pm) return;
    
    try {
      if (enable) {
        this.pm.enableLayerDrag();
      } else {
        this.pm.disableLayerDrag();
      }
    } catch (error) {
      console.error('Error toggling dragging for TextRectangle:', error);
    }
  }
} 