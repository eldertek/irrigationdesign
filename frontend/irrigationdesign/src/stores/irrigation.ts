import { defineStore } from 'pinia';
import api, { irrigationService } from '@/services/api';
import { useAuthStore } from './auth';
import { useNotificationStore } from './notification';

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
  concessionnaire?: number | null;
}

export interface Plan {
  id: number;
  nom: string;
  description: string;
  date_creation: string;
  date_modification: string;
  createur: UserDetails;
  usine: UserDetails | null;
  usine_id?: number | null;
  concessionnaire: UserDetails | null;
  concessionnaire_id?: number | null;
  agriculteur: UserDetails | null;
  agriculteur_id?: number | null;
  preferences?: any;
  elements?: any[];
  historique?: PlanHistory[];
  version?: number;
}

export interface NewPlan {
  nom: string;
  description: string;
  usine?: number | null;
  usine_id?: number | null;
  agriculteur?: number | null;
  agriculteur_id?: number | null;
  concessionnaire?: number | null;
  concessionnaire_id?: number | null;
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
    // Récupérer tous les plans selon les filtres appliqués
    async fetchPlans() {
      const authStore = useAuthStore();
      this.loading = true;
      try {
        let url = '/plans/';
        const params: Record<string, any> = {};
        
        if (authStore.isConcessionnaire) {
          params.concessionnaire = authStore.user?.id;
        } else if (authStore.isAgriculteur) {
          params.agriculteur = authStore.user?.id;
        }
        
        const response = await api.get(url, { params });
        this.plans = response.data;
      } catch (error) {
        this.error = 'Erreur lors du chargement des plans';
        throw error;
      } finally {
        this.loading = false;
      }
    },
    
    // Récupérer les plans avec tous les détails
    async fetchPlansWithDetails() {
      const authStore = useAuthStore();
      this.loading = true;
      try {
        let url = '/plans/';
        const params: Record<string, any> = {
          include_details: true
        };
        
        if (authStore.isConcessionnaire) {
          params.concessionnaire = authStore.user?.id;
        } else if (authStore.isAgriculteur) {
          params.agriculteur = authStore.user?.id;
        }
        
        console.log('[IrrigationStore] Fetching plans with params:', params);
        const response = await api.get(url, { params });
        console.log('[IrrigationStore] Plans received (raw):', JSON.stringify(response.data, null, 2));
        
        // Vérification structurelle des plans
        response.data.forEach((plan: any, index: number) => {
          console.log(`\n[IrrigationStore] Plan ${index + 1} (ID: ${plan.id || 'N/A'}) types:`, {
            usine: typeof plan.usine,
            concessionnaire: typeof plan.concessionnaire,
            agriculteur: typeof plan.agriculteur,
            usineValue: plan.usine,
            concessionnaireValue: plan.concessionnaire,
            agriculteurValue: plan.agriculteur
          });
        });
        
        // Transformer les données pour s'assurer qu'elles sont dans le bon format
        const processedPlans = response.data.map((plan: any) => {
          const processedPlan = {
            ...plan,
            // Garder seulement les objets, pas les IDs numériques
            usine: typeof plan.usine === 'object' ? plan.usine : null,
            concessionnaire: typeof plan.concessionnaire === 'object' ? plan.concessionnaire : null,
            agriculteur: typeof plan.agriculteur === 'object' ? plan.agriculteur : null
          };
          
          console.log(`[IrrigationStore] Plan ${plan.id} traité:`, {
            usine: processedPlan.usine,
            concessionnaire: processedPlan.concessionnaire,
            agriculteur: processedPlan.agriculteur
          });
          
          return processedPlan;
        });
        
        this.plans = processedPlans;
        return { data: processedPlans };
      } catch (error) {
        console.error('[IrrigationStore] Error fetching plans:', error);
        this.error = 'Erreur lors du chargement des plans';
        throw error;
      } finally {
        this.loading = false;
      }
    },
    
    // Récupérer les plans d'un client spécifique
    async fetchClientPlans(clientId: number) {
      this.loading = true;
      try {
        const response = await irrigationService.getAgriculteurPlans(clientId);
        return response.data;
      } catch (error) {
        this.error = 'Erreur lors du chargement des plans du client';
        throw error;
      } finally {
        this.loading = false;
      }
    },
    
