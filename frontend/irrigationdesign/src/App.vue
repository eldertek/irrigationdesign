<script setup lang="ts">
import { RouterLink, RouterView } from 'vue-router'
import { ref, computed, onMounted, watch, onBeforeUnmount } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import SearchBar from '@/components/SearchBar.vue'
const router = useRouter()
const authStore = useAuthStore()
const showProfileMenu = ref(false)
const showMobileMenu = ref(false)
const isSmallScreen = ref(false)
// Fonction pour détecter la taille de l'écran
function checkScreenSize() {
  isSmallScreen.value = window.innerWidth < 768
}
// Écouter les changements de taille d'écran
onMounted(() => {
  checkScreenSize()
  window.addEventListener('resize', checkScreenSize)
})
// Nettoyer l'écouteur d'événement
onBeforeUnmount(() => {
  window.removeEventListener('resize', checkScreenSize)
})
// Données utilisateur depuis le store d'authentification
const userName = computed(() => {
  const user = authStore.user
  if (!user) return ''
  const fullName = `${user.first_name} ${user.last_name.toUpperCase()}`
  if (user.company_name) {
    return `${fullName} (${user.company_name})`
  }
  return fullName
})
const userRole = computed(() => {
  const userType = authStore.user?.user_type
  switch (userType) {
    case 'admin':
      return 'Accès administrateur'
    case 'dealer':
      return 'Accès concessionnaire'
    case 'client':
      return 'Accès client'
    default:
      return ''
  }
})
const isAdmin = computed(() => authStore.user?.user_type === 'admin')
const userAvatar = ref('')
const isAuthenticated = computed(() => authStore.isAuthenticated)
// Items de navigation de base
const baseNavigationItems = [
  { name: 'Carte', to: '/' },
  { name: 'Plans', to: '/plans' }
]
// Items de navigation avec condition pour l'onglet Utilisateurs et Clients
const navigationItems = computed(() => {
  if (!isAuthenticated.value) return []
  const items = [...baseNavigationItems]
  if (isAdmin.value) {
    items.push({ name: 'Utilisateurs', to: '/users' })
  } else if (authStore.user?.user_type === 'dealer') {
    items.push({ name: 'Clients', to: '/clients' })
  }
  return items
})
// Items du menu profil
const profileMenuItems = computed(() => {
  if (!isAuthenticated.value) return []
  return [
    { name: 'Mon profil', to: '/profile' },
  ]
})
// Interface pour le paramètre de localisation
interface Location {
  lat: number
  lng: number
}
async function handleLogout() {
  try {
    await authStore.logout()
    router.push('/login')
  } catch (error) {
    console.error('Erreur lors de la déconnexion:', error)
  }
}
// Fonction pour gérer la sélection d'une adresse
function handleLocationSelect(location: Location) {
  // Émettre un événement personnalisé pour la carte
  window.dispatchEvent(new CustomEvent('map-set-location', { 
    detail: { 
      lat: location.lat,
      lng: location.lng,
      zoom: 16
    }
  }))
}
// Vérifier l'authentification au chargement
onMounted(async () => {
  console.log('App mounted, checking auth...')
  try {
    // Vérifier si un token existe
    const token = localStorage.getItem('token')
    if (token) {
      console.log('Token found, checking auth...')
      await authStore.checkAuth()
      // Forcer la récupération du profil utilisateur
      await authStore.fetchUserProfile()
    } else {
      console.log('No token found')
    }
  } catch (error) {
    console.error('Auth check error:', error)
    router.push('/login')
  }
})
// Titre de la page
const pageTitle = computed(() => {
  const baseTitle = 'IrrigationDesign'
  if (!isAuthenticated.value) return `${baseTitle} - Connexion`
  const currentRoute = router.currentRoute.value
  const routeTitles: Record<string, string> = {
    home: 'Carte',
    plans: 'Plans',
    users: 'Utilisateurs',
    profile: 'Mon profil',
    selectDealer: 'Sélection du concessionnaire',
    changePassword: 'Changement de mot de passe',
    map: 'Carte'
  }
  const routeTitle = routeTitles[currentRoute.name as string] || ''
  return routeTitle ? `${baseTitle} - ${routeTitle}` : baseTitle
})
// Mettre à jour le titre de la page
watch(pageTitle, (newTitle) => {
  document.title = newTitle
}, { immediate: true })
</script>
<template>
  <div class="h-screen flex flex-col">
    <!-- NavToolbar -->
    <header v-if="isAuthenticated" class="bg-white shadow-sm z-[2000]">
      <nav class="mx-auto px-4 sm:px-6 lg:px-8">
        <div class="flex h-16 items-center justify-between">
          <div class="flex items-center space-x-8">
            <router-link 
              to="/" 
              class="text-xl font-semibold text-primary-600 truncate"
            >
              <span class="md:inline hidden">IrrigationDesign</span>
              <span class="md:hidden inline">ID</span>
            </router-link>
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
          <!-- Barre de recherche uniquement sur la carte -->
          <div v-if="$route.path === '/'" class="hidden md:block flex-1 mx-8">
            <SearchBar @select-location="handleLocationSelect" />
          </div>
          <div v-else class="flex-1"></div>
          <div class="flex items-center space-x-2 md:space-x-4">
            <div class="flex md:hidden">
              <button
                @click="showMobileMenu = !showMobileMenu"
                class="inline-flex items-center justify-center p-2 rounded-md text-gray-400 hover:text-gray-500 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-primary-500"
              >
                <span class="sr-only">Ouvrir le menu</span>
                <svg
                  class="h-6 w-6"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    v-if="!showMobileMenu"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M4 6h16M4 12h16M4 18h16"
                  />
                  <path
                    v-else
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>
            <button
              class="hidden md:flex p-2 text-gray-400 hover:text-gray-500 rounded-full hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2"
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
            <div class="relative">
              <button
                @click="showProfileMenu = !showProfileMenu"
                class="flex items-center space-x-2 md:space-x-3 focus:outline-none"
              >
                <div class="hidden md:flex flex-col items-end">
                  <span class="text-sm font-medium text-gray-700">{{ userName }}</span>
                  <span v-if="userRole" class="text-xs text-gray-500">{{ userRole }}</span>
                </div>
                <img
                  class="h-8 w-8 rounded-full ring-2 ring-white"
                  :src="userAvatar || 'https://ui-avatars.com/api/?name=' + encodeURIComponent(userName)"
                  :alt="userName"
                />
              </button>
              <div
                v-if="showProfileMenu"
                class="absolute right-0 mt-2 w-48 origin-top-right rounded-md bg-white py-1 shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none z-[3000]"
              >
                <div class="md:hidden px-4 py-2 border-b border-gray-100">
                  <div class="text-sm font-medium text-gray-700">{{ userName }}</div>
                  <div class="text-xs text-gray-500">{{ userRole }}</div>
                </div>
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
        <div
          v-if="showMobileMenu"
          class="md:hidden"
        >
          <div class="space-y-1 px-2 pb-3 pt-2">
            <router-link
              v-for="item in navigationItems"
              :key="item.name"
              :to="item.to"
              class="block px-3 py-2 rounded-md text-base font-medium"
              :class="[
                $route.path === item.to
                  ? 'bg-primary-50 text-primary-600'
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
              ]"
              @click="showMobileMenu = false"
            >
              {{ item.name }}
            </router-link>
          </div>
          <!-- Barre de recherche mobile uniquement sur la carte -->
          <div v-if="$route.path === '/'" class="px-4 py-3">
            <SearchBar @select-location="handleLocationSelect" />
          </div>
        </div>
      </nav>
    </header>
    <!-- Main content -->
    <main :class="[ $route.path === '/' ? 'overflow-hidden' : 'overflow-auto', 'flex-1 flex flex-col' ]">
      <div
        v-if="isSmallScreen && $route.path === '/'"
        class="fixed inset-0 bg-white z-[2001] flex flex-col items-center justify-center p-6 text-center"
      >
        <svg
          class="w-24 h-24 text-primary-500 mb-6"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
          />
        </svg>
        <h2 class="text-2xl font-bold text-gray-900 mb-4">
          Version bureau recommandée
        </h2>
        <p class="text-gray-600 mb-8 max-w-md">
          Pour une meilleure expérience de conception d'irrigation, nous vous recommandons d'utiliser un écran plus large ou un ordinateur.
        </p>
        <router-link
          to="/plans"
          class="inline-flex items-center px-4 py-2 border border-transparent text-base font-medium rounded-md shadow-sm text-white bg-primary-600 hover:bg-primary-700"
        >
          Voir mes plans
        </router-link>
      </div>
      <router-view v-else></router-view>
    </main>
  </div>
</template>
<style>
body {
  @apply bg-gray-50 h-screen overflow-hidden;
}
#app {
  @apply h-screen overflow-hidden;
}
</style>
