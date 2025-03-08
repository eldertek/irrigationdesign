<template>
  <div class="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
    <div class="max-w-md w-full space-y-8">
      <div>
        <h2 class="mt-6 text-center text-3xl font-extrabold text-gray-900">
          Changement de mot de passe
        </h2>
        <p class="mt-2 text-center text-sm text-gray-600">
          Pour des raisons de sécurité, vous devez changer votre mot de passe.
        </p>
      </div>
      <form class="mt-8 space-y-6" @submit.prevent="handleSubmit">
        <div class="space-y-4">
          <div>
            <label for="old-password" class="block text-sm font-medium text-gray-700">Ancien mot de passe</label>
            <div class="mt-1">
              <input
                id="old-password"
                v-model="form.oldPassword"
                name="old-password"
                type="password"
                required
                autocomplete="current-password"
                class="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
                placeholder="Entrez votre mot de passe actuel"
              />
            </div>
          </div>
          <div>
            <label for="new-password" class="block text-sm font-medium text-gray-700">Nouveau mot de passe</label>
            <div class="mt-1">
              <input
                id="new-password"
                v-model="form.newPassword"
                name="new-password"
                type="password"
                required
                autocomplete="new-password"
                class="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
                placeholder="Entrez votre nouveau mot de passe"
              />
            </div>
            <p class="mt-1 text-sm text-gray-500">
              Le mot de passe doit contenir au moins 8 caractères
            </p>
          </div>
          <div>
            <label for="confirm-password" class="block text-sm font-medium text-gray-700">Confirmer le mot de passe</label>
            <div class="mt-1">
              <input
                id="confirm-password"
                v-model="form.confirmPassword"
                name="confirm-password"
                type="password"
                required
                autocomplete="new-password"
                class="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
                placeholder="Confirmez votre nouveau mot de passe"
              />
            </div>
          </div>
        </div>
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
        <div v-if="validationErrors.length > 0" class="rounded-md bg-yellow-50 p-4">
          <div class="flex">
            <div class="flex-shrink-0">
              <svg class="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
                <path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd" />
              </svg>
            </div>
            <div class="ml-3">
              <h3 class="text-sm font-medium text-yellow-800">Attention</h3>
              <div class="mt-2 text-sm text-yellow-700">
                <ul class="list-disc pl-5 space-y-1">
                  <li v-for="(error, index) in validationErrors" :key="index">
                    {{ error }}
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>
        <div>
          <button
            type="submit"
            :disabled="loading || !isValid"
            class="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50"
          >
            <span class="absolute left-0 inset-y-0 flex items-center pl-3">
              <svg
                v-if="!loading"
                class="h-5 w-5 text-primary-500 group-hover:text-primary-400"
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path
                  fill-rule="evenodd"
                  d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z"
                  clip-rule="evenodd"
                />
              </svg>
              <svg
                v-else
                class="animate-spin h-5 w-5 text-white"
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
            </span>
            {{ loading ? 'Modification en cours...' : 'Changer le mot de passe' }}
          </button>
        </div>
      </form>
    </div>
  </div>
</template>
<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
const router = useRouter()
const authStore = useAuthStore()
const form = reactive({
  oldPassword: '',
  newPassword: '',
  confirmPassword: ''
})
const loading = ref(false)
const error = ref('')
onMounted(() => {
  console.log('ChangePasswordForm mounted, auth state:', {
    isAuthenticated: authStore.isAuthenticated,
    userId: authStore.user?.id,
    mustChangePassword: authStore.user?.must_change_password
  })
})
const validationErrors = computed(() => {
  const errors = []
  if (form.newPassword && form.newPassword.length < 8) {
    errors.push('Le nouveau mot de passe doit contenir au moins 8 caractères')
  }
  if (form.newPassword && form.confirmPassword && form.newPassword !== form.confirmPassword) {
    errors.push('Les mots de passe ne correspondent pas')
  }
  return errors
})
const isValid = computed(() => {
  return (
    form.oldPassword.length > 0 &&
    form.newPassword.length >= 8 &&
    form.newPassword === form.confirmPassword
  )
})
async function handleSubmit() {
  if (!isValid.value) {
    error.value = 'Veuillez corriger les erreurs avant de continuer'
    return
  }
  if (!authStore.user?.id) {
    error.value = 'Erreur : utilisateur non identifié'
    return
  }
  loading.value = true
  error.value = ''
  try {
    console.log('Submitting password change...')
    await authStore.changePassword(form.oldPassword, form.newPassword)
    console.log('Password changed successfully')
    router.push('/')
  } catch (err: any) {
    console.error('Password change failed:', err)
    if (err.response?.data?.detail) {
      error.value = err.response.data.detail
    } else if (err.response?.data?.old_password) {
      error.value = err.response.data.old_password[0]
    } else if (err.response?.data?.password) {
      error.value = err.response.data.password[0]
    } else if (err.response?.status === 401) {
      error.value = 'Session expirée, veuillez vous reconnecter'
      await authStore.logout()
      router.push('/login')
    } else {
      error.value = 'Une erreur est survenue lors du changement de mot de passe'
    }
  } finally {
    loading.value = false
  }
}
</script> 