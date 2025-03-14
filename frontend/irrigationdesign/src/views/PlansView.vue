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
        <!-- Sélection de l'usine -->
        <div class="mb-6">
          <label for="usine-filter" class="block text-sm font-medium text-gray-700">Filtrer par usine</label>
          <select
            id="usine-filter"
            v-model="selectedUsine"
            class="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm rounded-md"
          >
            <option :value="null">Toutes les usines</option>
            <option v-for="usine in usines" :key="usine.id" :value="usine.id">
              {{ formatUserDisplay(usine) }}
            </option>
          </select>
        </div>
        <!-- Sélection du concessionnaire -->
        <div class="mb-6">
          <label for="concessionnaire-filter" class="block text-sm font-medium text-gray-700">Filtrer par concessionnaire</label>
          <select
            id="concessionnaire-filter"
            v-model="selectedConcessionnaire"
            class="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm rounded-md"
          >
            <option :value="null">{{ filteredConcessionnaires.length ? 'Tous les concessionnaires' : 'Aucun concessionnaire disponible' }}</option>
            <option v-for="concessionnaire in filteredConcessionnaires" :key="concessionnaire.id" :value="concessionnaire.id">
              {{ formatUserDisplay(concessionnaire) }}
            </option>
          </select>
        </div>
        <!-- Sélection de l'agriculteur si un concessionnaire est sélectionné -->
        <div v-if="selectedConcessionnaire" class="mb-6">
          <label for="agriculteur-filter" class="block text-sm font-medium text-gray-700">Filtrer par agriculteur</label>
          <select
            id="agriculteur-filter"
            v-model="selectedClient"
            class="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm rounded-md"
          >
            <option :value="null">{{ filteredClients.length ? 'Tous les agriculteurs' : 'Aucun agriculteur disponible' }}</option>
            <option v-for="client in filteredClients" :key="client.id" :value="client.id">
              {{ formatUserDisplay(client) }}
            </option>
          </select>
        </div>
      </div>
      <!-- Interface Concessionnaire -->
      <div v-else-if="authStore.isConcessionnaire" class="mt-8">
        <div class="mb-6">
          <label for="agriculteur-filter" class="block text-sm font-medium text-gray-700">Filtrer par agriculteur</label>
          <select
            id="agriculteur-filter"
            v-model="selectedClient"
            class="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm rounded-md"
          >
            <option :value="null">Tous les agriculteurs</option>
            <option v-for="client in clients" :key="client.id" :value="client.id">
              {{ formatUserDisplay(client) }}
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
                  <th scope="col" class="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
                    Usine
                  </th>
                  <th scope="col" class="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
                    Concessionnaire
                  </th>
                  <th scope="col" class="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
                    Agriculteur
                  </th>
                  <th scope="col" class="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
                    <button 
                      @click="toggleSort('date_modification')" 
                      class="group inline-flex items-center"
                    >
                      Dernière modification
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
                  <!-- Usine -->
                  <td class="px-3 py-4 text-sm text-gray-900">
                    <div v-if="plan.usine && typeof plan.usine === 'object'" class="flex items-center">
                      <div class="h-8 w-8 flex-shrink-0">
                        <div class="h-8 w-8 rounded-full bg-primary-100 flex items-center justify-center">
                          <span class="text-primary-700 font-medium text-sm">
                            {{ getInitials(plan.usine) }}
                          </span>
                        </div>
                      </div>
                      <div class="ml-3">
                        <div class="font-medium">{{ formatUserName(plan.usine) }}</div>
                      </div>
                    </div>
                    <div v-else class="text-gray-500">
                      Non assigné
                    </div>
                  </td>
                  <!-- Concessionnaire -->
                  <td class="px-3 py-4 text-sm text-gray-900">
                    <div v-if="plan.concessionnaire && typeof plan.concessionnaire === 'object'" class="flex items-center">
                      <div class="h-8 w-8 flex-shrink-0">
                        <div class="h-8 w-8 rounded-full bg-primary-100 flex items-center justify-center">
                          <span class="text-primary-700 font-medium text-sm">
                            {{ getInitials(plan.concessionnaire) }}
                          </span>
                        </div>
                      </div>
                      <div class="ml-3">
                        <div class="font-medium">{{ formatUserName(plan.concessionnaire) }}</div>
                      </div>
                    </div>
                    <div v-else class="text-gray-500">
                      Non assigné
                    </div>
                  </td>
                  <!-- Agriculteur -->
                  <td class="px-3 py-4 text-sm text-gray-900">
                    <div v-if="plan.agriculteur && typeof plan.agriculteur === 'object'" class="flex items-center">
                      <div class="h-8 w-8 flex-shrink-0">
                        <div class="h-8 w-8 rounded-full bg-primary-100 flex items-center justify-center">
                          <span class="text-primary-700 font-medium text-sm">
                            {{ getInitials(plan.agriculteur) }}
                          </span>
                        </div>
                      </div>
                      <div class="ml-3">
                        <div class="font-medium">{{ formatUserName(plan.agriculteur) }}</div>
                      </div>
                    </div>
                    <div v-else class="text-gray-500">
                      Non assigné
                    </div>
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
        :concessionnaires="concessionnaires"
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
                :disabled="loading"
                class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm disabled:bg-gray-100 disabled:cursor-not-allowed"
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
                :disabled="loading"
                rows="3"
                class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm disabled:bg-gray-100 disabled:cursor-not-allowed"
              ></textarea>
            </div>
            <!-- Assignation usine/concessionnaire/agriculteur (admin et usine) -->
            <div v-if="authStore.isAdmin || authStore.user?.user_type === 'usine'" class="space-y-4">
              <!-- Section usine (admin uniquement) -->
              <div v-if="authStore.isAdmin">
                <label for="edit-usine" class="block text-sm font-medium text-gray-700">
                  Usine
                </label>
                <select
                  id="edit-usine"
                  v-model="editPlanData.usine"
                  :disabled="loading"
                  class="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm rounded-md disabled:bg-gray-100 disabled:cursor-not-allowed"
                >
                  <option :value="null">Sélectionner une usine</option>
                  <option v-for="usine in usines" :key="usine.id" :value="usine.id">
                    {{ formatUserDisplay(usine) }}
                  </option>
                </select>
              </div>
              <!-- Section concessionnaire -->
              <div>
                <label for="edit-concessionnaire" class="block text-sm font-medium text-gray-700">
                  Concessionnaire
                </label>
                <select
                  id="edit-concessionnaire"
                  v-model="editPlanData.concessionnaire"
                  :disabled="(authStore.isAdmin && !editPlanData.usine) || loading"
                  class="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm rounded-md disabled:bg-gray-100 disabled:cursor-not-allowed"
                >
                  <option :value="null">Sélectionner un concessionnaire</option>
                  <option v-for="concessionnaire in filteredConcessionnairesForEdit" :key="concessionnaire.id" :value="concessionnaire.id">
                    {{ formatUserDisplay(concessionnaire) }}
                  </option>
                </select>
                <p v-if="authStore.isAdmin && !editPlanData.usine" class="mt-1 text-sm text-gray-500">
                  Veuillez d'abord sélectionner une usine
                </p>
              </div>
              <!-- Section agriculteur -->
              <div>
                <label for="edit-agriculteur" class="block text-sm font-medium text-gray-700">
                  Agriculteur
                </label>
                <select
                  id="edit-agriculteur"
                  v-model="editPlanData.agriculteur"
                  :disabled="!editPlanData.concessionnaire || loading"
                  class="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm rounded-md disabled:bg-gray-100 disabled:cursor-not-allowed"
                >
                  <option :value="null">Sélectionner un agriculteur</option>
                  <option v-for="client in filteredClientsForEdit" :key="client.id" :value="client.id">
                    {{ formatUserDisplay(client) }}
                  </option>
                </select>
                <p v-if="!editPlanData.concessionnaire" class="mt-1 text-sm text-gray-500">
                  Veuillez d'abord sélectionner un concessionnaire
                </p>
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
      <!-- Modal de confirmation de suppression -->
      <ConfirmationModal
        v-if="showDeleteModal"
        title="Supprimer le plan"
        message="Êtes-vous sûr de vouloir supprimer ce plan ? Cette action est irréversible."
        @confirm="confirmDeletePlan"
        @cancel="cancelDeletePlan"
      />
    </div>
  </div>
