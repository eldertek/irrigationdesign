import { defineStore } from 'pinia';
import api from '@/services/api';
import { useAuthStore } from './auth';
import { useIrrigationStore } from './irrigation';

interface DrawingElement {
  id?: number;
  type: string;
  properties: any;
  geometry: any;
}

interface DrawingState {
  currentPlanId: number | null;
  elements: DrawingElement[];
  selectedElement: DrawingElement | null;
  unsavedChanges: boolean;
  loading: boolean;
  error: string | null;
}

export const useDrawingStore = defineStore('drawing', {
  state: (): DrawingState => ({
    currentPlanId: null,
    elements: [],
    selectedElement: null,
    unsavedChanges: false,
    loading: false,
    error: null
  }),

  getters: {
    hasUnsavedChanges: (state) => state.unsavedChanges,
    getCurrentElements: (state) => state.elements,
    getSelectedElement: (state) => state.selectedElement
  },

  actions: {
    setCurrentPlan(planId: number | null) {
      this.currentPlanId = planId;
      if (planId === null) {
        this.clearElements();
      }
    },

    clearElements() {
      this.elements = [];
      this.selectedElement = null;
      this.unsavedChanges = false;
    },

    addElement(element: DrawingElement) {
      this.elements.push(element);
      this.unsavedChanges = true;
    },

    updateElement(element: DrawingElement) {
      const index = this.elements.findIndex(e => e.id === element.id);
      if (index !== -1) {
        this.elements[index] = element;
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

    async loadPlanElements(planId: number) {
      this.loading = true;
      try {
        const response = await api.get(`/plans/${planId}/`);
        const plan = response.data;
        
        // Convertir les formes, connexions et annotations en éléments de dessin
        this.elements = [
          ...plan.formes.map((forme: any) => ({
            id: forme.id,
            type: 'forme',
            properties: {
              type_forme: forme.type_forme,
              surface: forme.surface,
              ...forme.proprietes
            },
            geometry: forme.geometrie
          })),
          ...plan.connexions.map((connexion: any) => ({
            id: connexion.id,
            type: 'connexion',
            properties: {
              source: connexion.forme_source,
              destination: connexion.forme_destination
            },
            geometry: connexion.geometrie
          })),
          ...plan.annotations.map((annotation: any) => ({
            id: annotation.id,
            type: 'annotation',
            properties: {
              texte: annotation.texte,
              rotation: annotation.rotation
            },
            geometry: annotation.position
          }))
        ];
        
        this.currentPlanId = planId;
        this.unsavedChanges = false;
      } catch (error) {
        console.error('Erreur lors du chargement des éléments:', error);
        this.error = 'Erreur lors du chargement des éléments du plan';
        throw error;
      } finally {
        this.loading = false;
      }
    },

    async saveToPlan(planId?: number) {
      const irrigationStore = useIrrigationStore();
      this.loading = true;
      
      try {
        // Préparer les données à envoyer
        const elementsData = {
          formes: this.elements
            .filter(e => e.type === 'forme')
            .map(e => ({
              id: e.id,
              type_forme: e.properties.type_forme,
              geometrie: e.geometry,
              surface: e.properties.surface,
              proprietes: { ...e.properties }
            })),
          
          connexions: this.elements
            .filter(e => e.type === 'connexion')
            .map(e => ({
              id: e.id,
              forme_source: e.properties.source,
              forme_destination: e.properties.destination,
              geometrie: e.geometry
            })),
          
          annotations: this.elements
            .filter(e => e.type === 'annotation')
            .map(e => ({
              id: e.id,
              texte: e.properties.texte,
              position: e.geometry,
              rotation: e.properties.rotation
            }))
        };

        let response;
        if (planId || this.currentPlanId) {
          // Mise à jour d'un plan existant
          const targetPlanId = planId || this.currentPlanId;
          response = await api.post(`/plans/${targetPlanId}/save_with_elements/`, elementsData);
        } else {
          // Création d'un nouveau plan
          const newPlan = await irrigationStore.createPlan({
            nom: 'Nouveau plan',
            description: 'Plan créé depuis l\'outil de dessin'
          });
          
          response = await api.post(`/plans/${newPlan.id}/save_with_elements/`, elementsData);
          this.currentPlanId = newPlan.id;
        }

        // Mettre à jour les IDs des éléments avec ceux retournés par le serveur
        this.elements = [
          ...response.data.formes.map((forme: any) => ({
            id: forme.id,
            type: 'forme',
            properties: {
              type_forme: forme.type_forme,
              surface: forme.surface,
              ...forme.proprietes
            },
            geometry: forme.geometrie
          })),
          ...response.data.connexions.map((connexion: any) => ({
            id: connexion.id,
            type: 'connexion',
            properties: {
              source: connexion.forme_source,
              destination: connexion.forme_destination
            },
            geometry: connexion.geometrie
          })),
          ...response.data.annotations.map((annotation: any) => ({
            id: annotation.id,
            type: 'annotation',
            properties: {
              texte: annotation.texte,
              rotation: annotation.rotation
            },
            geometry: annotation.position
          }))
        ];

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