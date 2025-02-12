<template>
  <div class="min-h-screen bg-gray-50 py-12">
    <div class="max-w-7xl mx-auto sm:px-6 lg:px-8">
      <div class="md:grid md:grid-cols-3 md:gap-6">
        <!-- Informations du profil -->
        <div class="md:col-span-1">
          <div class="px-4 sm:px-0">
            <h3 class="text-lg font-medium leading-6 text-gray-900">
              Profil
            </h3>
            <p class="mt-1 text-sm text-gray-600">
              Ces informations seront affichées publiquement, soyez prudent avec ce que vous partagez.
            </p>
          </div>
        </div>

        <div class="mt-5 md:mt-0 md:col-span-2">
          <form @submit.prevent="updateProfile">
            <div class="shadow sm:rounded-md sm:overflow-hidden">
              <div class="px-4 py-5 bg-white space-y-6 sm:p-6">
                <div v-if="profileError" class="rounded-md bg-red-50 p-4">
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
                        {{ profileError }}
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
                      type="text"
                      name="username"
                      id="username"
                      v-model="profileForm.username"
                      class="shadow-sm focus:ring-primary-500 focus:border-primary-500 block w-full sm:text-sm border-gray-300 rounded-md"
                    />
                  </div>
                </div>

                <div>
                  <label
                    for="email"
                    class="block text-sm font-medium text-gray-700"
                  >
                    Adresse e-mail
                  </label>
                  <div class="mt-1">
                    <input
                      type="email"
                      name="email"
                      id="email"
                      v-model="profileForm.email"
                      class="shadow-sm focus:ring-primary-500 focus:border-primary-500 block w-full sm:text-sm border-gray-300 rounded-md"
                    />
                  </div>
                </div>
              </div>

              <div class="px-4 py-3 bg-gray-50 text-right sm:px-6">
                <button
                  type="submit"
                  :disabled="profileLoading"
                  class="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
                >
                  {{ profileLoading ? 'Enregistrement...' : 'Enregistrer' }}
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>

      <div class="hidden sm:block" aria-hidden="true">
        <div class="py-5">
          <div class="border-t border-gray-200"></div>
        </div>
      </div>

      <!-- Changement de mot de passe -->
      <div class="mt-10 sm:mt-0">
        <div class="md:grid md:grid-cols-3 md:gap-6">
          <div class="md:col-span-1">
            <div class="px-4 sm:px-0">
              <h3 class="text-lg font-medium leading-6 text-gray-900">
                Mot de passe
              </h3>
              <p class="mt-1 text-sm text-gray-600">
                Assurez-vous d'utiliser un mot de passe sécurisé.
              </p>
            </div>
          </div>

          <div class="mt-5 md:mt-0 md:col-span-2">
            <form @submit.prevent="changePassword">
              <div class="shadow sm:rounded-md sm:overflow-hidden">
                <div class="px-4 py-5 bg-white space-y-6 sm:p-6">
                  <div v-if="passwordError" class="rounded-md bg-red-50 p-4">
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
                          {{ passwordError }}
                        </h3>
                      </div>
                    </div>
                  </div>

                  <div>
                    <label
                      for="current-password"
                      class="block text-sm font-medium text-gray-700"
                    >
                      Mot de passe actuel
                    </label>
                    <div class="mt-1">
                      <input
                        type="password"
                        name="current-password"
                        id="current-password"
                        v-model="passwordForm.old_password"
                        required
                        class="shadow-sm focus:ring-primary-500 focus:border-primary-500 block w-full sm:text-sm border-gray-300 rounded-md"
                      />
                    </div>
                  </div>

                  <div>
                    <label
                      for="new-password"
                      class="block text-sm font-medium text-gray-700"
                    >
                      Nouveau mot de passe
                    </label>
                    <div class="mt-1">
                      <input
                        type="password"
                        name="new-password"
                        id="new-password"
                        v-model="passwordForm.new_password"
                        required
                        class="shadow-sm focus:ring-primary-500 focus:border-primary-500 block w-full sm:text-sm border-gray-300 rounded-md"
                      />
                    </div>
                  </div>

                  <div>
                    <label
                      for="confirm-password"
                      class="block text-sm font-medium text-gray-700"
                    >
                      Confirmer le nouveau mot de passe
                    </label>
                    <div class="mt-1">
                      <input
                        type="password"
                        name="confirm-password"
                        id="confirm-password"
                        v-model="passwordForm.confirm_password"
                        required
                        class="shadow-sm focus:ring-primary-500 focus:border-primary-500 block w-full sm:text-sm border-gray-300 rounded-md"
                      />
                    </div>
                  </div>
                </div>

                <div class="px-4 py-3 bg-gray-50 text-right sm:px-6">
                  <button
                    type="submit"
                    :disabled="passwordLoading"
                    class="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
                  >
                    {{ passwordLoading ? 'Modification...' : 'Modifier le mot de passe' }}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { useAuthStore } from '@/stores/auth'

const authStore = useAuthStore()

const profileLoading = ref(false)
const passwordLoading = ref(false)
const profileError = ref<string | null>(null)
const passwordError = ref<string | null>(null)

const profileForm = reactive({
  username: '',
  email: ''
})

const passwordForm = reactive({
  old_password: '',
  new_password: '',
  confirm_password: ''
})

onMounted(() => {
  if (authStore.user) {
    profileForm.username = authStore.user.username
    profileForm.email = authStore.user.email
  }
})

async function updateProfile() {
  profileLoading.value = true
  profileError.value = null

  try {
    await authStore.updateProfile({
      username: profileForm.username,
      email: profileForm.email
    })
  } catch (err: any) {
    if (err.response?.data) {
      const errors = err.response.data
      const firstError = Object.values(errors)[0]
      profileError.value = Array.isArray(firstError) ? firstError[0] : String(firstError)
    } else {
      profileError.value = 'Une erreur est survenue lors de la mise à jour du profil'
    }
  } finally {
    profileLoading.value = false
  }
}

async function changePassword() {
  if (passwordForm.new_password !== passwordForm.confirm_password) {
    passwordError.value = 'Les mots de passe ne correspondent pas'
    return
  }

  passwordLoading.value = true
  passwordError.value = null

  try {
    await authStore.changePassword({
      old_password: passwordForm.old_password,
      new_password: passwordForm.new_password
    })
    
    // Réinitialiser le formulaire
    passwordForm.old_password = ''
    passwordForm.new_password = ''
    passwordForm.confirm_password = ''
  } catch (err: any) {
    if (err.response?.data) {
      const errors = err.response.data
      const firstError = Object.values(errors)[0]
      passwordError.value = Array.isArray(firstError) ? firstError[0] : String(firstError)
    } else {
      passwordError.value = 'Une erreur est survenue lors du changement de mot de passe'
    }
  } finally {
    passwordLoading.value = false
  }
}
</script> 