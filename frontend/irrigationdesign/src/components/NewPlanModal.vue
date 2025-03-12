<template>
  <div v-if="modelValue" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[4000]">
    <div class="bg-white rounded-lg p-6 max-w-2xl w-full mx-4">
      <div class="flex justify-between items-center mb-4">
        <h2 class="text-xl font-semibold text-gray-900">Créer un nouveau plan</h2>
        <button @click="closeModal" class="text-gray-400 hover:text-gray-500">
          <svg class="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
      <!-- Sélection de l'usine (admin uniquement) -->
      <div v-if="authStore.isAdmin" class="mb-4">
        <label class="block text-sm font-medium text-gray-700 mb-2">Usine</label>
        <div v-if="isLoadingUsines" class="animate-pulse">
          <div class="h-10 bg-gray-200 rounded"></div>
        </div>
        <select
          v-else
          v-model="planData.usine"
          class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
        >
          <option :value="null">Sélectionnez une usine</option>
          <option v-for="usine in usines" :key="usine.id" :value="usine.id">
            {{ formatUserName(usine) }}
          </option>
        </select>
      </div>
      <!-- Sélection du concessionnaire -->
      <div v-if="authStore.user?.user_type === 'admin' || authStore.user?.user_type === 'usine'" class="mb-4">
        <label class="block text-sm font-medium text-gray-700 mb-2">Concessionnaire</label>
        <div v-if="isLoadingConcessionnaires" class="animate-pulse">
          <div class="h-10 bg-gray-200 rounded"></div>
        </div>
        <select
          v-else
          v-model="planData.concessionnaire"
          class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
          :disabled="!concessionnaires.length || (authStore.isAdmin && !planData.usine)"
        >
          <option :value="null">{{ concessionnaires.length ? 'Sélectionnez un concessionnaire' : 'Aucun concessionnaire disponible' }}</option>
          <option v-for="concessionnaire in concessionnaires" :key="concessionnaire.id" :value="concessionnaire.id">
            {{ formatUserName(concessionnaire) }}
          </option>
        </select>
      </div>
      <!-- Sélection du client -->
      <div v-if="authStore.user?.user_type !== 'agriculteur'" class="mb-4">
        <label class="block text-sm font-medium text-gray-700 mb-2">Agriculteur</label>
        <div v-if="isLoadingClients" class="animate-pulse">
          <div class="h-10 bg-gray-200 rounded"></div>
        </div>
        <select
          v-else
          v-model="planData.client"
          class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
          :disabled="!concessionnaireClients.length || (authStore.user?.user_type !== 'concessionnaire' && !planData.concessionnaire)"
        >
          <option :value="null">{{ concessionnaireClients.length ? 'Sélectionnez un agriculteur' : 'Aucun agriculteur disponible' }}</option>
          <option v-for="client in concessionnaireClients" :key="client.id" :value="client.id">
            {{ formatUserName(client) }}
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
import { useAuthStore, formatUserName } from '@/stores/auth';
import { useIrrigationStore } from '@/stores/irrigation';
import { userService } from '@/services/api';
import type { UserDetails } from '@/types/user';
import { useDrawingStore } from '@/stores/drawing';

const props = defineProps<{
  modelValue: boolean;
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void;
  (e: 'created', planId: number): void;
  (e: 'concessionnaireSelected', concessionnaire: UserDetails): void;
  (e: 'clientSelected', client: UserDetails): void;
}>();

const authStore = useAuthStore();
const irrigationStore = useIrrigationStore();
const drawingStore = useDrawingStore();
const loading = ref(false);
const isCreating = ref(false);
const error = ref<string | null>(null);
const concessionnaires = ref<UserDetails[]>([]);
const concessionnaireClients = ref<UserDetails[]>([]);
const usines = ref<UserDetails[]>([]);
const selectedConcessionnaire = ref<UserDetails | null>(null);
const selectedClient = ref<UserDetails | null>(null);
const isLoadingConcessionnaires = ref(false);
const isLoadingClients = ref(false);
const isLoadingUsines = ref(false);

const planData = ref({
  nom: '',
  description: '',
  usine: null as number | null,
  concessionnaire: null as number | null,
  client: null as number | null
});

// Computed pour vérifier si le formulaire est valide
const isFormValid = computed(() => {
  if (authStore.user?.user_type === 'admin') {
    return planData.value.nom.trim() && planData.value.usine && planData.value.concessionnaire && planData.value.client;
  } else if (authStore.user?.user_type === 'usine') {
    return planData.value.nom.trim() && planData.value.concessionnaire && planData.value.client;
  } else if (authStore.user?.user_type === 'concessionnaire') {
    return planData.value.nom.trim() && planData.value.client;
  }
  return planData.value.nom.trim();
});

// Watcher pour charger les concessionnaires quand une usine est sélectionnée
watch(() => planData.value.usine, async (newUsineId) => {
  if (!props.modelValue) return;
  
  planData.value.concessionnaire = null;
  planData.value.client = null;
  concessionnaireClients.value = [];
  
  if (newUsineId) {
    await loadConcessionnaires(newUsineId);
  } else {
    concessionnaires.value = [];
  }
});

// Watcher pour charger les clients quand un concessionnaire est sélectionné
watch(() => planData.value.concessionnaire, async (newConcessionnaireId) => {
  if (!props.modelValue) return;
  
  planData.value.client = null;
  
  if (newConcessionnaireId) {
    await loadConcessionnaireClients(newConcessionnaireId);
  } else {
    concessionnaireClients.value = [];
  }
});

