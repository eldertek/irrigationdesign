import L from 'leaflet';
import { Line } from './Line';
import { lineString } from '@turf/turf';
import along from '@turf/along';

/**
 * ElevationLine étend la classe personnalisée Line pour ajouter un profil altimétrique.
 *
 * Points importants :
 * - Utilise l'API Open‑Elevation pour récupérer l'altitude à chaque point d'échantillonnage.
 * - Si la ligne comporte uniquement 2 points, elle génère des points intermédiaires (ici 20 par défaut)
 *   pour obtenir un profil continu.
 * - Intègre une logique de retry (MAX_RETRIES) avec un délai (RETRY_DELAY) et un fallback vers
 *   une simulation en cas d'échec de l'API.
 * - Lors de l'update des propriétés, les statistiques d'élévation sont recalculées directement à partir
 *   de this.elevationData pour éviter que la méthode parente ne remplace ces valeurs.
 *
 * Note utilisateur : Même pour un segment de 2 points, le profil altimétrique affichera plusieurs
 * échantillons. Si les altitudes des deux points extrêmes sont identiques, la courbe pourra rester plate.
 */
export class ElevationLine extends Line {
  private elevationData: { distance: number; elevation: number }[] = [];
  private elevationProfile: L.Polyline | null = null;
  private elevationMarker: L.CircleMarker | null = null;
  private samplePoints: L.CircleMarker[] = [];
  private sampleTooltips: L.Tooltip[] = [];
  // Paramètres pour l'appel à l'API Open‑Elevation
  private static API_URL = 'https://api.open-elevation.com/api/v1/lookup';
  private static RETRY_DELAY = 2000; // 2 secondes entre les tentatives
  private static MAX_RETRIES = 3;    // Nombre maximal de tentatives
  private static SAMPLE_DISTANCE = 100; // Distance en mètres entre chaque point
  private static MIN_SAMPLES = 10;    // Nombre minimum de points
  private static MAX_SAMPLES = 50;    // Nombre maximum de points

  // Styles par défaut pour les points d'échantillonnage
  private samplePointStyle = {
    radius: 4,
    color: '#FF4500',
    fillColor: '#FF4500',
    fillOpacity: 0.6,
    weight: 2,
    opacity: 0.8
  };

  // Styles pour les points min/max
  private minMaxPointStyle = {
    radius: 6,
    weight: 3,
    opacity: 1,
    fillOpacity: 1
  };

  constructor(
    latlngs: L.LatLngExpression[] | L.LatLngExpression[][],
    options: L.PolylineOptions = {}
  ) {
    // Appeler le constructeur parent avec les options de style
    super(latlngs, {
      ...options,
      color: '#FF4500', // Couleur distincte pour les profils altimétriques
      weight: 4,
      opacity: 0.8
    });

    // Initialiser les propriétés de base sans les données d'élévation
    this.properties = {
      ...this.properties,
      type: 'ElevationLine',
      elevationProfile: null,
      maxElevation: 0,
      minElevation: 0,
      elevationGain: 0,
      elevationLoss: 0,
      dataSource: 'pending', // 'api', 'simulation' ou 'error'
      samplePointStyle: this.samplePointStyle,
      minMaxPointStyle: this.minMaxPointStyle
    };

    // Écouter les événements après l'initialisation complète
    this.setupEventListeners();
  }

  /**
   * Configure les écouteurs d'événements pour les mises à jour du profil
   */
  private setupEventListeners(): void {
    this.on('edit', () => this.updateElevationProfile());
    this.on('move', () => this.updateElevationProfile());
    this.on('pm:vertexadded', () => {
      console.log('[ElevationLine] Vertex added, updating profile');
      this.updateElevationProfile();
    });
    this.on('pm:vertexremoved', () => {
      console.log('[ElevationLine] Vertex removed, updating profile');
      this.updateElevationProfile();
    });
    this.on('pm:dragend', () => {
      console.log('[ElevationLine] Drag ended, updating profile');
      this.updateElevationProfile();
    });
    this.on('pm:markerdragend', () => {
      console.log('[ElevationLine] Marker drag ended, updating profile');
      this.updateElevationProfile();
    });
    this.on('pm:edit', (e: any) => {
      e.layer.properties.type = 'ElevationLine';
    });
  }

