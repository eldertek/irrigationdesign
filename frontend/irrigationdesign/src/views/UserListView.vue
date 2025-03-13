<template>
  <div class="h-full bg-gray-50">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div class="flex justify-between items-center mb-8">
        <h1 class="text-3xl font-extrabold text-gray-900">
          <span v-if="isAdmin">Gestion des utilisateurs</span>
          <span v-else-if="isUsine">Gestion des concessionnaires et agriculteurs</span>
          <span v-else-if="isConcessionnaire">Gestion des agriculteurs</span>
        </h1>
        <button
          @click="openCreateUserModal"
          class="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
        >
          <svg class="-ml-1 mr-2 h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
            <path fill-rule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clip-rule="evenodd" />
          </svg>
          <span v-if="isAdmin">Nouvel utilisateur</span>
          <span v-else-if="isUsine">Nouveau concessionnaire/agriculteur</span>
          <span v-else-if="isConcessionnaire">Nouvel agriculteur</span>
        </button>
      </div>
      <!-- Filtres -->
      <div class="bg-white shadow rounded-lg mb-6 p-4">
        <div class="space-y-4">
          <!-- Première ligne : Rôle, Usine, Concessionnaire -->
          <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
            <!-- Filtre de rôle uniquement pour les admins et usines -->
            <div v-if="isAdmin || isUsine">
              <label for="role-filter" class="block text-sm font-medium text-gray-700">Rôle</label>
              <select
                id="role-filter"
                v-model="filters.role"
                class="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm rounded-md"
              >
                <option value="">Tous les rôles</option>
                <option value="ADMIN" v-if="isAdmin">Administrateur</option>
                <option value="USINE" v-if="isAdmin">Usine</option>
                <option value="CONCESSIONNAIRE">Concessionnaire</option>
                <option value="AGRICULTEUR">Agriculteur</option>
              </select>
            </div>
            <!-- Filtre d'usine uniquement pour les admins -->
            <div v-if="isAdmin">
              <label for="usine-filter" class="block text-sm font-medium text-gray-700">Usine</label>
              <select
                id="usine-filter"
                v-model="filters.usine"
                class="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm rounded-md"
              >
                <option value="">Toutes les usines</option>
                <option v-for="usine in usines" :key="usine.id" :value="usine.id">
                  {{ formatUserName(usine) }}
                </option>
              </select>
            </div>
            <!-- Filtre de concessionnaire uniquement pour les admins et usines -->
            <div v-if="isAdmin || isUsine">
              <label for="concessionnaire-filter" class="block text-sm font-medium text-gray-700">Concessionnaire</label>
              <select
                id="concessionnaire-filter"
                v-model="filters.concessionnaire"
                class="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm rounded-md"
              >
                <option value="">Tous les concessionnaires</option>
                <option v-for="concessionnaire in availableConcessionnaires" :key="concessionnaire.id" :value="concessionnaire.id">
                  {{ formatUserName(concessionnaire) }}
                </option>
              </select>
            </div>
          </div>
          <!-- Deuxième ligne : Recherche -->
          <div class="w-full">
            <label for="search" class="block text-sm font-medium text-gray-700">Recherche</label>
            <input
              type="text"
              id="search"
              v-model="filters.search"
              placeholder="Rechercher par nom, email, entreprise..."
              class="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
            />
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
                  Utilisateur
                </th>
                <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Rôle
                </th>
                <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Email
                </th>
                <th v-if="isAdmin || isUsine" scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Usine
                </th>
                <th v-if="isAdmin || isUsine" scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
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
              <tr v-if="loading" class="animate-pulse">
                <td colspan="7" class="py-4 px-6">
                  <div class="h-4 bg-gray-200 rounded w-3/4"></div>
                </td>
              </tr>
              <tr v-else-if="filteredUsers.length === 0">
                <td colspan="7" class="py-4 px-6 text-center text-gray-500">
                  Aucun utilisateur trouvé
                </td>
              </tr>
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
                        {{ formatUserName(user) }}
                      </div>
                      <div class="text-sm text-gray-500">{{ user.username }}</div>
                    </div>
                  </div>
                </td>
                <td class="px-6 py-4 whitespace-nowrap">
                  <span :class="getRoleBadgeClass()">
                    {{ getRoleLabel(user.role) }}
                  </span>
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {{ user.email }}
                </td>
                <td v-if="isAdmin || isUsine" class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  <template v-if="user.role === 'USINE'">
                    -
                  </template>
                  <template v-else-if="user.role === 'CONCESSIONNAIRE'">
                    {{ user.usine ? formatUserName(user.usine) : 'Non assigné' }}
                  </template>
                  <template v-else-if="user.role === 'AGRICULTEUR'">
                    {{ user.concessionnaire?.usine ? formatUserName(user.concessionnaire.usine) : 'Non assigné' }}
                  </template>
                  <template v-else>
                    -
                  </template>
                </td>
                <td v-if="isAdmin || isUsine" class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  <template v-if="user.role === 'USINE' || user.role === 'ADMIN'">
                    -
                  </template>
                  <template v-else-if="user.role === 'CONCESSIONNAIRE'">
                    -
                  </template>
                  <template v-else>
                    {{ user.concessionnaire ? formatUserName(user.concessionnaire) : 'Non assigné' }}
                  </template>
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
      :concessionnaires="concessionnaires"
      :usines="usines"
      :is-admin="isAdmin"
      :is-usine="isUsine"
      :current-concessionnaire="isConcessionnaire ? authStore.user?.id?.toString() : undefined"
      :current-usine="isUsine ? authStore.user?.id?.toString() : undefined"
      :api-errors="apiErrors"
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
import { useAuthStore, formatUserName, getInitials, getRoleBadgeClass, getRoleLabel, getStatusBadgeClass } from '@/stores/auth'
import { fetchUsersByHierarchy, formatApiErrors } from '@/services/api'
import { useNotificationStore } from '@/stores/notification'
import UserFormModal from '@/components/UserFormModal.vue'
import ConfirmationModal from '@/components/ConfirmationModal.vue'

