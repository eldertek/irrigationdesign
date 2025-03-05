<template>
  <div class="h-full bg-gray-50">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div class="sm:flex sm:items-center">
        <div class="sm:flex-auto">
          <h1 class="text-2xl font-semibold text-gray-900">{{ plansList.title }}</h1>
          <p class="mt-2 text-sm text-gray-700">
            {{ plansList.description }}
          </p>
        </div>
        <div class="mt-4 sm:mt-0 sm:ml-16 sm:flex-none">
          <button
            @click="openNewPlanModal"
            class="inline-flex items-center justify-center rounded-md border border-transparent bg-primary-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 sm:w-auto"
          >
            Nouveau plan
          </button>
        </div>
      </div>

      <!-- Interface Admin -->
      <div v-if="authStore.isAdmin" class="mt-8">
        <!-- Sélection du concessionnaire -->
        <div class="mb-6">
          <label for="dealer-filter" class="block text-sm font-medium text-gray-700">Filtrer par concessionnaire</label>
          <select
            id="dealer-filter"
            v-model="selectedDealer"
            class="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm rounded-md"
          >
            <option :value="null">Tous les concessionnaires</option>
            <option v-for="dealer in dealers" :key="dealer.id" :value="dealer.id">
              {{ dealer.first_name }} {{ dealer.last_name }} ({{ dealer.company_name }})
            </option>
          </select>
        </div>

        <!-- Sélection du client si un concessionnaire est sélectionné -->
        <div v-if="selectedDealer" class="mb-6">
          <label for="client-filter" class="block text-sm font-medium text-gray-700">Filtrer par client</label>
          <select
            id="client-filter"
            v-model="selectedClient"
            class="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm rounded-md"
          >
            <option :value="null">Tous les clients</option>
            <option v-for="client in filteredClients" :key="client.id" :value="client.id">
              {{ client.first_name }} {{ client.last_name }} ({{ client.company_name }})
            </option>
          </select>
        </div>
      </div>

      <!-- Interface Concessionnaire -->
      <div v-else-if="authStore.isDealer" class="mt-8">
        <div class="mb-6">
          <label for="client-filter" class="block text-sm font-medium text-gray-700">Filtrer par client</label>
          <select
            id="client-filter"
            v-model="selectedClient"
            class="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm rounded-md"
          >
            <option :value="null">Tous les clients</option>
            <option v-for="client in clients" :key="client.id" :value="client.id">
              {{ client.first_name }} {{ client.last_name }} ({{ client.company_name }})
            </option>
          </select>
        </div>
      </div>

      <!-- Liste des plans -->
      <div class="mt-8">
        <div class="overflow-hidden shadow-sm ring-1 ring-black ring-opacity-5 rounded-lg">
          <div class="overflow-x-auto">
            <table class="min-w-full divide-y divide-gray-300">
              <thead class="bg-gray-50">
                <tr>
                  <th scope="col" class="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-gray-900 sm:pl-6 lg:pl-8">
                    <button 
                      @click="toggleSort('nom')" 
                      class="group inline-flex items-center"
                    >
                      Nom
                      <span class="ml-2 flex-none rounded">
                        <svg 
                          class="h-5 w-5" 
                          :class="{
                            'text-gray-900': sortField === 'nom',
                            'text-gray-400': sortField !== 'nom',
                            'rotate-180': sortField === 'nom' && sortDirection === 'asc'
                          }"
                          viewBox="0 0 20 20" 
                          fill="currentColor"
                        >
                          <path fill-rule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clip-rule="evenodd" />
                        </svg>
                      </span>
                    </button>
                  </th>
                  <th scope="col" class="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
                    Description
                  </th>
                  <th v-if="!authStore.isDealer" scope="col" class="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
                    Concessionnaire
                  </th>
                  <th v-if="!authStore.isClient" scope="col" class="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
                    Client
                  </th>
                  <th scope="col" class="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
                    <button 
                      @click="toggleSort('date_creation')" 
                      class="group inline-flex items-center"
                    >
                      Créé le
                      <span class="ml-2 flex-none rounded">
                        <svg 
                          class="h-5 w-5" 
                          :class="{
                            'text-gray-900': sortField === 'date_creation',
                            'text-gray-400': sortField !== 'date_creation',
                            'rotate-180': sortField === 'date_creation' && sortDirection === 'asc'
                          }"
                          viewBox="0 0 20 20" 
                          fill="currentColor"
                        >
                          <path fill-rule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clip-rule="evenodd" />
                        </svg>
                      </span>
                    </button>
                  </th>
                  <th scope="col" class="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
                    <button 
                      @click="toggleSort('date_modification')" 
                      class="group inline-flex items-center"
                    >
                      Modifié le
                      <span class="ml-2 flex-none rounded">
                        <svg 
                          class="h-5 w-5" 
                          :class="{
                            'text-gray-900': sortField === 'date_modification',
                            'text-gray-400': sortField !== 'date_modification',
                            'rotate-180': sortField === 'date_modification' && sortDirection === 'asc'
                          }"
                          viewBox="0 0 20 20" 
                          fill="currentColor"
                        >
                          <path fill-rule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clip-rule="evenodd" />
                        </svg>
                      </span>
                    </button>
                  </th>
                  <th scope="col" class="relative py-3.5 pl-3 pr-4 sm:pr-6 lg:pr-8">
                    <span class="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody class="divide-y divide-gray-200 bg-white">
                <tr v-if="filteredPlans.length === 0">
                  <td colspan="7" class="py-4 px-6 text-center text-gray-500">
                    Aucun plan disponible
                  </td>
                </tr>
                <tr v-for="plan in filteredPlans" :key="plan.id" class="hover:bg-gray-50">
                  <td class="whitespace-nowrap py-4 pl-4 pr-3 text-sm font-medium text-gray-900 sm:pl-6 lg:pl-8">
                    {{ plan.nom }}
                  </td>
                  <td class="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                    {{ plan.description || '-' }}
                  </td>
                  <td v-if="!authStore.isDealer" class="px-3 py-4 text-sm text-gray-900">
                    <div v-if="plan.concessionnaire_details" class="flex items-center">
                      <div class="h-8 w-8 flex-shrink-0">
                        <div class="h-8 w-8 rounded-full bg-primary-100 flex items-center justify-center">
                          <span class="text-primary-700 font-medium text-sm">
                            {{ getInitials(plan.concessionnaire_details) }}
                          </span>
                        </div>
                      </div>
                      <div class="ml-3">
                        <div class="font-medium">{{ formatUserName(plan.concessionnaire_details) }}</div>
                      </div>
                    </div>
                    <div v-else class="text-gray-500">-</div>
                  </td>
                  <td v-if="!authStore.isClient" class="px-3 py-4 text-sm text-gray-900">
                    <div v-if="plan.client_details" class="flex items-center">
                      <div class="h-8 w-8 flex-shrink-0">
                        <div class="h-8 w-8 rounded-full bg-primary-100 flex items-center justify-center">
                          <span class="text-primary-700 font-medium text-sm">
                            {{ getInitials(plan.client_details) }}
                          </span>
                        </div>
                      </div>
                      <div class="ml-3">
                        <div class="font-medium">{{ formatUserName(plan.client_details) }}</div>
                      </div>
                    </div>
                    <div v-else class="text-gray-500">-</div>
                  </td>
                  <td class="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                    {{ formatDate(plan.date_creation) }}
                  </td>
                  <td class="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                    {{ formatDate(plan.date_modification) }}
                  </td>
                  <td class="relative whitespace-nowrap py-4 pl-3 pr-4 text-right text-sm font-medium sm:pr-6 lg:pr-8">
                    <button
                      @click="editPlan(plan)"
                      class="text-primary-600 hover:text-primary-900 mr-4"
                    >
                      Ouvrir
                    </button>
                    <button
                      @click="openEditPlanModal(plan)"
                      class="text-primary-600 hover:text-primary-900 mr-4"
                    >
                      Modifier
                    </button>
                    <button
                      v-if="canDeletePlan(plan)"
                      @click="deletePlan(plan)"
                      class="text-red-600 hover:text-red-900"
                    >
                      Supprimer
                    </button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <!-- Modal nouveau plan -->
      <NewPlanModal
        v-model="showNewPlanModal"
        :dealers="dealers"
        :clients="clients"
        @created="onPlanCreated"
      />

      <!-- Modal Modification Plan -->
      <div v-if="showEditPlanModal" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[2000]">
        <div class="bg-white rounded-lg p-6 max-w-md w-full">
          <div class="flex justify-between items-center mb-4">
            <h2 class="text-xl font-semibold text-gray-900">Modifier le plan</h2>
            <button
              @click="showEditPlanModal = false"
              class="text-gray-400 hover:text-gray-500 focus:outline-none"
            >
              <svg class="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <form @submit.prevent="updatePlan" class="space-y-4">
            <div>
              <label for="edit-nom" class="block text-sm font-medium text-gray-700">
                Nom
              </label>
              <input
                type="text"
                id="edit-nom"
                v-model="editPlanData.nom"
                class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
                required
              />
            </div>
            <div>
              <label for="edit-description" class="block text-sm font-medium text-gray-700">
                Description
              </label>
              <textarea
                id="edit-description"
                v-model="editPlanData.description"
                rows="3"
                class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
              ></textarea>
            </div>

            <!-- Assignation concessionnaire/client (admin uniquement) -->
            <div v-if="authStore.isAdmin" class="space-y-4">
              <div>
                <label for="edit-concessionnaire" class="block text-sm font-medium text-gray-700">
                  Concessionnaire
                </label>
                <select
                  id="edit-concessionnaire"
                  v-model="editPlanData.concessionnaire"
                  class="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm rounded-md"
                >
                  <option :value="null">Aucun</option>
                  <option v-for="dealer in dealers" :key="dealer.id" :value="dealer.id">
                    {{ formatUserName(dealer) }}
                  </option>
                </select>
              </div>

              <div>
                <label for="edit-client" class="block text-sm font-medium text-gray-700">
                  Client
                </label>
                <select
                  id="edit-client"
                  v-model="editPlanData.client"
                  class="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm rounded-md"
                >
                  <option :value="null">Aucun</option>
                  <option v-for="client in filteredClients" :key="client.id" :value="client.id">
                    {{ formatUserName(client) }}
                  </option>
                </select>
              </div>
            </div>

            <div v-if="error" class="mt-4 bg-red-50 p-4 rounded-md">
              <div class="flex">
                <div class="flex-shrink-0">
                  <svg class="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                    <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd" />
                  </svg>
                </div>
                <div class="ml-3">
                  <p class="text-sm font-medium text-red-800">{{ error }}</p>
                </div>
              </div>
            </div>

            <div class="mt-5 sm:mt-6 sm:grid sm:grid-cols-2 sm:gap-3">
              <button
                type="button"
                class="mt-3 inline-flex w-full justify-center rounded-md border border-gray-300 bg-white px-4 py-2 text-base font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 sm:mt-0 sm:text-sm"
                @click="showEditPlanModal = false"
              >
                Annuler
              </button>
              <button
                type="submit"
                :disabled="loading"
                class="inline-flex w-full justify-center rounded-md border border-transparent bg-primary-600 px-4 py-2 text-base font-medium text-white shadow-sm hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 sm:text-sm disabled:opacity-50"
              >
                <svg
                  v-if="loading"
                  class="animate-spin -ml-1 mr-3 h-5 w-5 text-white"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    class="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    stroke-width="4"
                  ></circle>
                  <path
                    class="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  ></path>
                </svg>
                {{ loading ? 'Enregistrement...' : 'Enregistrer' }}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useIrrigationStore } from '@/stores/irrigation'
