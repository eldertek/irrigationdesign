import { defineStore } from 'pinia';
import api from '@/services/api';
import type { 
  DrawingElement, 
  TextData, 
  ShapeData, 
  RectangleData, 
  PolygonData,
  ElevationLineData,
  LineData,
  DrawingElementType,
  SemicircleData
} from '@/types/drawing';
import L from 'leaflet';
import { TextRectangle } from '@/utils/TextRectangle';
import { Polygon } from '@/utils/Polygon';
import { ElevationLine } from '@/utils/ElevationLine';
import { Line } from '@/utils/Line';
import { CircleArc } from '@/utils/CircleArc';
import { Rectangle } from '@/utils/Rectangle';

interface DrawingState {
  currentPlanId: number | null;
  elements: DrawingElement[];
  selectedElement: DrawingElement | null;
  unsavedChanges: boolean;
  loading: boolean;
  error: string | null;
  currentTool: string;
  currentStyle: {
    strokeStyle?: string;
    strokeWidth?: number;
    strokeColor?: string;
    fillColor?: string;
    fillOpacity?: number;
  };
  lastUsedType: string | null;
}

function isTextData(data: ShapeData): data is TextData {
  return 'content' in data && 'bounds' in data;
}

function isPolygonData(data: any): data is PolygonData {
  return data && Array.isArray(data.points) && data.points.length > 0 && 
         Array.isArray(data.points[0]) && data.points[0].length === 2;
}

function isElevationData(data: any): data is ElevationLineData {
  return data && Array.isArray(data.points) && data.points.length > 0 &&
         Array.isArray(data.points[0]) && data.points[0].length === 2;
}

function isLineData(data: any): data is LineData {
  return data && Array.isArray(data.points) && data.points.length > 0 &&
         Array.isArray(data.points[0]) && data.points[0].length === 2;
}

