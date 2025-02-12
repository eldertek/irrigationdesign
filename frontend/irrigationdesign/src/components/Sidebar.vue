<template>
  <div class="h-full w-64 bg-white shadow-lg">
    <div class="p-4">
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
import { ref } from 'vue'

const selectedShape = ref('rectangle')
const shapes = ref([])

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