import { useAuthStore, formatUserName } from '@/stores/auth'
import type { Plan as StorePlan } from '@/stores/irrigation'
import api from '@/services/api'
import NewPlanModal from '@/components/NewPlanModal.vue'

interface LocalUser {
  id: number
  username: string
  first_name: string
  last_name: string
  email: string
  company_name?: string
  role: string
  concessionnaire?: number | null
}

interface LocalPlan extends Omit<StorePlan, 'client' | 'concessionnaire'> {
  client: number | null
  concessionnaire: number | null
  client_details?: LocalUser | null
  concessionnaire_details?: LocalUser | null
}

const router = useRouter()
const irrigationStore = useIrrigationStore()
const authStore = useAuthStore()

const plans = ref<LocalPlan[]>([])
const dealers = ref<LocalUser[]>([])
const clients = ref<LocalUser[]>([])
const showNewPlanModal = ref(false)
const showEditPlanModal = ref(false)
const newPlan = ref({
  nom: '',
  description: '',
  client: null as number | null
})
const editPlanData = ref({
  id: 0,
  nom: '',
  description: '',
  concessionnaire: null as number | null,
  client: null as number | null
})
const loading = ref(false)
const error = ref<string | null>(null)

// Ajout des refs pour la sélection
const selectedDealer = ref<number | null>(null);
const selectedClient = ref<number | null>(null);

