<template>
  <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
    <div class="sm:flex sm:items-center">
      <div class="sm:flex-auto">
        <h1 class="text-2xl font-semibold text-gray-900">Plans d'irrigation</h1>
        <p class="mt-2 text-sm text-gray-700">
          Gérez vos plans d'irrigation
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

    <!-- Mes plans -->
    <div class="mt-8">
      <div class="mb-4">
        <h2 class="text-lg font-medium text-gray-900">Mes plans</h2>
        <p class="mt-1 text-sm text-gray-500">
          Plans que vous avez créés
        </p>
      </div>
      <div class="-mx-4 -my-2 overflow-x-auto sm:-mx-6 lg:-mx-8">
        <div class="inline-block min-w-full py-2 align-middle">
          <div class="overflow-hidden shadow-sm ring-1 ring-black ring-opacity-5">
            <table class="min-w-full divide-y divide-gray-300">
              <thead class="bg-gray-50">
                <tr>
                  <th scope="col" class="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-gray-900 sm:pl-6 lg:pl-8">
                    Nom du plan
                  </th>
                  <th scope="col" class="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
                    Description
                  </th>
                  <th scope="col" class="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
                    Créé le
                  </th>
                  <th scope="col" class="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
                    Modifié le
                  </th>
                  <th scope="col" class="relative py-3.5 pl-3 pr-4 sm:pr-6 lg:pr-8">
                    <span class="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody class="divide-y divide-gray-200 bg-white">
                <tr v-if="myPlans.length === 0">
                  <td colspan="5" class="py-4 px-6 text-center text-gray-500">
                    Vous n'avez pas encore créé de plans
                  </td>
                </tr>
                <tr v-for="plan in myPlans" :key="plan.id" class="hover:bg-gray-50">
                  <td class="whitespace-nowrap py-4 pl-4 pr-3 text-sm font-medium text-gray-900 sm:pl-6 lg:pl-8">
                    {{ plan.nom }}
                  </td>
                  <td class="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                    {{ plan.description || '-' }}
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
                      class="text-primary-600 hover:text-primary-900 mr-4 inline-flex items-center"
                    >
                      <svg class="h-4 w-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                      </svg>
                      Modifier
                    </button>
                    <button
                      @click="deletePlan(plan)"
                      class="text-red-600 hover:text-red-900 inline-flex items-center"
                    >
                      <svg class="h-4 w-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                      Supprimer
                    </button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>

    <!-- Autres plans -->
    <div v-if="authStore.isAdmin || authStore.isDealer" class="mt-12">
      <div class="mb-4">
        <h2 class="text-lg font-medium text-gray-900">Plans des clients</h2>
        <p class="mt-1 text-sm text-gray-500">
          {{ authStore.isAdmin ? 'Tous les plans créés par les clients et les concessionnaires' : 'Plans de vos clients' }}
        </p>
      </div>
      <div class="-mx-4 -my-2 overflow-x-auto sm:-mx-6 lg:-mx-8">
        <div class="inline-block min-w-full py-2 align-middle">
          <div class="overflow-hidden shadow-sm ring-1 ring-black ring-opacity-5">
            <table class="min-w-full divide-y divide-gray-300">
              <thead class="bg-gray-50">
                <tr>
                  <th scope="col" class="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-gray-900 sm:pl-6 lg:pl-8">
                    Nom du plan
                  </th>
                  <th scope="col" class="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
                    Description
                  </th>
                  <th v-if="authStore.isAdmin || authStore.isDealer" scope="col" class="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
                    Client
                  </th>
                  <th v-if="authStore.isAdmin" scope="col" class="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
                    Concessionnaire
                  </th>
                  <th scope="col" class="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
                    Créé le
                  </th>
                  <th scope="col" class="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
                    Modifié le
                  </th>
                  <th scope="col" class="relative py-3.5 pl-3 pr-4 sm:pr-6 lg:pr-8">
                    <span class="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody class="divide-y divide-gray-200 bg-white">
                <tr v-if="otherPlans.length === 0">
                  <td :colspan="getColspan" class="py-4 px-6 text-center text-gray-500">
                    {{ authStore.isAdmin ? 'Aucun plan client disponible' : 'Aucun plan de vos clients disponible' }}
                  </td>
                </tr>
                <tr v-for="plan in otherPlans" :key="plan.id" class="hover:bg-gray-50">
                  <td class="whitespace-nowrap py-4 pl-4 pr-3 text-sm font-medium text-gray-900 sm:pl-6 lg:pl-8">
                    {{ plan.nom }}
                  </td>
                  <td class="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                    {{ plan.description || '-' }}
                  </td>
                  <td v-if="authStore.isAdmin || authStore.isDealer" class="px-3 py-4 text-sm text-gray-900">
                    <div class="flex items-center">
                      <div class="ml-3">
                        <div class="font-medium">{{ formatUserName(plan.createur) }}</div>
                        <div class="text-gray-500 text-xs">
                          {{ plan.createur.email }}
                          <span v-if="plan.createur.company_name" class="text-gray-400">
                            ({{ plan.createur.company_name }})
                          </span>
                        </div>
                      </div>
                    </div>
                  </td>
                  <td v-if="authStore.isAdmin" class="px-3 py-4 text-sm text-gray-900">
                    <div v-if="plan.concessionnaire" class="flex items-center">
                      <div class="ml-3">
                        <div class="font-medium">{{ formatUserName(plan.concessionnaire) }}</div>
                        <div class="text-gray-500 text-xs">
                          {{ plan.concessionnaire.email }}
                          <span v-if="plan.concessionnaire.company_name" class="text-gray-400">
                            ({{ plan.concessionnaire.company_name }})
                          </span>
                        </div>
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
                      class="text-primary-600 hover:text-primary-900 mr-4 inline-flex items-center"
                    >
                      <svg class="h-4 w-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                      </svg>
                      Modifier
                    </button>
                    <button
                      v-if="authStore.isAdmin"
                      @click="deletePlan(plan)"
                      class="text-red-600 hover:text-red-900 inline-flex items-center"
                    >
                      <svg class="h-4 w-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                      Supprimer
                    </button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>

    <!-- Modal nouveau plan -->
    <div
      v-if="showNewPlanModal"
      class="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center"
    >
      <div class="bg-white rounded-lg p-6 max-w-md w-full">
        <h2 class="text-lg font-medium mb-4">Nouveau plan</h2>
        <form @submit.prevent="createPlan">
          <div class="space-y-4">
            <div>
              <label for="name" class="block text-sm font-medium text-gray-700">
                Nom
              </label>
              <input
                type="text"
                id="name"
                v-model="newPlan.nom"
                class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
                required
              />
            </div>
            <div>
              <label for="description" class="block text-sm font-medium text-gray-700">
                Description
              </label>
              <textarea
                id="description"
                v-model="newPlan.description"
                rows="3"
                class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
              ></textarea>
            </div>
          </div>
          <div class="mt-5 sm:mt-6 sm:grid sm:grid-cols-2 sm:gap-3">
            <button
              type="button"
              class="mt-3 inline-flex w-full justify-center rounded-md border border-gray-300 bg-white px-4 py-2 text-base font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 sm:mt-0 sm:text-sm"
              @click="showNewPlanModal = false"
            >
              Annuler
            </button>
            <button
              type="submit"
              class="inline-flex w-full justify-center rounded-md border border-transparent bg-primary-600 px-4 py-2 text-base font-medium text-white shadow-sm hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 sm:text-sm"
            >
              Créer
            </button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useIrrigationStore } from '@/stores/irrigation'