    // Créer un nouveau plan
    async createPlan(planData: NewPlan) {
      this.clearCurrentPlan();
      this.loading = true;
      const notificationStore = useNotificationStore();
      try {
        const authStore = useAuthStore();
        
        // Pour un agriculteur, utiliser ses relations existantes
        if (authStore.user?.user_type === 'agriculteur') {
          planData = {
            ...planData,
            agriculteur: authStore.user.id,
            concessionnaire: authStore.user.concessionnaire,
            usine: authStore.user.usine
          };
        }

        // S'assurer que les IDs sont des nombres
        const formattedData = {
          ...planData,
          usine: planData.usine ? (typeof planData.usine === 'object' && 'id' in planData.usine ? planData.usine.id : Number(planData.usine)) : null,
          concessionnaire: planData.concessionnaire ? (typeof planData.concessionnaire === 'object' && 'id' in planData.concessionnaire ? planData.concessionnaire.id : Number(planData.concessionnaire)) : null,
          agriculteur: planData.agriculteur ? (typeof planData.agriculteur === 'object' && 'id' in planData.agriculteur ? planData.agriculteur.id : Number(planData.agriculteur)) : null
        };

        console.log('[IrrigationStore] Données formatées pour création:', formattedData);

        const response = await irrigationService.createPlan(formattedData);
        this.plans.push(response.data);
        notificationStore.success(`Le plan "${response.data.nom}" a été créé avec succès`);
        return response.data;
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error('Error creating plan:', errorMessage);
        this.error = errorMessage;
        notificationStore.error(`Erreur lors de la création du plan : ${errorMessage}`);
        throw error;
      } finally {
        this.loading = false;
      }
    },
    
    // Créer un plan pour un client spécifique
    async createPlanForClient(planData: NewPlan, clientId: number) {
      this.clearCurrentPlan();
      this.loading = true;
      try {
        const data = { ...planData, agriculteur: clientId };
        const response = await irrigationService.createPlanForAgriculteur(data);
        this.plans.push(response.data);
        return response.data;
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error('Error creating plan for client:', errorMessage);
        this.error = 'Erreur lors de la création du plan pour le client';
        throw error;
      } finally {
        this.loading = false;
      }
    },
    
    // Démarrer la sauvegarde automatique
    startAutoSave() {
      if (this.autoSaveInterval) return;
      this.autoSaveInterval = setInterval(async () => {
        if (this.unsavedChanges && this.currentPlan) {
          await this.savePlan(this.currentPlan.id);
        }
      }, 30000); // Sauvegarde toutes les 30 secondes
    },
    
    // Arrêter la sauvegarde automatique
    stopAutoSave() {
      if (this.autoSaveInterval) {
        clearInterval(this.autoSaveInterval);
        this.autoSaveInterval = null;
      }
    },
    
    // Sauvegarder un plan
    async savePlan(planId: number) {
      if (!this.unsavedChanges) {
        console.log('[IrrigationStore][savePlan] Aucun changement à sauvegarder');
        return;
      }

      console.log('[IrrigationStore][savePlan] Début de la sauvegarde', {
        planId,
        currentPlan: this.currentPlan?.id,
        hasUnsavedChanges: this.unsavedChanges
      });

      this.loading = true;
      try {
        const response = await api.patch(`/plans/${planId}/`, {
          ...this.currentPlan,
          version: this.currentPlan?.version || 1
        });

        console.log('[IrrigationStore][savePlan] Réponse reçue', {
          status: response.status,
          data: response.data
        });

        // Mettre à jour le plan dans la liste
        const index = this.plans.findIndex(p => p.id === planId);
        if (index !== -1) {
          console.log('[IrrigationStore][savePlan] Mise à jour du plan dans la liste', {
            index,
            oldPlan: this.plans[index],
            newPlan: response.data
          });
          this.plans[index] = response.data;
        }

        // Mettre à jour le plan courant
        if (this.currentPlan?.id === planId) {
          console.log('[IrrigationStore][savePlan] Mise à jour du plan courant');
          this.currentPlan = response.data;
        }

        this.unsavedChanges = false;
        return response.data;
      } catch (error) {
        console.error('[IrrigationStore][savePlan] ERREUR:', error);
        console.error('[IrrigationStore][savePlan] Stack trace:', error instanceof Error ? error.stack : 'No stack trace');
        if (error && typeof error === 'object' && 'response' in error) {
          const apiError = error as { response: { status: number; statusText: string; data: any } };
          console.error('[IrrigationStore][savePlan] Réponse d\'erreur:', {
            status: apiError.response.status,
            statusText: apiError.response.statusText,
            data: apiError.response.data
          });
        }
        this.error = 'Erreur lors de la sauvegarde du plan';
        throw error;
      } finally {
        this.loading = false;
      }
    },
    