const authStore = useAuthStore()
const notificationStore = useNotificationStore()

interface User {
  id: number;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  role: string;
  concessionnaire_id?: number;
  company_name?: string;
  is_active: boolean;
  usine?: {
    id: number;
    username: string;
    first_name: string;
    last_name: string;
    company_name?: string;
    role: string;
    display_name: string;
  };
  concessionnaire?: {
    id: number;
    username: string;
    first_name: string;
    last_name: string;
    company_name?: string;
    role: string;
    display_name: string;
    usine?: {
      id: number;
      username: string;
      first_name: string;
      last_name: string;
      company_name?: string;
      role: string;
      display_name: string;
    };
  };
}

interface UserReference {
  id: number;
  first_name: string;
  last_name: string;
  company_name?: string;
  username: string;
  role: string;
  display_name?: string;
}

const users = ref<User[]>([])
const concessionnaires = ref<UserReference[]>([])
const usines = ref<UserReference[]>([])
const showUserModal = ref(false)
const showDeleteModal = ref(false)
const selectedUser = ref<User | null>(null)
const userToDelete = ref<User | null>(null)
const loading = ref(true)
const apiErrors = ref<{field: string, message: string}[]>([])

const filters = reactive({
  role: '',
  search: '',
  concessionnaire: '',
  usine: ''
})

const isAdmin = computed(() => authStore.isAdmin)
const isUsine = computed(() => authStore.isUsine)
const isConcessionnaire = computed(() => authStore.isConcessionnaire)

const availableConcessionnaires = computed(() => {
  if (isAdmin.value) {
    return users.value.filter(user => user.role === 'CONCESSIONNAIRE')
  } else if (isUsine.value) {
    // Pour une usine, uniquement ses propres concessionnaires
    return users.value.filter(user => 
      user.role === 'CONCESSIONNAIRE' && 
      user.usine?.id === authStore.user?.id
    )
  }
  return []
})

// Filtrage des utilisateurs adapté au rôle
const filteredUsers = computed(() => {
  let filtered = users.value
  
  // Si c'est une usine, ne montrer que ses concessionnaires et les agriculteurs associés
  if (isUsine.value) {
    filtered = filtered.filter(user => {
      if (user.role === 'CONCESSIONNAIRE') {
        return user.usine?.id === authStore.user?.id
      } else if (user.role === 'AGRICULTEUR') {
        return user.concessionnaire?.usine?.id === authStore.user?.id
      }
      return false
    })
  }
  
  // Si c'est un concessionnaire, ne montrer que ses agriculteurs
  if (isConcessionnaire.value) {
    filtered = filtered.filter(user => 
      user.role === 'AGRICULTEUR' && 
      (user.concessionnaire_id === authStore.user?.id || 
       (user.concessionnaire && user.concessionnaire.id === authStore.user?.id))
    )
  }
  
  // Pour les admins et usines, appliquer les filtres
  if (isAdmin.value || isUsine.value) {
    if (filters.role) {
      filtered = filtered.filter(user => user.role === filters.role)
    }
    
    if (filters.concessionnaire) {
      filtered = filtered.filter(user => {
        const concessionnaireId = user.concessionnaire?.id || user.concessionnaire_id;
        return concessionnaireId?.toString() === filters.concessionnaire.toString()
      })
    }
    
    if (filters.usine && isAdmin.value) {
      filtered = filtered.filter(user => {
        if (user.role === 'CONCESSIONNAIRE') {
          return user.usine?.id?.toString() === filters.usine.toString()
        } else if (user.role === 'AGRICULTEUR') {
          return user.concessionnaire?.usine?.id?.toString() === filters.usine.toString()
        }
        return false
      })
    }
  }
  
  // Filtre de recherche commun
  if (filters.search) {
    const search = filters.search.toLowerCase()
    filtered = filtered.filter(user => 
      user.username?.toLowerCase().includes(search) ||
      user.email?.toLowerCase().includes(search) ||
      user.first_name?.toLowerCase().includes(search) ||
      user.last_name?.toLowerCase().includes(search) ||
      (user.company_name && user.company_name.toLowerCase().includes(search))
    )
  }
  
  return filtered
})

