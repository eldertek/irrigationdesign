<template>
  <div class="fixed inset-0 z-50 overflow-y-auto">
    <div class="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
      <div class="fixed inset-0 transition-opacity" aria-hidden="true">
        <div class="absolute inset-0 bg-gray-500 opacity-75"></div>
      </div>
      <span class="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>
      <div
        class="inline-block align-bottom bg-white rounded-lg px-4 pt-5 pb-4 text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full sm:p-6"
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-headline"
      >
        <div>
          <div class="mt-3 text-center sm:mt-0 sm:text-left">
            <h3 class="text-lg leading-6 font-medium text-gray-900" id="modal-headline">
              {{ user ? 'Modifier l\'utilisateur' : 'Nouvel utilisateur' }}
            </h3>
            <div class="mt-4">
              <form @submit.prevent="handleSubmit" class="space-y-4">
                <!-- Informations de base -->
                <div class="grid grid-cols-2 gap-4">
                  <div>
                    <label for="first_name" class="block text-sm font-medium text-gray-700">Prénom</label>
                    <input
                      type="text"
                      id="first_name"
                      v-model="form.first_name"
                      required
                      class="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
                    />
                  </div>
                  <div>
                    <label for="last_name" class="block text-sm font-medium text-gray-700">Nom</label>
                    <input
                      type="text"
                      id="last_name"
                      v-model="form.last_name"
                      required
                      class="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
                    />
                  </div>
                </div>
                <div>
                  <label for="email" class="block text-sm font-medium text-gray-700">Email</label>
                  <input
                    type="email"
                    id="email"
                    v-model="form.email"
                    required
                    class="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
                  />
                </div>
                <div>
                  <label for="username" class="block text-sm font-medium text-gray-700">Nom d'utilisateur</label>
                  <input
                    type="text"
                    id="username"
                    v-model="form.username"
                    required
                    :disabled="!!props.user"
                    :class="[
                      'mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500 sm:text-sm',
                      { 'bg-gray-100': !!props.user }
                    ]"
                  />
                  <p v-if="props.user" class="mt-1 text-sm text-gray-500">
                    Le nom d'utilisateur ne peut pas être modifié après la création.
                  </p>
                </div>
                <div>
                  <label for="company_name" class="block text-sm font-medium text-gray-700">Nom de l'entreprise</label>
                  <input
                    type="text"
                    id="company_name"
                    v-model="form.company_name"
                    class="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
                  />
                </div>
                <!-- Rôle et Concessionnaire -->
                <div class="grid grid-cols-2 gap-4">
                  <div v-if="props.isAdmin">
                    <label for="role" class="block text-sm font-medium text-gray-700">Rôle</label>
                    <select
                      id="role"
                      v-model="form.role"
                      required
                      :disabled="!canChangeRole"
                      class="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm rounded-md"
                    >
                      <option value="">Sélectionner un rôle</option>
                      <option v-for="role in availableRoles" :key="role.value" :value="role.value">
                        {{ role.label }}
                      </option>
                    </select>
                  </div>
                  <div v-if="showDealerSelect">
                    <label for="dealer" class="block text-sm font-medium text-gray-700">Concessionnaire</label>
                    <select
                      id="dealer"
                      v-model="form.dealer"
                      required
                      :disabled="!props.isAdmin"
                      class="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm rounded-md"
                    >
                      <option value="">Sélectionner un concessionnaire</option>
                      <option v-for="dealer in availableDealers" :key="dealer.id" :value="dealer.id">
                        {{ formatUserName(dealer) }}
                      </option>
                    </select>
                  </div>
                </div>
                <!-- Mot de passe -->
                <div v-if="!user">
                  <div class="grid grid-cols-2 gap-4">
                    <div>
                      <label for="password" class="block text-sm font-medium text-gray-700">Mot de passe</label>
                      <input
                        type="password"
                        id="password"
                        v-model="form.password"
                        required
                        autocomplete="new-password"
                        class="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
                      />
                    </div>
                    <div>
                      <label for="password_confirm" class="block text-sm font-medium text-gray-700">Confirmer le mot de passe</label>
                      <input
                        type="password"
                        id="password_confirm"
                        v-model="form.password_confirm"
                        required
                        autocomplete="new-password"
                        class="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
                      />
                    </div>
                  </div>
                  <p class="mt-1 text-sm text-gray-500">
                    L'utilisateur devra changer son mot de passe à sa première connexion.
                  </p>
                </div>
                <!-- Message d'erreur -->
                <div v-if="error" class="rounded-md bg-red-50 p-4">
                  <div class="flex">
                    <div class="flex-shrink-0">
                      <svg class="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                        <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd" />
                      </svg>
                    </div>
                    <div class="ml-3">
                      <h3 class="text-sm font-medium text-red-800">{{ error }}</h3>
                    </div>
                  </div>
                </div>
                <!-- Actions -->
                <div class="mt-5 sm:mt-6 sm:grid sm:grid-cols-2 sm:gap-3 sm:grid-flow-row-dense">
                  <button
                    type="submit"
                    :disabled="loading"
                    class="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-primary-600 text-base font-medium text-white hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 sm:col-start-2 sm:text-sm disabled:opacity-50 disabled:cursor-not-allowed"
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
                  <button
                    type="button"
                    class="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 sm:mt-0 sm:col-start-1 sm:text-sm"
                    @click="$emit('close')"
                  >
                    Annuler
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
<script setup lang="ts">
import { ref, reactive, computed, type PropType } from 'vue'
import { useAuthStore, formatUserName } from '@/stores/auth'
interface UserData {
  first_name: string
  last_name: string
  email: string
  username: string
  company_name: string
  role: string
  dealer?: string
  concessionnaire?: string
  password?: string
  password_confirm?: string
  id?: number
}
interface Dealer {
  id: number
  first_name: string
  last_name: string
  company_name?: string
  role: string
}
interface ApiError {
  response?: {
    data?: {
      username?: string[]
      email?: string[]
      password?: string[]
      concessionnaire?: string[]
      [key: string]: string[] | undefined
    }
  }
}
const props = defineProps({
  user: {
    type: Object as PropType<Record<string, any> | null>,
    default: null
  },
  dealers: {
    type: Array as PropType<Array<Dealer>>,
    default: () => []
  },
  isAdmin: {
    type: Boolean,
    required: true
  },
  currentDealer: {
    type: String,
    default: ''
  }
})
const emit = defineEmits(['close', 'save'])
const authStore = useAuthStore()
const loading = ref(false)
const error = ref<string | null>(null)
const canChangeRole = computed(() => {
  if (!props.isAdmin) return false
  if (props.user) {
    // Un admin ne peut pas changer son propre rôle
    return props.user.id !== authStore.user?.id
  }
  return true
})
const availableRoles = computed(() => {
  if (props.isAdmin) {
    return [
      { value: 'ADMIN', label: 'Administrateur' },
      { value: 'CONCESSIONNAIRE', label: 'Concessionnaire' },
      { value: 'UTILISATEUR', label: 'Client' }
    ]
  }
  return [
    { value: 'UTILISATEUR', label: 'Client' }
  ]
})
const showDealerSelect = computed(() => {
  if (!props.isAdmin) return true // Toujours afficher pour les concessionnaires
  return form.role === 'UTILISATEUR'
})
const availableDealers = computed(() => {
  return props.dealers.filter(dealer => dealer.role === 'CONCESSIONNAIRE')
})
const form = reactive<UserData>({
  first_name: props.user?.first_name || '',
  last_name: props.user?.last_name || '',
  email: props.user?.email || '',
  username: props.user?.username || '',
  company_name: props.user?.company_name || '',
  role: props.user?.role || (props.isAdmin ? '' : 'UTILISATEUR'),
  dealer: props.user?.concessionnaire || props.currentDealer,
  password: '',
  password_confirm: ''
})
const validateForm = () => {
  if (!form.first_name || !form.last_name) {
    error.value = 'Le prénom et le nom sont requis'
    return false
  }
  if (!form.email) {
    error.value = 'L\'email est requis'
    return false
  }
  if (!form.username) {
    error.value = 'Le nom d\'utilisateur est requis'
    return false
  }
  if (!props.user) {
    if (!form.password) {
      error.value = 'Le mot de passe est requis'
      return false
    }
    if (form.password !== form.password_confirm) {
      error.value = 'Les mots de passe ne correspondent pas'
      return false
    }
  }
  if (form.role === 'UTILISATEUR' && !form.dealer) {
    error.value = 'Un concessionnaire doit être sélectionné pour un client'
    return false
  }
  return true
}
const handleSubmit = async () => {
  error.value = null
  if (!validateForm()) return
  loading.value = true
  try {
    const userData = { ...form }
    // Ne pas envoyer le mot de passe si on modifie un utilisateur existant
    if (props.user?.id) {
      userData.id = props.user.id
      delete userData.password
      delete userData.password_confirm
    }
    // Conversion du dealer en concessionnaire uniquement pour les clients
    if (userData.role === 'UTILISATEUR' && userData.dealer) {
      userData.concessionnaire = userData.dealer
    }
    delete userData.dealer
    await emit('save', userData)
    emit('close')
  } catch (err: any) {
    console.error('Erreur formulaire:', err)
    error.value = err.message
    loading.value = false
  }
}
</script> 