function convertShapeToDrawingElement(shape: any): DrawingElement {
  console.log('[DrawingStore] Conversion de la forme en élément', { 
    type: shape.properties?.type,
    properties: shape.properties,
    bounds: shape.getBounds?.(),
    shape 
  });

  let type_forme: DrawingElementType;
  let data: ShapeData;

  // Vérifier d'abord si c'est un TextRectangle
  if (shape instanceof TextRectangle || shape.properties?.type === 'TextRectangle') {
    type_forme = 'TEXTE';
    const bounds = shape.getBounds();
    data = {
      bounds: {
        southWest: [bounds.getSouthWest().lng, bounds.getSouthWest().lat],
        northEast: [bounds.getNorthEast().lng, bounds.getNorthEast().lat]
      },
      content: shape.properties.text || '',
      style: {
        ...shape.properties.style,
        textStyle: {
          color: shape.properties.style.textStyle?.color || '#000000',
          fontSize: shape.properties.style.textStyle?.fontSize || '14px',
          fontFamily: shape.properties.style.textStyle?.fontFamily || 'Arial, sans-serif',
          textAlign: shape.properties.style.textStyle?.textAlign || 'center',
          backgroundColor: shape.properties.style.textStyle?.backgroundColor || '#FFFFFF',
          backgroundOpacity: shape.properties.style.textStyle?.backgroundOpacity ?? 1,
          bold: shape.properties.style.textStyle?.bold || false,
          italic: shape.properties.style.textStyle?.italic || false
        }
      },
      rotation: shape.properties.rotation || 0
    } as TextData;

    console.log('[DrawingStore] TextRectangle converti', {
      type_forme,
      data,
      originalProperties: shape.properties
    });
    return { type_forme, data };
  }

  // Pour les autres types, utiliser un switch sur shape.properties?.type
  switch (shape.properties?.type) {
    case 'Polygon':
      type_forme = 'POLYGON';
      const latLngsPolygon = shape.getLatLngs()[0] as L.LatLng[];
      data = {
        points: latLngsPolygon.map((ll: L.LatLng) => [ll.lng, ll.lat]),
        style: {
          color: shape.properties.style.color || '#3388ff',
          weight: shape.properties.style.weight || 3,
          opacity: shape.properties.style.opacity || 1,
          fillColor: shape.properties.style.fillColor || '#3388ff',
          fillOpacity: shape.properties.style.fillOpacity || 0.2,
          dashArray: shape.properties.style.dashArray || ''
        }
      } as PolygonData;
      break;

    case 'Semicircle':
      type_forme = 'DEMI_CERCLE';
      const center = shape.getCenter ? shape.getCenter() : shape.getLatLng();
      data = {
        center: [center.lng, center.lat],
        radius: shape.getRadius(),
        startAngle: shape.properties.startAngle || 0,
        endAngle: shape.properties.stopAngle || 180,
        style: {
          color: shape.properties.style.color || '#3388ff',
          weight: shape.properties.style.weight || 3,
          opacity: shape.properties.style.opacity || 1,
          fillColor: shape.properties.style.fillColor || '#3388ff',
          fillOpacity: shape.properties.style.fillOpacity || 0.2,
          dashArray: shape.properties.style.dashArray || ''
        }
      } as SemicircleData;
      break;

    case 'ElevationLine':
      type_forme = 'ELEVATIONLINE';
      const latLngsElevation = shape.getLatLngs() as L.LatLng[];
      data = {
        points: latLngsElevation.map((ll: L.LatLng) => [ll.lng, ll.lat]),
        style: {
          color: shape.properties.style.color || '#FF4500',
          weight: shape.properties.style.weight || 4,
          opacity: shape.properties.style.opacity || 0.8
        },
        elevationData: shape.getElevationData(),
        samplePointStyle: shape.properties.samplePointStyle,
        minMaxPointStyle: shape.properties.minMaxPointStyle
      } as ElevationLineData;
      break;

    case 'Rectangle':
      type_forme = 'RECTANGLE';
      data = {
        bounds: {
          southWest: [shape.getBounds().getSouthWest().lng, shape.getBounds().getSouthWest().lat],
          northEast: [shape.getBounds().getNorthEast().lng, shape.getBounds().getNorthEast().lat]
        },
        rotation: shape.getRotation ? shape.getRotation() : 0,
        style: shape.properties?.style || {}
      } as RectangleData;
      break;

    case 'Line':
      type_forme = 'LIGNE';
      const latLngsLine = shape.getLatLngs() as L.LatLng[];
      data = {
        points: latLngsLine.map((ll: L.LatLng) => [ll.lng, ll.lat]),
        style: shape.properties.style || {}
      } as LineData;
      break;

    default:
      console.warn('[DrawingStore] Type de forme non géré:', shape.properties?.type);
      type_forme = 'UNKNOWN';
      data = {} as ShapeData;
  }

  console.log('[DrawingStore] Élément converti', { type_forme, data });
  return { type_forme, data };
}