    // Mettre à jour les détails d'un plan
    async updatePlanDetails(planId: number, planData: Partial<Plan>) {
      console.log('Mise à jour du plan avec les données:', planData);
      const { agriculteur_id, concessionnaire_id, usine_id, ...otherData } = planData;
      const notificationStore = useNotificationStore();
      
      try {
        const authStore = useAuthStore();
        const data: Record<string, any> = { ...otherData };
        
        // Validation pour les usines
        if (authStore.user?.user_type === 'usine') {
          if (!concessionnaire_id && !planData.concessionnaire) {
            throw new Error('La sélection d\'un concessionnaire est obligatoire');
          }
          if (!agriculteur_id && !planData.agriculteur) {
            throw new Error('La sélection d\'un agriculteur est obligatoire');
          }
        }
        
        if (agriculteur_id !== undefined) {
          data.agriculteur_id = agriculteur_id;
        }
        
        if (concessionnaire_id !== undefined) {
          data.concessionnaire_id = concessionnaire_id;
        }
        
        if (usine_id !== undefined) {
          data.usine_id = usine_id;
        }
        
        const response = await api.patch(`/plans/${planId}/`, data);
        
        // Mettre à jour le plan en local si c'est le plan courant
        if (this.currentPlan && this.currentPlan.id === planId) {
          this.currentPlan = { ...this.currentPlan, ...response.data };
        }
        
        // Mettre à jour le plan dans la liste
        const index = this.plans.findIndex(p => p.id === planId);
        if (index !== -1) {
          this.plans[index] = { ...this.plans[index], ...response.data };
        }
        return response.data;
      } catch (error) {
        console.error('Erreur lors de la mise à jour du plan:', error);
        notificationStore.error(`Erreur lors de la mise à jour du plan : ${error instanceof Error ? error.message : String(error)}`);
        throw error;
      }
    },
    
    // Récupérer l'historique d'un plan
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
    
    // Restaurer une version d'un plan
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
    
    // Définir le plan courant
    setCurrentPlan(plan: Plan) {
      this.currentPlan = plan;
      this.startAutoSave();
    },
    
    // Effacer le plan courant
    clearCurrentPlan() {
      this.currentPlan = null;
      this.unsavedChanges = false;
      if (this.autoSaveInterval) {
        clearInterval(this.autoSaveInterval);
        this.autoSaveInterval = null;
      }
    },
    
    // Marquer des changements non sauvegardés
    markUnsavedChanges() {
      this.unsavedChanges = true;
    },
    
    // Supprimer un plan
    async deletePlan(planId: number) {
      this.loading = true;
      const notificationStore = useNotificationStore();
      try {
        const planToDelete = this.plans.find(p => p.id === planId);
        await irrigationService.deletePlan(planId);
        // Retirer le plan de la liste locale
        this.plans = this.plans.filter(p => p.id !== planId);
        // Si c'était le plan courant, le nettoyer
        if (this.currentPlan?.id === planId) {
          this.clearCurrentPlan();
        }
        notificationStore.success(`Le plan "${planToDelete?.nom || ''}" a été supprimé avec succès`);
      } catch (error) {
        this.error = 'Erreur lors de la suppression du plan';
        notificationStore.error(`Erreur lors de la suppression du plan : ${error instanceof Error ? error.message : String(error)}`);
        throw error;
      } finally {
        this.loading = false;
      }
    }
  }
}); 