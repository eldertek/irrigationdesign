import L from 'leaflet';
import * as turf from '@turf/turf';

export interface TextRectangleOptions extends L.PolylineOptions {
  textColor?: string;
  fontSize?: string;
  fontFamily?: string;
  textAlign?: string;
  backgroundColor?: string;
  backgroundOpacity?: number;
  bold?: boolean;
  italic?: boolean;
}

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

export class TextRectangle extends L.Rectangle {
  public properties: TextRectangleProperties;
  private _textNode: SVGTextElement | null = null;
  private _map: L.Map | null = null;
  private _isEditing: boolean = false;
  private _editableDiv: HTMLDivElement | null = null;
  private _originalText: string = '';
  private _fontScale: number = 1.0;

  constructor(
    bounds: L.LatLngBoundsExpression,
    text: string = 'Double-cliquez pour éditer',
    options: TextRectangleOptions = {}
  ) {
    // Ensure bounds are valid
      const b = bounds instanceof L.LatLngBounds ? bounds : L.latLngBounds(bounds);
      
      // Validate bounds are not empty/invalid
      if (!b.isValid()) {
        console.warn('[TextRectangle] Initialized with invalid bounds, using default bounds');
        const center = L.latLng(0, 0);
        b.extend(L.latLng(center.lat + 0.001, center.lng + 0.001));
        b.extend(L.latLng(center.lat - 0.001, center.lng - 0.001));
      }

      // Make sure options are properly initialized to avoid unexpected rendering
      const mergedOptions = {
        ...options,
        pmIgnore: false,
        interactive: true,
        fill: true,
        stroke: true,
        className: 'leaflet-text-rectangle'
      };

    super(b, mergedOptions);

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
        fillColor: mergedOptions.fillColor || '#FFFFFF',
        fillOpacity: mergedOptions.fillOpacity || 0.8,
        textColor: mergedOptions.textColor || '#000000',
        fontSize: mergedOptions.fontSize || '14px',
        fontFamily: mergedOptions.fontFamily || 'Arial, sans-serif',
        textAlign: mergedOptions.textAlign || 'center',
        bold: mergedOptions.bold || false,
        italic: mergedOptions.italic || false
      }
    };

      // Setup event handlers
    this.on('add', this._onAdd);
    this.on('remove', this._onRemove);
    this.on('dblclick', this._onDoubleClick);
    this.on('dragend', this._updateTextPosition);
    this.on('pm:edit', this._updateTextPosition);
    this.on('pm:dragend', this._updateTextPosition);
    this.on('pm:markerdragend', this._updateTextPosition);
    this.on('pm:vertexadded', this._updateTextPosition);
    this.on('pm:vertexremoved', this._updateTextPosition);

      // Enable dragging via leaflet-geoman
      if (this.pm) {
        this.pm.enableLayerDrag();
    }
  }

  // Override Leaflet methods
  onAdd(map: L.Map): this {
    this._map = map;
      super.onAdd(map);
    this._textRedraw();
    this.updateProperties();
    return this;
  }

  onRemove(map: L.Map): this {
    this._cleanupEditableDiv();
    this._removeTextNode();
    this._map = null;
      super.onRemove(map);
    return this;
    }

  bringToFront(): this {
    super.bringToFront();
    this._textRedraw();
    return this;
  }

  _update(): void {
    super._update();
    this._textRedraw();
  }

  // Public methods
  setText(text: string): void {
    if (!text) text = 'Double-cliquez pour éditer';
    this.properties.text = text;
    this._textRedraw();
    this.fire('properties:updated', { shape: this, properties: this.properties });
  }

  setTextStyle(style: Partial<TextRectangleProperties['style']>): void {
    // Update style properties
    this.properties.style = { ...this.properties.style, ...style };
    
    // Apply styles to the underlying shape
    const rectStyle: L.PathOptions = {};
    if (style.color) rectStyle.color = style.color;
    if (style.weight !== undefined) rectStyle.weight = style.weight;
    if (style.fillColor) rectStyle.fillColor = style.fillColor;
    if (style.fillOpacity !== undefined) rectStyle.fillOpacity = style.fillOpacity;
    
    if (Object.keys(rectStyle).length > 0) {
      this.setStyle(rectStyle);
    }

    // Update text rendering
    this._textRedraw();
    
    this.fire('properties:updated', { shape: this, properties: this.properties });
  }

  setRotation(rotation: number): void {
    this.properties.rotation = rotation;
    this._textRedraw();
    this.fire('properties:updated', { shape: this, properties: this.properties });
  }

  getTextElement(): SVGTextElement | null {
    return this._textNode;
  }

  updateProperties(): void {
    try {
      if (!this._map) return;

      const bounds = this.getBounds();
      
      // Calculate width and height in meters
      const sw = bounds.getSouthWest();
      const se = L.latLng(bounds.getSouth(), bounds.getEast());
      const ne = bounds.getNorthEast();
      
      const width = this._map.distance(sw, se);
      const height = this._map.distance(sw, L.latLng(bounds.getNorth(), bounds.getWest()));
      const area = width * height;

      // Calculate rotation if needed (0 for standard rectangles)
      // Note: Calculating actual rotation would require additional tracking of original orientation

      // Update properties
      this.properties.width = width;
      this.properties.height = height;
      this.properties.area = area;
      this.properties.center = bounds.getCenter();
      
      this.fire('properties:updated', { shape: this, properties: this.properties });
    } catch (error) {
      console.error('[TextRectangle] Error updating properties:', error);
    }
  }

  /**
   * Définit les limites du rectangle et met à jour le texte
   */
  setBounds(bounds: L.LatLngBounds): this {
    super.setBounds(bounds);
    this._textRedraw();
    return this;
  }

  // Private methods
  private _textRedraw(): void {
    // Get the text from properties
    const text = this.properties.text;
    
    // Skip if not in SVG mode or map not initialized
    if (!L.Browser.svg || !this._map || !text || this._isEditing) {
      return;
    }
    
    // Remove existing text node first
    this._removeTextNode();
    
    try {
      // Get the SVG container element
      const renderer = this._map.getRenderer(this);
      if (!renderer._container) return;
      
      const svg = renderer._container;
      
      // Add ID to the path
      const id = 'textbox-' + L.Util.stamp(this);
      if (this._path) {
        this._path.setAttribute('id', id);
      }
      
      // Create the text node
      const textNode = L.SVG.create('text') as SVGTextElement;
      textNode.setAttribute('class', 'leaflet-text-rectangle-text');
      
      // Set text styling attributes
      textNode.style.fill = this.properties.style.textColor || '#000000';
      textNode.style.fontFamily = this.properties.style.fontFamily || 'Arial, sans-serif';
      textNode.style.fontWeight = this.properties.style.bold ? 'bold' : 'normal';
      textNode.style.fontStyle = this.properties.style.italic ? 'italic' : 'normal';
      
      // Calculate font scale based on zoom level
      const defaultZoom = 15;
      const currentZoom = this._map.getZoom();
      const zoomOffset = currentZoom - defaultZoom;
      this._fontScale = Math.max(0.5, Math.min(2.0, Math.pow(1.2, zoomOffset)));
      
      // Get the bounds and position
      const bounds = this.getBounds();
      const nw = bounds.getNorthWest();
      const se = bounds.getSouthEast();
      const nwPoint = this._map.latLngToLayerPoint(nw);
      const sePoint = this._map.latLngToLayerPoint(se);
      
      // Calculate position and dimensions
      const padding = 10;
      const textX = nwPoint.x + padding;
      const textY = nwPoint.y + padding;
      const textWidth = Math.max(10, sePoint.x - nwPoint.x - (padding * 2));
      
      // Position the text
      textNode.setAttribute('x', textX.toString());
      textNode.setAttribute('y', textY.toString());
      textNode.setAttribute('text-anchor', 'start');
      textNode.setAttribute('dominant-baseline', 'hanging');
      
      // Apply rotation if needed
      if (this.properties.rotation !== 0) {
        const center = this._map.latLngToLayerPoint(bounds.getCenter());
        textNode.setAttribute('transform', 
          `rotate(${this.properties.rotation}, ${center.x}, ${center.y})`);
      }
      
      // Calculate font size based on scale
      const baseFontSize = parseInt(this.properties.style.fontSize || '14px') * this._fontScale;
      const lineHeight = baseFontSize * 1.2; // 1.2em line height
      
      // Split text by newlines and process each line
      const lines = text.replace(/ /g, '\u00A0').split(/\n|\r\n?/);
      
      lines.forEach((line, index) => {
        const tspan = L.SVG.create('tspan');
        tspan.setAttribute('x', textX.toString());
        tspan.setAttribute('dy', index === 0 ? '0' : lineHeight + 'px');
        tspan.style.fontSize = baseFontSize + 'px';
        
        // Handle text alignment
        const textAlign = this.properties.style.textAlign || 'left';
        if (textAlign === 'center') {
          tspan.setAttribute('x', ((nwPoint.x + sePoint.x) / 2).toString());
          tspan.setAttribute('text-anchor', 'middle');
        } else if (textAlign === 'right') {
          tspan.setAttribute('x', (sePoint.x - padding).toString());
          tspan.setAttribute('text-anchor', 'end');
        }
        
        tspan.textContent = line;
        textNode.appendChild(tspan);
      });
      
      // Store the text node and add it to SVG
      this._textNode = textNode;
      svg.appendChild(textNode);
    } catch (error) {
      console.error('[TextRectangle] Error drawing text:', error);
    }
  }

  private _removeTextNode(): void {
    if (this._textNode && this._textNode.parentNode) {
      this._textNode.parentNode.removeChild(this._textNode);
      this._textNode = null;
    }
  }

  private _onAdd = (): void => {
    this.updateProperties();
    this._textRedraw();
  }

  private _onRemove = (): void => {
    this._cleanupEditableDiv();
    this._removeTextNode();
  }

  private _updateTextPosition = (): void => {
    this.updateProperties();
    this._textRedraw();
  }

  // Text editing methods
  private _onDoubleClick = (e: L.LeafletMouseEvent): void => {
    if (this._isEditing) return;
    
    L.DomEvent.stopPropagation(e);
    this._isEditing = true;
    this._originalText = this.properties.text;
    
    // Remove text node while editing
    this._removeTextNode();
    
    // Create editable div
    this._createEditableDiv();
  }

  private _createEditableDiv(): void {
    if (!this._map) return;
    
    try {
      const bounds = this.getBounds();
      const nw = bounds.getNorthWest();
      const se = bounds.getSouthEast();
      const nwPoint = this._map.latLngToLayerPoint(nw);
      const sePoint = this._map.latLngToLayerPoint(se);
      
      // Create editable div
      const div = document.createElement('div');
      div.className = 'leaflet-text-rectangle-editor';
      div.style.position = 'absolute';
      div.style.left = nwPoint.x + 'px';
      div.style.top = nwPoint.y + 'px';
      div.style.width = (sePoint.x - nwPoint.x - 20) + 'px';
      div.style.maxHeight = (sePoint.y - nwPoint.y - 20) + 'px';
      div.style.padding = '10px';
      div.style.backgroundColor = this.properties.style.backgroundColor || '#FFFFFF';
      div.style.color = this.properties.style.textColor || '#000000';
      div.style.fontSize = parseInt(this.properties.style.fontSize || '14px') * this._fontScale + 'px';
      div.style.fontFamily = this.properties.style.fontFamily || 'Arial, sans-serif';
      div.style.fontWeight = this.properties.style.bold ? 'bold' : 'normal';
      div.style.fontStyle = this.properties.style.italic ? 'italic' : 'normal';
      div.style.textAlign = this.properties.style.textAlign || 'left';
      div.style.border = '2px solid #3388ff';
      div.style.borderRadius = '3px';
      div.style.boxShadow = '0 0 10px rgba(0,0,0,0.2)';
      div.style.zIndex = '1000';
      div.style.overflow = 'auto';
      div.style.whiteSpace = 'pre-wrap';
      div.style.wordBreak = 'break-word';
      div.contentEditable = 'true';
      
      // Apply rotation if needed
      if (this.properties.rotation !== 0) {
        const center = this._map.latLngToLayerPoint(bounds.getCenter());
        const divCenterX = (nwPoint.x + sePoint.x) / 2;
        const divCenterY = (nwPoint.y + sePoint.y) / 2;
        div.style.transformOrigin = `${center.x - nwPoint.x + 10}px ${center.y - nwPoint.y + 10}px`;
        div.style.transform = `rotate(${this.properties.rotation}deg)`;
      }
      
      div.innerText = this.properties.text;
      
      // Add to document
      document.body.appendChild(div);
      this._editableDiv = div;
      
      // Focus and select
      div.focus();
      
      // Add event listeners
      div.addEventListener('keydown', this._onKeyDown);
      div.addEventListener('blur', this._finishEditing);
      
      // Temporarily disable map dragging
      if (this._map.dragging.enabled()) {
        this._map.dragging.disable();
      }
    } catch (error) {
      console.error('[TextRectangle] Error creating editable div:', error);
      this._isEditing = false;
    }
  }

  private _onKeyDown = (e: KeyboardEvent): void => {
    if (e.key === 'Enter' && e.ctrlKey) {
      e.preventDefault();
      this._finishEditing();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      this._cancelEditing();
    }
  }

  private _finishEditing = (): void => {
    if (!this._editableDiv) return;
    
    try {
      // Get new text
      const newText = this._editableDiv.innerText.trim();
      this.setText(newText || 'Double-cliquez pour éditer');
      
      this._cleanupEditableDiv();
      
      // Re-enable map dragging
      if (this._map && !this._map.dragging.enabled()) {
        this._map.dragging.enable();
      }
    } catch (error) {
      console.error('[TextRectangle] Error finishing editing:', error);
    }
  }

  private _cancelEditing = (): void => {
    // Restore original text
    this.setText(this._originalText);
    this._cleanupEditableDiv();
    
    // Re-enable map dragging
    if (this._map && !this._map.dragging.enabled()) {
      this._map.dragging.enable();
    }
  }

  private _cleanupEditableDiv(): void {
    if (this._editableDiv) {
      this._editableDiv.removeEventListener('keydown', this._onKeyDown);
      this._editableDiv.removeEventListener('blur', this._finishEditing);
      
      if (this._editableDiv.parentNode) {
        this._editableDiv.parentNode.removeChild(this._editableDiv);
      }
      
      this._editableDiv = null;
      this._isEditing = false;
    }
  }
} 