import L from 'leaflet';
import 'leaflet-path-transform';

interface TextRectangleProperties {
  type: string;
  text: string;
  width: number;
  height: number;
  area: number;
  rotation: number;
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

export class TextRectangle extends L.Rectangle {
  private textMarker: L.Marker;
  public properties: TextRectangleProperties;

  constructor(
    bounds: L.LatLngBoundsExpression,
    text: string = 'Double-cliquez pour éditer',
    options: L.PolylineOptions = {}
  ) {
    super(bounds, {
      ...options,
      pmIgnore: false,
      interactive: true,
      className: 'leaflet-text-rectangle'
    });

    // Initialiser les propriétés
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

    // Créer le marqueur de texte
    const textIcon = L.divIcon({
      className: 'text-icon',
      html: `<div class="text-container" contenteditable="false">${text}</div>`,
      iconSize: [40, 40],
      iconAnchor: [20, 20]
    });

    this.textMarker = L.marker(this.getBounds().getCenter(), {
      icon: textIcon,
      draggable: false
    });
    // Activer la transformation
    (this as any).transform.enable({
      rotation: true,
      scaling: true
    });

    // Gérer les événements
    this.on('add', () => {
      if (this._map) {
        this.textMarker.addTo(this._map);
        this.updateTextPosition();
      }
    });

    this.on('remove', () => {
      this.textMarker.remove();
    });

    this.on('transform:rotate', (e: any) => {
      this.properties.rotation = e.rotation;
      this.updateTextRotation();
    });

    this.on('transform', () => {
      this.updateTextPosition();
      this.updateProperties();
    });

    // Gestion de l'édition du texte
    this.textMarker.on('dblclick', (e: L.LeafletMouseEvent) => {
      L.DomEvent.stopPropagation(e); // Empêche le zoom de la carte
      const textElement = this.textMarker.getElement()?.querySelector('.text-container') as HTMLElement;
      if (!textElement) return;

      // Désactiver la transformation pour masquer les points de contrôle
      (this as any).transform.disable();

      textElement.contentEditable = 'true';
      textElement.focus();
      textElement.classList.add('editing');

      // Sélectionner tout le texte
      const selection = window.getSelection();
      const range = document.createRange();
      range.selectNodeContents(textElement);
      selection?.removeAllRanges();
      selection?.addRange(range);

      const finishEditing = () => {
        textElement.contentEditable = 'false';
        textElement.classList.remove('editing');
        const newText = textElement.innerText.trim();
        if (newText) {
          this.properties.text = newText;
          this.setText(newText); // Utiliser la méthode setText existante
        }
        textElement.removeEventListener('blur', finishEditing);
        textElement.removeEventListener('keydown', onKeyDown);
        // Réactiver la transformation après l'édition
        (this as any).transform.enable({
          rotation: true,
          scaling: true
        });
      };

      const onKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          finishEditing();
        }
      };

      textElement.addEventListener('blur', finishEditing);
      textElement.addEventListener('keydown', onKeyDown);
    });
  }

  private updateTextPosition(): void {
    const center = this.getBounds().getCenter();
    this.textMarker.setLatLng(center);
  }

  private updateTextRotation(): void {
    const element = this.textMarker.getElement();
    if (element) {
      element.style.transform = `rotate(${this.properties.rotation}deg)`;
    }
  }

  private updateProperties(): void {
    const bounds = this.getBounds();
    const ne = bounds.getNorthEast();
    const sw = bounds.getSouthWest();
    
    // Calculer les dimensions en mètres
    this.properties.width = this.calculateDistance(
      [sw.lat, sw.lng],
      [sw.lat, ne.lng]
    );
    this.properties.height = this.calculateDistance(
      [sw.lat, sw.lng],
      [ne.lat, sw.lng]
    );
    this.properties.area = this.properties.width * this.properties.height;
  }

  private calculateDistance(point1: [number, number], point2: [number, number]): number {
    const lat1 = point1[0] * Math.PI / 180;
    const lon1 = point1[1] * Math.PI / 180;
    const lat2 = point2[0] * Math.PI / 180;
    const lon2 = point2[1] * Math.PI / 180;

    const R = 6371000; // Rayon de la Terre en mètres
    const dLat = lat2 - lat1;
    const dLon = lon2 - lon1;

    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1) * Math.cos(lat2) *
              Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  }

  setText(text: string): void {
    this.properties.text = text;
    const element = this.textMarker.getElement()?.querySelector('.text-container') as HTMLElement;
    if (element) {
      element.innerText = text;
    }
  }

  setTextStyle(style: Partial<TextRectangleProperties['style']>): void {
    this.properties.style = { ...this.properties.style, ...style };
    const element = this.textMarker.getElement()?.querySelector('.text-container') as HTMLElement;
    if (element) {
      if (style.textColor) element.style.color = style.textColor;
      if (style.fontSize) element.style.fontSize = style.fontSize;
      if (style.backgroundColor) element.style.backgroundColor = style.backgroundColor;
    }
  }
} 