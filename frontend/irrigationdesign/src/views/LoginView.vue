<template>
  <div class="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
    <div class="sm:mx-auto sm:w-full sm:max-w-md">
      <h2 class="mt-6 text-center text-3xl font-extrabold text-gray-900">
        IrrigationDesign
      </h2>
      <p class="mt-2 text-center text-sm text-gray-600">
        Connectez-vous pour accéder à votre espace
      </p>
    </div>

    <div class="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
      <div class="bg-white py-8 px-4 shadow-sm rounded-lg sm:px-10">
        <form class="space-y-6" @submit.prevent="handleSubmit">
          <div v-if="error" class="rounded-md bg-red-50 p-4">
            <div class="flex">
              <div class="flex-shrink-0">
                <svg
                  class="h-5 w-5 text-red-400"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                >
                  <path
                    fill-rule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                    clip-rule="evenodd"
                  />
                </svg>
              </div>
              <div class="ml-3">
                <h3 class="text-sm font-medium text-red-800">
                  {{ error }}
                </h3>
              </div>
            </div>
          </div>

          <div>
            <label
              for="username"
              class="block text-sm font-medium text-gray-700"
            >
              Nom d'utilisateur
            </label>
            <div class="mt-1">
              <input
                id="username"
                v-model="form.username"
                name="username"
                type="text"
                required
                autocomplete="username"
                class="appearance-none block w-full h-11 px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
                aria-label="Nom d'utilisateur"
              />
            </div>
          </div>

          <div>
            <label
              for="password"
              class="block text-sm font-medium text-gray-700"
            >
              Mot de passe
            </label>
            <div class="mt-1">
              <input
                id="password"
                v-model="form.password"
                name="password"
                type="password"
                required
                autocomplete="current-password"
                class="appearance-none block w-full h-11 px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
                aria-label="Mot de passe"
              />
            </div>
          </div>

          <div class="flex items-center justify-between">
            <div class="flex items-center">
              <input
                id="remember-me"
                v-model="form.rememberMe"
                name="remember-me"
                type="checkbox"
                class="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                aria-label="Se souvenir de moi"
              />
              <label
                for="remember-me"
                class="ml-2 block text-sm text-gray-900"
              >
                Se souvenir de moi
              </label>
            </div>

            <div class="text-sm">
              <router-link
                to="/forgot-password"
                class="font-medium text-primary-600 hover:text-primary-500 transition-colors duration-200"
              >
                Mot de passe oublié ?
              </router-link>
            </div>
          </div>

          <div>
            <button
              type="submit"
              :disabled="loading"
              class="w-full h-11 flex justify-center items-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
              aria-label="Se connecter"
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
              {{ loading ? 'Connexion en cours...' : 'Se connecter' }}
            </button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const router = useRouter()
const authStore = useAuthStore()

const loading = ref(false)
const error = ref<string | null>(null)

const form = reactive({
  username: '',
  password: '',
  rememberMe: false
})

onMounted(() => {
  console.log('LoginView mounted')
  console.log('INITIAL_STATE:', window.INITIAL_STATE)
  // Vérifier si l'utilisateur est déjà authentifié
  if (window.INITIAL_STATE?.isAuthenticated) {
    console.log('User is authenticated, redirecting to home')
    router.push('/')
  }
})

async function handleSubmit() {
  console.log('Attempting login...')
  loading.value = true
  error.value = null

  try {
    await authStore.login(form.username, form.password)
    console.log('Login successful, checking user type...')
    
    // Redirection en fonction du type d'utilisateur
    if (authStore.user?.must_change_password) {
      console.log('User must change password, redirecting...')
      router.push('/change-password')
    } else if (authStore.isClient && !authStore.hasDealer) {
      console.log('Client without dealer, redirecting to dealer selection...')
      router.push('/select-dealer')
    } else {
      console.log('Normal login flow, redirecting to home...')
      router.push('/')
    }
  } catch (err: any) {
    console.error('Login error:', err)
    if (err.response?.status === 401) {
      error.value = 'Identifiants incorrects'
    } else if (err.response?.data?.detail) {
      error.value = err.response.data.detail
    } else {
      error.value = 'Une erreur est survenue lors de la connexion'
    }
  } finally {
    loading.value = false
  }
}
</script> 