<template>
  <div v-if="modelValue" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[2000]">
    <div class="bg-white rounded-lg p-6 max-w-2xl w-full mx-4">
      <div class="flex justify-between items-center mb-4">
        <h2 class="text-xl font-semibold text-gray-900">Créer un nouveau plan</h2>
        <button @click="closeModal" class="text-gray-400 hover:text-gray-500">
          <svg class="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
      <!-- Sélection du concessionnaire (admin uniquement) -->
      <div v-if="authStore.isAdmin" class="mb-4">
        <label class="block text-sm font-medium text-gray-700 mb-2">Concessionnaire</label>
        <div v-if="isLoadingDealers" class="animate-pulse">
          <div class="h-10 bg-gray-200 rounded"></div>
        </div>
        <select
          v-else
          v-model="planData.concessionnaire"
          class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
        >
          <option :value="null">Sélectionnez un concessionnaire</option>
          <option v-for="dealer in dealers" :key="dealer.id" :value="dealer.id">
            {{ dealer.first_name }} {{ dealer.last_name }} ({{ dealer.company_name }})
          </option>
        </select>
      </div>
      <!-- Sélection du client -->
      <div v-if="authStore.user?.user_type === 'admin' || authStore.user?.user_type === 'dealer'" class="mb-4">
        <label class="block text-sm font-medium text-gray-700 mb-2">Client</label>
        <div v-if="isLoadingClients" class="animate-pulse">
          <div class="h-10 bg-gray-200 rounded"></div>
        </div>
        <select
          v-else
          v-model="planData.client"
          class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
          :disabled="!dealerClients.length"
        >
          <option :value="null">{{ dealerClients.length ? 'Sélectionnez un client' : 'Aucun client disponible' }}</option>
          <option v-for="client in dealerClients" :key="client.id" :value="client.id">
            {{ client.first_name }} {{ client.last_name }} ({{ client.company_name }})
          </option>
        </select>
      </div>
      <!-- Nom du plan -->
      <div class="mb-4">
        <label class="block text-sm font-medium text-gray-700 mb-2">Nom du plan</label>
        <input
          v-model="planData.nom"
          type="text"
          class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
          placeholder="Entrez le nom du plan"
        />
      </div>
      <!-- Description -->
      <div class="mb-6">
        <label class="block text-sm font-medium text-gray-700 mb-2">Description</label>
        <textarea
          v-model="planData.description"
          class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
          rows="3"
          placeholder="Entrez une description (optionnel)"
        ></textarea>
      </div>
      <!-- Boutons d'action -->
      <div class="flex justify-end space-x-3">
        <button
          @click="closeModal"
          class="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-primary-500"
        >
          Annuler
        </button>
        <button
          @click="createPlan"
          class="px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500"
          :disabled="!isFormValid || isCreating"
        >
          <span v-if="isCreating">Création en cours...</span>
          <span v-else>Créer le plan</span>
        </button>
      </div>
    </div>
  </div>