// Chargement initial des données
onMounted(async () => {
  await fetchUsers()
  await fetchDependencies()
})

// Récupération des utilisateurs en utilisant la fonction centralisée
async function fetchUsers() {
  loading.value = true
  try {
    if (isAdmin.value) {
      users.value = await authStore.fetchUsers()
    } else if (isUsine.value) {
      // Pour une usine, récupérer ses concessionnaires et tous les agriculteurs liés
      const [concessionnairesResult, agriculteursResult] = await Promise.all([
        fetchUsersByHierarchy({
          role: 'CONCESSIONNAIRE',
          usineId: authStore.user?.id
        }),
        fetchUsersByHierarchy({
          role: 'AGRICULTEUR',
          usineId: authStore.user?.id
        })
      ])
      users.value = [...concessionnairesResult, ...agriculteursResult]
    } else if (isConcessionnaire.value) {
      // Pour un concessionnaire, récupérer seulement ses agriculteurs
      users.value = await fetchUsersByHierarchy({
        role: 'AGRICULTEUR',
        concessionnaireId: authStore.user?.id,
        includeDetails: true
      })
      console.log('Agriculteurs récupérés:', users.value)
    }
  } catch (error) {
    console.error('Erreur lors de la récupération des utilisateurs:', error)
    notificationStore.error('Erreur lors de la récupération des utilisateurs')
  } finally {
    loading.value = false
  }
}

// Récupération des données dépendantes
async function fetchDependencies() {
  try {
    if (isAdmin.value) {
      await Promise.all([
        fetchAllConcessionnaires(),
        fetchAllUsines()
      ])
    } else if (isUsine.value) {
      await fetchUsineConcessionnaires()
    }
  } catch (error) {
    console.error('Erreur lors de la récupération des dépendances:', error)
  }
}

// Récupération des concessionnaires selon le rôle
async function fetchAllConcessionnaires() {
  try {
    if (isAdmin.value) {
      concessionnaires.value = await authStore.fetchUsersByRole({ role: 'CONCESSIONNAIRE' })
    } else if (isUsine.value) {
      concessionnaires.value = await authStore.fetchUsineConcessionnaires(authStore.user?.id!)
    }
  } catch (error) {
    console.error('Erreur lors de la récupération des concessionnaires:', error)
  }
}

// Récupération spécifique des concessionnaires d'une usine
async function fetchUsineConcessionnaires() {
  if (!isUsine.value || !authStore.user?.id) return
  
  try {
    concessionnaires.value = await authStore.fetchUsineConcessionnaires(authStore.user?.id)
  } catch (error) {
    console.error('Erreur lors de la récupération des concessionnaires de l\'usine:', error)
  }
}

