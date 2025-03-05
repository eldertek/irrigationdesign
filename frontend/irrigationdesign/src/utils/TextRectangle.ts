import L from 'leaflet';
import '@geoman-io/leaflet-geoman-free';

// Extend Leaflet event handlers for Geoman events
declare module 'leaflet' {
  interface LeafletEventHandlerFnMap {
    'pm:edit': L.LeafletEventHandlerFn;
    'pm:dragend': L.LeafletEventHandlerFn;
    'pm:markerdragend': L.LeafletEventHandlerFn;
    'pm:vertexadded': L.LeafletEventHandlerFn;
    'pm:vertexremoved': L.LeafletEventHandlerFn;
  }
}

// Interface for style options
export interface TextRectangleOptions extends L.PolylineOptions {
  textColor?: string;
  fontSize?: string;
  fontFamily?: string;
  textAlign?: 'left' | 'center' | 'right';
  backgroundColor?: string;
  backgroundOpacity?: number;
  bold?: boolean;
  italic?: boolean;
  fixedPhysicalSize?: boolean;
}

// Interface for properties
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
    textAlign?: string;
    backgroundColor?: string;
    backgroundOpacity?: number;
    bold?: boolean;
    italic?: boolean;
    fixedPhysicalSize?: boolean;
  };
}

export class TextRectangle extends L.Rectangle {
  public properties: TextRectangleProperties;
  private _textNode: SVGTextElement | null = null;
  private _isEditing: boolean = false;
  private _editableDiv: HTMLDivElement | null = null;
  private _fontScale: number = 1.0;

  private get map(): L.Map | undefined {
    return (this as any)._map;
  }

  private set map(value: L.Map | undefined) {
    (this as any)._map = value;
  }

  constructor(
    bounds: L.LatLngBoundsExpression,
    text: string = 'Double-cliquez pour éditer',
    options: TextRectangleOptions = {}
  ) {
    const validBounds = bounds instanceof L.LatLngBounds ? bounds : L.latLngBounds(bounds);
    if (!validBounds.isValid()) {
      console.warn('[TextRectangle] Limites invalides, utilisation de limites par défaut');
      const center = L.latLng(0, 0);
      validBounds.extend(L.latLng(center.lat + 0.001, center.lng + 0.001));
      validBounds.extend(L.latLng(center.lat - 0.001, center.lng - 0.001));
    }

    const mergedOptions = {
      ...options,
      pmIgnore: false,
      interactive: true,
      fill: true,
      stroke: true,
      className: 'leaflet-text-rectangle',
    };

    super(validBounds, mergedOptions);

    this.properties = {
      type: 'TextRectangle',
      text,
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
        backgroundColor: mergedOptions.backgroundColor || '#FFFFFF',
        backgroundOpacity: mergedOptions.backgroundOpacity ?? 1,
        bold: mergedOptions.bold || false,
        italic: mergedOptions.italic || false,
        fixedPhysicalSize: mergedOptions.fixedPhysicalSize || false,
      },
    };

    this.on({
      add: this._onAdd,
      remove: this._onRemove,
      dblclick: this._onDoubleClick,
      dragend: this._updateTextPosition,
      'pm:edit': this._updateTextPosition,
      'pm:dragend': this._updateTextPosition,
      'pm:markerdragend': this._updateTextPosition,
      'pm:vertexadded': this._updateTextPosition,
      'pm:vertexremoved': this._updateTextPosition,
    });

