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
              <!-- Message d'erreur global -->
              <div v-if="globalError" class="mb-4 rounded-md bg-red-50 p-4">
                <div class="flex">
                  <div class="flex-shrink-0">
                    <svg class="h-5 w-5 text-red-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                      <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd" />
                    </svg>
                  </div>
                  <div class="ml-3">
                    <h3 class="text-sm font-medium text-red-800">{{ globalError }}</h3>
                  </div>
                </div>
              </div>
              
              <form @submit.prevent="saveUser" class="space-y-6">
                <!-- Champ de type d'utilisateur (uniquement pour les admins) -->
                <div v-if="isAdmin">
                  <label for="role" class="block text-sm font-medium text-gray-700">Type d'utilisateur</label>
                  <select
                    id="role"
                    v-model="form.role"
                    class="mt-1 block w-full py-2 px-3 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
                    required
                  >
                    <option value="ADMIN">Administrateur</option>
                    <option value="USINE">Usine</option>
                    <option value="CONCESSIONNAIRE">Concessionnaire</option>
                    <option value="AGRICULTEUR">Agriculteur</option>
                  </select>
                </div>
                
                <!-- Sélection d'usine (uniquement pour les concessionnaires créés par un admin) -->
                <div v-if="isAdmin && form.role === 'CONCESSIONNAIRE'">
                  <label for="usine" class="block text-sm font-medium text-gray-700">Usine</label>
                  <select
                    id="usine"
                    v-model="form.usine"
                    class="mt-1 block w-full py-2 px-3 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
                  >
                    <option :value="null">-- Sélectionner une usine --</option>
                    <option v-for="usine in usines" :key="usine.id" :value="usine.id">
                      {{ usine.first_name }} {{ usine.last_name }} ({{ usine.company_name || 'Usine' }})
                    </option>
                  </select>
                </div>

                <!-- Champ de type d'utilisateur (pour les usines) -->
                <div v-if="isUsine && !form.id">
                  <label for="role" class="block text-sm font-medium text-gray-700">Type d'utilisateur</label>
                  <select
                    id="role"
                    v-model="form.role"
                    class="mt-1 block w-full py-2 px-3 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
                    required
                  >
                    <option value="CONCESSIONNAIRE">Concessionnaire</option>
                    <option value="AGRICULTEUR">Agriculteur</option>
                  </select>
                </div>
                
                <!-- Sélection de concessionnaire pour les agriculteurs (sauf si le créateur est un concessionnaire) -->
                <div v-if="(isAdmin || isUsine) && form.role === 'AGRICULTEUR' && !currentConcessionnaire">
                  <label for="concessionnaire" class="block text-sm font-medium text-gray-700">Concessionnaire</label>
                  <select
                    id="concessionnaire"
                    v-model="form.concessionnaire"
                    class="mt-1 block w-full py-2 px-3 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
                    required
                  >
                    <option :value="null">-- Sélectionner un concessionnaire --</option>
                    <option v-for="concessionnaire in concessionnaires" :key="concessionnaire.id" :value="concessionnaire.id">
                      {{ concessionnaire.first_name }} {{ concessionnaire.last_name }} ({{ concessionnaire.company_name || 'Concessionnaire' }})
                    </option>
                  </select>
                </div>
                
                <!-- Champs pour les informations générales de l'utilisateur -->
                <div class="grid grid-cols-1 gap-y-6 gap-x-4 sm:grid-cols-2">
                  <div>
                    <label for="first_name" class="block text-sm font-medium text-gray-700">Prénom</label>
                    <input
                      type="text"
                      id="first_name"
                      v-model="form.first_name"
                      class="mt-1 focus:ring-primary-500 focus:border-primary-500 block w-full shadow-sm sm:text-sm border-gray-300 rounded-md"
                    />
                  </div>
                  <div>
                    <label for="last_name" class="block text-sm font-medium text-gray-700">Nom</label>
                    <input
                      type="text"
                      id="last_name"
                      v-model="form.last_name"
                      class="mt-1 focus:ring-primary-500 focus:border-primary-500 block w-full shadow-sm sm:text-sm border-gray-300 rounded-md"
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
                    class="mt-1 focus:ring-primary-500 focus:border-primary-500 block w-full shadow-sm sm:text-sm border-gray-300 rounded-md"
                  />
                  <div v-if="emailError" class="mt-2 text-sm text-red-600">{{ emailError }}</div>
                </div>
                
                <div>
                  <label for="username" class="block text-sm font-medium text-gray-700">Nom d'utilisateur</label>
                  <input
                    type="text"
                    id="username"
                    v-model="form.username"
                    required
                    class="mt-1 focus:ring-primary-500 focus:border-primary-500 block w-full shadow-sm sm:text-sm border-gray-300 rounded-md"
                  />
                  <div v-if="usernameError" class="mt-2 text-sm text-red-600">{{ usernameError }}</div>
                </div>
                
                <div>
                  <label for="company_name" class="block text-sm font-medium text-gray-700">Entreprise</label>
                  <input
                    type="text"
                    id="company_name"
                    v-model="form.company_name"
                    class="mt-1 focus:ring-primary-500 focus:border-primary-500 block w-full shadow-sm sm:text-sm border-gray-300 rounded-md"
                  />
                </div>
                
                <div v-if="!form.id">
                      <label for="password" class="block text-sm font-medium text-gray-700">Mot de passe</label>
                      <input
                        type="password"
                        id="password"
                        v-model="form.password"
                        required
                        autocomplete="new-password"
                    class="mt-1 focus:ring-primary-500 focus:border-primary-500 block w-full shadow-sm sm:text-sm border-gray-300 rounded-md"
                      />
                    </div>
                
                <div v-if="!form.id">
                      <label for="password_confirm" class="block text-sm font-medium text-gray-700">Confirmer le mot de passe</label>
                      <input
                        type="password"
                        id="password_confirm"
                    v-model="passwordConfirm"
                        required
                        autocomplete="new-password"
                    class="mt-1 focus:ring-primary-500 focus:border-primary-500 block w-full shadow-sm sm:text-sm border-gray-300 rounded-md"
                  />
                  <div v-if="passwordError" class="mt-2 text-sm text-red-600">{{ passwordError }}</div>
                </div>
                
                <div class="flex justify-end space-x-3">
                  <button
                    type="button"
                    @click="$emit('close')"
                    class="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
                  >
                    Annuler
                  </button>
                  <button
                    type="submit"
                    :disabled="loading"
                    class="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
                  >
                    <span v-if="loading" class="mr-2">
                      <!-- Spinner -->
                      <svg class="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                    </span>
                    {{ form.id ? 'Enregistrer' : 'Créer' }}
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
import { ref, reactive, type PropType, watchEffect, onMounted } from 'vue'

