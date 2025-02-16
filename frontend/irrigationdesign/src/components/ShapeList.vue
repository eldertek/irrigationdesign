<!-- ShapeList.vue -->
<template>
  <div class="shape-list">
    <h3 class="text-lg font-semibold mb-4">Formes du plan</h3>
    
    <div v-if="shapes.length === 0" class="text-gray-500 text-sm">
      Aucune forme n'a été créée
    </div>
    
    <ul v-else class="space-y-2">
      <li
        v-for="shape in shapes"
        :key="shape.id"
        class="p-2 rounded hover:bg-gray-50 cursor-pointer"
        :class="{ 'bg-blue-50': selectedShape?.id === shape.id }"
        @click="$emit('select', shape)"
      >
        <div class="flex items-center justify-between">
          <div>
            <span class="font-medium">{{ getShapeTypeName(shape.type) }}</span>
            <span v-if="shape.name" class="text-sm text-gray-600 ml-2">
              {{ shape.name }}
            </span>
          </div>
          
          <div class="flex items-center space-x-2">
            <button
              class="text-gray-400 hover:text-gray-600"
              @click.stop="$emit('edit', shape)"
              title="Modifier"
            >
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
              </svg>
            </button>
            
            <button
              class="text-gray-400 hover:text-red-600"
              @click.stop="$emit('delete', shape)"
              title="Supprimer"
            >
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          </div>
        </div>
        
        <div class="mt-1 text-sm text-gray-500">
          <template v-if="shape.properties">
            <template v-if="shape.properties.area">
              Surface: {{ formatArea(shape.properties.area) }}
            </template>
            <template v-if="shape.properties.length">
              Longueur: {{ formatLength(shape.properties.length) }}
            </template>
            <template v-if="shape.properties.radius">
              Rayon: {{ formatLength(shape.properties.radius) }}
            </template>
          </template>
        </div>
      </li>
    </ul>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';

const props = defineProps<{
  shapes: any[];
  selectedShape: any | null;
}>();

const emit = defineEmits<{
  (e: 'select', shape: any): void;
  (e: 'edit', shape: any): void;
  (e: 'delete', shape: any): void;
}>();

const getShapeTypeName = (type: string): string => {
  const typeNames: Record<string, string> = {
    'Circle': 'Cercle',
    'Semicircle': 'Demi-cercle',
    'Rectangle': 'Rectangle',
    'Polygon': 'Polygone',
    'Line': 'Ligne',
    'Polyline': 'Polyligne'
  };
  return typeNames[type] || type;
};

const formatArea = (area: number): string => {
  return `${(area / 10000).toFixed(2)} ha`;
};

const formatLength = (length: number): string => {
  return `${length.toFixed(1)} m`;
};
</script>

<style scoped>
.shape-list {
  max-height: calc(100vh - 300px);
  overflow-y: auto;
}
</style> 