<!-- DrawingTools.vue -->
<template>
  <div class="drawing-tools">
    <div class="mb-6">
      <h3 class="text-lg font-semibold mb-4">Outils de dessin</h3>
      
      <div class="grid grid-cols-2 gap-2">
        <button
          v-for="tool in drawingTools"
          :key="tool.type"
          class="flex items-center justify-center p-2 rounded border"
          :class="{
            'bg-blue-50 border-blue-200': currentTool === tool.type,
            'hover:bg-gray-50 border-gray-200': currentTool !== tool.type
          }"
          @click="$emit('tool-change', tool.type)"
        >
          <span class="text-sm">{{ tool.label }}</span>
        </button>
      </div>
    </div>

    <div v-if="selectedShape" class="mb-6">
      <h3 class="text-lg font-semibold mb-4">Style</h3>
      
      <div class="space-y-4">
        <!-- Couleur de remplissage -->
        <div v-if="showFillOptions">
          <label class="block text-sm font-medium text-gray-700 mb-1">
            Couleur de remplissage
          </label>
          <div class="flex items-center space-x-2">
            <input
              type="color"
              v-model="fillColor"
              class="w-8 h-8 rounded border"
              @change="updateStyle({ fillColor })"
            />
            <input
              type="range"
              v-model="fillOpacity"
              min="0"
              max="1"
              step="0.1"
              class="flex-1"
              @change="updateStyle({ fillOpacity })"
            />
          </div>
        </div>

        <!-- Couleur de bordure -->
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">
            Couleur de bordure
          </label>
          <div class="flex items-center space-x-2">
            <input
              type="color"
              v-model="strokeColor"
              class="w-8 h-8 rounded border"
              @change="updateStyle({ strokeColor })"
            />
            <input
              type="number"
              v-model="strokeWidth"
              min="1"
              max="10"
              class="w-20 px-2 py-1 rounded border"
              @change="updateStyle({ strokeWidth })"
            />
          </div>
        </div>

        <!-- Options spécifiques aux formes -->
        <div v-if="selectedShape.type === 'Circle' || selectedShape.type === 'Semicircle'">
          <label class="block text-sm font-medium text-gray-700 mb-1">
            Rayon (m)
          </label>
          <input
            type="number"
            v-model="radius"
            min="1"
            class="w-full px-2 py-1 rounded border"
            @change="updateProperties({ radius })"
          />
        </div>

        <div v-if="selectedShape.type === 'Semicircle'">
          <label class="block text-sm font-medium text-gray-700 mb-1">
            Angle de départ (°)
          </label>
          <input
            type="number"
            v-model="startAngle"
            min="0"
            max="360"
            class="w-full px-2 py-1 rounded border"
            @change="updateProperties({ startAngle })"
          />
        </div>
      </div>
    </div>

    <div v-if="selectedShape" class="mb-6">
      <h3 class="text-lg font-semibold mb-4">Propriétés</h3>
      
      <div class="space-y-2 text-sm">
        <div v-if="selectedShape.properties.area">
          Surface: {{ formatArea(selectedShape.properties.area) }}
        </div>
        <div v-if="selectedShape.properties.length">
          Longueur: {{ formatLength(selectedShape.properties.length) }}
        </div>
        <div v-if="selectedShape.properties.perimeter">
          Périmètre: {{ formatLength(selectedShape.properties.perimeter) }}
        </div>
        <div v-if="selectedShape.properties.slope">
          Pente: {{ formatSlope(selectedShape.properties.slope) }}
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';

const props = defineProps<{
  currentTool: string;
  selectedShape: any | null;
}>();

const emit = defineEmits<{
  (e: 'tool-change', tool: string): void;
  (e: 'style-update', style: any): void;
  (e: 'properties-update', properties: any): void;
}>();

const drawingTools = [
  { type: 'Circle', label: 'Cercle' },
  { type: 'Semicircle', label: 'Demi-cercle' },
  { type: 'Rectangle', label: 'Rectangle' },
  { type: 'Polygon', label: 'Polygone' },
  { type: 'Line', label: 'Ligne' }
];

// Style
const fillColor = ref('#3B82F6');
const fillOpacity = ref(0.2);
const strokeColor = ref('#2563EB');
const strokeWidth = ref(2);
const radius = ref(0);
const startAngle = ref(0);

const showFillOptions = computed(() => {
  if (!props.selectedShape) return false;
  return ['Circle', 'Semicircle', 'Rectangle', 'Polygon'].includes(props.selectedShape.type);
});

// Initialiser les valeurs quand une forme est sélectionnée
watch(() => props.selectedShape, (shape) => {
  if (shape) {
    fillColor.value = shape.properties.style.fillColor || '#3B82F6';
    fillOpacity.value = shape.properties.style.fillOpacity || 0.2;
    strokeColor.value = shape.properties.style.color || '#2563EB';
    strokeWidth.value = shape.properties.style.weight || 2;
    radius.value = shape.properties.radius || 0;
    startAngle.value = shape.properties.startAngle || 0;
  }
}, { immediate: true });

const updateStyle = (style: any) => {
  emit('style-update', style);
};

const updateProperties = (properties: any) => {
  emit('properties-update', properties);
};

const formatArea = (area: number): string => {
  return `${(area / 10000).toFixed(2)} ha`;
};

const formatLength = (length: number): string => {
  return `${length.toFixed(1)} m`;
};

const formatSlope = (slope: number): string => {
  return `${(slope * 100).toFixed(1)}%`;
};
</script>

<style scoped>
.drawing-tools {
  max-height: calc(100vh - 300px);
  overflow-y: auto;
}
</style> 