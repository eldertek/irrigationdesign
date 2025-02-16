<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const router = useRouter()
const authStore = useAuthStore()

const dealers = ref([])
const selectedDealer = ref(null)
const loading = ref(false)
const error = ref('')

onMounted(async () => {
  try {
    loading.value = true
    await fetchDealers()
  } catch (err) {
    error.value = 'Erreur lors du chargement des concessionnaires'
    console.error(err)
  } finally {
    loading.value = false
  }
})

async function fetchDealers() {
  try {
    const response = await authStore.fetchConcessionnaires()
    dealers.value = response
  } catch (err) {
    error.value = 'Erreur lors du chargement des concessionnaires'
    throw err
  }
}

async function handleDealerSelection() {
  if (!selectedDealer.value) {
    error.value = 'Veuillez sélectionner un concessionnaire'
    return
  }

  try {
    loading.value = true
    await authStore.setConcessionnaire(authStore.user?.id, selectedDealer.value)
    router.push({ name: 'home' })
  } catch (err) {
    error.value = 'Erreur lors de la sélection du concessionnaire'
    console.error(err)
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
    <div class="sm:mx-auto sm:w-full sm:max-w-md">
      <h2 class="mt-6 text-center text-3xl font-extrabold text-gray-900">
        Sélectionnez votre concessionnaire
      </h2>
      <p class="mt-2 text-center text-sm text-gray-600">
        Pour commencer à utiliser l'application, veuillez sélectionner votre concessionnaire
      </p>
    </div>

    <div class="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
      <div class="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
        <div v-if="loading" class="flex justify-center">
          <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
        </div>

        <form v-else @submit.prevent="handleDealerSelection" class="space-y-6">
          <div v-if="error" class="bg-red-50 p-4 rounded-md">
            <div class="flex">
              <div class="flex-shrink-0">
                <svg class="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd" />
                </svg>
              </div>
              <div class="ml-3">
                <p class="text-sm text-red-700">{{ error }}</p>
              </div>
            </div>
          </div>

          <div>
            <label for="dealer" class="block text-sm font-medium text-gray-700">
              Concessionnaire
            </label>
            <select
              id="dealer"
              v-model="selectedDealer"
              class="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm rounded-md"
              :class="{ 'border-red-300': error }"
            >
              <option value="" disabled selected>Sélectionnez un concessionnaire</option>
              <option
                v-for="dealer in dealers"
                :key="dealer.id"
                :value="dealer.id"
              >
                {{ dealer.company_name || dealer.username }}
              </option>
            </select>
          </div>

          <div>
            <button
              type="submit"
              :disabled="!selectedDealer || loading"
              class="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Confirmer
            </button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template> 