</template>
<script setup lang="ts">
import { ref, onMounted, computed, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useIrrigationStore, type UserDetails } from '@/stores/irrigation'
import { useAuthStore, formatUserName } from '@/stores/auth'
import { fetchUsersByHierarchy } from '@/services/api'
import NewPlanModal from '@/components/NewPlanModal.vue'
import ConfirmationModal from '@/components/ConfirmationModal.vue'

interface LocalUser {
  id: number
  username: string
  first_name: string
  last_name: string
  email: string
  company_name?: string
  role: string
  concessionnaire?: number | LocalUser | null
  usine?: LocalUser | null
}

interface Usine extends LocalUser {
  role: 'USINE'
}

interface Concessionnaire extends LocalUser {
  usine_id?: number
  role: 'CONCESSIONNAIRE'
}

interface ClientWithConcessionnaire extends LocalUser {
  concessionnaire_id?: number
  concessionnaire_ref?: number | LocalUser | null
}

interface LocalPlan {
  id: number
  nom: string
  description: string
  date_creation: string
  date_modification: string
  createur: { 
    id: number
    username: string
    first_name: string
    last_name: string
    email: string
    company_name?: string
    role: string
  }
  usine: UserDetails | null
  concessionnaire: UserDetails | null
  agriculteur: UserDetails | null
}
const router = useRouter()
const irrigationStore = useIrrigationStore()
const authStore = useAuthStore()
const plans = ref<LocalPlan[]>([])
const concessionnaires = ref<Concessionnaire[]>([])
const usines = ref<Usine[]>([])
const clients = ref<ClientWithConcessionnaire[]>([])
const showNewPlanModal = ref(false)
const showEditPlanModal = ref(false)
const showDeleteModal = ref(false)
const planToDelete = ref<LocalPlan | null>(null)
const newPlan = ref({
  nom: '',
  description: '',
  client: null as number | null
})
const editPlanData = ref({
  id: 0,
  nom: '',
  description: '',
  usine: null as number | null,
  concessionnaire: null as number | null,
  agriculteur: null as number | null
})
const loading = ref(false)
const error = ref<string | null>(null)
// Ajout des refs pour la sélection
const selectedConcessionnaire = ref<number | null>(null);
const selectedClient = ref<number | null>(null);
// Ajout des refs pour le tri
const sortField = ref<'nom' | 'date_creation' | 'date_modification'>('date_modification')
const sortDirection = ref<'asc' | 'desc'>('desc')
// Ajout de la ref pour la sélection de l'usine
const selectedUsine = ref<number | null>(null);
// Computed pour les clients filtrés selon le concessionnaire sélectionné
const filteredClients = computed(() => {
  if (!selectedConcessionnaire.value) return clients.value;
  return clients.value.filter(client => {
    if (typeof client.concessionnaire === 'object' && client.concessionnaire) {
      return client.concessionnaire.id === selectedConcessionnaire.value;
    }
    return client.concessionnaire === selectedConcessionnaire.value || 
           client.concessionnaire_id === selectedConcessionnaire.value;
  });
});
// Computed pour les plans filtrés
const filteredPlans = computed(() => {
  let filtered = plans.value;
  
  console.log('\n[PlansView] Filtering plans:', filtered.map(plan => ({
    id: plan.id,
    usine: plan.usine,
    concessionnaire: plan.concessionnaire,
    agriculteur: plan.agriculteur
  })));
  
  if (authStore.isAdmin) {
    if (selectedUsine.value) {
      filtered = filtered.filter(plan => {
        if (typeof plan.usine === 'object') {
          return plan.usine?.id === selectedUsine.value;
        }
        return plan.usine === selectedUsine.value;
      });
    }
    
    if (selectedConcessionnaire.value) {
      filtered = filtered.filter(plan => {
        if (typeof plan.concessionnaire === 'object') {
          return plan.concessionnaire?.id === selectedConcessionnaire.value;
        }
        return plan.concessionnaire === selectedConcessionnaire.value;
      });
      
      if (selectedClient.value) {
        filtered = filtered.filter(plan => {
          if (typeof plan.agriculteur === 'object') {
            return plan.agriculteur?.id === selectedClient.value;
          }
          return plan.agriculteur === selectedClient.value;
        });
      }
    }
  } else if (authStore.isConcessionnaire) {
    filtered = filtered.filter(plan => {
      if (typeof plan.concessionnaire === 'object') {
        return plan.concessionnaire?.id === authStore.user?.id;
      }
      return plan.concessionnaire === authStore.user?.id;
    });
    
    if (selectedClient.value) {
      filtered = filtered.filter(plan => {
        if (typeof plan.agriculteur === 'object') {
          return plan.agriculteur?.id === selectedClient.value;
        }
        return plan.agriculteur === selectedClient.value;
      });
    }
  }
  
  // Appliquer le tri
  const sorted = [...filtered].sort((a, b) => {
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
  
  console.log('[PlansView] Final filtered and sorted plans:', sorted.map(plan => ({
    id: plan.id,
    usine: plan.usine,
    concessionnaire: plan.concessionnaire,
    agriculteur: plan.agriculteur
  })));
  
  return sorted;
});
// Computed properties pour le filtrage des plans
const plansList = computed(() => {
  if (authStore.isAdmin) {
    return {
      title: "Tous les plans",
      description: "Liste complète des plans",
      plans: plans.value
    }
  } else if (authStore.isConcessionnaire) {
    return {
      title: "Plans des agriculteurs",
      description: "Plans où vous êtes assigné comme concessionnaire",
      plans: plans.value.filter(plan => {
        if (typeof plan.concessionnaire === 'object') {
          return plan.concessionnaire?.id === authStore.user?.id;
        }
        return plan.concessionnaire === authStore.user?.id;
      })
    }
  } else {
    // Agriculteur
    return {
      title: "Mes plans",
      description: "Plans qui vous sont assignés ou que vous avez créés",
      plans: plans.value.filter(plan => {
        const isCreator = plan.createur.id === authStore.user?.id;
        let isAgriculteur = false;
        
        if (typeof plan.agriculteur === 'object') {
          isAgriculteur = plan.agriculteur?.id === authStore.user?.id;
        } else {
          isAgriculteur = plan.agriculteur === authStore.user?.id;
        }
        
        return isAgriculteur || isCreator;
      })
    }
  }
})

// Computed pour filtrer les concessionnaires selon l'usine sélectionnée dans le dropdown
const filteredConcessionnaires = computed(() => {
  if (!selectedUsine.value) return concessionnaires.value;
  
  return concessionnaires.value.filter(concessionnaire => {
    if (typeof concessionnaire.usine === 'object') {
      return concessionnaire.usine?.id === selectedUsine.value;
    }
    return concessionnaire.usine_id === selectedUsine.value;
  });
});

// Computed pour filtrer les concessionnaires dans le modal d'édition
const filteredConcessionnairesForEdit = computed(() => {
  if (!editPlanData.value.usine) return [];
  
  return concessionnaires.value.filter(concessionnaire => {
    if (typeof concessionnaire.usine === 'object') {
      return concessionnaire.usine?.id === editPlanData.value.usine;
    }
    return concessionnaire.usine_id === editPlanData.value.usine;
  });
});

// Computed pour filtrer les clients selon le concessionnaire sélectionné pour l'édition
const filteredClientsForEdit = computed(() => {
  if (!editPlanData.value.usine || !editPlanData.value.concessionnaire) {
    return [];
  }
  
  return clients.value.filter(client => {
    if (typeof client.concessionnaire === 'object' && client.concessionnaire) {
      return client.concessionnaire.id === editPlanData.value.concessionnaire;
    }
    return client.concessionnaire === editPlanData.value.concessionnaire || 
           client.concessionnaire_id === editPlanData.value.concessionnaire;
  });
});

onMounted(async () => {
  await loadPlans()
  if (authStore.isAdmin) {
    await loadAllUsines()
  } else if (authStore.isConcessionnaire) {
    // Charger les agriculteurs du concessionnaire
    await loadAgriculteurs(authStore.user?.id || 0)
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

// Utilisation des fonctions centralisées pour charger les usines
async function loadAllUsines() {
  try {
    console.log('Chargement des usines...');
    usines.value = await authStore.fetchUsines() as unknown as Usine[];
    console.log('Usines chargées:', usines.value);
  } catch (error) {
    console.error('Erreur lors du chargement des usines:', error);
  }
}

// Utilisation des fonctions centralisées pour charger les concessionnaires par usine
async function loadConcessionnaires(usineId?: number) {
  try {
    console.log('Chargement des concessionnaires pour l\'usine:', usineId);
    // Utiliser fetchUsersByRole quand usineId est undefined
    if (usineId === undefined) {
      const result = await authStore.fetchUsersByRole({ role: 'CONCESSIONNAIRE' });
      concessionnaires.value = result as unknown as Concessionnaire[];
    } else {
      concessionnaires.value = await authStore.fetchUsineConcessionnaires(usineId) as unknown as Concessionnaire[];
    }
    console.log('Concessionnaires chargés:', concessionnaires.value);
  } catch (error) {
    console.error('Erreur lors du chargement des concessionnaires:', error);
  }
}

// Utilisation des fonctions centralisées pour charger les agriculteurs par concessionnaire
async function loadAgriculteurs(concessionnaireId: number) {
  try {
    console.log('Chargement des agriculteurs pour le concessionnaire:', concessionnaireId);
    const result = await fetchUsersByHierarchy({
      role: 'AGRICULTEUR',
      concessionnaireId
    });
    clients.value = result.map((agriculteur: any) => ({
      ...agriculteur,
      concessionnaire_id: concessionnaireId
    }));
    console.log('Agriculteurs chargés:', clients.value);
  } catch (error) {
    console.error('Erreur lors du chargement des agriculteurs:', error);
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
  console.log('\n[PlansView][editPlan] ====== DÉBUT ÉDITION PLAN ======');
  console.log('[PlansView][editPlan] Plan reçu:', {
    id: plan.id,
    nom: plan.nom,
    usine: plan.usine,
    concessionnaire: plan.concessionnaire,
    agriculteur: plan.agriculteur
  });

  try {
    console.log('[PlansView][editPlan] Définition du plan courant dans le store...');
    irrigationStore.setCurrentPlan(plan);
    
    console.log('[PlansView][editPlan] Sauvegarde de l\'ID dans localStorage:', plan.id);
    localStorage.setItem('lastPlanId', plan.id.toString());
    
    console.log('[PlansView][editPlan] Redirection vers la vue carte...');
    await router.push('/');
    
    console.log('[PlansView][editPlan] ====== FIN ÉDITION PLAN ======\n');
  } catch (error) {
    console.error('[PlansView][editPlan] ERREUR:', error);
    if (error instanceof Error) {
      console.error('[PlansView][editPlan] Stack trace:', error.stack);
    }
    alert('Une erreur est survenue lors du chargement du plan');
  }
}

async function deletePlan(plan: LocalPlan) {
  if (!plan?.id) return
  planToDelete.value = plan
  showDeleteModal.value = true
}

async function confirmDeletePlan() {
  if (!planToDelete.value?.id) return
  try {
    await irrigationStore.deletePlan(planToDelete.value.id)
    await loadPlans()
    // Si le plan supprimé était le plan courant, le nettoyer
    if (irrigationStore.currentPlan?.id === planToDelete.value.id) {
      irrigationStore.clearCurrentPlan()
    }
  } catch (error) {
    console.error('Erreur lors de la suppression du plan:', error)
    alert('Une erreur est survenue lors de la suppression du plan')
  } finally {
    showDeleteModal.value = false
    planToDelete.value = null
  }
}

function cancelDeletePlan() {
  showDeleteModal.value = false
  planToDelete.value = null
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

function getInitials(user: UserDetails | LocalUser | null): string {
  if (!user) return '';
  const firstName = user.first_name || '';
  const lastName = user.last_name || '';
  return (firstName.charAt(0) + lastName.charAt(0)).toUpperCase();
}

async function openEditPlanModal(plan: LocalPlan) {
  loading.value = true;
  error.value = null;
  
  try {
    // S'assurer que les données sont chargées
    if (authStore.isAdmin && (!usines.value.length)) {
      await loadAllUsines();
    }
    
    const usineId = typeof plan.usine === 'object' && plan.usine ? plan.usine.id : plan.usine;
    const concessionnaireId = typeof plan.concessionnaire === 'object' && plan.concessionnaire ? plan.concessionnaire.id : plan.concessionnaire;
    const agriculteurId = typeof plan.agriculteur === 'object' && plan.agriculteur ? plan.agriculteur.id : plan.agriculteur;
    
    editPlanData.value = {
      id: plan.id,
      nom: plan.nom,
      description: plan.description,
      usine: usineId || null,
      concessionnaire: concessionnaireId || null,
      agriculteur: agriculteurId || null
    };
    
    // Charger les concessionnaires de l'usine si nécessaire
    if (usineId) {
      await loadConcessionnaires(usineId);
    }
    
    // Charger les agriculteurs du concessionnaire si nécessaire
    if (concessionnaireId) {
      await loadAgriculteurs(concessionnaireId);
    }
    
    showEditPlanModal.value = true;
  } catch (err) {
    console.error('Erreur lors de l\'ouverture du modal:', err);
    error.value = 'Erreur lors du chargement des données';
  } finally {
    loading.value = false;
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
    // Validation de la logique hiérarchique
    if (editPlanData.value.agriculteur && !editPlanData.value.concessionnaire) {
      throw new Error('Un concessionnaire doit être sélectionné pour assigner un agriculteur')
    }
    if (editPlanData.value.concessionnaire && !editPlanData.value.usine) {
      throw new Error('Une usine doit être sélectionnée pour assigner un concessionnaire')
    }

    console.log('Données envoyées pour la mise à jour:', {
      id: editPlanData.value.id,
      nom: editPlanData.value.nom.trim(),
      description: editPlanData.value.description.trim(),
      usine_id: editPlanData.value.usine,
      concessionnaire_id: editPlanData.value.concessionnaire,
      agriculteur_id: editPlanData.value.agriculteur
    });

    const response = await irrigationStore.updatePlanDetails(editPlanData.value.id, {
      nom: editPlanData.value.nom.trim(),
      description: editPlanData.value.description.trim(),
      usine_id: editPlanData.value.usine,
      concessionnaire_id: editPlanData.value.concessionnaire,
      agriculteur_id: editPlanData.value.agriculteur
    });

    console.log('Réponse de la mise à jour:', response);

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

// Watchers pour gérer les dépendances et le rechargement des données
watch(() => selectedUsine.value, async (newUsineId) => {
  selectedConcessionnaire.value = null;
  selectedClient.value = null;
  
  if (newUsineId) {
    await loadConcessionnaires(newUsineId);
  } else {
    // Si aucune usine n'est sélectionnée, charger tous les concessionnaires
    await loadConcessionnaires();
  }
});

watch(() => selectedConcessionnaire.value, async (newConcessionnaireId) => {
  selectedClient.value = null;
  
  if (newConcessionnaireId) {
    await loadAgriculteurs(newConcessionnaireId);
  }
});

watch(() => editPlanData.value.usine, async (newUsineId) => {
  if (newUsineId === null) {
    editPlanData.value.concessionnaire = null;
    editPlanData.value.agriculteur = null;
  } else {
    // Charger les concessionnaires pour cette usine
    await loadConcessionnaires(newUsineId);
  }
});

watch(() => editPlanData.value.concessionnaire, async (newConcessionnaireId) => {
  editPlanData.value.agriculteur = null;
  
  if (newConcessionnaireId) {
    // Charger les agriculteurs pour ce concessionnaire
    await loadAgriculteurs(newConcessionnaireId);
  }
});

// Fonction pour déterminer si l'utilisateur peut supprimer un plan
function canDeletePlan(plan: LocalPlan): boolean {
  const user = authStore.user
  if (!user) return false
  
  if (user.user_type === 'admin') return true
  
  if (user.user_type === 'usine') {
    if (typeof plan.usine === 'object') {
      return plan.usine?.id === user.id;
    }
    return plan.usine === user.id;
  }
  
  if (user.user_type === 'concessionnaire') {
    if (typeof plan.concessionnaire === 'object') {
      return plan.concessionnaire?.id === user.id;
    }
    return plan.concessionnaire === user.id;
  }
  
  const isCreator = plan.createur.id === user.id;
  let isAgriculteur = false;
  
  if (typeof plan.agriculteur === 'object') {
    isAgriculteur = plan.agriculteur?.id === user.id;
  } else {
    isAgriculteur = plan.agriculteur === user.id;
  }
  
  return isAgriculteur || isCreator;
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

// Fonction pour formater l'affichage des utilisateurs
function formatUserDisplay(user: any): string {
  if (!user) return '';
  return formatUserName(user);
}
</script> 