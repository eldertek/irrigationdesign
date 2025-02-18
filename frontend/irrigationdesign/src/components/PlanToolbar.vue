<template>
  <div class="bg-white border-b border-gray-200 py-1">
    <div class="max-w-7xl mx-auto px-2 sm:px-4">
      <div class="flex items-center justify-between h-10">
        <!-- Informations du plan actuel -->
        <div class="flex items-center space-x-2">
          <span v-if="currentPlan" class="text-xs text-gray-600">
            Plan actuel : <span class="font-medium text-gray-900">{{ currentPlan.nom }}</span>
          </span>
          <span v-else class="text-xs text-gray-500">
            Aucun plan sélectionné
          </span>
        </div>

        <!-- Actions -->
        <div class="flex items-center space-x-2">
          <button
            @click="showNewPlanModal = true"
            class="px-2 py-1 text-sm bg-primary-600 text-white rounded hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-1"
          >
            Nouveau plan
          </button>
          <button
            @click="showLoadPlanModal = true"
            class="px-2 py-1 text-sm bg-white text-primary-600 border border-primary-600 rounded hover:bg-primary-50 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-1"
          >
            Charger
          </button>
          <button
            v-if="currentPlan"
            @click="savePlan"
            class="px-2 py-1 text-sm bg-green-600 text-white rounded hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-1"
            :disabled="!hasUnsavedChanges"
          >
            Sauvegarder
          </button>
        </div>
      </div>
    </div>

    <!-- Modal Nouveau Plan -->
    <div v-if="showNewPlanModal" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[2000]">
      <div class="bg-white rounded-lg p-4 max-w-sm w-full mx-4">
        <h2 class="text-lg font-semibold mb-3">Créer un nouveau plan</h2>
        <form @submit.prevent="createNewPlan">
          <div class="space-y-3">
            <div>
              <label for="nom" class="block text-sm font-medium text-gray-700">Nom du plan</label>
              <input
                type="text"
                id="nom"
                v-model="newPlanData.nom"
                class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 text-sm"
                required
              />
            </div>
            <div>
              <label for="description" class="block text-sm font-medium text-gray-700">Description</label>
              <textarea
                id="description"
                v-model="newPlanData.description"
                rows="2"
                class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 text-sm"
              ></textarea>
            </div>
          </div>
          <div class="mt-4 flex justify-end space-x-2">
            <button
              type="button"
              @click="showNewPlanModal = false"
              class="px-3 py-1.5 text-sm border border-gray-300 rounded text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-1"
            >
              Annuler
            </button>
            <button
              type="submit"
              class="px-3 py-1.5 text-sm bg-primary-600 text-white rounded hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-1"
            >
              Créer
            </button>
          </div>
        </form>
      </div>
    </div>

    <!-- Modal Charger un Plan -->
    <div v-if="showLoadPlanModal" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[2000]">
      <div class="bg-white rounded-lg p-4 max-w-sm w-full mx-4">
        <h2 class="text-lg font-semibold mb-3">Charger un plan existant</h2>
        <div class="max-h-72 overflow-y-auto">
          <div v-for="plan in plans" :key="plan.id" class="border-b border-gray-200 last:border-b-0">
            <button
              @click="loadPlan(plan.id)"
              class="w-full px-3 py-2 text-left hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-1"
            >
              <div class="font-medium text-sm text-gray-900">{{ plan.nom }}</div>
              <div class="text-xs text-gray-500">{{ plan.description }}</div>
              <div class="text-xs text-gray-400">
                Modifié le {{ new Date(plan.date_modification).toLocaleDateString() }}
              </div>
            </button>
          </div>
        </div>
        <div class="mt-4 flex justify-end">
          <button
            @click="showLoadPlanModal = false"
            class="px-3 py-1.5 text-sm border border-gray-300 rounded text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-1"
          >
            Fermer
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { useIrrigationStore } from '@/stores/irrigation';
import { useDrawingStore } from '@/stores/drawing';

const irrigationStore = useIrrigationStore();
const drawingStore = useDrawingStore();

const showNewPlanModal = ref(false);
const showLoadPlanModal = ref(false);
const newPlanData = ref({
  nom: '',
  description: ''
});

// Computed properties
const currentPlan = computed(() => irrigationStore.currentPlan);
const plans = computed(() => irrigationStore.plans);
const hasUnsavedChanges = computed(() => drawingStore.hasUnsavedChanges);

// Charger les plans au montage du composant
onMounted(async () => {
  await irrigationStore.fetchPlans();
  
  // Charger le dernier plan utilisé
  const lastPlanId = localStorage.getItem('lastPlanId');
  if (lastPlanId) {
    await loadPlan(parseInt(lastPlanId));
  }
});

// Créer un nouveau plan
async function createNewPlan() {
  try {
    const plan = await irrigationStore.createPlan(newPlanData.value);
    drawingStore.setCurrentPlan(plan.id);
    localStorage.setItem('lastPlanId', plan.id.toString());
    newPlanData.value = { nom: '', description: '' };
    showNewPlanModal.value = false;
  } catch (error) {
    console.error('Erreur lors de la création du plan:', error);
  }
}

// Charger un plan existant
async function loadPlan(planId: number) {
  try {
    await drawingStore.loadPlanElements(planId);
    localStorage.setItem('lastPlanId', planId.toString());
    showLoadPlanModal.value = false;
  } catch (error) {
    console.error('Erreur lors du chargement du plan:', error);
  }
}

// Sauvegarder le plan courant
async function savePlan() {
  try {
    if (drawingStore.hasUnsavedChanges) {
      await drawingStore.saveToPlan();
    }
  } catch (error) {
    console.error('Erreur lors de la sauvegarde du plan:', error);
  }
}
</script> 