import { useAuthStore } from '@/stores/auth'
import type { Plan, UserDetails } from '@/stores/irrigation'

const router = useRouter()
const irrigationStore = useIrrigationStore()
const authStore = useAuthStore()

const plans = ref<Plan[]>([])
const showNewPlanModal = ref(false)
const newPlan = ref({
  nom: '',
  description: ''
})

const myPlans = computed(() => {
  return plans.value.filter(plan => plan.createur.id === authStore.user?.id)
})

const otherPlans = computed(() => {
  return plans.value.filter(plan => plan.createur.id !== authStore.user?.id)
})

const getColspan = computed(() => {
  // Colonnes de base : nom, description, dates création/modification, actions
  let count = 5
  // Ajouter colonnes client/concessionnaire selon le rôle
  if (authStore.isAdmin) count += 2 // client + concessionnaire
  else if (authStore.isDealer) count += 1 // client seulement
  return count
})

onMounted(async () => {
  await loadPlans()
})

async function loadPlans() {
  try {
    const response = await irrigationStore.fetchPlansWithDetails()
    plans.value = response.data
  } catch (error) {
    console.error('Erreur lors du chargement des plans:', error)
  }
}

function openNewPlanModal() {
  showNewPlanModal.value = true
  newPlan.value = {
    nom: '',
    description: ''
  }
}

async function createPlan() {
  try {
    if (!newPlan.value.nom.trim()) {
      throw new Error('Le nom du plan est requis')
    }

    // Vérifier s'il y a un plan courant avec des changements non sauvegardés
    if (irrigationStore.currentPlan?.id && irrigationStore.hasUnsavedChanges) {
      if (confirm('Voulez-vous sauvegarder les modifications du plan actuel avant d\'en créer un nouveau ?')) {
        await irrigationStore.savePlan(irrigationStore.currentPlan.id)
      }
      irrigationStore.clearCurrentPlan()
    }

    // Créer le nouveau plan
    const newPlanData = await irrigationStore.createPlan({
      nom: newPlan.value.nom.trim(),
      description: newPlan.value.description.trim()
    })
    
    showNewPlanModal.value = false
    await loadPlans()

    // Définir le nouveau plan comme plan courant et rediriger vers l'éditeur
    irrigationStore.setCurrentPlan(newPlanData)
    router.push('/')
  } catch (error: any) {
    console.error('Erreur lors de la création du plan:', error)
    alert(error.message || 'Une erreur est survenue lors de la création du plan')
  }
}

async function editPlan(plan: Plan) {
  irrigationStore.setCurrentPlan(plan)
  router.push('/')
}

async function deletePlan(plan: Plan) {
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

function formatUserName(user: UserDetails): string {
  if (!user) return 'Non spécifié'
  return `${user.first_name} ${user.last_name.toUpperCase()}`
}
</script> 