// Watcher pour réinitialiser les données quand le modal s'ouvre ou se ferme
watch(() => props.modelValue, (isOpen) => {
  if (isOpen) {
    // Si le modal s'ouvre, charger les données nécessaires
    if (authStore.user?.user_type === 'admin') {
      loadUsines();
    } else if (authStore.user?.user_type === 'usine') {
      loadConcessionnaires(authStore.user.id);
    } else if (authStore.user?.user_type === 'concessionnaire') {
      loadConcessionnaireClients(authStore.user.id);
    }
  } else {
    // Si le modal se ferme, nettoyer toutes les données
    planData.value = {
      nom: '',
      description: '',
      usine: null,
      concessionnaire: null,
      client: null
    };
    selectedConcessionnaire.value = null;
    selectedClient.value = null;
    concessionnaireClients.value = [];
    concessionnaires.value = [];
    usines.value = [];
    error.value = null;
  }
});

// Computed pour les clients disponibles selon le contexte
const availableClients = computed(() => {
  if (authStore.user?.user_type === 'admin') {
    return selectedConcessionnaire.value
      ? concessionnaireClients.value
      : [];
  }
  return concessionnaireClients.value;
});

// Fonction pour charger les concessionnaires
async function loadConcessionnaires(usineId?: number) {
  isLoadingConcessionnaires.value = true;
  try {
    if (usineId) {
      concessionnaires.value = await authStore.fetchUsineConcessionnaires(usineId);
    } else {
      // Pour admin sans usine sélectionnée, utilisez userService directement
      const response = await userService.getConcessionnaires();
      concessionnaires.value = response.data;
    }
  } catch (error) {
    console.error('[NewPlanModal] Error loading concessionnaires:', error);
    concessionnaires.value = [];
  } finally {
    isLoadingConcessionnaires.value = false;
  }
}

// Fonction pour charger les clients d'un concessionnaire
async function loadConcessionnaireClients(concessionnaireId: number) {
  isLoadingClients.value = true;
  try {
    concessionnaireClients.value = await authStore.fetchConcessionnaireAgriculteurs(concessionnaireId);
  } catch (error) {
    console.error('[NewPlanModal] Error loading clients:', error);
    concessionnaireClients.value = [];
  } finally {
    isLoadingClients.value = false;
  }
}

// Fonction pour sélectionner un concessionnaire
async function selectConcessionnaire(concessionnaire: UserDetails) {
  // N'exécuter que si le modal est visible
  if (!props.modelValue) return;
  
  selectedConcessionnaire.value = concessionnaire;
  planData.value.concessionnaire = concessionnaire.id;
  await loadConcessionnaireClients(concessionnaire.id);
  emit('concessionnaireSelected', concessionnaire);
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
    usine: null,
    concessionnaire: null,
    client: null
  };
  selectedConcessionnaire.value = null;
  selectedClient.value = null;
  concessionnaireClients.value = [];
  error.value = null;
}

// Fonction pour charger les usines
async function loadUsines() {
  isLoadingUsines.value = true;
  try {
    usines.value = await authStore.fetchUsines();
  } catch (error) {
    console.error('[NewPlanModal] Error loading usines:', error);
    usines.value = [];
  } finally {
    isLoadingUsines.value = false;
  }
}

// Fonction pour créer un plan
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
      data.usine = planData.value.usine;
      data.concessionnaire = planData.value.concessionnaire;
      data.agriculteur = planData.value.client;
    } else if (authStore.user?.user_type === 'usine') {
      data.usine = authStore.user.id;
      data.concessionnaire = planData.value.concessionnaire;
      data.agriculteur = planData.value.client;
    } else if (authStore.user?.user_type === 'concessionnaire') {
      data.usine = authStore.user.usine;
      data.concessionnaire = authStore.user.id;
      data.agriculteur = planData.value.client;
    } else if (authStore.user?.user_type === 'agriculteur') {
      data.usine = authStore.user.usine;
      data.concessionnaire = authStore.user.concessionnaire;
      data.agriculteur = authStore.user.id;
    }

    console.log('Données du plan à créer:', data);

    // S'assurer que l'état est propre avant de créer un nouveau plan
    irrigationStore.clearCurrentPlan();
    drawingStore.setCurrentPlan(null);
    
    const newPlan = await irrigationStore.createPlan(data);
    emit('created', newPlan.id);
    closeModal();
  } catch (err: any) {
    console.error('[NewPlanModal] Error creating plan:', err);
    console.error('Response data:', err.response?.data);
    
    let errorMessage = 'Une erreur est survenue lors de la création du plan';
    
    if (err.response?.data) {
      if (typeof err.response.data === 'object') {
        errorMessage = Object.entries(err.response.data)
          .map(([field, messages]) => {
            if (Array.isArray(messages)) {
              return `${field}: ${messages.join(', ')}`;
            }
            return `${field}: ${messages}`;
          })
          .join('\n');
      } else if (typeof err.response.data === 'string') {
        errorMessage = err.response.data;
      }
    }
    
    error.value = errorMessage;
  } finally {
    isCreating.value = false;
  }
}

// Exposer les méthodes et données nécessaires
defineExpose({
  concessionnaires,
  concessionnaireClients,
  selectedConcessionnaire,
  selectedClient,
  loadConcessionnaires,
  loadConcessionnaireClients,
  selectConcessionnaire,
  selectClient
});
</script> 