// Récupération des usines
async function fetchAllUsines() {
  try {
    usines.value = await authStore.fetchUsines()
  } catch (error) {
    console.error('Erreur lors de la récupération des usines:', error)
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
  apiErrors.value = []
}

// Création ou mise à jour d'un utilisateur
async function saveUser(userData: any) {
  // Réinitialiser les erreurs d'API
  apiErrors.value = []
  
  const isUpdate = Boolean(userData.id)
  try {
    // Mise à jour de la logique pour gérer correctement les relations
    const payload = { ...userData }

    // Logique différente selon le rôle actuel
    if (isAdmin.value) {
      // Admin peut créer tous types d'utilisateurs
      if (payload.usine && typeof payload.usine === 'object') {
        payload.usine_id = payload.usine.id
      } else if (typeof payload.usine === 'number') {
        payload.usine_id = payload.usine
      }

      if (payload.concessionnaire && typeof payload.concessionnaire === 'object') {
        payload.concessionnaire_id = payload.concessionnaire.id
      } else if (typeof payload.concessionnaire === 'number') {
        payload.concessionnaire_id = payload.concessionnaire
      }
    } else if (isUsine.value) {
      // Usine peut créer des concessionnaires ou agriculteurs
      payload.usine_id = authStore.user?.id
      if (payload.role === 'AGRICULTEUR') {
        if (payload.concessionnaire && typeof payload.concessionnaire === 'object') {
          payload.concessionnaire_id = payload.concessionnaire.id
        } else if (typeof payload.concessionnaire === 'number') {
          payload.concessionnaire_id = payload.concessionnaire
        }
      }
    } else if (isConcessionnaire.value) {
      // Si un concessionnaire crée un utilisateur, c'est forcément un agriculteur
      payload.role = 'AGRICULTEUR'
      payload.concessionnaire_id = authStore.user?.id
    }

    // Gérer les relations
    if (payload.role === 'CONCESSIONNAIRE') {
      // S'assurer que l'usine est correctement définie
      if (payload.usine?.id) {
        payload.usine_id = payload.usine.id
        delete payload.usine
      } else if (typeof payload.usine === 'number') {
        payload.usine_id = payload.usine
        delete payload.usine
      }
      delete payload.concessionnaire
    } else if (payload.role === 'AGRICULTEUR') {
      // S'assurer que le concessionnaire est correctement défini
      if (payload.concessionnaire?.id) {
        payload.concessionnaire_id = payload.concessionnaire.id
        delete payload.concessionnaire
      } else if (typeof payload.concessionnaire === 'number') {
        payload.concessionnaire_id = payload.concessionnaire
        delete payload.concessionnaire
      }
      delete payload.usine
      delete payload.usine_id
    }

    if (isUpdate) {
      await authStore.updateUser(userData.id, payload)
      notificationStore.success('Utilisateur modifié avec succès')
    } else {
      await authStore.createUser(payload)
      notificationStore.success('Utilisateur créé avec succès')
    }

    // Recharger les données après une modification
    await Promise.all([
      fetchUsers(),
      fetchDependencies()
    ])
    
    closeUserModal()
  } catch (error: any) {
    console.error('Error saving user:', error.response?.data || error)
    
    // Formater et stocker les erreurs d'API pour le modal
    apiErrors.value = formatApiErrors(error)
    
    // Afficher également une notification d'erreur
    notificationStore.error('Erreur lors de la sauvegarde de l\'utilisateur')
    
    // Générer un message d'erreur pour l'exception
    const errorData = error.response?.data || {}
    let errorMessage = ''
    if (typeof errorData === 'object') {
      errorMessage = Object.entries(errorData)
        .map(([field, messages]: [string, any]) => {
          if (Array.isArray(messages)) {
            return `${field}: ${messages[0]}`
          }
          return `${field}: ${messages}`
        })
        .filter(message => message)
        .join('\n')
    }
    if (!errorMessage) {
      errorMessage = 'Une erreur est survenue lors de la sauvegarde'
    }
    throw new Error(errorMessage)
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
    await authStore.deleteUser(userToDelete.value.id)
    notificationStore.success('Utilisateur supprimé avec succès')
    
    // Recharger les données après une suppression
    await Promise.all([
      fetchUsers(),
      fetchDependencies()
    ])
    
    showDeleteModal.value = false
    userToDelete.value = null
  } catch (error) {
    console.error('Erreur lors de la suppression de l\'utilisateur:', error)
    notificationStore.error('Erreur lors de la suppression de l\'utilisateur')
    throw error
  }
}

// Vérification des permissions
function canDeleteUser(user: User): boolean {
  // Un admin peut tout supprimer
  if (isAdmin.value) return true;

  // Une usine peut supprimer ses concessionnaires et leurs agriculteurs
  if (isUsine.value) {
    if (user.role === 'CONCESSIONNAIRE') {
      return user.usine?.id === authStore.user?.id;
    }
    if (user.role === 'AGRICULTEUR') {
      return user.concessionnaire?.usine?.id === authStore.user?.id;
    }
    return false;
  }

  // Un concessionnaire peut supprimer ses agriculteurs
  if (isConcessionnaire.value) {
    return user.role === 'AGRICULTEUR' && 
           (user.concessionnaire_id === authStore.user?.id || 
            user.concessionnaire?.id === authStore.user?.id);
  }

  return false;
}
</script> 