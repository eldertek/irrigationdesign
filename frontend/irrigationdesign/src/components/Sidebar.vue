<template>
  <div class="h-full w-64 bg-white shadow-lg flex flex-col">
    <!-- Navigation -->
    <nav class="p-4 border-b">
      <ul class="space-y-2">
        <li>
          <router-link
            to="/"
            class="flex items-center px-2 py-2 text-sm font-medium text-gray-700 rounded-md hover:bg-gray-50 hover:text-gray-900"
            :class="{ 'bg-gray-50': $route.path === '/' }"
          >
            <svg class="mr-3 h-5 w-5 text-gray-500" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
              <path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z" />
            </svg>
            Accueil
          </router-link>
        </li>
        <li v-if="isAdminOrDealer">
          <router-link
            to="/users"
            class="flex items-center px-2 py-2 text-sm font-medium text-gray-700 rounded-md hover:bg-gray-50 hover:text-gray-900"
            :class="{ 'bg-gray-50': $route.path === '/users' }"
          >
            <svg class="mr-3 h-5 w-5 text-gray-500" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
              <path d="M9 6a3 3 0 11-6 0 3 3 0 016 0zM17 6a3 3 0 11-6 0 3 3 0 016 0zM12.93 17c.046-.327.07-.66.07-1a6.97 6.97 0 00-1.5-4.33A5 5 0 0119 16v1h-6.07zM6 11a5 5 0 015 5v1H1v-1a5 5 0 015-5z" />
            </svg>
            Gestion des utilisateurs
          </router-link>
        </li>
      </ul>
    </nav>

    <!-- Outils de dessin -->
    <div class="flex-1 p-4 overflow-y-auto">
      <h2 class="text-lg font-semibold text-gray-900 mb-4">Outils de dessin</h2>
      
      <!-- Sélection du type de forme -->
      <div class="mb-4">
        <label class="label mb-2">Type de forme</label>
        <select v-model="selectedShape" class="input">
          <option value="rectangle">Rectangle</option>
          <option value="circle">Cercle</option>
          <option value="semicircle">Demi-cercle</option>
          <option value="line">Ligne</option>
        </select>
      </div>

      <!-- Boutons d'action -->
      <div class="space-y-2">
        <button @click="startDrawing" class="btn w-full">
          Commencer le dessin
        </button>
        <button @click="cancelDrawing" class="btn-secondary w-full">
          Annuler
        </button>
      </div>

      <!-- Liste des formes -->
      <div class="mt-8">
        <h3 class="text-md font-semibold text-gray-900 mb-2">Formes dessinées</h3>
        <ul class="space-y-2">
          <li v-for="shape in shapes" :key="shape.id" class="flex items-center justify-between p-2 bg-gray-50 rounded-md">
            <span>{{ shape.type }}</span>
            <button @click="deleteShape(shape.id)" class="text-red-600 hover:text-red-800">
              Supprimer
            </button>
          </li>
        </ul>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useAuthStore } from '@/stores/auth'

const authStore = useAuthStore()
const selectedShape = ref('rectangle')
const shapes = ref([])

const isAdminOrDealer = computed(() => {
  return authStore.isAdmin || authStore.isDealer
})

const emit = defineEmits(['start-drawing', 'cancel-drawing', 'delete-shape'])

const startDrawing = () => {
  emit('start-drawing', selectedShape.value)
}

const cancelDrawing = () => {
  emit('cancel-drawing')
}

const deleteShape = (shapeId) => {
  emit('delete-shape', shapeId)
}

// Méthode exposée pour ajouter une forme à la liste
const addShape = (shape) => {
  shapes.value.push(shape)
}

defineExpose({
  addShape
})
</script> 