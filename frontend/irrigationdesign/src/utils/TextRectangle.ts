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
    backgroundColor?: string;
  };
}

export class TextRectangle extends Polygon {
  public properties: TextRectangleProperties;
  private originalLatLngs: L.LatLng[] = [];
  private _textContainer: HTMLDivElement | null = null;

  constructor(
    bounds: L.LatLngBoundsExpression,
    text: string = 'Double-cliquez pour éditer',
    options: L.PolylineOptions = {}
  ) {
    const b = bounds instanceof L.LatLngBounds ? bounds : L.latLngBounds(bounds);
    const latLngs: L.LatLng[] = [
      b.getSouthWest(),
      b.getSouthEast(),
      b.getNorthEast(),
      b.getNorthWest()
    ];

    super(latLngs, {
      ...options,
      pmIgnore: false,
      interactive: true,
      className: 'leaflet-text-rectangle'
    });

    this.originalLatLngs = latLngs.slice();

    this.properties = {
      type: 'TextRectangle',
      text: text,
      width: 0,
      height: 0,
      area: 0,
      rotation: 0,
      style: {
        ...options,
        textColor: '#000000',
        fontSize: '14px',
        backgroundColor: '#FFFFFF'
      }
    };

    // Créer le conteneur de texte
    this._textContainer = document.createElement('div');
    this._textContainer.className = 'text-container';
    this._textContainer.style.position = 'absolute';
    this._textContainer.style.transform = 'translate(-50%, -50%)';
    this._textContainer.style.pointerEvents = 'auto';
    this._textContainer.style.cursor = 'text';
    this._textContainer.style.padding = '2px 5px';
    this._textContainer.style.borderRadius = '3px';
    this._textContainer.style.backgroundColor = this.properties.style.backgroundColor || '#FFFFFF';
    this._textContainer.style.color = this.properties.style.textColor || '#000000';
    this._textContainer.style.fontSize = this.properties.style.fontSize || '14px';
    this._textContainer.innerText = text;

    // Gestion du double-clic pour l'édition
    this._textContainer.addEventListener('dblclick', (e: MouseEvent) => {
      e.stopPropagation();
      if (!this._textContainer) return;
      
      this._textContainer.contentEditable = 'true';
      this._textContainer.focus();
      this._textContainer.classList.add('editing');

      const finishEditing = () => {
        if (!this._textContainer) return;
        this._textContainer.contentEditable = 'false';
        this._textContainer.classList.remove('editing');
        const newText = this._textContainer.innerText.trim();
        if (newText) {
          this.properties.text = newText;
          this.setText(newText);
        }
        this._textContainer.removeEventListener('blur', finishEditing);
        this._textContainer.removeEventListener('keydown', onKeyDown);
      };

      const onKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          finishEditing();
        }
      };

      this._textContainer.addEventListener('blur', finishEditing);
      this._textContainer.addEventListener('keydown', onKeyDown);
    });

    // Événements pour maintenir la forme rectangulaire
    this.on('pm:vertexremoved', this.enforceRectangularShape);
    this.on('pm:vertexadded', this.enforceRectangularShape);
    this.on('pm:dragend', this.enforceRectangularShape);
    this.on('pm:markerdragend', this.onMarkerDragEnd);

    // Événements pour la mise à jour de la position du texte
    this.on('move', this.updateTextPosition);
    this.on('drag', this.updateTextPosition);

    this.updateProperties();
  }

  onAdd(map: L.Map): this {
    super.onAdd(map);
    if (this._textContainer && this._map) {
      this._map.getPanes().overlayPane.appendChild(this._textContainer);
      this.updateTextPosition();
    }
    return this;
  }

  onRemove(map: L.Map): this {
    if (this._textContainer && this._textContainer.parentElement) {
      this._textContainer.parentElement.removeChild(this._textContainer);
    }
    super.onRemove(map);
    return this;
  }

  private updateTextPosition(): void {
    if (!this._textContainer || !this._map) return;
    const center = this.getCenter();
    const pos = this._map.latLngToLayerPoint(center);
    this._textContainer.style.left = `${pos.x}px`;
    this._textContainer.style.top = `${pos.y}px`;
  }

  public setText(text: string): void {
    this.properties.text = text;
    if (this._textContainer) {
      this._textContainer.innerText = text;
    }
  }

  public setTextStyle(style: Partial<TextRectangleProperties['style']>): void {
    this.properties.style = { ...this.properties.style, ...style };
    if (this._textContainer) {
      if (style.textColor) this._textContainer.style.color = style.textColor;
      if (style.fontSize) this._textContainer.style.fontSize = style.fontSize;
      if (style.backgroundColor) this._textContainer.style.backgroundColor = style.backgroundColor;
    }
  }

  private enforceRectangularShape = (): void => {
    const latLngs = this.getLatLngs()[0] as L.LatLng[];
    if (latLngs.length !== 4) {
      console.warn('TextRectangle must have exactly 4 points');
      this.setLatLngs([this.originalLatLngs]);
      return;
    }

    const bounds = this.getBounds();
    const sw = bounds.getSouthWest();
    const se = L.latLng(bounds.getSouth(), bounds.getEast());
    const ne = bounds.getNorthEast();
    const nw = L.latLng(bounds.getNorth(), bounds.getWest());
    const newLatLngs = [sw, se, ne, nw];

    const hasSignificantChange = newLatLngs.some((newLL, i) => {
      const oldLL = latLngs[i];
      return Math.abs(newLL.lat - oldLL.lat) > 1e-6 || Math.abs(newLL.lng - oldLL.lng) > 1e-6;
    });

    if (hasSignificantChange) {
      L.Polygon.prototype.setLatLngs.call(this, [newLatLngs]);
      this.originalLatLngs = newLatLngs.slice();
      this.updateTextPosition();
      this.updateProperties();
    }
  };

  private onMarkerDragEnd = (e: any): void => {
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
  };

  public setLatLngs(latlngs: L.LatLngExpression[] | L.LatLngExpression[][]): this {
    super.setLatLngs(latlngs);
    this.enforceRectangularShape();
    this.updateTextPosition();
    return this;
  }

  public updateProperties(): void {
    const latLngs = this.getLatLngs()[0] as L.LatLng[];
    if (latLngs.length !== 4) {
      console.warn('TextRectangle doit avoir exactement 4 points');
      return;
    }

    const sw = latLngs[0];
    const se = latLngs[1];
    const nw = latLngs[3];

    const width = turf.distance([sw.lng, sw.lat], [se.lng, se.lat], { units: 'meters' });
    const height = turf.distance([sw.lng, sw.lat], [nw.lng, nw.lat], { units: 'meters' });
    const area = width * height;

    const deltaLng = se.lng - sw.lng;
    const deltaLat = se.lat - sw.lat;
    let rotation = Math.atan2(deltaLat, deltaLng) * (180 / Math.PI);
    rotation = (rotation + 360) % 360;

    this.properties.width = width;
    this.properties.height = height;
    this.properties.area = area;
    this.properties.rotation = rotation;
    this.properties.center = this.getCenter();

    this.fire('properties:updated', {
      shape: this,
      properties: this.properties
    });
  }

  public resizeFromCorner(cornerIndex: number, newLatLng: L.LatLng): void {
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
  }

  public resizeFromSide(sideIndex: number, newLatLng: L.LatLng): void {
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
  }

  public moveFromCenter(newCenter: L.LatLng): void {
    const currentCenter = this.getCenter();
    const deltaLat = newCenter.lat - currentCenter.lat;
    const deltaLng = newCenter.lng - currentCenter.lng;
    const latLngs = this.getLatLngs()[0] as L.LatLng[];
    const newLatLngs = latLngs.map(ll => L.latLng(ll.lat + deltaLat, ll.lng + deltaLng));
    L.Polygon.prototype.setLatLngs.call(this, [newLatLngs]);
    this.updateTextPosition();
  }

  public getMidPoints(): L.LatLng[] {
    return super.getMidPoints();
  }
} 