<template>
  <div class="min-h-screen bg-gray-50 py-8">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div class="flex justify-between items-center mb-8">
        <h1 class="text-3xl font-extrabold text-gray-900">
          {{ isAdmin ? 'Gestion des Utilisateurs' : 'Mes Clients' }}
        </h1>
        <button
          @click="openCreateUserModal"
          class="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
        >
          <svg class="-ml-1 mr-2 h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
            <path fill-rule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clip-rule="evenodd" />
          </svg>
          {{ isAdmin ? 'Nouvel Utilisateur' : 'Nouveau Client' }}
        </button>
      </div>

      <!-- Filtres -->
      <div class="bg-white shadow rounded-lg mb-6 p-4">
        <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
          <!-- Filtre de rôle uniquement pour les admins -->
          <div v-if="isAdmin">
            <label for="role-filter" class="block text-sm font-medium text-gray-700">Rôle</label>
            <select
              id="role-filter"
              v-model="filters.role"
              class="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm rounded-md"
            >
              <option value="">Tous les rôles</option>
              <option value="ADMIN">Admin</option>
              <option value="CONCESSIONNAIRE">Concessionnaire</option>
              <option value="CLIENT">Client</option>
            </select>
          </div>
          <div>
            <label for="search" class="block text-sm font-medium text-gray-700">Recherche</label>
            <input
              type="text"
              id="search"
              v-model="filters.search"
              :placeholder="isAdmin ? 'Nom, email...' : 'Rechercher un client...'"
              class="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
            />
          </div>
          <!-- Filtre de concessionnaire uniquement pour les admins -->
          <div v-if="isAdmin">
            <label for="dealer-filter" class="block text-sm font-medium text-gray-700">Concessionnaire</label>
            <select
              id="dealer-filter"
              v-model="filters.dealer"
              class="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm rounded-md"
            >
              <option value="">Tous les concessionnaires</option>
              <option v-for="dealer in dealers" :key="dealer.id" :value="dealer.id">
                {{ dealer.company_name || dealer.full_name }}
              </option>
            </select>
          </div>
        </div>
      </div>

      <!-- Liste des utilisateurs -->
      <div class="bg-white shadow rounded-lg">
        <div class="overflow-x-auto">
          <table class="min-w-full divide-y divide-gray-200">
            <thead class="bg-gray-50">
              <tr>
                <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {{ isAdmin ? 'Utilisateur' : 'Client' }}
                </th>
                <th v-if="isAdmin" scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Rôle
                </th>
                <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Email
                </th>
                <th v-if="isAdmin" scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Concessionnaire
                </th>
                <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Statut
                </th>
                <th scope="col" class="relative px-6 py-3">
                  <span class="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody class="bg-white divide-y divide-gray-200">
              <tr v-for="user in filteredUsers" :key="user.id">
                <td class="px-6 py-4 whitespace-nowrap">
                  <div class="flex items-center">
                    <div class="flex-shrink-0 h-10 w-10">
                      <div class="h-10 w-10 rounded-full bg-primary-100 flex items-center justify-center">
                        <span class="text-primary-600 font-medium">
                          {{ getInitials(user.first_name, user.last_name) }}
                        </span>
                      </div>
                    </div>
                    <div class="ml-4">
                      <div class="text-sm font-medium text-gray-900">
                        {{ user.company_name || `${user.first_name} ${user.last_name}` }}
                      </div>
                      <div class="text-sm text-gray-500">
                        {{ user.username }}
                      </div>
                    </div>
                  </div>
                </td>
                <td class="px-6 py-4 whitespace-nowrap">
                  <span :class="getRoleBadgeClass(user.role)">
                    {{ getRoleLabel(user.role) }}
                  </span>
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {{ user.email }}
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {{ user.dealer_name || '-' }}
                </td>
                <td class="px-6 py-4 whitespace-nowrap">
                  <span :class="getStatusBadgeClass(user.is_active)">
                    {{ user.is_active ? 'Actif' : 'Inactif' }}
                  </span>
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                  <button
                    @click="editUser(user)"
                    class="text-primary-600 hover:text-primary-900 mr-4"
                  >
                    Modifier
                  </button>
                  <button
                    v-if="canDeleteUser(user)"
                    @click="confirmDeleteUser(user)"
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

    <!-- Modal de création/édition d'utilisateur -->
    <UserFormModal
      v-if="showUserModal"
      :user="selectedUser"
      :dealers="dealers"
      :is-admin="isAdmin"
      :current-dealer="authStore.user?.id?.toString()"
      @close="closeUserModal"
      @save="saveUser"
    />

    <!-- Modal de confirmation de suppression -->
    <ConfirmationModal
      v-if="showDeleteModal"
      :title="'Supprimer l\'utilisateur'"
      :message="'Êtes-vous sûr de vouloir supprimer cet utilisateur ? Cette action est irréversible.'"
      @confirm="deleteUser"
      @cancel="showDeleteModal = false"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue'
import { useAuthStore } from '@/stores/auth'
import UserFormModal from '@/components/UserFormModal.vue'
import ConfirmationModal from '@/components/ConfirmationModal.vue'
import api from '@/services/api'

const authStore = useAuthStore()

interface User {
  id: number;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  role: string;
  dealer?: number;
  dealer_name?: string;
  company_name?: string;
  is_active: boolean;
}

