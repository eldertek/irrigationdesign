import { defineStore } from 'pinia';
import axios from 'axios';

interface Plan {
  id: number;
  nom: string;
  description: string;
  date_creation: string;
  date_modification: string;
  elements: any[];
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
    error: null as string | null
  }),

  getters: {
    getPlanById: (state) => (id: number) => {
      return state.plans.find(plan => plan.id === id);
    }
  },

  actions: {
    async fetchPlans() {
      this.loading = true;
      this.error = null;
      try {
        const response = await axios.get('/api/plans/');
        this.plans = response.data;
      } catch (error) {
        this.error = 'Erreur lors du chargement des plans';
        throw error;
      } finally {
        this.loading = false;
      }
    },

    async createPlan(planData: NewPlan) {
      this.loading = true;
      this.error = null;
      try {
        const response = await axios.post('/api/plans/', planData);
        this.plans.push(response.data);
        return response.data;
      } catch (error) {
        this.error = 'Erreur lors de la création du plan';
        throw error;
      } finally {
        this.loading = false;
      }
    },

    async updatePlan(planId: number, planData: Partial<Plan>) {
      this.loading = true;
      this.error = null;
      try {
        const response = await axios.patch(`/api/plans/${planId}/`, planData);
        const index = this.plans.findIndex(p => p.id === planId);
        if (index !== -1) {
          this.plans[index] = response.data;
        }
        if (this.currentPlan?.id === planId) {
          this.currentPlan = response.data;
        }
        return response.data;
      } catch (error) {
        this.error = 'Erreur lors de la mise à jour du plan';
        throw error;
      } finally {
        this.loading = false;
      }
    },

    async deletePlan(planId: number) {
      this.loading = true;
      this.error = null;
      try {
        await axios.delete(`/api/plans/${planId}/`);
        this.plans = this.plans.filter(p => p.id !== planId);
        if (this.currentPlan?.id === planId) {
          this.currentPlan = null;
        }
      } catch (error) {
        this.error = 'Erreur lors de la suppression du plan';
        throw error;
      } finally {
        this.loading = false;
      }
    },

    setCurrentPlan(plan: Plan) {
      this.currentPlan = plan;
    },

    clearCurrentPlan() {
      this.currentPlan = null;
    }
  }
}); 