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
                    class="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
                  />
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
                  <div>
                    <label for="role" class="block text-sm font-medium text-gray-700">Rôle</label>
                    <select
                      id="role"
                      v-model="form.role"
                      required
                      :disabled="!canChangeRole"
                      class="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm rounded-md"
                    >
                      <option v-if="isAdmin" value="ADMIN">Admin</option>
                      <option value="CONCESSIONNAIRE">Concessionnaire</option>
                      <option value="CLIENT">Client</option>
                    </select>
                  </div>
                  <div v-if="showDealerSelect">
                    <label for="dealer" class="block text-sm font-medium text-gray-700">Concessionnaire</label>
                    <select
                      id="dealer"
                      v-model="form.dealer"
                      required
                      class="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm rounded-md"
                    >
                      <option value="">Sélectionner un concessionnaire</option>
                      <option v-for="dealer in dealers" :key="dealer.id" :value="dealer.id">
                        {{ dealer.company_name || dealer.full_name }}
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
import { ref, reactive, computed } from 'vue'
import { useAuthStore } from '@/stores/auth'

const props = defineProps({
  user: {
    type: Object,
    default: null
  },
  dealers: {
    type: Array,
    default: () => []
  }
})

const emit = defineEmits(['close', 'save'])
const authStore = useAuthStore()
const loading = ref(false)
const error = ref<string | null>(null)

const isAdmin = computed(() => authStore.isAdmin)
const isDealer = computed(() => authStore.isDealer)

const form = reactive({
  first_name: props.user?.first_name || '',
  last_name: props.user?.last_name || '',
  email: props.user?.email || '',
  username: props.user?.username || '',
  company_name: props.user?.company_name || '',
  role: props.user?.role || (isAdmin.value ? 'ADMIN' : 'CLIENT'),
  dealer: props.user?.dealer || '',
  password: '',
  password_confirm: ''
})

const showDealerSelect = computed(() => {
  return form.role === 'CLIENT' && (isAdmin.value || isDealer.value)
})

const canChangeRole = computed(() => {
  if (isAdmin.value) return true
  if (isDealer.value) return !props.user || props.user.role === 'CLIENT'
  return false
})

async function handleSubmit() {
  error.value = null
  loading.value = true

  try {
    // Validation du mot de passe pour un nouvel utilisateur
    if (!props.user) {
      if (form.password !== form.password_confirm) {
        throw new Error('Les mots de passe ne correspondent pas')
      }
      if (form.password.length < 8) {
        throw new Error('Le mot de passe doit contenir au moins 8 caractères')
      }
    }

    // Préparation des données
    const userData = {
      ...form,
      must_change_password: !props.user // Forcer le changement de mot de passe pour les nouveaux utilisateurs
    }

    // Si c'est une modification, on ajoute l'ID
    if (props.user) {
      userData.id = props.user.id
      // On ne modifie pas le mot de passe lors d'une modification
      delete userData.password
      delete userData.password_confirm
    }

    // Si c'est un concessionnaire qui crée un client
    if (isDealer.value && form.role === 'CLIENT') {
      userData.dealer = authStore.user?.id
    }

    await emit('save', userData)
  } catch (err: any) {
    error.value = err.response?.data?.detail || err.message || 'Une erreur est survenue'
  } finally {
    loading.value = false
  }
}
</script> 