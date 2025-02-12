import { defineStore } from 'pinia';
import { ref } from 'vue';
import { irrigationService } from '@/services/api';

export interface IrrigationPlan {
  id: number;
  name: string;
  description: string;
  shapes: any[]; // Définir une interface plus précise pour les formes
  created_at: string;
  updated_at: string;
}

export const useIrrigationStore = defineStore('irrigation', () => {
  const plans = ref<IrrigationPlan[]>([]);
  const currentPlan = ref<IrrigationPlan | null>(null);
  const loading = ref(false);
  const error = ref<string | null>(null);

  async function fetchPlans() {
    try {
      loading.value = true;
      const response = await irrigationService.getPlans();
      plans.value = response.data;
    } catch (err) {
      error.value = 'Erreur lors du chargement des plans';
      console.error(err);
    } finally {
      loading.value = false;
    }
  }

  async function createPlan(planData: Partial<IrrigationPlan>) {
    try {
      loading.value = true;
      const response = await irrigationService.createPlan(planData);
      plans.value.push(response.data);
      return response.data;
    } catch (err) {
      error.value = 'Erreur lors de la création du plan';
      console.error(err);
      throw err;
    } finally {
      loading.value = false;
    }
  }

  async function updatePlan(planId: number, planData: Partial<IrrigationPlan>) {
    try {
      loading.value = true;
      const response = await irrigationService.updatePlan(planId, planData);
      const index = plans.value.findIndex(p => p.id === planId);
      if (index !== -1) {
        plans.value[index] = response.data;
      }
      return response.data;
    } catch (err) {
      error.value = 'Erreur lors de la mise à jour du plan';
      console.error(err);
      throw err;
    } finally {
      loading.value = false;
    }
  }

  async function deletePlan(planId: number) {
    try {
      loading.value = true;
      await irrigationService.deletePlan(planId);
      plans.value = plans.value.filter(p => p.id !== planId);
    } catch (err) {
      error.value = 'Erreur lors de la suppression du plan';
      console.error(err);
      throw err;
    } finally {
      loading.value = false;
    }
  }

  function setCurrentPlan(plan: IrrigationPlan | null) {
    currentPlan.value = plan;
  }

  return {
    plans,
    currentPlan,
    loading,
    error,
    fetchPlans,
    createPlan,
    updatePlan,
    deletePlan,
    setCurrentPlan,
  };
}); 