    if (this.pm) {
      this.pm.enableLayerDrag();
    }
  }

  public setText(text: string): void {
    this.properties.text = text || 'Double-cliquez pour éditer';
    this._textRedraw();
    this.fire('properties:updated', { shape: this, properties: this.properties });
  }

  public setTextStyle(style: Partial<TextRectangleProperties['style']>): void {
    this.properties.style = { ...this.properties.style, ...style };
    const rectStyle: L.PathOptions = {
      color: style.color || this.properties.style.color,
      weight: style.weight ?? this.properties.style.weight,
      fillColor: style.fillColor || this.properties.style.fillColor,
      fillOpacity: style.fillOpacity ?? this.properties.style.fillOpacity,
    };
    this.setStyle(rectStyle);
    this._textRedraw();
    this.fire('properties:updated', { shape: this, properties: this.properties });
  }

  public setRotation(rotation: number): void {
    this.properties.rotation = rotation % 360;
    this._textRedraw();
    this.fire('properties:updated', { shape: this, properties: this.properties });
  }

  public getTextElement(): SVGTextElement | null {
    return this._textNode;
  }

  public updateProperties(): void {
    if (!this.map) return;
    try {
      const bounds = this.getBounds();
      const sw = bounds.getSouthWest();
      const se = L.latLng(bounds.getSouth(), bounds.getEast());
      const width = this.map.distance(sw, se);
      const height = this.map.distance(sw, L.latLng(bounds.getNorth(), bounds.getWest()));
      this.properties.width = width;
      this.properties.height = height;
      this.properties.area = width * height;
      this.properties.center = bounds.getCenter();
      this.fire('properties:updated', { shape: this, properties: this.properties });
    } catch (error) {
      console.error('[TextRectangle] Erreur lors de la mise à jour des propriétés :', error);
    }
  }

  public setBounds(bounds: L.LatLngBounds): this {
    super.setBounds(bounds);
    this._textRedraw();
    this.updateProperties();
    return this;
  }

  private _onAdd(): void {
    if (!this.map) return;
    this.map = this.map!;
    this.updateProperties();
    this._textRedraw();
    this.map.on('zoomend', this._onZoomEnd);
  }

  private _onRemove(): void {
    if (!this.map) return;
    this.map.off('zoomend', this._onZoomEnd);
    this._cleanupEditableDiv();
    this._removeTextNode();
    this.map = undefined;
  }

  private _textRedraw(): void {
    if (!L.Browser.svg || !this.map || this._isEditing) return;

    this._removeTextNode();
    const text = this.properties.text;
    if (!text) return;

    try {
      const path = (this as any)._path as SVGPathElement;
      if (!path) return;
      const svg = path.ownerSVGElement;
      if (!svg) return;

      const textNode = L.SVG.create('text') as SVGTextElement;
      textNode.setAttribute('class', 'leaflet-text-rectangle-text');

      textNode.style.fill = this.properties.style.textColor || '#000000';
      textNode.style.fontFamily = this.properties.style.fontFamily || 'Arial, sans-serif';
      textNode.style.fontWeight = this.properties.style.bold ? 'bold' : 'normal';
      textNode.style.fontStyle = this.properties.style.italic ? 'italic' : 'normal';

      const bounds = this.getBounds();
      const nw = this.map.latLngToLayerPoint(bounds.getNorthWest());
      const se = this.map.latLngToLayerPoint(bounds.getSouthEast());
      const padding = 10;
      const baseFontSize = parseInt(this.properties.style.fontSize || '14');
      const fontSize = this.properties.style.fixedPhysicalSize
        ? this._calculatePhysicalFontSize(baseFontSize)
        : baseFontSize * this._fontScale;

      const lines = text.split('\n');
      lines.forEach((line, index) => {
        const tspan = L.SVG.create('tspan');
        tspan.textContent = line;
        tspan.setAttribute('dy', index === 0 ? '0' : `${fontSize * 1.2}px`);
        tspan.style.fontSize = `${fontSize}px`;

        const textXBase =
          this.properties.style.textAlign === 'center'
            ? (nw.x + se.x) / 2
            : this.properties.style.textAlign === 'right'
            ? se.x - padding
            : nw.x + padding;

        tspan.setAttribute('x', textXBase.toString());
        tspan.setAttribute(
          'text-anchor',
          this.properties.style.textAlign === 'center'
            ? 'middle'
            : this.properties.style.textAlign === 'right'
            ? 'end'
            : 'start'
        );
        textNode.appendChild(tspan);
      });

      const textY = nw.y + padding;
      textNode.setAttribute('y', textY.toString());
      textNode.setAttribute('dominant-baseline', 'hanging');

      if (this.properties.rotation !== 0) {
        const center = this.map.latLngToLayerPoint(bounds.getCenter());
        textNode.setAttribute('transform', `rotate(${this.properties.rotation}, ${center.x}, ${center.y})`);
      }

      this._textNode = textNode;
      svg.appendChild(textNode);
    } catch (error) {
      console.error('[TextRectangle] Erreur lors du rendu du texte :', error);
    }
  }

  private _calculatePhysicalFontSize(baseSize: number): number {
    if (!this.map) return baseSize;
    const bounds = this.getBounds();
    const center = bounds.getCenter();
    const zoom = this.map.getZoom();
    const metersPerPixel = (40075016.686 * Math.abs(Math.cos((center.lat * Math.PI) / 180))) / Math.pow(2, zoom + 8);
    return Math.max(10, Math.min(48, (baseSize / metersPerPixel) * 2.5));
  }

  private _removeTextNode(): void {
    if (this._textNode && this._textNode.parentNode) {
      this._textNode.parentNode.removeChild(this._textNode);
      this._textNode = null;
    }
  }

  private _onDoubleClick(e: L.LeafletMouseEvent): void {
    if (this._isEditing) return;
    L.DomEvent.stopPropagation(e);
    this._isEditing = true;
    this._removeTextNode();
    this._createEditableDiv();
  }

  private _createEditableDiv(): void {
    if (!this.map) return;
    try {
      const bounds = this.getBounds();
      const nw = this.map.latLngToLayerPoint(bounds.getNorthWest());
      const se = this.map.latLngToLayerPoint(bounds.getSouthEast());

      const div = document.createElement('div');
      div.className = 'leaflet-text-rectangle-editor';
      div.style.position = 'absolute';
      div.style.left = `${nw.x + 10}px`;
      div.style.top = `${nw.y + 10}px`;
      div.style.width = `${se.x - nw.x - 20}px`;
      div.style.maxHeight = `${se.y - nw.y - 20}px`;
      div.style.padding = '5px';
      div.style.backgroundColor = this.properties.style.backgroundColor || '#FFFFFF';
      div.style.opacity = `${this.properties.style.backgroundOpacity ?? 1}`;
      div.style.color = this.properties.style.textColor || '#000000';
      div.style.fontSize = `${parseInt(this.properties.style.fontSize || '14') * this._fontScale}px`;
      div.style.fontFamily = this.properties.style.fontFamily || 'Arial, sans-serif';
      div.style.fontWeight = this.properties.style.bold ? 'bold' : 'normal';
      div.style.fontStyle = this.properties.style.italic ? 'italic' : 'normal';
      div.style.textAlign = this.properties.style.textAlign || 'center';
      div.style.border = '2px dashed #3388ff';
      div.style.zIndex = '1000';
      div.style.overflow = 'auto';
      div.style.whiteSpace = 'pre-wrap';
      div.contentEditable = 'true';
      div.innerText = this.properties.text;

      if (this.properties.rotation !== 0) {
        const center = this.map.latLngToLayerPoint(bounds.getCenter());
        div.style.transformOrigin = `${center.x - nw.x - 10}px ${center.y - nw.y - 10}px`;
        div.style.transform = `rotate(${this.properties.rotation}deg)`;
      }

      document.body.appendChild(div);
      this._editableDiv = div;
      div.focus();

      div.addEventListener('keydown', this._onKeyDown);
      div.addEventListener('blur', this._finishEditing);
      if (this.map.dragging.enabled()) {
        this.map.dragging.disable();
      }
    } catch (error) {
      console.error("[TextRectangle] Erreur lors de la creation de l'editeur :", error);
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
  };

  private _finishEditing = (): void => {
    if (!this._editableDiv) return;
    const newText = this._editableDiv.innerText.trim();
    this.setText(newText);
    this._cleanupEditableDiv();
    if (this.map && !this.map.dragging.enabled()) {
      this.map.dragging.enable();
    }
  };

  private _cancelEditing = (): void => {
    this._textRedraw();
    this._cleanupEditableDiv();
    if (this.map && !this.map.dragging.enabled()) {
      this.map.dragging.enable();
    }
  };

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

  private _updateTextPosition = (): void => {
    this.updateProperties();
    this._textRedraw();
  };

  private _onZoomEnd = (): void => {
    this._fontScale = Math.max(0.5, Math.min(2.5, 1 + (this.map!.getZoom() - 15) * 0.15));
    this._textRedraw();
  };
}