// Ajout des refs pour le tri
const sortField = ref<'nom' | 'date_creation' | 'date_modification'>('date_modification')
const sortDirection = ref<'asc' | 'desc'>('desc')

// Computed pour les clients filtrés selon le concessionnaire sélectionné
const filteredClients = computed(() => {
  if (!selectedDealer.value) return clients.value;
  return clients.value.filter(client => client.concessionnaire === selectedDealer.value);
});

// Computed pour les plans filtrés
const filteredPlans = computed(() => {
  let filtered = plans.value;

  if (authStore.isAdmin) {
    if (selectedDealer.value) {
      filtered = filtered.filter(plan => plan.concessionnaire === selectedDealer.value);
      if (selectedClient.value) {
        filtered = filtered.filter(plan => plan.client === selectedClient.value);
      }
    }
  } else if (authStore.isDealer) {
    filtered = filtered.filter(plan => plan.concessionnaire === authStore.user?.id);
    if (selectedClient.value) {
      filtered = filtered.filter(plan => plan.client === selectedClient.value);
    }
  }

  // Appliquer le tri
  return [...filtered].sort((a, b) => {
    if (sortField.value === 'nom') {
      return sortDirection.value === 'asc' 
        ? a.nom.localeCompare(b.nom)
        : b.nom.localeCompare(a.nom);
    } else {
      const dateA = new Date(a[sortField.value]).getTime();
      const dateB = new Date(b[sortField.value]).getTime();
      return sortDirection.value === 'asc' ? dateA - dateB : dateB - dateA;
    }
  });
});
// Computed properties pour le filtrage des plans
const plansList = computed(() => {
  if (authStore.isAdmin) {
    return {
      title: "Tous les plans",
      description: "Liste complète des plans",
      plans: plans.value
    }
  } else if (authStore.isDealer) {
    return {
      title: "Plans des clients",
      description: "Plans où vous êtes assigné comme concessionnaire",
      plans: plans.value.filter(plan => plan.concessionnaire === authStore.user?.id)
    }
  } else {
    // Client
    return {
      title: "Mes plans",
      description: "Plans qui vous sont assignés ou que vous avez créés",
      plans: plans.value.filter(plan => 
        plan.client === authStore.user?.id || 
        plan.createur.id === authStore.user?.id
      )
    }
  }
})

