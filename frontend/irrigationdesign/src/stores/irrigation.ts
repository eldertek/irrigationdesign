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

export interface UserDetails {
  id: number;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  role: string;
  company_name?: string;
  phone?: string | null;
}

export interface Plan {
  id: number;
  nom: string;
  description: string;
  date_creation: string;
  date_modification: string;
  createur: UserDetails;
  concessionnaire: UserDetails | null;
  preferences: {
    currentTool?: string;
    currentStyle?: {
      fillColor?: string;
      fillOpacity?: number;
      strokeColor?: string;
      strokeStyle?: string;
      strokeWidth?: number;
    };
    last_viewport?: {
      lat: number;
      lng: number;
      zoom: number;
    };
  };
  elements?: any[];
  historique?: PlanHistory[];
  version?: number;
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
        if (authStore.isDealer) {
          url += '?concessionnaire=' + authStore.user?.id;
        } else if (authStore.isClient) {
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

    async fetchPlansWithDetails() {
      const authStore = useAuthStore();
      this.loading = true;
      try {
        let url = '/plans/';
        const params: Record<string, any> = {
          include_details: true
        };

        if (authStore.isDealer) {
          params.concessionnaire = authStore.user?.id;
        } else if (authStore.isClient) {
          params.utilisateur = authStore.user?.id;
        }

        const response = await api.get(url, { params });
        this.plans = response.data;
        return response;
      } catch (error) {
        this.error = 'Erreur lors du chargement des plans';
        throw error;
      } finally {
        this.loading = false;
      }
    },

    async createPlan(planData: NewPlan) {
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

    async updatePlanDetails(planId: number, { nom, description }: { nom: string; description: string }) {
      try {
        this.loading = true;
        this.error = null;
        
        const response = await api.patch(`/plans/${planId}/`, {
          nom,
          description
        });

        // Mettre à jour le plan dans la liste
        const index = this.plans.findIndex(p => p.id === planId);
        if (index !== -1) {
          this.plans[index] = { ...this.plans[index], ...response.data };
        }

        // Mettre à jour le plan courant si c'est celui qui est modifié
        if (this.currentPlan?.id === planId) {
          this.currentPlan = { ...this.currentPlan, ...response.data };
        }

        return response.data;
      } catch (error: any) {
        this.error = error.message;
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
    },

    async deletePlan(planId: number) {
      this.loading = true;
      try {
        await api.delete(`/plans/${planId}/`);
        // Retirer le plan de la liste locale
        this.plans = this.plans.filter(p => p.id !== planId);
        // Si c'était le plan courant, le nettoyer
        if (this.currentPlan?.id === planId) {
          this.clearCurrentPlan();
        }
      } catch (error) {
        this.error = 'Erreur lors de la suppression du plan';
        throw error;
      } finally {
        this.loading = false;
      }
    }
  }
}); 