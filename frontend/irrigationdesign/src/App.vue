<script setup lang="ts">
import { RouterLink, RouterView } from 'vue-router'
import HelloWorld from './components/HelloWorld.vue'
import { ref } from 'vue'

const showProfileMenu = ref(false)
</script>

<template>
  <div class="h-full">
    <header class="bg-white shadow-sm fixed top-0 left-0 right-0 z-50">
      <nav class="mx-auto px-4 sm:px-6 lg:px-8">
        <div class="flex h-14 items-center justify-between">
          <div class="flex items-center">
            <router-link to="/" class="text-xl font-bold text-primary-600 flex items-center space-x-2">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>IrrigationDesign</span>
            </router-link>
          </div>
          
          <div class="flex items-center space-x-4">
            <!-- Bouton de profil -->
            <div class="relative">
              <button
                @click="showProfileMenu = !showProfileMenu"
                class="flex items-center space-x-2 text-gray-700 hover:text-primary-600 focus:outline-none"
              >
                <span class="text-sm font-medium">John Doe</span>
                <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path fill-rule="evenodd" d="M10 3a7 7 0 100 14 7 7 0 000-14zm0 18a9 9 0 110-18 9 9 0 010 18z" clip-rule="evenodd" />
                  <path fill-rule="evenodd" d="M10 12a3 3 0 100-6 3 3 0 000 6z" clip-rule="evenodd" />
                </svg>
              </button>

              <!-- Menu déroulant du profil -->
              <div
                v-if="showProfileMenu"
                class="absolute right-0 mt-2 w-48 rounded-md shadow-lg bg-white ring-1 ring-black ring-opacity-5"
              >
                <div class="py-1">
                  <a href="#" class="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">Paramètres</a>
                  <a href="#" class="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">Déconnexion</a>
                </div>
              </div>
            </div>
          </div>
        </div>
      </nav>
    </header>

    <main class="h-[calc(100%-3.5rem)] pt-14">
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