onMounted(async () => {
  await loadPlans()
  if (authStore.isAdmin) {
    await loadDealersAndClients()
  } else if (authStore.isDealer) {
    // Charger les clients du concessionnaire
    await loadClientsForDealer(authStore.user?.id || 0)
  }
})

async function loadPlans() {
  try {
    const response = await irrigationStore.fetchPlansWithDetails()
    plans.value = response.data
  } catch (error) {
    console.error('Erreur lors du chargement des plans:', error)
  }
}

async function loadDealersAndClients() {
  try {
    const [dealersResponse, clientsResponse] = await Promise.all([
      api.get('/users/', {
        params: { role: 'CONCESSIONNAIRE' }
      }),
      api.get('/users/', {
        params: { role: 'UTILISATEUR' }
      })
    ])
    dealers.value = dealersResponse.data
    clients.value = clientsResponse.data
  } catch (error) {
    console.error('Erreur lors du chargement des dealers et clients:', error)
  }
}

function openNewPlanModal() {
  showNewPlanModal.value = true
  newPlan.value = {
    nom: '',
    description: '',
    client: null
  }
}
async function editPlan(plan: LocalPlan) {
  try {
    // Définir le plan courant dans le store
    irrigationStore.setCurrentPlan(plan);
    
    // Sauvegarder l'ID du plan dans localStorage pour la persistance
    localStorage.setItem('lastPlanId', plan.id.toString());
    
    // Rediriger vers la vue carte
    router.push('/');
  } catch (error) {
    console.error('Erreur lors du chargement du plan:', error);
    alert('Une erreur est survenue lors du chargement du plan');
  }
}

async function deletePlan(plan: LocalPlan) {
  if (!plan?.id) return

  if (confirm('Êtes-vous sûr de vouloir supprimer ce plan ?')) {
    try {
      await irrigationStore.deletePlan(plan.id)
      await loadPlans()
      
      // Si le plan supprimé était le plan courant, le nettoyer
      if (irrigationStore.currentPlan?.id === plan.id) {
        irrigationStore.clearCurrentPlan()
      }
    } catch (error) {
      console.error('Erreur lors de la suppression du plan:', error)
      alert('Une erreur est survenue lors de la suppression du plan')
    }
  }
}

