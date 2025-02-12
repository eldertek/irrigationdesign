<template>
  <div class="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
    <div class="sm:mx-auto sm:w-full sm:max-w-md">
      <h2 class="mt-6 text-center text-3xl font-extrabold text-gray-900">
        Créer un compte
      </h2>
    </div>

    <div class="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
      <div class="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
        <form class="space-y-6" @submit.prevent="handleSubmit">
          <div>
            <label for="username" class="label">Nom d'utilisateur</label>
            <div class="mt-1">
              <input
                id="username"
                v-model="username"
                type="text"
                required
                class="input"
              />
            </div>
          </div>

          <div>
            <label for="email" class="label">Email</label>
            <div class="mt-1">
              <input
                id="email"
                v-model="email"
                type="email"
                required
                class="input"
              />
            </div>
          </div>

          <div>
            <label for="password" class="label">Mot de passe</label>
            <div class="mt-1">
              <input
                id="password"
                v-model="password"
                type="password"
                required
                class="input"
              />
            </div>
          </div>

          <div>
            <label for="confirmPassword" class="label">Confirmer le mot de passe</label>
            <div class="mt-1">
              <input
                id="confirmPassword"
                v-model="confirmPassword"
                type="password"
                required
                class="input"
              />
            </div>
          </div>

          <div v-if="error" class="text-red-600 text-sm">
            {{ error }}
          </div>

          <div>
            <button
              type="submit"
              :disabled="loading || !isFormValid"
              class="w-full btn"
            >
              {{ loading ? 'Inscription en cours...' : 'S\'inscrire' }}
            </button>
          </div>
        </form>

        <div class="mt-6">
          <div class="relative">
            <div class="relative flex justify-center text-sm">
              <span class="px-2 bg-white text-gray-500">
                Déjà un compte ?
                <router-link
                  to="/login"
                  class="font-medium text-primary-600 hover:text-primary-500"
                >
                  Se connecter
                </router-link>
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const router = useRouter()
const authStore = useAuthStore()

const username = ref('')
const email = ref('')
const password = ref('')
const confirmPassword = ref('')
const loading = ref(false)
const error = ref('')

const isFormValid = computed(() => {
  return (
    username.value.length >= 3 &&
    email.value.includes('@') &&
    password.value.length >= 8 &&
    password.value === confirmPassword.value
  )
})

async function handleSubmit() {
  if (!isFormValid.value) {
    error.value = 'Veuillez remplir correctement tous les champs'
    return
  }

  try {
    loading.value = true
    error.value = ''
    await authStore.register({
      username: username.value,
      email: email.value,
      password: password.value,
    })
    // Connexion automatique après l'inscription
    await authStore.login(username.value, password.value)
    router.push('/')
  } catch (err: any) {
    error.value = err.response?.data?.detail || 'Une erreur est survenue lors de l\'inscription'
  } finally {
    loading.value = false
  }
}
</script> 