// Types
interface User {
  id?: number
  first_name?: string
  last_name?: string
  username: string
  email: string
  password?: string
  company_name?: string
  role?: string
  concessionnaire?: number | UserReference | null
  concessionnaire_id?: number | null
  usine?: number | UserReference | null
  usine_id?: number | null
  is_active?: boolean
}

interface UserReference {
  id: number
  first_name: string
  last_name: string
  username: string
  company_name?: string
  role: string
}

// Props du composant
const props = defineProps({
  user: {
    type: Object as PropType<Partial<User> | null>,
    default: () => ({})
  },
  concessionnaires: {
    type: Array as PropType<UserReference[]>,
    default: () => []
  },
  usines: {
    type: Array as PropType<UserReference[]>,
    default: () => []
  },
  isAdmin: {
    type: Boolean,
    default: false
  },
  isUsine: {
    type: Boolean,
    default: false
  },
  currentConcessionnaire: {
    type: String,
    default: undefined
  },
  currentUsine: {
    type: String, 
    default: undefined
  },
  // Ajout d'une prop pour recevoir les erreurs API du parent
  apiErrors: {
    type: Array as PropType<{field: string, message: string}[]>,
    default: () => []
  },
  // Ajout d'une prop pour forcer le rafraîchissement des données
  refreshKey: {
    type: Number,
    default: 0
  }
})

// Emits
const emit = defineEmits(['close', 'save', 'refresh'])

// État du composant
const loading = ref(false)
const emailError = ref('')
const usernameError = ref('')
const passwordError = ref('')
const globalError = ref('')
const passwordConfirm = ref('')

// Formulaire
const form = reactive({
  id: undefined as number | undefined,
  first_name: '',
  last_name: '',
  username: '',
  email: '',
  password: '',
  company_name: '',
  role: props.isUsine ? 'CONCESSIONNAIRE' : (props.isAdmin ? 'ADMIN' : 'AGRICULTEUR'),
  concessionnaire: null as number | null,
  usine: null as number | null,
  is_active: true
})