function formatDate(dateString: string) {
  return new Date(dateString).toLocaleDateString('fr-FR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

function getInitials(user: LocalUser | null): string {
  if (!user) return ''
  return (user.first_name.charAt(0) + user.last_name.charAt(0)).toUpperCase()
}

function openEditPlanModal(plan: LocalPlan) {
  editPlanData.value = {
    id: plan.id,
    nom: plan.nom,
    description: plan.description,
    concessionnaire: plan.concessionnaire || null,
    client: plan.client || null
  }
  
  // Si un concessionnaire est déjà assigné, charger ses clients
  if (plan.concessionnaire) {
    loadClientsForDealer(plan.concessionnaire);
  }
  
  showEditPlanModal.value = true;
}

// Fonction pour charger les clients d'un concessionnaire spécifique
async function loadClientsForDealer(dealerId: number) {
  try {
    const response = await api.get('/users/', {
      params: { 
        role: 'UTILISATEUR',
        concessionnaire: dealerId
      }
    })
    clients.value = response.data;
  } catch (error) {
    console.error('Erreur lors du chargement des clients:', error)
    clients.value = [];
  }
}

// Fonction de validation avant la mise à jour
async function updatePlan() {
  error.value = null
  loading.value = true
  
  try {
    if (!editPlanData.value.nom.trim()) {
      throw new Error('Le nom du plan est requis')
    }

    // Validation de la logique client/concessionnaire
    if (editPlanData.value.client && !editPlanData.value.concessionnaire) {
      throw new Error('Un concessionnaire doit être sélectionné pour assigner un client')
    }

    const response = await irrigationStore.updatePlanDetails(editPlanData.value.id, {
      nom: editPlanData.value.nom.trim(),
      description: editPlanData.value.description.trim(),
      concessionnaire: editPlanData.value.concessionnaire,
      client: editPlanData.value.client
    })

    if (response) {
      showEditPlanModal.value = false
      await loadPlans()
    }
  } catch (err: any) {
    console.error('Erreur lors de la mise à jour du plan:', err)
    if (err.response?.data?.detail) {
      error.value = err.response.data.detail
    } else if (err.response?.data?.non_field_errors) {
      error.value = err.response.data.non_field_errors[0]
    } else if (err.response?.data) {
      // Gestion des erreurs de validation par champ
      const errors = Object.entries(err.response.data)
        .map(([field, messages]) => `${field}: ${Array.isArray(messages) ? messages[0] : messages}`)
      error.value = errors.join('\n')
    } else {
      error.value = err.message || 'Une erreur est survenue lors de la mise à jour du plan'
    }
  } finally {
    loading.value = false
  }
}

// Ajout d'un watcher pour charger les clients quand le concessionnaire change dans le modal d'édition
watch(() => editPlanData.value.concessionnaire, async (newDealerId) => {
  if (newDealerId) {
    await loadClientsForDealer(newDealerId);
  } else {
    clients.value = [];
    editPlanData.value.client = null;
  }
});

// Fonction pour déterminer si l'utilisateur peut supprimer un plan
function canDeletePlan(plan: LocalPlan): boolean {
  const user = authStore.user
  if (!user) return false

  if (user.user_type === 'admin') return true
  if (user.user_type === 'dealer') return plan.concessionnaire === user.id
  return plan.client === user.id || plan.createur.id === user.id
}
// Ajouter la fonction de callback
async function onPlanCreated(planId: number) {
  await loadPlans();
  // Sauvegarder l'ID du nouveau plan dans localStorage
  localStorage.setItem('lastPlanId', planId.toString());
  console.log(`Plan ${planId} créé et défini comme plan actif`);
  // Rediriger vers l'éditeur avec le nouveau plan
  router.push('/');
}

// Fonction pour gérer le tri
function toggleSort(field: 'nom' | 'date_creation' | 'date_modification') {
  if (sortField.value === field) {
    sortDirection.value = sortDirection.value === 'asc' ? 'desc' : 'asc';
  } else {
    sortField.value = field;
    sortDirection.value = 'desc';
  }
}
</script> 