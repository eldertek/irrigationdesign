import { defineStore } from 'pinia';
import api from '@/services/api';
import type { DrawingElement, TextData, ShapeData, RectangleData } from '@/types/drawing';
import L from 'leaflet';
import { TextRectangle } from '@/utils/TextRectangle';
import { Polygon } from '@/utils/Polygon';
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
interface PolygonData {
  points: [number, number][];
  style: {
    color?: string;
    fillColor?: string;
    fillOpacity?: number;
    weight?: number;
    opacity?: number;
    dashArray?: string;
  };
}
function isTextData(data: ShapeData): data is TextData {
  return 'content' in data && 'bounds' in data;
}
function isPolygonData(data: any): data is PolygonData {
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
  let type_forme: DrawingElement['type_forme'];
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
  switch (shape.properties?.type) {
    case 'Polygon':
      type_forme = 'POLYGON';
      const latLngs = shape.getLatLngs()[0];
      data = {
        points: latLngs.map((ll: L.LatLng) => [ll.lng, ll.lat]),
        style: {
          color: shape.properties.style.color || '#3388ff',
          weight: shape.properties.style.weight || 3,
          opacity: shape.properties.style.opacity || 1,
          fillColor: shape.properties.style.fillColor || '#3388ff',
          fillOpacity: shape.properties.style.fillOpacity || 0.2,
          dashArray: shape.properties.style.dashArray || ''
        }
      };
      break;
    case 'Rectangle':
      type_forme = 'RECTANGLE';
      data = {
        bounds: {
          southWest: [shape.getBounds().getSouthWest().lng, shape.getBounds().getSouthWest().lat],
          northEast: [shape.getBounds().getNorthEast().lng, shape.getBounds().getNorthEast().lat]
        },
        style: shape.properties?.style || {}
      } as RectangleData;
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
      // Créer les bounds pour le TextRectangle
      const bounds = new L.LatLngBounds(
        L.latLng(textData.bounds.southWest[1], textData.bounds.southWest[0]),
        L.latLng(textData.bounds.northEast[1], textData.bounds.northEast[0])
      );
      // Préparer les options pour le TextRectangle
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
      return {
        type: 'TextRectangle',
        bounds,
        text: textData.content || 'Double-cliquez pour éditer',
        options,
        properties: {
          type: 'TextRectangle',
          text: textData.content || 'Double-cliquez pour éditer',
          style: options,
          rotation: textData.rotation || 0
        }
      };
    }
    case 'POLYGON': {
      const data = element.data;
      if (!isPolygonData(data)) {
        console.error('[DrawingStore] Données invalides pour Polygon');
        return null;
      }
      // Créer une instance de Polygon avec les points et le style
      const points = data.points.map((point: [number, number]) => 
        L.latLng(point[1], point[0])
      );
      const polygon = new Polygon([points], {
        ...data.style,
        color: data.style?.color || '#3388ff',
        weight: data.style?.weight || 3,
        opacity: data.style?.opacity || 1,
        fillColor: data.style?.fillColor || '#3388ff',
        fillOpacity: data.style?.fillOpacity || 0.2,
        dashArray: data.style?.dashArray || ''
      });
      // Forcer la mise à jour des propriétés
      polygon.updateProperties();
      return polygon;
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
      console.log('[DrawingStore] Ajout d\'un élément', { element });
      // Si l'élément est une forme Leaflet (TextRectangle, Polygon, etc.)
      if (element.properties?.type) {
        const convertedElement = convertShapeToDrawingElement(element);
        console.log('[DrawingStore] Élément converti avant ajout', convertedElement);
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
        if (!targetPlanId) {
          throw new Error('Aucun plan sélectionné pour la sauvegarde');
        }
        console.log('[DrawingStore] Début de la sauvegarde', {
          planId: targetPlanId,
          elementsCount: this.elements.length,
          elements: this.elements.map(el => ({
            id: el.id,
            type_forme: el.type_forme,
            isTextRectangle: el.type_forme === 'TEXTE' || isTextData(el.data)
          }))
        });
        const formesAvecType = this.elements.map(element => {
          console.log('[DrawingStore] Préparation de l\'élément pour sauvegarde', {
            id: element.id,
            type_forme: element.type_forme,
            isTextRectangle: element.type_forme === 'TEXTE' || isTextData(element.data),
            dataType: element.data ? Object.keys(element.data) : null
          });
          // Vérifier si c'est un TextRectangle
          if (element.type_forme === 'TEXTE' && isTextData(element.data)) {
            console.log('[DrawingStore] Traitement spécial TextRectangle', {
              bounds: element.data.bounds,
              content: element.data.content,
              style: element.data.style
            });
          }
          return {
            ...element,
            type_forme: element.type_forme || this.lastUsedType
          };
        });
        const elementsToDelete = options?.elementsToDelete || [];
        console.log('[DrawingStore] Envoi de la sauvegarde', {
          planId: targetPlanId,
          formesCount: formesAvecType.length,
          formes: formesAvecType,
          elementsToDeleteCount: elementsToDelete.length,
          preferences: {
            currentTool: this.currentTool,
            currentStyle: this.currentStyle,
            lastUsedType: this.lastUsedType
          }
        });
        const response = await api.post(`/plans/${targetPlanId}/save_with_elements/`, {
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
        console.log('[DrawingStore] Réponse de sauvegarde reçue', {
          formes: response.data.formes,
          status: response.status
        });
        this.elements = response.data.formes.map((forme: any) => {
          console.log('[DrawingStore] Mise à jour de l\'élément après sauvegarde', {
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
        console.error('[DrawingStore] Erreur lors de la sauvegarde:', error);
        this.error = 'Erreur lors de la sauvegarde du plan';
        throw error;
      } finally {
        this.loading = false;
      }
    }
  }
}); 