function convertStoredElementToShape(element: DrawingElement): any {
  console.log('[DrawingStore] Conversion de l\'élément stocké en forme', { element });

  switch (element.type_forme) {
    case 'TEXTE': {
      if (!isTextData(element.data)) {
        console.error('[DrawingStore] Données invalides pour TextRectangle');
        return null;
      }

      const textData = element.data;
      if (!textData.bounds) {
        console.error('[DrawingStore] Données de bounds manquantes pour TextRectangle');
        return null;
      }

      const bounds = new L.LatLngBounds(
        L.latLng(textData.bounds.southWest[1], textData.bounds.southWest[0]),
        L.latLng(textData.bounds.northEast[1], textData.bounds.northEast[0])
      );

      const options = {
        color: textData.style?.color || '#3388ff',
        fillColor: textData.style?.fillColor || '#3388ff',
        fillOpacity: textData.style?.fillOpacity || 0.2,
        weight: textData.style?.weight || 3,
        opacity: textData.style?.opacity || 1,
        textStyle: {
          color: textData.style.textStyle?.color || '#000000',
          fontSize: textData.style.textStyle?.fontSize || '14px',
          fontFamily: textData.style.textStyle?.fontFamily || 'Arial, sans-serif',
          textAlign: textData.style.textStyle?.textAlign || 'center',
          backgroundColor: textData.style.textStyle?.backgroundColor || '#FFFFFF',
          backgroundOpacity: textData.style.textStyle?.backgroundOpacity ?? 1,
          bold: textData.style.textStyle?.bold || false,
          italic: textData.style.textStyle?.italic || false
        }
      };

      const textRect = new TextRectangle(bounds, textData.content || 'Double-cliquez pour éditer', options);
      if (textData.rotation) {
        textRect.setRotation(textData.rotation);
      }
      return textRect;
    }

    case 'POLYGON': {
      const data = element.data;
      if (!isPolygonData(data)) {
        console.error('[DrawingStore] Données invalides pour Polygon');
        return null;
      }

      const points = data.points.map((point: [number, number]) => 
        L.latLng(point[1], point[0])
      );

      const polygon = new Polygon([points], {
        color: data.style?.color || '#3388ff',
        weight: data.style?.weight || 3,
        opacity: data.style?.opacity || 1,
        fillColor: data.style?.fillColor || '#3388ff',
        fillOpacity: data.style?.fillOpacity || 0.2,
        dashArray: data.style?.dashArray || ''
      });

      polygon.updateProperties();
      return polygon;
    }

    case 'ELEVATIONLINE': {
      const data = element.data;
      if (!isElevationData(data)) {
        console.error('[DrawingStore] Données invalides pour ElevationLine');
        return null;
      }

      const points = data.points.map((point: [number, number]) => 
        L.latLng(point[1], point[0])
      );

      const elevationLine = new ElevationLine(points, {
        color: data.style?.color || '#FF4500',
        weight: data.style?.weight || 4,
        opacity: data.style?.opacity || 0.8
      });

      // Restaurer les styles des points
      if (data.samplePointStyle) {
        elevationLine.setSamplePointStyle(data.samplePointStyle);
      }
      if (data.minMaxPointStyle) {
        elevationLine.setMinMaxPointStyle(data.minMaxPointStyle);
      }

      // Forcer une mise à jour du profil
      elevationLine.updateElevationProfile();

      return elevationLine;
    }

    case 'LIGNE': {
      const data = element.data;
      if (!isLineData(data)) {
        console.error('[DrawingStore] Données invalides pour Ligne');
        return null;
      }

      const points = data.points.map((point: [number, number]) => 
        L.latLng(point[1], point[0])
      );

      const line = new Line(points, data.style);
      line.updateProperties();
      return line;
    }

    case 'DEMI_CERCLE': {
      const data = element.data as SemicircleData;
      if (!data.center || !data.radius) {
        console.error('[DrawingStore] Données invalides pour Semicircle');
        return null;
      }

      const circleArc = new CircleArc(
        L.latLng(data.center[1], data.center[0]),
        data.radius,
        data.startAngle,
        data.endAngle,
        data.style
      );

      // S'assurer que les propriétés sont correctement définies
      circleArc.properties = {
        type: 'Semicircle',
        radius: data.radius,
        startAngle: data.startAngle,
        stopAngle: data.endAngle,
        style: data.style
      };

      // Calculer les propriétés additionnelles
      const area = Math.PI * Math.pow(data.radius, 2) * ((data.endAngle - data.startAngle) / 360);
      const perimeter = 2 * data.radius + (Math.PI * data.radius * ((data.endAngle - data.startAngle) / 180));
      const arcLength = Math.PI * data.radius * ((data.endAngle - data.startAngle) / 180);

      circleArc.properties.area = area;
      circleArc.properties.perimeter = perimeter;
      circleArc.properties.arcLength = arcLength;
      circleArc.properties.openingAngle = data.endAngle - data.startAngle;

      return circleArc;
    }

    case 'RECTANGLE': {
      const data = element.data as RectangleData;
      if (!data.bounds) {
        console.error('[DrawingStore] Données de bounds manquantes pour Rectangle');
        return null;
      }

      const bounds = new L.LatLngBounds(
        L.latLng(data.bounds.southWest[1], data.bounds.southWest[0]),
        L.latLng(data.bounds.northEast[1], data.bounds.northEast[0])
      );

      const rectangle = new Rectangle(bounds, {
        color: data.style?.color || '#3388ff',
        weight: data.style?.weight || 3,
        opacity: data.style?.opacity || 1,
        fillColor: data.style?.fillColor || '#3388ff',
        fillOpacity: data.style?.fillOpacity || 0.2,
        dashArray: data.style?.dashArray || ''
      });

      // Appliquer la rotation si elle existe
      if (data.rotation) {
        rectangle.setRotation(data.rotation);
      }

      return rectangle;
    }

    default:
      console.warn('[DrawingStore] Type non géré pour la restauration:', element.type_forme);
      return null;
  }
}

