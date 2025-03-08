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
export interface TextRectangleTextStyle {
  color: string;
  fontSize: string;
  fontFamily: string;
  textAlign: 'left' | 'center' | 'right';
  backgroundColor: string;
  backgroundOpacity: number;
  bold: boolean;
  italic: boolean;
}
export interface TextRectangleOptions extends L.PathOptions {
  textStyle?: Partial<TextRectangleTextStyle>;
  // Legacy properties for backward compatibility
  textColor?: string;
  fontFamily?: string;
  textAlign?: 'left' | 'center' | 'right';
  bold?: boolean;
  italic?: boolean;
  backgroundColor?: string;
  backgroundOpacity?: number;
}
export interface TextRectangleProperties {
  type: 'TextRectangle';
  text: string;
  width: number;
  height: number;
  area: number;
  rotation: number;
  center?: L.LatLng;
  style: TextRectangleOptions & {
    textStyle: TextRectangleTextStyle;
  };
}
export class TextRectangle extends L.Rectangle {
  public properties: TextRectangleProperties;
  private _textNode: SVGTextElement | null = null;
  private _isEditing: boolean = false;
  private _editableDiv: HTMLDivElement | null = null;
  private _text: string;
  private _rotation: number = 0;
  private _textStyle: TextRectangleTextStyle = {
    color: '#000000',
    fontSize: '14px',
    fontFamily: 'Arial, sans-serif',
    textAlign: 'center',
    backgroundColor: '#FFFFFF',
    backgroundOpacity: 1,
    bold: false,
    italic: false
  };
  private _initialBounds: L.LatLngBounds | null = null;
  private _isResizing: boolean = false;
  private _resizePreview: L.Rectangle | null = null;
  private _minWidth: number = 50; // Largeur minimale en pixels
  private _minHeight: number = 30; // Hauteur minimale en pixels
  private _maxWidth: number = 2000; // Largeur maximale en pixels
  private _maxHeight: number = 1000; // Hauteur maximale en pixels
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
    // Convert legacy options to new textStyle format
    const textStyle = {
      ...options.textStyle,
      color: options.textColor || options.textStyle?.color || '#000000',
      fontFamily: options.fontFamily || options.textStyle?.fontFamily || 'Arial, sans-serif',
      textAlign: options.textAlign || options.textStyle?.textAlign || 'center',
      backgroundColor: options.backgroundColor || options.textStyle?.backgroundColor || '#FFFFFF',
      backgroundOpacity: options.backgroundOpacity ?? options.textStyle?.backgroundOpacity ?? 1,
      bold: options.bold || options.textStyle?.bold || false,
      italic: options.italic || options.textStyle?.italic || false,
      fontSize: options.textStyle?.fontSize || '14px'
    };
    const mergedOptions: TextRectangleOptions = {
      pmIgnore: false,
      interactive: true,
      fill: true,
      stroke: true,
      className: 'leaflet-text-rectangle',
      ...options,
      textStyle
    };
    super(validBounds, mergedOptions);
    this._text = text;
    this._textStyle = textStyle as TextRectangleTextStyle;
    this.properties = {
      type: 'TextRectangle',
      text: this._text,
      width: 0,
      height: 0,
      area: 0,
      rotation: this._rotation,
      style: {
        ...mergedOptions,
        textStyle: this._textStyle
      }
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
      console.log('[TextRectangle] Geoman activé pour cette instance');
    }
  }
  public setText(text: string, style?: Partial<TextRectangleTextStyle>): void {
    const oldText = this.properties.text;
    this._text = text;
    if (style) {
      this._textStyle = {
        ...this._textStyle,
        ...style
      };
    }
    this.properties.text = text || 'Double-cliquez pour éditer';
    console.log('[TextRectangle] Mise à jour du texte', {
      oldText,
      newText: this.properties.text,
      hasTextNode: !!this._textNode
    });
    // Redessiner le texte
    this._textRedraw();
    // Émettre les événements dans cet ordre pour assurer la cohérence
    this.fire('text:updated', { 
      text: this.properties.text,
      oldText,
      bounds: this.getBounds(),
      style: this.properties.style
    });
    // Émettre l'événement properties:updated après text:updated
    this.fire('properties:updated', { 
      shape: this, 
      properties: this.properties,
      source: 'setText'
    });
  }
  public setTextStyle(style: Partial<TextRectangleTextStyle>): void {
    this._textStyle = {
      ...this._textStyle,
      ...style
    };
    this.properties.style.textStyle = this._textStyle;
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
      // Mettre à jour les propriétés
      this.properties.width = width;
      this.properties.height = height;
      this.properties.area = width * height;
      this.properties.center = bounds.getCenter();
      // Émettre l'événement avec la source de la mise à jour
      this.fire('properties:updated', { 
        shape: this, 
        properties: this.properties,
        source: 'updateProperties',
        dimensions: { width, height }
      });
      console.log('[TextRectangle] Propriétés mises à jour', {
        width,
        height,
        area: width * height,
        center: bounds.getCenter()
      });
    } catch (error) {
      console.error('[TextRectangle] Erreur lors de la mise à jour des propriétés :', error);
    }
  }
  public setBounds(bounds: L.LatLngBoundsExpression): this {
    const validBounds = bounds instanceof L.LatLngBounds ? bounds : L.latLngBounds(bounds);
    L.Rectangle.prototype.setBounds.call(this, validBounds);
    this._textRedraw(); // Redessiner immédiatement après le changement de limites
    this.updateProperties();
    return this;
  }
  public startResize(): void {
    if (this._isResizing) return;
    this._isResizing = true;
    this._initialBounds = this.getBounds();
    // Créer le rectangle fantôme avec les mêmes styles que le rectangle actuel
    if (this.map && !this._resizePreview) {
      try {
        this._resizePreview = L.rectangle(this._initialBounds, {
          color: this.options.color || '#3388ff',
          weight: this.options.weight || 2,
          opacity: 0.8,
          fillColor: this.options.fillColor || '#3388ff',
          fillOpacity: 0.2,
          dashArray: this.options.dashArray || '5,5',
          className: 'resize-preview'
        }).addTo(this.map);
        // Appliquer la rotation au rectangle fantôme si nécessaire
        if (this._rotation !== 0) {
          const path = (this._resizePreview as any)._path;
          if (path) {
            path.style.transformOrigin = 'center';
            path.style.transform = `rotate(${this._rotation}deg)`;
          }
        }
        // Cacher temporairement le texte pendant le redimensionnement
        if (this._textNode) {
          this._textNode.style.opacity = '0.5';
        }
      } catch (error) {
        console.error('[TextRectangle] Erreur lors de la création du rectangle fantôme:', error);
        this._cleanupResizePreview();
      }
    }
  }
  public updateResizePreview(newBounds: L.LatLngBounds): void {
    if (!this._isResizing || !this._resizePreview || !this.map) return;
    try {
      const nw = this.map.latLngToContainerPoint(newBounds.getNorthWest());
      const se = this.map.latLngToContainerPoint(newBounds.getSouthEast());
      const width = Math.abs(se.x - nw.x);
      const height = Math.abs(se.y - nw.y);
      if (width < this._minWidth || height < this._minHeight || 
          width > this._maxWidth || height > this._maxHeight) {
        return;
      }
      this._resizePreview.setBounds(newBounds);
      if (this._rotation !== 0) {
        const path = (this._resizePreview as any)._path;
        if (path) {
          path.style.transformOrigin = 'center';
          path.style.transform = `rotate(${this._rotation}deg)`;
        }
      }
      // Mettre à jour la position et la taille du texte en temps réel
      if (this._textNode) {
        const fontSize = Math.min(width, height) * 0.1;
        const clampedFontSize = Math.max(10, Math.min(48, fontSize));
        const lineHeight = clampedFontSize * 1.2;
        const lines = this.properties.text.split('\n');
        const totalTextHeight = lines.length * lineHeight;
        const textY = nw.y + (height - totalTextHeight) / 2;
        const textX = this._calculateTextX(nw.x, se.x, 5);
        this._textNode.setAttribute('x', textX.toString());
        this._textNode.setAttribute('y', textY.toString());
        this._textNode.querySelectorAll('tspan').forEach((tspan, index) => {
          tspan.setAttribute('x', textX.toString());
          tspan.setAttribute('dy', index === 0 ? '0' : `${lineHeight}px`);
          tspan.style.fontSize = `${clampedFontSize}px`;
        });
        if (this._rotation !== 0) {
          const center = this.map.latLngToLayerPoint(newBounds.getCenter());
          this._textNode.setAttribute('transform', `rotate(${this._rotation}, ${center.x}, ${center.y})`);
        }
      }
      this.fire('resize:update', { bounds: newBounds });
    } catch (error) {
      console.error('[TextRectangle] Erreur lors de la mise à jour du rectangle fantôme:', error);
      this._cleanupResizePreview();
    }
  }
  public endResize(finalBounds: L.LatLngBounds): void {
    if (!this._isResizing) return;
    try {
      this._cleanupResizePreview();
      if (this._textNode) {
        this._textNode.style.opacity = '1';
      }
      if (this.map) {
        const nw = this.map.latLngToContainerPoint(finalBounds.getNorthWest());
        const se = this.map.latLngToContainerPoint(finalBounds.getSouthEast());
        const width = Math.abs(se.x - nw.x);
        const height = Math.abs(se.y - nw.y);
        if (width < this._minWidth || height < this._minHeight || 
            width > this._maxWidth || height > this._maxHeight) {
          this.cancelResize();
          return;
        }
      }
      this.setBounds(finalBounds);
      this._textRedraw(); // Forcer le redraw immédiatement après la fin du resize
      this.fire('resize:end', { bounds: finalBounds });
    } catch (error) {
      console.error('[TextRectangle] Erreur lors de la fin du redimensionnement:', error);
      this.cancelResize();
    } finally {
      this._isResizing = false;
    }
  }
  public cancelResize(): void {
    if (!this._isResizing || !this._initialBounds) return;
    try {
      // Nettoyer le rectangle fantôme
      this._cleanupResizePreview();
      // Restaurer l'opacité du texte
      if (this._textNode) {
        this._textNode.style.opacity = '1';
      }
      // Restaurer les limites initiales
      this.setBounds(this._initialBounds);
    } catch (error) {
      console.error('[TextRectangle] Erreur lors de l\'annulation du redimensionnement:', error);
    } finally {
      this._isResizing = false;
      this._initialBounds = null;
    }
  }
  private _cleanupResizePreview(): void {
    if (this._resizePreview && this.map) {
      try {
        this.map.removeLayer(this._resizePreview);
      } catch (error) {
        console.error('[TextRectangle] Erreur lors du nettoyage du rectangle fantôme:', error);
      } finally {
        this._resizePreview = null;
      }
    }
  }
  private _onDoubleClick(e: L.LeafletMouseEvent): void {
    if (this._isEditing || this._isResizing) return;
    L.DomEvent.stopPropagation(e);
    // Émettre un événement pour désactiver les points de contrôle
    this.fire('edit:start');
    this._isEditing = true;
    this._removeTextNode();
    this._createEditableDiv();
  }
  private _createEditableDiv(): void {
    if (!this.map) return;
    try {
      const bounds = this.getBounds();
      const nw = this.map.latLngToContainerPoint(bounds.getNorthWest());
      const se = this.map.latLngToContainerPoint(bounds.getSouthEast());
      const rectWidth = se.x - nw.x;
      const rectHeight = se.y - nw.y;
      const div = document.createElement('div');
      div.className = 'leaflet-text-rectangle-editor';
      div.contentEditable = 'true';
      div.innerText = this.properties.text;
      // Calculer la taille de police relative
      const fontSize = Math.min(rectWidth, rectHeight) * 0.1;
      const clampedFontSize = Math.max(10, Math.min(48, fontSize));
      // Styles améliorés pour une meilleure visibilité et interaction
      Object.assign(div.style, {
        position: 'absolute',
        left: `${nw.x}px`,
        top: `${nw.y}px`,
        width: `${rectWidth}px`,
        height: `${rectHeight}px`,
        backgroundColor: this.properties.style.fillColor || '#FFFFFF',
        opacity: `${this.properties.style.fillOpacity ?? 1}`,
        color: this.properties.style.textColor || '#000000',
        fontSize: `${clampedFontSize}px`,
        fontFamily: this.properties.style.fontFamily || 'Arial, sans-serif',
        fontWeight: this.properties.style.bold ? 'bold' : 'normal',
        fontStyle: this.properties.style.italic ? 'italic' : 'normal',
        textAlign: this.properties.style.textAlign || 'center',
        border: `${this.properties.style.weight || 2}px solid ${this.properties.style.color || '#3388ff'}`,
        borderRadius: '2px',
        padding: '4px',
        boxSizing: 'border-box',
        zIndex: '1000',
        overflow: 'auto',
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-word',
        cursor: 'text',
        userSelect: 'text',
        outline: 'none',
        display: 'flex',
        alignItems: 'center',
        justifyContent: this._getJustifyContent()
      });
      // Appliquer la rotation si nécessaire
      if (this.properties.rotation !== 0) {
        const center = this.map.latLngToContainerPoint(bounds.getCenter());
        div.style.transformOrigin = `${center.x - nw.x}px ${center.y - nw.y}px`;
        div.style.transform = `rotate(${this.properties.rotation}deg)`;
      }
      // Ajouter au conteneur de la carte pour un meilleur positionnement
      const mapContainer = this.map.getContainer();
      mapContainer.appendChild(div);
      this._editableDiv = div;
      // Focus et sélection du texte
      div.focus();
      const selection = window.getSelection();
      const range = document.createRange();
      range.selectNodeContents(div);
      selection?.removeAllRanges();
      selection?.addRange(range);
      // Gestionnaires d'événements avec bind explicite
      div.addEventListener('keydown', this._onKeyDown.bind(this));
      div.addEventListener('blur', this._finishEditing.bind(this));
      div.addEventListener('paste', (e: ClipboardEvent) => {
        e.preventDefault();
        const text = e.clipboardData?.getData('text/plain') || '';
        document.execCommand('insertText', false, text);
      });
      // Désactiver le défilement de la carte pendant l'édition
      if (this.map.dragging.enabled()) {
        this.map.dragging.disable();
      }
      console.log('[TextRectangle] Div éditable créé', {
        position: { left: nw.x, top: nw.y },
        size: { width: rectWidth, height: rectHeight },
        fontSize: clampedFontSize,
        styles: this.properties.style
      });
    } catch (error) {
      console.error('[TextRectangle] Erreur lors de la création de l\'éditeur :', error);
      this._isEditing = false;
    }
  }
  private _getJustifyContent(): string {
    const align = this.properties.style.textAlign || 'center';
    switch (align) {
      case 'left':
        return 'flex-start';
      case 'right':
        return 'flex-end';
      case 'center':
      default:
        return 'center';
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
    try {
      const newText = this._editableDiv.innerText.trim() || 'Double-cliquez pour éditer';
      this._cleanupEditableDiv();
      this.setText(newText);
      this._textRedraw(); // Ajout pour forcer le rendu immédiat
      this.fire('edit:end');
      if (this.map && !this.map.dragging.enabled()) {
        this.map.dragging.enable();
      }
    } catch (error) {
      console.error('[TextRectangle] Erreur lors de la finalisation de l\'édition :', error);
      this._cleanupEditableDiv();
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
    this._textRedraw();
  };
  private _textRedraw(): void {
    if (!L.Browser.svg || !this.map || this._isEditing || !(this as any)._path) {
      console.log('[TextRectangle] _textRedraw ignoré', {
        reason: !L.Browser.svg ? 'SVG non supporté' : 
                !this.map ? 'Carte non disponible' : 
                this._isEditing ? 'En cours d\'édition' : 
                'Chemin SVG non trouvé'
      });
      return;
    }
    this._removeTextNode();
    const text = this.properties.text;
    if (!text) return;
    try {
      const path = (this as any)._path as SVGPathElement;
      if (!path) {
        console.warn('[TextRectangle] Chemin SVG non trouvé');
        return;
      }
      const svg = path.ownerSVGElement;
      if (!svg) {
        console.warn('[TextRectangle] Élément SVG parent non trouvé');
        return;
      }
      const textNode = L.SVG.create('text') as SVGTextElement;
      textNode.setAttribute('class', 'leaflet-text-rectangle-text');
      // Appliquer les styles de texte
      Object.assign(textNode.style, {
        fill: this.properties.style.textColor || '#000000',
        fontFamily: this.properties.style.fontFamily || 'Arial, sans-serif',
        fontWeight: this.properties.style.bold ? 'bold' : 'normal',
        fontStyle: this.properties.style.italic ? 'italic' : 'normal'
      });
      const bounds = this.getBounds();
      const nw = this.map.latLngToLayerPoint(bounds.getNorthWest());
      const se = this.map.latLngToLayerPoint(bounds.getSouthEast());
      const rectWidth = se.x - nw.x;
      const rectHeight = se.y - nw.y;
      // Calculer la taille de police relative au rectangle (10% de la plus petite dimension)
      const fontSize = Math.min(rectWidth, rectHeight) * 0.1;
      const clampedFontSize = Math.max(10, Math.min(48, fontSize));
      // Séparer le texte en lignes
      const lines = text.split('\n');
      const lineHeight = clampedFontSize * 1.2; // Espacement entre les lignes
      const totalTextHeight = lines.length * lineHeight;
      // Calculer la position Y pour centrer verticalement
      const textY = nw.y + (rectHeight - totalTextHeight) / 2;
      // Définir l'alignement horizontal et la position X
      const textAnchor = this._getTextAnchor();
      const textXBase = this._calculateTextX(nw.x, se.x, 5); // Marge de 5px
      // Nettoyer et configurer le nœud de texte
      textNode.setAttribute('text-anchor', textAnchor);
      textNode.setAttribute('dominant-baseline', 'hanging');
      // Ajouter chaque ligne avec le bon espacement
      lines.forEach((line, index) => {
        const tspan = L.SVG.create('tspan');
        tspan.textContent = line;
        tspan.setAttribute('x', textXBase.toString());
        tspan.setAttribute('dy', index === 0 ? '0' : `${lineHeight}px`);
        tspan.style.fontSize = `${clampedFontSize}px`;
        textNode.appendChild(tspan);
      });
      // Positionner le texte
      textNode.setAttribute('y', textY.toString());
      // Appliquer la rotation si nécessaire
      if (this.properties.rotation !== 0) {
        const center = this.map.latLngToLayerPoint(bounds.getCenter());
        textNode.setAttribute('transform', `rotate(${this.properties.rotation}, ${center.x}, ${center.y})`);
      }
      this._textNode = textNode;
      svg.appendChild(textNode);
      // Émettre un événement pour notifier que le texte a été redessiné
      this.fire('text:redrawn', {
        text,
        fontSize: clampedFontSize,
        position: { x: textXBase, y: textY },
        dimensions: { width: rectWidth, height: rectHeight }
      });
      console.log('[TextRectangle] Texte redessiné avec succès', {
        text,
        fontSize: clampedFontSize,
        position: { x: textXBase, y: textY },
        dimensions: { width: rectWidth, height: rectHeight },
        lines: lines.length,
        lineHeight,
        totalTextHeight
      });
    } catch (error) {
      console.error('[TextRectangle] Erreur lors du rendu du texte :', error);
    }
  }
  private _calculateTextX(nwX: number, seX: number, padding: number): number {
    const width = seX - nwX;
    switch (this.properties.style.textAlign) {
      case 'left':
        return nwX + padding;
      case 'right':
        return seX - padding;
      case 'center':
      default:
        return nwX + width / 2;
    }
  }
  private _getTextAnchor(): string {
    switch (this.properties.style.textAlign) {
      case 'left':
        return 'start';
      case 'right':
        return 'end';
      case 'center':
      default:
        return 'middle';
    }
  }
  private _removeTextNode(): void {
    if (this._textNode && this._textNode.parentNode) {
      this._textNode.parentNode.removeChild(this._textNode);
      this._textNode = null;
    }
  }
  public getDimensions(): { width: number; height: number } {
    const bounds = this.getBounds();
    if (!this.map) {
      return { width: 0, height: 0 };
    }
    const sw = bounds.getSouthWest();
    const se = L.latLng(bounds.getSouth(), bounds.getEast());
    const width = this.map.distance(sw, se);
    const height = this.map.distance(sw, L.latLng(bounds.getNorth(), bounds.getWest()));
    return { width, height };
  }
  public getMidPoints(): L.LatLng[] {
    const bounds = this.getBounds();
    const nw = bounds.getNorthWest();
    const ne = bounds.getNorthEast();
    const se = bounds.getSouthEast();
    const sw = bounds.getSouthWest();
    return [
      L.latLng((nw.lat + ne.lat) / 2, (nw.lng + ne.lng) / 2), // Milieu haut
      L.latLng((ne.lat + se.lat) / 2, (ne.lng + se.lng) / 2), // Milieu droite
      L.latLng((sw.lat + se.lat) / 2, (sw.lng + se.lng) / 2), // Milieu bas
      L.latLng((nw.lat + sw.lat) / 2, (nw.lng + sw.lng) / 2)  // Milieu gauche
    ];
  }
  private _onAdd = (): void => {
    this._textRedraw();
    if (this.map) {
      this.map.on('zoomend', this._onZoomEnd.bind(this));
    }
  };
  private _onRemove = (): void => {
    this._removeTextNode();
    if (this.map) {
      this.map.off('zoomend', this._onZoomEnd);
    }
  };
}