// Initialiser le formulaire avec les valeurs de l'utilisateur existant
onMounted(() => {
  if (props.user?.id) {
    form.id = props.user.id
    form.first_name = props.user.first_name || ''
    form.last_name = props.user.last_name || ''
    form.username = props.user.username || ''
    form.email = props.user.email || ''
    form.company_name = props.user.company_name || ''
    form.role = props.user.role || 'AGRICULTEUR'
    form.is_active = props.user.is_active ?? true
    
    // Gérer les relations
    if (props.user.concessionnaire) {
      if (typeof props.user.concessionnaire === 'object') {
    form.concessionnaire = props.user.concessionnaire.id
      } else {
        form.concessionnaire = props.user.concessionnaire
      }
    } else if (props.user.concessionnaire_id) {
      form.concessionnaire = props.user.concessionnaire_id
    } else if (props.currentConcessionnaire) {
      form.concessionnaire = parseInt(props.currentConcessionnaire)
    }
    
    if (props.user.usine) {
      if (typeof props.user.usine === 'object') {
    form.usine = props.user.usine.id
      } else {
        form.usine = props.user.usine
      }
    } else if (props.user.usine_id) {
      form.usine = props.user.usine_id
    } else if (props.currentUsine) {
      form.usine = parseInt(props.currentUsine)
    }
  } else {
    // Pour un nouvel utilisateur, définir des valeurs par défaut
    if (props.currentConcessionnaire) {
      form.concessionnaire = parseInt(props.currentConcessionnaire)
    }
    if (props.currentUsine) {
      form.usine = parseInt(props.currentUsine)
    }
    // Si l'utilisateur est une usine, le rôle par défaut est concessionnaire
    if (props.isUsine) {
      form.role = 'CONCESSIONNAIRE'
    }
    // Si l'utilisateur est un concessionnaire, le rôle par défaut est agriculteur
    else if (!props.isAdmin) {
      form.role = 'AGRICULTEUR'
    }
  }
})

// Surveiller les changements de rôle pour réinitialiser les relations
watchEffect(() => {
  if (form.role === 'ADMIN' || form.role === 'USINE') {
    form.concessionnaire = null
    form.usine = null
  } else if (form.role === 'CONCESSIONNAIRE') {
    form.concessionnaire = null
    // Si l'utilisateur est une usine, définir automatiquement l'usine
    if (props.isUsine && props.currentUsine) {
      form.usine = parseInt(props.currentUsine)
    }
  }
})

// Observer les changements dans les erreurs API et les afficher
watchEffect(() => {
  // Réinitialiser les erreurs locales
  emailError.value = ''
  usernameError.value = ''
  passwordError.value = ''
  globalError.value = ''
  
  // Traiter les erreurs API reçues du parent
  if (props.apiErrors && props.apiErrors.length > 0) {
    props.apiErrors.forEach(err => {
      switch (err.field) {
        case 'email':
          emailError.value = err.message;
          break;
        case 'username':
          usernameError.value = err.message;
          break;
        case 'password':
          passwordError.value = err.message;
          break;
        case 'non_field_error':
        default:
          globalError.value = err.message;
          break;
      }
    });
  }
})

// Valider et envoyer le formulaire
async function saveUser() {
  // Réinitialiser les erreurs
  emailError.value = ''
  usernameError.value = ''
  passwordError.value = ''
  globalError.value = ''
  
  // Valider le formulaire
  let isValid = true
  
  // Valider les mots de passe pour un nouvel utilisateur
  if (!form.id) {
    if (form.password !== passwordConfirm.value) {
      passwordError.value = 'Les mots de passe ne correspondent pas'
      isValid = false
    } else if (form.password.length < 8) {
      passwordError.value = 'Le mot de passe doit contenir au moins 8 caractères'
      isValid = false
    }
  }
  
  if (!isValid) return
  
  loading.value = true
  
  try {
    // Préparer les données à envoyer
    const userData: Record<string, any> = { ...form }
    
    // Si c'est une mise à jour, ne pas envoyer le mot de passe
    if (form.id) {
      delete userData.password
    }
    
    // Si le rôle est défini par le contexte, s'assurer qu'il est correct
    if (props.isUsine && ['CONCESSIONNAIRE', 'AGRICULTEUR'].includes(form.role)) {
      userData.usine_id = props.currentUsine ? parseInt(props.currentUsine) : undefined
    }
    
    // Transformer concessionnaire en concessionnaire_id
    if (userData.concessionnaire) {
      userData.concessionnaire_id = userData.concessionnaire
      delete userData.concessionnaire
    }
    
    if (props.currentConcessionnaire && form.role === 'AGRICULTEUR') {
      userData.concessionnaire_id = parseInt(props.currentConcessionnaire)
    }
    
    await emit('save', userData)
    // Émettre un événement de rafraîchissement après la sauvegarde
    emit('refresh')
    
  } catch (error: any) {
    console.error('Erreur locale:', error);
  } finally {
    loading.value = false
  }
}
</script> 