  /**
   * Calcule le nombre optimal de points d'échantillonnage en fonction de la longueur de la ligne
   */
  private calculateOptimalSampleCount(): number {
    const length = this.getLength();
    // Calculer le nombre de points basé sur la distance
    const pointsByDistance = Math.ceil(length / ElevationLine.SAMPLE_DISTANCE);
    // Limiter entre MIN_SAMPLES et MAX_SAMPLES
    return Math.min(
      Math.max(pointsByDistance, ElevationLine.MIN_SAMPLES),
      ElevationLine.MAX_SAMPLES
    );
  }

  /**
   * Récupère les données d'élévation via l'API Open‑Elevation.
   */
  private async fetchElevationData(retryCount = 0): Promise<void> {
    const latLngs = this.getLatLngs() as L.LatLng[];
    if (latLngs.length === 0) return;
    const totalLength = this.getLength();

    let locationsQuery = "";
    // Calculer le nombre optimal de points
    const sampleCount = this.calculateOptimalSampleCount();
    console.log(`[ElevationLine] Using ${sampleCount} sample points for ${totalLength.toFixed(0)}m line`);

    // Générer les points d'échantillonnage
    const samplePoints: string[] = [];
    for (let i = 0; i < sampleCount; i++) {
      const dist = (i / (sampleCount - 1)) * totalLength;
      const pt = this.getPointAtDistance(dist);
      if (pt) {
        samplePoints.push(`${pt.lat},${pt.lng}`);
      }
    }
    locationsQuery = samplePoints.join('|');

    try {
      const response = await fetch(`${ElevationLine.API_URL}?locations=${locationsQuery}`);
      if (!response.ok) {
        throw new Error(`HTTP error ${response.status}`);
      }
      const data = await response.json();
      if (!data.results || !Array.isArray(data.results)) {
        throw new Error('Invalid API response format');
      }

      // Associer chaque point échantillonné à sa distance le long de la ligne
      this.elevationData = data.results.map(
        (result: { latitude: number; longitude: number; elevation: number }, index: number) => ({
          distance: (index / (sampleCount - 1)) * totalLength,
          elevation: result.elevation
        })
      );
      this.properties.dataSource = 'api';
    } catch (error) {
      console.warn(`[ElevationLine] API fetch attempt ${retryCount + 1}/${ElevationLine.MAX_RETRIES} failed:`, error);
      if (retryCount < ElevationLine.MAX_RETRIES) {
        await new Promise(resolve => setTimeout(resolve, ElevationLine.RETRY_DELAY));
        return this.fetchElevationData(retryCount + 1);
      }
      console.warn('[ElevationLine] All API attempts failed, falling back to simulation');
      this.simulateElevationData();
      this.properties.dataSource = 'simulation';
    }
    this.calculateElevationStatistics();
  }

  /**
   * Fallback : simulation de données d'élévation via une fonction sinusoïdale.
   */
  private simulateElevationData(): void {
    const totalLength = this.getLength();
    const sampleCount = this.calculateOptimalSampleCount();
    
    this.elevationData = Array.from({ length: sampleCount }, (_, index) => {
      const distance = (index / (sampleCount - 1)) * totalLength;
      const elevation = 100 + Math.sin(distance / totalLength * Math.PI * 2) * 50;
      return { distance, elevation };
    });
  }

  /**
   * Calcule les statistiques d'élévation (min, max, dénivelé positif et négatif)
   * à partir de this.elevationData.
   */
  private calculateElevationStatistics(): void {
    if (!this.elevationData.length) return;
    const elevations = this.elevationData.map(d => d.elevation);
    const maxElevation = elevations.length ? Math.max(...elevations) : 0;
    const minElevation = elevations.length ? Math.min(...elevations) : 0;
    let gain = 0;
    let loss = 0;
    for (let i = 1; i < this.elevationData.length; i++) {
      const diff = this.elevationData[i].elevation - this.elevationData[i - 1].elevation;
      if (diff > 0) gain += diff;
      else loss += Math.abs(diff);
    }
    this.properties.maxElevation = maxElevation;
    this.properties.minElevation = minElevation;
    this.properties.elevationGain = gain;
    this.properties.elevationLoss = loss;
  }

