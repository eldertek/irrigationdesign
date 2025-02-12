<template>
  <div class="min-h-screen bg-gray-50 py-12">
    <div class="max-w-7xl mx-auto sm:px-6 lg:px-8">
      <!-- Paramètres généraux -->
      <div class="md:grid md:grid-cols-3 md:gap-6">
        <div class="md:col-span-1">
          <div class="px-4 sm:px-0">
            <h3 class="text-lg font-medium leading-6 text-gray-900">
              Paramètres généraux
            </h3>
            <p class="mt-1 text-sm text-gray-600">
              Configurez les paramètres généraux de l'application.
            </p>
          </div>
        </div>

        <div class="mt-5 md:mt-0 md:col-span-2">
          <form @submit.prevent="saveGeneralSettings">
            <div class="shadow sm:rounded-md sm:overflow-hidden">
              <div class="px-4 py-5 bg-white space-y-6 sm:p-6">
                <!-- Unités de mesure -->
                <div>
                  <label
                    for="units"
                    class="block text-sm font-medium text-gray-700"
                  >
                    Unités de mesure
                  </label>
                  <select
                    id="units"
                    v-model="settings.units"
                    class="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm rounded-md"
                  >
                    <option value="metric">Métrique (m, m², m³)</option>
                    <option value="imperial">Impérial (ft, ft², ft³)</option>
                  </select>
                </div>

                <!-- Langue -->
                <div>
                  <label
                    for="language"
                    class="block text-sm font-medium text-gray-700"
                  >
                    Langue
                  </label>
                  <select
                    id="language"
                    v-model="settings.language"
                    class="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm rounded-md"
                  >
                    <option value="fr">Français</option>
                    <option value="en">English</option>
                  </select>
                </div>

                <!-- Thème -->
                <div>
                  <label
                    for="theme"
                    class="block text-sm font-medium text-gray-700"
                  >
                    Thème
                  </label>
                  <select
                    id="theme"
                    v-model="settings.theme"
                    class="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm rounded-md"
                  >
                    <option value="light">Clair</option>
                    <option value="dark">Sombre</option>
                    <option value="system">Système</option>
                  </select>
                </div>
              </div>

              <div class="px-4 py-3 bg-gray-50 text-right sm:px-6">
                <button
                  type="submit"
                  :disabled="loading"
                  class="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
                >
                  {{ loading ? 'Enregistrement...' : 'Enregistrer' }}
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

      <!-- Paramètres de la carte -->
      <div class="mt-10 sm:mt-0">
        <div class="md:grid md:grid-cols-3 md:gap-6">
          <div class="md:col-span-1">
            <div class="px-4 sm:px-0">
              <h3 class="text-lg font-medium leading-6 text-gray-900">
                Paramètres de la carte
              </h3>
              <p class="mt-1 text-sm text-gray-600">
                Configurez l'affichage et le comportement de la carte.
              </p>
            </div>
          </div>

          <div class="mt-5 md:mt-0 md:col-span-2">
            <form @submit.prevent="saveMapSettings">
              <div class="shadow sm:rounded-md sm:overflow-hidden">
                <div class="px-4 py-5 bg-white space-y-6 sm:p-6">
                  <!-- Fond de carte par défaut -->
                  <div>
                    <label
                      for="default-map"
                      class="block text-sm font-medium text-gray-700"
                    >
                      Fond de carte par défaut
                    </label>
                    <select
                      id="default-map"
                      v-model="settings.defaultMap"
                      class="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm rounded-md"
                    >
                      <option value="osm">OpenStreetMap</option>
                      <option value="satellite">Satellite</option>
                      <option value="terrain">Terrain</option>
                    </select>
                  </div>

                  <!-- Zoom par défaut -->
                  <div>
                    <label
                      for="default-zoom"
                      class="block text-sm font-medium text-gray-700"
                    >
                      Niveau de zoom par défaut
                    </label>
                    <input
                      type="number"
                      id="default-zoom"
                      v-model="settings.defaultZoom"
                      min="1"
                      max="20"
                      class="mt-1 block w-full shadow-sm sm:text-sm focus:ring-primary-500 focus:border-primary-500 border-gray-300 rounded-md"
                    />
                  </div>

                  <!-- Position par défaut -->
                  <div>
                    <label
                      class="block text-sm font-medium text-gray-700"
                    >
                      Position par défaut
                    </label>
                    <div class="mt-1 grid grid-cols-2 gap-4">
                      <div>
                        <label
                          for="default-lat"
                          class="block text-xs text-gray-500"
                        >
                          Latitude
                        </label>
                        <input
                          type="number"
                          id="default-lat"
                          v-model="settings.defaultLat"
                          step="0.000001"
                          class="mt-1 block w-full shadow-sm sm:text-sm focus:ring-primary-500 focus:border-primary-500 border-gray-300 rounded-md"
                        />
                      </div>
                      <div>
                        <label
                          for="default-lng"
                          class="block text-xs text-gray-500"
                        >
                          Longitude
                        </label>
                        <input
                          type="number"
                          id="default-lng"
                          v-model="settings.defaultLng"
                          step="0.000001"
                          class="mt-1 block w-full shadow-sm sm:text-sm focus:ring-primary-500 focus:border-primary-500 border-gray-300 rounded-md"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <div class="px-4 py-3 bg-gray-50 text-right sm:px-6">
                  <button
                    type="submit"
                    :disabled="loading"
                    class="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
                  >
                    {{ loading ? 'Enregistrement...' : 'Enregistrer' }}
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
import { ref, reactive } from 'vue'

const loading = ref(false)

const settings = reactive({
  // Paramètres généraux
  units: 'metric',
  language: 'fr',
  theme: 'light',

  // Paramètres de la carte
  defaultMap: 'osm',
  defaultZoom: 13,
  defaultLat: 48.8566,
  defaultLng: 2.3522
})

async function saveGeneralSettings() {
  loading.value = true
  try {
    // Sauvegarder les paramètres généraux
    localStorage.setItem('settings', JSON.stringify(settings))
    // Appliquer les changements
    applySettings()
  } catch (error) {
    console.error('Erreur lors de la sauvegarde des paramètres:', error)
  } finally {
    loading.value = false
  }
}

async function saveMapSettings() {
  loading.value = true
  try {
    // Sauvegarder les paramètres de la carte
    localStorage.setItem('settings', JSON.stringify(settings))
    // Appliquer les changements
    applySettings()
  } catch (error) {
    console.error('Erreur lors de la sauvegarde des paramètres:', error)
  } finally {
    loading.value = false
  }
}

function loadSettings() {
  const savedSettings = localStorage.getItem('settings')
  if (savedSettings) {
    const parsed = JSON.parse(savedSettings)
    Object.assign(settings, parsed)
  }
}

function applySettings() {
  // Appliquer le thème
  document.documentElement.classList.remove('light', 'dark')
  if (settings.theme === 'system') {
    const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches
    document.documentElement.classList.add(isDark ? 'dark' : 'light')
  } else {
    document.documentElement.classList.add(settings.theme)
  }

  // Appliquer la langue
  document.documentElement.lang = settings.language
}

// Charger les paramètres au montage du composant
loadSettings()
</script> 