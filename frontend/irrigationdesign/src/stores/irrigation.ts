import { defineStore } from 'pinia';
import api from '@/services/api';
import { useAuthStore } from './auth';

interface PlanHistory {
  id: number;
  plan_id: number;
  date_modification: string;
  modifications: any;
  utilisateur: number;
}

interface Plan {
  id: number;
  nom: string;
  description: string;
  date_creation: string;
  date_modification: string;
  createur: number;
  elements: any[];
  historique: PlanHistory[];
  version: number;
}

interface NewPlan {
  nom: string;
  description: string;
}

export const useIrrigationStore = defineStore('irrigation', {
  state: () => ({
    plans: [] as Plan[],
    currentPlan: null as Plan | null,
    loading: false,
    error: null as string | null,
    autoSaveInterval: null as any,
    unsavedChanges: false,
    planHistory: [] as PlanHistory[]
  }),

  getters: {
    getPlanById: (state) => (id: number) => {
      return state.plans.find(plan => plan.id === id);
    },
    hasUnsavedChanges: (state) => state.unsavedChanges,
    getCurrentPlanHistory: (state) => state.planHistory
  },

  actions: {
    async fetchPlans() {
      const authStore = useAuthStore();
      this.loading = true;
      try {
        let url = '/plans/';
        if (authStore.isConcessionnaire) {
          url += '?concessionnaire=' + authStore.user?.id;
        } else if (authStore.isUtilisateur) {
          url += '?utilisateur=' + authStore.user?.id;
        }
        const response = await api.get(url);
        this.plans = response.data;
      } catch (error) {
        this.error = 'Erreur lors du chargement des plans';
        throw error;
      } finally {
        this.loading = false;
      }
    },

    async createPlan(planData: any) {
      this.loading = true;
      try {
        const response = await api.post('/plans/', planData);
        this.plans.push(response.data);
        return response.data;
      } catch (error) {
        this.error = 'Erreur lors de la création du plan';
        throw error;
      } finally {
        this.loading = false;
      }
    },

    startAutoSave() {
      if (this.autoSaveInterval) return;
      
      this.autoSaveInterval = setInterval(async () => {
        if (this.unsavedChanges && this.currentPlan) {
          await this.savePlan(this.currentPlan.id);
        }
      }, 30000); // Sauvegarde toutes les 30 secondes
    },

    stopAutoSave() {
      if (this.autoSaveInterval) {
        clearInterval(this.autoSaveInterval);
        this.autoSaveInterval = null;
      }
    },

    async savePlan(planId: number) {
      if (!this.unsavedChanges) return;

      this.loading = true;
      try {
        const response = await api.patch(`/plans/${planId}/`, {
          ...this.currentPlan,
          version: this.currentPlan?.version || 1
        });
        
        // Mettre à jour le plan dans la liste
        const index = this.plans.findIndex(p => p.id === planId);
        if (index !== -1) {
          this.plans[index] = response.data;
        }
        
        // Mettre à jour le plan courant
        if (this.currentPlan?.id === planId) {
          this.currentPlan = response.data;
        }
        
        this.unsavedChanges = false;
        return response.data;
      } catch (error) {
        this.error = 'Erreur lors de la sauvegarde du plan';
        throw error;
      } finally {
        this.loading = false;
      }
    },

    async fetchPlanHistory(planId: number) {
      this.loading = true;
      try {
        const response = await api.get(`/plans/${planId}/historique/`);
        this.planHistory = response.data;
        return response.data;
      } catch (error) {
        this.error = 'Erreur lors de la récupération de l\'historique';
        throw error;
      } finally {
        this.loading = false;
      }
    },

    async restorePlanVersion(planId: number, versionId: number) {
      this.loading = true;
      try {
        const response = await api.post(`/plans/${planId}/restaurer/`, {
          version_id: versionId
        });
        
        // Mettre à jour le plan restauré
        if (this.currentPlan?.id === planId) {
          this.currentPlan = response.data;
        }
        
        const index = this.plans.findIndex(p => p.id === planId);
        if (index !== -1) {
          this.plans[index] = response.data;
        }
        
        return response.data;
      } catch (error) {
        this.error = 'Erreur lors de la restauration de la version';
        throw error;
      } finally {
        this.loading = false;
      }
    },

    setCurrentPlan(plan: Plan) {
      this.currentPlan = plan;
      this.startAutoSave();
    },

    clearCurrentPlan() {
      this.currentPlan = null;
      this.stopAutoSave();
    },

    markUnsavedChanges() {
      this.unsavedChanges = true;
    }
  }
}); 