  /**
   * Affiche les points d'échantillonnage sur la ligne
   */
  private showSamplePoints(): void {
    // Nettoyer les points existants
    this.clearSamplePoints();

    if (!this.elevationData.length) return;

    // Trouver les valeurs min et max
    const elevations = this.elevationData.map(d => d.elevation);
    const maxElevation = Math.max(...elevations);
    const minElevation = Math.min(...elevations);

    // Créer un point pour chaque échantillon
    this.elevationData.forEach((data) => {
      const point = this.getPointAtDistance(data.distance);
      if (!point) return;

      // Déterminer si c'est un point min ou max
      const isMin = data.elevation === minElevation;
      const isMax = data.elevation === maxElevation;
      
      // Appliquer le style approprié
      let style = { ...this.samplePointStyle };
      if (isMin) {
        style = {
          ...style,
          ...this.minMaxPointStyle,
          color: '#DC2626', // Rouge pour le minimum
          fillColor: '#DC2626'
        };
      } else if (isMax) {
        style = {
          ...style,
          ...this.minMaxPointStyle,
          color: '#059669', // Vert pour le maximum
          fillColor: '#059669'
        };
      }

      // Créer le marqueur
      const marker = L.circleMarker(point, style);

      // Créer le tooltip
      const tooltip = L.tooltip({
        permanent: false,
        direction: 'top',
        className: 'elevation-tooltip',
        offset: [0, -10]
      });

      // Configurer le contenu du tooltip avec indication min/max
      let tooltipContent = `
        Distance: ${this.formatDistance(data.distance)}<br>
        Altitude: ${this.formatElevation(data.elevation)}
      `;
      if (isMin) tooltipContent += '<br><strong>Point le plus bas</strong>';
      if (isMax) tooltipContent += '<br><strong>Point le plus haut</strong>';
      tooltip.setContent(tooltipContent);

      // Ajouter les événements de survol
      marker.on('mouseover', () => {
        marker.setStyle({
          ...style,
          radius: style.radius + 2,
          fillOpacity: 1
        });
        marker.bindTooltip(tooltip).openTooltip();
      });

      marker.on('mouseout', () => {
        marker.setStyle(style);
        marker.closeTooltip();
      });

      // Ajouter à la carte
      if (this._map) {
        marker.addTo(this._map);
        this.samplePoints.push(marker);
        this.sampleTooltips.push(tooltip);
      }
    });
  }

  /**
   * Nettoie les points d'échantillonnage
   */
  private clearSamplePoints(): void {
    this.samplePoints.forEach(point => point.remove());
    this.samplePoints = [];
    this.sampleTooltips.forEach(tooltip => tooltip.remove());
    this.sampleTooltips = [];
  }

  /**
   * Formate une distance pour l'affichage
   */
  private formatDistance(distance: number): string {
    return distance >= 1000 
      ? `${(distance / 1000).toFixed(2)} km`
      : `${distance.toFixed(0)} m`;
  }

  /**
   * Formate une élévation pour l'affichage
   */
  private formatElevation(elevation: number): string {
    return `${elevation.toFixed(0)} m`;
  }

  /**
   * Surcharge de onAdd pour afficher les points d'échantillonnage
   */
  override onAdd(map: L.Map): this {
    super.onAdd(map);
    this.showSamplePoints();
    return this;
  }

  /**
   * Surcharge de onRemove pour nettoyer les points d'échantillonnage
   */
  override onRemove(map: L.Map): this {
    this.clearSamplePoints();
    this.hideElevationMarker();
    if (this.elevationProfile) {
      this.elevationProfile.remove();
      this.elevationProfile = null;
    }
    return super.onRemove(map);
  }

  /**
   * Met à jour le profil d'élévation
   */
  async updateElevationProfile(): Promise<void> {
    await this.fetchElevationData();
    this.updateProperties();
    // Mettre à jour les points d'échantillonnage
    if (this._map) {
      this.showSamplePoints();
    }
    this.fire('elevation:updated', {
      shape: this,
      elevationData: this.elevationData,
      properties: this.properties
    });
  }

  /**
   * Surcharge de updateProperties pour gérer correctement les données d'élévation
   */
  override updateProperties(): void {
    // Appeler d'abord la méthode parente pour les propriétés de base
    super.updateProperties();

    // Ne mettre à jour les statistiques d'élévation que si nous avons des données
    if (this.elevationData && this.elevationData.length > 0) {
      const elevations = this.elevationData.map(d => d.elevation);
      const maxElevation = Math.max(...elevations);
      const minElevation = Math.min(...elevations);
      let gain = 0;
      let loss = 0;
      for (let i = 1; i < this.elevationData.length; i++) {
        const diff = this.elevationData[i].elevation - this.elevationData[i - 1].elevation;
        if (diff > 0) gain += diff;
        else loss += Math.abs(diff);
      }

      // Mettre à jour les propriétés avec les nouvelles statistiques
      this.properties = {
        ...this.properties,
        type: 'ElevationLine', // S'assurer que le type est toujours correct
        elevationData: this.elevationData,
        maxElevation,
        minElevation,
        elevationGain: gain,
        elevationLoss: loss
      };
    }
  }

