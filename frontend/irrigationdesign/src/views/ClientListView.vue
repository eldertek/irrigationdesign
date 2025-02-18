<template>
  <div class="container mx-auto px-4 py-8">
    <div class="sm:flex sm:items-center">
      <div class="sm:flex-auto">
        <h1 class="text-2xl font-semibold text-gray-900">Clients</h1>
        <p class="mt-2 text-sm text-gray-700">
          Liste de vos clients et leurs projets associés
        </p>
      </div>
      <div class="mt-4 sm:mt-0 sm:ml-16 sm:flex-none">
        <button
          @click="showAddClientModal = true"
          class="inline-flex items-center justify-center rounded-md border border-transparent bg-primary-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 sm:w-auto"
        >
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
                  <th
                    scope="col"
                    class="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-gray-900 sm:pl-6"
                  >
                    Nom
                  </th>
                  <th
                    scope="col"
                    class="px-3 py-3.5 text-left text-sm font-semibold text-gray-900"
                  >
                    Email
                  </th>
                  <th
                    scope="col"
                    class="px-3 py-3.5 text-left text-sm font-semibold text-gray-900"
                  >
                    Nombre de projets
                  </th>
                  <th
                    scope="col"
                    class="px-3 py-3.5 text-left text-sm font-semibold text-gray-900"
                  >
                    Dernier projet
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
                  <td class="whitespace-nowrap py-4 pl-4 pr-3 text-sm font-medium text-gray-900 sm:pl-6">
                    {{ client.first_name }} {{ client.last_name }}
                  </td>
                  <td class="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                    {{ client.email }}
                  </td>
                  <td class="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                    {{ client.projects_count }}
                  </td>
                  <td class="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                    {{ client.last_project_date ? formatDate(client.last_project_date) : '-' }}
                  </td>
                  <td class="relative whitespace-nowrap py-4 pl-3 pr-4 text-right text-sm font-medium sm:pr-6">
                    <button
                      @click="viewClientDetails(client)"
                      class="text-primary-600 hover:text-primary-900 mr-4"
                    >
                      Voir les détails
                    </button>
                    <button
                      @click="editClient(client)"
                      class="text-primary-600 hover:text-primary-900"
                    >
                      Modifier
                    </button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useAuthStore } from '@/stores/auth'
import axios from 'axios'

interface Client {
  id: number
  first_name: string
  last_name: string
  email: string
  projects_count: number
  last_project_date: string | null
}

const authStore = useAuthStore()
const clients = ref<Client[]>([])
const loading = ref(true)
const showAddClientModal = ref(false)

onMounted(async () => {
  await fetchClients()
})

async function fetchClients() {
  try {
    const response = await axios.get('/api/users/', {
      params: {
        dealer: authStore.user?.id,
        role: 'client'
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

function viewClientDetails(client: Client) {
  // TODO: Implémenter la vue détaillée du client
  console.log('View client details:', client)
}

function editClient(client: Client) {
  // TODO: Implémenter l'édition du client
  console.log('Edit client:', client)
}
</script> 