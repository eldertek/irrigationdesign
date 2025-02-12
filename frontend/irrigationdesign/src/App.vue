<script setup lang="ts">
import { RouterLink, RouterView } from 'vue-router'
import HelloWorld from './components/HelloWorld.vue'
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import SearchBar from '@/components/SearchBar.vue'

const router = useRouter()
const authStore = useAuthStore()
const showProfileMenu = ref(false)

// Données utilisateur depuis le store d'authentification
const userName = computed(() => authStore.user?.username || 'Utilisateur')
const userRole = computed(() => authStore.user?.role || 'Utilisateur')
const isAdmin = computed(() => authStore.user?.role === 'ADMIN')
const userAvatar = ref('')

// Items de navigation de base
const baseNavigationItems = [
  { name: 'Carte', to: '/' },
  { name: 'Projets', to: '/projects' }
]

// Items de navigation avec condition pour l'onglet Utilisateurs
const navigationItems = computed(() => {
  if (isAdmin.value) {
    return [...baseNavigationItems, { name: 'Utilisateurs', to: '/users' }]
  }
  return baseNavigationItems
})

// Items du menu profil
const profileMenuItems = [
  { name: 'Mon profil', to: '/profile' },
  { name: 'Paramètres', to: '/settings' }
]

async function handleLogout() {
  try {
    await authStore.logout()
    router.push('/login')
  } catch (error) {
    console.error('Erreur lors de la déconnexion:', error)
  }
}
</script>

<template>
  <div class="h-full">
    <header class="bg-white shadow-sm fixed top-0 left-0 right-0 z-50">
      <nav class="mx-auto px-4 sm:px-6 lg:px-8">
        <div class="flex h-16 items-center justify-between">
          <!-- Logo et navigation principale -->
          <div class="flex items-center space-x-8">
            <router-link to="/" class="text-xl font-semibold text-primary-600">
              IrrigationDesign
            </router-link>
            
            <!-- Navigation principale -->
            <div class="hidden md:flex space-x-6">
              <router-link
                v-for="item in navigationItems"
                :key="item.name"
                :to="item.to"
                class="text-sm font-medium transition-colors duration-200"
                :class="[
                  $route.path === item.to
                    ? 'text-primary-600 border-b-2 border-primary-500'
                    : 'text-gray-500 hover:text-gray-900'
                ]"
              >
                {{ item.name }}
              </router-link>
            </div>
          </div>

          <!-- Barre de recherche -->
          <div class="flex-1 max-w-2xl mx-8">
            <SearchBar />
          </div>

          <!-- Actions utilisateur -->
          <div class="flex items-center space-x-4">
            <!-- Notifications -->
            <button
              class="p-2 text-gray-400 hover:text-gray-500 rounded-full hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2"
            >
              <span class="sr-only">Voir les notifications</span>
              <svg class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
                />
              </svg>
            </button>

            <!-- Menu utilisateur -->
            <div class="relative">
              <button
                @click="showProfileMenu = !showProfileMenu"
                class="flex items-center space-x-3 focus:outline-none"
              >
                <div class="flex flex-col items-end">
                  <span class="text-sm font-medium text-gray-700">{{ userName }}</span>
                  <span class="text-xs text-gray-500">{{ userRole }}</span>
                </div>
                <img
                  class="h-8 w-8 rounded-full ring-2 ring-white"
                  :src="userAvatar || 'https://ui-avatars.com/api/?name=' + encodeURIComponent(userName)"
                  alt=""
                />
              </button>

              <!-- Menu déroulant -->
              <div
                v-if="showProfileMenu"
                class="absolute right-0 mt-2 w-48 origin-top-right rounded-md bg-white py-1 shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none"
              >
                <router-link
                  v-for="item in profileMenuItems"
                  :key="item.name"
                  :to="item.to"
                  class="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                  @click="showProfileMenu = false"
                >
                  {{ item.name }}
                </router-link>
                <button
                  @click="handleLogout"
                  class="block w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-gray-50"
                >
                  Déconnexion
                </button>
              </div>
            </div>
          </div>
        </div>
      </nav>
    </header>

    <main class="h-[calc(100%-4rem)] pt-16">
      <router-view />
    </main>
  </div>
</template>

<style>
body {
  @apply bg-gray-50;
}

#app {
  @apply h-screen;
}
</style>