  /**
   * Retourne le tableau des données d'élévation sous forme de {distance, elevation}.
   */
  getElevationData(): { distance: number; elevation: number }[] {
    return this.elevationData;
  }

  /**
   * Affiche un marqueur sur la ligne à la distance spécifiée et émet l'événement 'elevation:show'.
   */
  showElevationAt(distance: number): void {
    if (!this.elevationData.length) return;
    const point = this.elevationData.reduce((prev, curr) =>
      Math.abs(curr.distance - distance) < Math.abs(prev.distance - distance) ? curr : prev
    );
    const latLng = this.getPointAtDistance(distance);
    if (!this.elevationMarker && latLng) {
      this.elevationMarker = L.circleMarker(latLng, {
        radius: 6,
        color: '#FF4500',
        fillColor: '#FF4500',
        fillOpacity: 1
      });
      this.elevationMarker.addTo(this._map);
    } else if (this.elevationMarker && latLng) {
      this.elevationMarker.setLatLng(latLng);
    }
    this.fire('elevation:show', {
      distance,
      elevation: point.elevation,
      latLng
    });
  }

  /**
   * Supprime le marqueur d'élévation s'il existe.
   */
  hideElevationMarker(): void {
    if (this.elevationMarker) {
      this.elevationMarker.remove();
      this.elevationMarker = null;
    }
  }

  /**
   * Retourne le point géographique sur la ligne correspondant à la distance donnée.
   */
  private getPointAtDistance(distance: number): L.LatLng | null {
    try {
      const latLngs = this.getLatLngs() as L.LatLng[];
      const coordinates = latLngs.map(ll => [ll.lng, ll.lat]);
      const line = lineString(coordinates);
      const point = along(line, distance, { units: 'meters' });
      return L.latLng(point.geometry.coordinates[1], point.geometry.coordinates[0]);
    } catch (error) {
      console.error('Error calculating point at distance', error);
      return null;
    }
  }

  // --- Surcharges pour maintenir le type ElevationLine ---

  override moveVertex(vertexIndex: number, newLatLng: L.LatLng, updateProps: boolean = false): void {
    super.moveVertex(vertexIndex, newLatLng, false);
    this.properties.type = 'ElevationLine';
    if (updateProps) {
      this.updateElevationProfile();
    }
  }

  // Désactivation de l'ajout de vertex intermédiaires (non autorisé pour un profil altimétrique)
  override addVertex(_segmentIndex: number, _newLatLng: L.LatLng, _updateProps: boolean = false): void {
    console.warn('[ElevationLine] Tentative d\'ajout de vertex ignorée - non autorisé pour un profil altimétrique');
  }

  override setLatLngs(latlngs: L.LatLngExpression[] | L.LatLngExpression[][]): this {
    super.setLatLngs(latlngs);
    this.properties.type = 'ElevationLine';
    this.updateElevationProfile();
    return this;
  }

  override move(deltaLatLng: L.LatLng, updateProps: boolean = true): this {
    super.move(deltaLatLng, false);
    this.properties.type = 'ElevationLine';
    if (updateProps) {
      this.updateElevationProfile();
    }
    return this;
  }

  // Méthode pour mettre à jour les styles des points
  setSamplePointStyle(style: Partial<typeof ElevationLine.prototype.samplePointStyle>): void {
    this.samplePointStyle = { ...this.samplePointStyle, ...style };
    this.properties.samplePointStyle = this.samplePointStyle;
    if (this._map) {
      this.showSamplePoints(); // Rafraîchir les points avec le nouveau style
    }
  }

  // Méthode pour mettre à jour les styles des points min/max
  setMinMaxPointStyle(style: Partial<typeof ElevationLine.prototype.minMaxPointStyle>): void {
    this.minMaxPointStyle = { ...this.minMaxPointStyle, ...style };
    this.properties.minMaxPointStyle = this.minMaxPointStyle;
    if (this._map) {
      this.showSamplePoints(); // Rafraîchir les points avec le nouveau style
    }
  }
}