export const useDrawingStore = defineStore('drawing', {
  state: (): DrawingState => ({
    currentPlanId: null,
    elements: [],
    selectedElement: null,
    unsavedChanges: false,
    loading: false,
    error: null,
    currentTool: '',
    currentStyle: {
      strokeStyle: 'solid',
      strokeWidth: 2,
      strokeColor: '#2563EB',
      fillColor: '#3B82F6',
      fillOpacity: 0.2
    },
    lastUsedType: null
  }),
  getters: {
    hasUnsavedChanges: (state) => state.unsavedChanges,
    getCurrentElements: (state) => state.elements,
    getSelectedElement: (state) => state.selectedElement,
    getCurrentTool: (state) => state.currentTool,
    getCurrentStyle: (state) => state.currentStyle,
    getLastUsedType: (state) => state.lastUsedType
  },
  actions: {
    setCurrentPlan(planId: number | null) {
      // Émettre un événement personnalisé pour nettoyer les points de contrôle
      window.dispatchEvent(new CustomEvent('clearControlPoints'));
      this.currentPlanId = planId;
      if (planId === null) {
        this.clearElements();
      }
      // Réinitialiser l'état du dessin
      this.selectedElement = null;
      this.unsavedChanges = false;
      this.currentTool = '';
      this.lastUsedType = null;
      this.currentStyle = {
        strokeStyle: 'solid',
        strokeWidth: 2,
        strokeColor: '#2563EB',
        fillColor: '#3B82F6',
        fillOpacity: 0.2
      };
    },
    clearCurrentPlan() {
      this.currentPlanId = null;
      this.elements = [];
      this.selectedElement = null;
      this.unsavedChanges = false;
      this.loading = false;
      this.error = null;
    },
    clearElements() {
      this.elements = [];
      this.selectedElement = null;
      this.unsavedChanges = false;
      this.error = null;
    },
    addElement(element: DrawingElement | any) {
      console.log('[DrawingStore] Ajout d\'un élément', { 
        element,
        isLeafletLayer: element instanceof L.Layer,
        hasProperties: !!element.properties,
        properties: element.properties,
        type: element.properties?.type
      });

      // Si l'élément est une forme Leaflet (TextRectangle, Polygon, etc.)
      if (element instanceof L.Layer && element.properties) {
        const convertedElement = convertShapeToDrawingElement(element);
        console.log('[DrawingStore] Élément converti avant ajout', {
          original: element,
          converted: convertedElement,
          type: convertedElement.type_forme,
          data: convertedElement.data
        });
        this.elements.push(convertedElement);
      } else {
        // Cas standard pour les éléments déjà au bon format
        if (!element.type_forme && this.lastUsedType) {
          element.type_forme = this.lastUsedType;
        }
        this.elements.push(element);
      }

      this.unsavedChanges = true;
      console.log('[DrawingStore] État après ajout', { 
        elements: this.elements,
        unsavedChanges: this.unsavedChanges 
      });
    },
    updateElement(element: DrawingElement) {
      const index = this.elements.findIndex(e => e.id === element.id);
      if (index !== -1) {
        const type_forme = this.elements[index].type_forme;
        this.elements[index] = { ...element, type_forme };
        this.unsavedChanges = true;
      }
    },
    removeElement(elementId: number) {
      const index = this.elements.findIndex(e => e.id === elementId);
      if (index !== -1) {
        this.elements.splice(index, 1);
        this.unsavedChanges = true;
      }
    },
    selectElement(element: DrawingElement | null) {
      this.selectedElement = element;
    },
    setCurrentTool(tool: string) {
      this.currentTool = tool;
      if (['CERCLE', 'RECTANGLE', 'DEMI_CERCLE', 'LIGNE', 'TEXTE'].includes(tool)) {
        this.lastUsedType = tool;
      }
    },
    setCurrentStyle(style: Partial<DrawingState['currentStyle']>) {
      // Si aucun style n'est fourni, réinitialiser aux valeurs par défaut
      if (!style || Object.keys(style).length === 0) {
        this.currentStyle = {
          strokeStyle: 'solid',
          strokeWidth: 2,
          strokeColor: '#2563EB',
          fillColor: '#3B82F6',
          fillOpacity: 0.2
        };
        return;
      }
      
      // Sinon, mettre à jour uniquement les propriétés fournies
      this.currentStyle = { ...this.currentStyle, ...style };
    },
    async loadPlanElements(planId: number) {
      this.loading = true;
      try {
        console.log('[DrawingStore] Début du chargement du plan', { planId });
        const response = await api.get(`/plans/${planId}/`);
        const plan = response.data;
        console.log('[DrawingStore] Données du plan reçues', {
          formes: plan.formes,
          preferences: plan.preferences
        });
        // Convertir les formes en éléments de dessin
        this.elements = plan.formes.map((forme: any) => {
          console.log('[DrawingStore] Traitement de la forme stockée', {
            id: forme.id,
            type_forme: forme.type_forme,
            data: forme.data,
            isTextRectangle: forme.type_forme === 'TEXTE' || (forme.data && isTextData(forme.data))
          });
          // Si la forme a déjà été convertie en élément de dessin
          if (forme.type_forme) {
            console.log('[DrawingStore] Forme déjà au format élément', {
              type_forme: forme.type_forme,
              data: forme.data
            });
            return {
              id: forme.id,
              type_forme: forme.type_forme,
              data: forme.data || {}
            };
          }
          // Sinon, tenter de convertir la forme
          try {
            const convertedShape = convertStoredElementToShape(forme);
            if (convertedShape) {
              console.log('[DrawingStore] Forme convertie avec succès', {
                originalType: forme.type_forme,
                convertedType: convertedShape.type,
                properties: convertedShape.properties
              });
              return convertShapeToDrawingElement(convertedShape);
            }
          } catch (error) {
            console.error('[DrawingStore] Erreur lors de la conversion de la forme', {
              error,
              forme
            });
          }
          // En cas d'échec, retourner la forme telle quelle
          console.warn('[DrawingStore] Utilisation de la forme sans conversion', {
            type_forme: forme.type_forme,
            data: forme.data
          });
          return forme;
        });
        console.log(`[DrawingStore] Plan ${planId} - Chargé ${this.elements.length} éléments`, {
          elements: this.elements.map(el => ({
            id: el.id,
            type_forme: el.type_forme,
            isTextRectangle: el.type_forme === 'TEXTE' || isTextData(el.data)
          }))
        });
        this.currentPlanId = planId;
        this.unsavedChanges = false;
        // Charger les préférences du plan
        if (plan.preferences) {
          console.log('[DrawingStore] Chargement des préférences', plan.preferences);
          if (plan.preferences.currentTool) {
            this.setCurrentTool(plan.preferences.currentTool);
          }
          if (plan.preferences.currentStyle) {
            this.currentStyle = { ...this.currentStyle, ...plan.preferences.currentStyle };
          }
          if (plan.preferences.lastUsedType) {
            this.lastUsedType = plan.preferences.lastUsedType;
          }
        }
        return this.elements;
      } catch (error) {
        console.error('[DrawingStore] Erreur lors du chargement des éléments:', error);
        this.error = 'Erreur lors du chargement des éléments du plan';
        throw error;
      } finally {
        this.loading = false;
      }
    },
    async saveToPlan(planId?: number, options?: { elementsToDelete?: number[] }) {
      this.loading = true;
      try {
        const targetPlanId = planId || this.currentPlanId;
        console.log('[DrawingStore][saveToPlan] Début de la sauvegarde', {
          targetPlanId,
          currentPlanId: this.currentPlanId,
          elementsCount: this.elements.length,
          elementsToDelete: options?.elementsToDelete
        });

        if (!targetPlanId) {
          throw new Error('Aucun plan sélectionné pour la sauvegarde');
        }

        // Logs détaillés des éléments avant la sauvegarde
        console.log('[DrawingStore][saveToPlan] État des éléments avant sauvegarde:', {
          elements: this.elements.map(el => ({
            id: el.id,
            type_forme: el.type_forme,
            data: {
              hasPoints: 'points' in el.data,
              points: 'points' in el.data ? el.data.points : null,
              hasBounds: 'bounds' in el.data,
              bounds: 'bounds' in el.data ? el.data.bounds : null,
              hasContent: 'content' in el.data,
              content: 'content' in el.data ? el.data.content : null,
              style: el.data.style
            }
          }))
        });

        const formesAvecType = this.elements.map(element => {
          console.log('[DrawingStore][saveToPlan] Préparation élément pour sauvegarde', {
            id: element.id,
            type_forme: element.type_forme,
            isTextRectangle: element.type_forme === 'TEXTE' || element.type_forme === 'POLYGON' || isTextData(element.data) || isPolygonData(element.data),
            dataType: element.data ? Object.keys(element.data) : null,
            dataContent: element.data
          });

          return {
            ...element,
            type_forme: element.type_forme || this.lastUsedType
          };
        });

        const elementsToDelete = options?.elementsToDelete || [];
        const requestUrl = `/plans/${targetPlanId}/save_with_elements/`;
        console.log('[DrawingStore][saveToPlan] Préparation requête API', {
          url: requestUrl,
          method: 'POST',
          formesCount: formesAvecType.length,
          elementsToDeleteCount: elementsToDelete.length
        });

        const response = await api.post(requestUrl, {
          formes: formesAvecType,
          connexions: [],
          annotations: [],
          elementsToDelete: elementsToDelete,
          preferences: {
            currentTool: this.currentTool,
            currentStyle: this.currentStyle,
            lastUsedType: this.lastUsedType
          }
        });

        console.log('[DrawingStore][saveToPlan] Réponse reçue', {
          status: response.status,
          formesCount: response.data.formes?.length,
          data: response.data
        });

        this.elements = response.data.formes.map((forme: any) => {
          console.log('[DrawingStore][saveToPlan] Mise à jour élément après sauvegarde', {
            forme,
            type_forme: forme.type_forme
          });
          return {
            ...forme,
            type_forme: forme.type_forme
          };
        });
        this.unsavedChanges = false;
        return response.data;
      } catch (error) {
        console.error('[DrawingStore][saveToPlan] ERREUR:', error);
        console.error('[DrawingStore][saveToPlan] Stack trace:', error instanceof Error ? error.stack : 'No stack trace');
        this.error = 'Erreur lors de la sauvegarde du plan';
        throw error;
      } finally {
        this.loading = false;
      }
    }
  }
}); 