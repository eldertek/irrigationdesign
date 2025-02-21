<template>
  <div class="container mx-auto px-4 py-8">
    <div class="sm:flex sm:items-center">
      <div class="sm:flex-auto">
        <h1 class="text-2xl font-semibold text-gray-900">Clients</h1>
        <p class="mt-2 text-sm text-gray-700">
          Liste de vos clients et leurs plans associés
        </p>
      </div>
      <div class="mt-4 sm:mt-0 sm:ml-16 sm:flex-none">
        <button
          @click="showAddClientModal = true"
          class="inline-flex items-center justify-center rounded-md border border-transparent bg-primary-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 sm:w-auto"
        >
          <svg class="-ml-1 mr-2 h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
            <path fill-rule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clip-rule="evenodd" />
          </svg>
          Ajouter un client
        </button>
      </div>
    </div>

    <!-- Liste des clients -->
    <div class="mt-8 flex flex-col">
      <div class="-mx-4 -my-2 overflow-x-auto sm:-mx-6 lg:-mx-8">
        <div class="inline-block min-w-full py-2 align-middle md:px-6 lg:px-8">
          <div class="overflow-hidden shadow ring-1 ring-black ring-opacity-5 md:rounded-lg">
            <table class="min-w-full divide-y divide-gray-300">
              <thead class="bg-gray-50">
                <tr>
                  <th scope="col" class="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-gray-900 sm:pl-6">
                    Client
                  </th>
                  <th scope="col" class="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
                    Email
                  </th>
                  <th scope="col" class="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
                    Entreprise
                  </th>
                  <th scope="col" class="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
                    Nombre de plans
                  </th>
                  <th scope="col" class="relative py-3.5 pl-3 pr-4 sm:pr-6">
                    <span class="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody class="divide-y divide-gray-200 bg-white">
                <tr v-if="loading" class="animate-pulse">
                  <td colspan="5" class="py-4 px-6">
                    <div class="h-4 bg-gray-200 rounded w-3/4"></div>
                  </td>
                </tr>
                <tr v-else-if="clients.length === 0">
                  <td colspan="5" class="py-4 px-6 text-center text-gray-500">
                    Aucun client trouvé
                  </td>
                </tr>
                <tr v-for="client in clients" :key="client.id" class="hover:bg-gray-50">
                  <td class="whitespace-nowrap py-4 pl-4 pr-3 text-sm sm:pl-6">
                    <div class="flex items-center">
                      <div class="h-10 w-10 flex-shrink-0">
                        <div class="h-10 w-10 rounded-full bg-primary-100 flex items-center justify-center">
                          <span class="text-primary-600 font-medium">
                            {{ getInitials(client.first_name, client.last_name) }}
                          </span>
                        </div>
                      </div>
                      <div class="ml-4">
                        <div class="font-medium text-gray-900">
                          {{ client.first_name }} {{ client.last_name.toUpperCase() }}
                        </div>
                        <div class="text-gray-500">{{ client.username }}</div>
                      </div>
                    </div>
                  </td>
                  <td class="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                    {{ client.email }}
                  </td>
                  <td class="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                    {{ client.company_name || '-' }}
                  </td>
                  <td class="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                    <div class="flex items-center">
                      <span class="font-medium">{{ client.plans_count || 0 }}</span>
                      <span class="text-gray-400 ml-1">plan{{ (client.plans_count || 0) > 1 ? 's' : '' }}</span>
                    </div>
                  </td>
                  <td class="relative whitespace-nowrap py-4 pl-3 pr-4 text-right text-sm font-medium sm:pr-6">
                    <button
                      @click="editClient(client)"
                      class="text-primary-600 hover:text-primary-900 mr-4"
                    >
                      Modifier
                    </button>
                    <button
                      @click="deleteClient(client)"
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
    </div>

    <!-- Modal création/édition client -->
    <UserFormModal
      v-if="showAddClientModal"
      :user="selectedClient || {}"
      :dealers="[authStore.user]"
      :is-admin="false"
      :current-dealer="authStore.user?.id?.toString()"
      @close="closeClientModal"
      @save="saveClient"
    />

    <!-- Modal de confirmation de suppression -->
    <ConfirmationModal
      v-if="showDeleteModal"
      :title="'Supprimer le client'"
      :message="'Êtes-vous sûr de vouloir supprimer ce client ? Cette action est irréversible.'"
      @confirm="confirmDelete"
      @cancel="showDeleteModal = false"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { useRouter } from 'vue-router'
import api from '@/services/api'
import UserFormModal from '@/components/UserFormModal.vue'
import ConfirmationModal from '@/components/ConfirmationModal.vue'

interface Client {
  id: number
  first_name: string
  last_name: string
  email: string
  username: string
  company_name: string
  plans_count: number
  last_plan_date: string | null
  last_plan_id?: number
}

const router = useRouter()
const authStore = useAuthStore()
const clients = ref<Client[]>([])
const loading = ref(true)
const showAddClientModal = ref(false)
const showDeleteModal = ref(false)
const selectedClient = ref<Client | null>(null)
const clientToDelete = ref<Client | null>(null)

onMounted(async () => {
  await fetchClients()
})

async function fetchClients() {
  try {
    const response = await api.get('/users/', {
      params: {
        dealer: authStore.user?.id,
        role: 'UTILISATEUR',
        include_plans: true // Demander les informations sur les plans
      }
    })
    clients.value = response.data
  } catch (error) {
    console.error('Error fetching clients:', error)
  } finally {
    loading.value = false
  }
}

function formatDate(date: string) {
  return new Date(date).toLocaleDateString()
}

function getInitials(firstName: string, lastName: string): string {
  return `${firstName?.charAt(0) || ''}${lastName?.charAt(0) || ''}`.toUpperCase()
}

function editClient(client: Client) {
  selectedClient.value = client
  showAddClientModal.value = true
}

function closeClientModal() {
  showAddClientModal.value = false
  selectedClient.value = null
}

async function saveClient(userData: any) {
  try {
    const isUpdate = !!userData.id
    const endpoint = isUpdate ? `/users/${userData.id}/` : '/users/'
    const method = isUpdate ? 'patch' : 'post'

    // Ajouter automatiquement le concessionnaire et le rôle
    userData.role = 'UTILISATEUR'
    userData.concessionnaire = authStore.user?.id

    await api[method](endpoint, userData)
    await fetchClients()
    closeClientModal()
  } catch (error: any) {
    console.error('Erreur lors de la sauvegarde du client:', error)
    throw error
  }
}

function deleteClient(client: Client) {
  clientToDelete.value = client
  showDeleteModal.value = true
}

async function confirmDelete() {
  if (!clientToDelete.value) return

  try {
    await api.delete(`/users/${clientToDelete.value.id}/`)
    await fetchClients()
    showDeleteModal.value = false
    clientToDelete.value = null
  } catch (error) {
    console.error('Erreur lors de la suppression du client:', error)
    throw error
  }
}

function viewPlan(client: Client) {
  if (client.last_plan_id) {
    router.push(`/plans/${client.last_plan_id}`)
  }
}
</script> 