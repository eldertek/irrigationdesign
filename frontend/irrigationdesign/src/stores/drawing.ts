import { defineStore } from 'pinia';
import api from '@/services/api';
import { useAuthStore } from './auth';
import { useIrrigationStore } from './irrigation';
import type { DrawingElement } from '@/types/drawing';
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
      this.currentPlanId = planId;
      if (planId === null) {
        this.clearElements();
      }
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
    },
    addElement(element: DrawingElement) {
      if (!element.type_forme && this.lastUsedType) {
        element.type_forme = this.lastUsedType;
      }
      this.elements.push(element);
      this.unsavedChanges = true;
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
        const response = await api.get(`/plans/${planId}/`);
        const plan = response.data;
        // Convertir les formes en éléments de dessin
        this.elements = plan.formes.map((forme: any) => ({
          id: forme.id,  // Assurer que l'ID est correctement copié
          type_forme: forme.type_forme,
          data: forme.data || {}
        }));
        console.log(`Plan ${planId} - Chargé ${this.elements.length} éléments`);
        this.currentPlanId = planId;
        this.unsavedChanges = false;
        // Charger les préférences du plan
        if (plan.preferences) {
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
        if (this.selectedElement?.type_forme) {
          this.setCurrentTool(this.selectedElement.type_forme);
        }
        return this.elements;
      } catch (error) {
        console.error('Erreur lors du chargement des éléments:', error);
        this.error = 'Erreur lors du chargement des éléments du plan';
        throw error;
      } finally {
        this.loading = false;
      }
    },
    async saveToPlan(planId?: number, options?: { elementsToDelete?: number[] }) {
      const irrigationStore = useIrrigationStore();
      this.loading = true;
      try {
        const targetPlanId = planId || this.currentPlanId;
        if (!targetPlanId) {
          throw new Error('Aucun plan sélectionné pour la sauvegarde');
        }
        const formesAvecType = this.elements.map(element => ({
          ...element,
          type_forme: element.type_forme || this.lastUsedType
        }));
        // Identifiants des éléments à supprimer (s'ils existent)
        const elementsToDelete = options?.elementsToDelete || [];
        console.log('Store - Sauvegarde du plan:', {
          planId: targetPlanId,
          elementsCount: formesAvecType.length,
          elementsToDeleteCount: elementsToDelete.length
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
        this.elements = response.data.formes.map((forme: any) => ({
          ...forme,
          type_forme: forme.type_forme
        }));
        this.unsavedChanges = false;
        return response.data;
      } catch (error) {
        console.error('Erreur lors de la sauvegarde:', error);
        this.error = 'Erreur lors de la sauvegarde du plan';
        throw error;
      } finally {
        this.loading = false;
      }
    }
  }
}); 