</template>
<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { useAuthStore } from '@/stores/auth';
import { useIrrigationStore } from '@/stores/irrigation';
import type { UserDetails } from '@/types/user';
import api from '@/services/api';
import { useDrawingStore } from '@/stores/drawing';
const props = defineProps<{
  modelValue: boolean;
}>();
const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void;
  (e: 'created', planId: number): void;
  (e: 'dealerSelected', dealer: UserDetails): void;
  (e: 'clientSelected', client: UserDetails): void;
}>();
const authStore = useAuthStore();
const irrigationStore = useIrrigationStore();
const drawingStore = useDrawingStore();
const loading = ref(false);
const isCreating = ref(false);
const error = ref<string | null>(null);
const dealers = ref<UserDetails[]>([]);
const dealerClients = ref<UserDetails[]>([]);
const selectedDealer = ref<UserDetails | null>(null);
const selectedClient = ref<UserDetails | null>(null);
const isLoadingDealers = ref(false);
const isLoadingClients = ref(false);
const planData = ref({
  nom: '',
  description: '',
  concessionnaire: null as number | null,
  client: null as number | null
});
// Computed pour vérifier si le formulaire est valide
const isFormValid = computed(() => {
  if (authStore.user?.user_type === 'admin') {
    return planData.value.nom.trim() && planData.value.concessionnaire && planData.value.client;
  } else if (authStore.user?.user_type === 'dealer') {
    return planData.value.nom.trim() && planData.value.client;
  }
  return planData.value.nom.trim();
});
// Watcher pour charger les clients quand un concessionnaire est sélectionné
watch(() => planData.value.concessionnaire, async (newDealerId) => {
  // N'exécuter que si le modal est visible
  if (!props.modelValue) return;
  if (newDealerId) {
    const dealer = dealers.value.find(d => d.id === newDealerId);
    if (dealer) {
      await selectDealer(dealer);
    }
  } else {
    dealerClients.value = [];
    selectedDealer.value = null;
    selectedClient.value = null;
    planData.value.client = null;
  }
});
// Watcher pour réinitialiser les données quand le modal s'ouvre ou se ferme
watch(() => props.modelValue, (isOpen) => {
  if (isOpen) {
    // Si le modal s'ouvre, charger les données nécessaires
    if (authStore.user?.user_type === 'admin') {
      loadDealers();
    } else if (authStore.user?.user_type === 'dealer') {
      loadDealerClients(authStore.user.id);
    }
  } else {
    // Si le modal se ferme, nettoyer toutes les données
    planData.value = {
      nom: '',
      description: '',
      concessionnaire: null,
      client: null
    };
    selectedDealer.value = null;
    selectedClient.value = null;
    dealerClients.value = [];
    dealers.value = [];
    error.value = null;
  }
});
// Computed pour les clients disponibles selon le contexte
const availableClients = computed(() => {
  if (authStore.user?.user_type === 'admin') {
    return selectedDealer.value
      ? dealerClients.value
      : [];
  }
  return dealerClients.value;
});
// Fonction pour charger les concessionnaires
async function loadDealers() {
  isLoadingDealers.value = true;
  try {
    const response = await api.get('/users/', {
      params: { role: 'CONCESSIONNAIRE' }
    });
    dealers.value = response.data;
  } catch (error) {
    console.error('[NewPlanModal] Error loading dealers:', error);
  } finally {
    isLoadingDealers.value = false;
  }
}
// Fonction pour charger les clients d'un concessionnaire
async function loadDealerClients(dealerId: number) {
  isLoadingClients.value = true;
  try {
    const response = await api.get('/users/', {
      params: { 
        role: 'UTILISATEUR',
        concessionnaire: dealerId
      }
    });
    dealerClients.value = Array.isArray(response.data) ? response.data : [response.data];
  } catch (error) {
    console.error('[NewPlanModal] Error loading clients:', error);
    dealerClients.value = [];
  } finally {
    isLoadingClients.value = false;
  }
}
// Fonction pour sélectionner un concessionnaire
async function selectDealer(dealer: UserDetails) {
  // N'exécuter que si le modal est visible
  if (!props.modelValue) return;
  selectedDealer.value = dealer;
  planData.value.concessionnaire = dealer.id;
  isLoadingClients.value = true;
  try {
    const response = await api.get('/users/', {
      params: {
        role: 'UTILISATEUR',
        concessionnaire: dealer.id
      }
    });
    dealerClients.value = Array.isArray(response.data) ? response.data : [response.data];
  } catch (error) {
    console.error('[NewPlanModal] Error loading clients:', error);
    dealerClients.value = [];
  } finally {
    isLoadingClients.value = false;
  }
}
// Fonction pour sélectionner un client
function selectClient(client: UserDetails) {
  // N'exécuter que si le modal est visible
  if (!props.modelValue) return;
  selectedClient.value = client;
  planData.value.client = client.id;
  emit('clientSelected', client);
}
// Fonction pour fermer le modal
function closeModal() {
  emit('update:modelValue', false);
  // Réinitialiser les données
  planData.value = {
    nom: '',
    description: '',
    concessionnaire: null,
    client: null
  };
  selectedDealer.value = null;
  selectedClient.value = null;
  dealerClients.value = [];
  error.value = null;
}
async function createPlan() {
  error.value = null;
  isCreating.value = true;
  try {
    const data: any = {
      nom: planData.value.nom.trim(),
      description: planData.value.description.trim()
    };
    // Gestion des IDs selon le type d'utilisateur
    if (authStore.user?.user_type === 'admin') {
      data.concessionnaire = planData.value.concessionnaire;
      data.client = planData.value.client;
    } else if (authStore.user?.user_type === 'dealer') {
      data.concessionnaire = authStore.user.id;
      data.client = planData.value.client;
    } else if (authStore.user?.user_type === 'client') {
      data.client = authStore.user.id;
    }
    // S'assurer que l'état est propre avant de créer un nouveau plan
    irrigationStore.clearCurrentPlan();
    drawingStore.setCurrentPlan(null);
    const newPlan = await irrigationStore.createPlan(data);
    emit('created', newPlan.id);
    closeModal();
  } catch (err: any) {
    console.error('[NewPlanModal] Error creating plan:', err);
    error.value = err.response?.data?.detail || err.message || 'Une erreur est survenue lors de la création du plan';
  } finally {
    isCreating.value = false;
  }
}
// Exposer les méthodes et données nécessaires
defineExpose({
  dealers,
  dealerClients,
  selectedDealer,
  selectedClient,
  loadDealers,
  loadDealerClients,
  selectDealer,
  selectClient
});
</script> 