interface Dealer {
  id: number;
  company_name?: string;
  full_name?: string;
}

const users = ref<User[]>([])
const dealers = ref<Dealer[]>([])
const showUserModal = ref(false)
const showDeleteModal = ref(false)
const selectedUser = ref<User | null>(null)
const userToDelete = ref<User | null>(null)

const filters = reactive({
  role: '',
  search: '',
  dealer: ''
})

const isAdmin = computed(() => authStore.isAdmin)
const isDealer = computed(() => authStore.isDealer)

// Filtrage des utilisateurs adapté au rôle
const filteredUsers = computed(() => {
  console.log('Computing filtered users...')
  console.log('Current users:', users.value)
  console.log('Is admin:', isAdmin.value)
  console.log('Is dealer:', isDealer.value)
  console.log('Current filters:', filters)
  
  let filtered = users.value

  // Pour les concessionnaires, ne montrer que leurs clients
  if (isDealer.value) {
    console.log('Filtering for dealer:', authStore.user?.id)
    filtered = filtered.filter(user => 
      user.role === 'CLIENT' && user.dealer === authStore.user?.id
    )
    console.log('Filtered users for dealer:', filtered)
  }

  // Pour les admins, appliquer les filtres normalement
  if (isAdmin.value) {
    if (filters.role) {
      filtered = filtered.filter(user => user.role === filters.role)
      console.log('Filtered by role:', filtered)
    }

    if (filters.dealer) {
      filtered = filtered.filter(user => String(user.dealer) === String(filters.dealer))
      console.log('Filtered by dealer:', filtered)
    }
  }

  // Filtre de recherche commun
  if (filters.search) {
    const search = filters.search.toLowerCase()
    filtered = filtered.filter(user => 
      user.username.toLowerCase().includes(search) ||
      user.email.toLowerCase().includes(search) ||
      user.first_name.toLowerCase().includes(search) ||
      user.last_name.toLowerCase().includes(search) ||
      (user.company_name && user.company_name.toLowerCase().includes(search))
    )
    console.log('Filtered by search:', filtered)
  }

  console.log('Final filtered users:', filtered)
  return filtered
})

// Chargement initial des données
onMounted(async () => {
  await fetchUsers()
  if (isAdmin.value) {
    await fetchDealers()
  }
})

// Récupération des utilisateurs
async function fetchUsers() {
  try {
    console.log('Fetching users...')
    const response = await api.get('/users/')
    console.log('Users API response:', response.data)
    users.value = response.data
    console.log('Users after assignment:', users.value)
  } catch (error) {
    console.error('Erreur lors de la récupération des utilisateurs:', error)
  }
}

// Récupération des concessionnaires
async function fetchDealers() {
  try {
    const response = await api.get('/users/', {
      params: { role: 'CONCESSIONNAIRE' }
    })
    dealers.value = response.data
  } catch (error) {
    console.error('Erreur lors de la récupération des concessionnaires:', error)
  }
}

// Gestion des modals
function openCreateUserModal() {
  selectedUser.value = null
  showUserModal.value = true
}

function editUser(user: User) {
  selectedUser.value = { ...user }
  showUserModal.value = true
}

function closeUserModal() {
  showUserModal.value = false
  selectedUser.value = null
}

async function saveUser(userData: any) {
  try {
    // Si c'est un concessionnaire qui crée un client, on force l'attribution
    if (isDealer.value && !userData.id) {
      userData.role = 'CLIENT'
      userData.dealer = authStore.user?.id
    }

    if (userData.id) {
      await api.patch(`/users/${userData.id}/`, userData)
    } else {
      await api.post('/users/', userData)
    }
    await fetchUsers()
    closeUserModal()
  } catch (error) {
    console.error('Erreur lors de la sauvegarde de l\'utilisateur:', error)
    throw error
  }
}

// Suppression d'utilisateur
function confirmDeleteUser(user: User) {
  userToDelete.value = user
  showDeleteModal.value = true
}

async function deleteUser() {
  if (!userToDelete.value) return

  try {
    await api.delete(`/users/${userToDelete.value.id}/`)
    await fetchUsers()
    showDeleteModal.value = false
    userToDelete.value = null
  } catch (error) {
    console.error('Erreur lors de la suppression de l\'utilisateur:', error)
    throw error
  }
}

// Helpers
function getInitials(firstName: string, lastName: string): string {
  return `${firstName?.charAt(0) || ''}${lastName?.charAt(0) || ''}`.toUpperCase()
}

const roleLabels: Record<string, string> = {
  'ADMIN': 'Admin',
  'CONCESSIONNAIRE': 'Concessionnaire',
  'UTILISATEUR': 'Utilisateur',
  'CLIENT': 'Client'
}

function getRoleLabel(role: string): string {
  return roleLabels[role] || role
}

function getRoleBadgeClass(role: string): string {
  return 'px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-gray-100 text-gray-800'
}

function getStatusBadgeClass(isActive: boolean): string {
  return isActive
    ? 'px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800'
    : 'px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-red-100 text-red-800'
}

function canDeleteUser(user: User): boolean {
  if (isAdmin.value) return true
  if (isDealer.value) return user.role === 'CLIENT' && user.dealer === authStore.user?.id
  return false
}
</script> 