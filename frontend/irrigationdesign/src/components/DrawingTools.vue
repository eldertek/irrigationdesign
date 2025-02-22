<!-- DrawingTools.vue -->
<template>
  <div class="drawing-tools">
    <!-- Outils de dessin -->
    <div class="mb-4">
      <div class="grid grid-cols-2 gap-2">
        <button
          v-for="tool in drawingTools.filter(t => t.type !== 'delete')"
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
      
      <!-- Bouton de suppression -->
      <button
        v-if="selectedShape"
        class="w-full mt-2 flex items-center justify-center p-2 rounded border border-red-500 bg-red-50 hover:bg-red-100 text-red-700 transition-colors duration-200"
        :class="{
          'bg-red-100 border-red-600': currentTool === 'delete'
        }"
        @click="$emit('delete-shape')"
      >
        <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
        </svg>
        <span class="text-sm font-medium">Supprimer la forme</span>
      </button>
    </div>

    <!-- Sections collapsables pour les formes sélectionnées -->
    <div v-if="selectedShape" class="space-y-2">
      <!-- Style - Section collapsable -->
      <div class="border rounded overflow-hidden">
        <button 
          class="w-full px-3 py-2 flex justify-between items-center bg-gray-50 hover:bg-gray-100"
          @click="toggleSection('style')"
        >
          <span class="font-medium">Style</span>
          <svg 
            class="w-5 h-5 transform transition-transform"
            :class="{ 'rotate-180': !sectionsCollapsed.style }"
            fill="none" 
            stroke="currentColor" 
            viewBox="0 0 24 24"
          >
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
          </svg>
        </button>
        <div v-show="!sectionsCollapsed.style" class="p-3 space-y-3">
          <!-- Couleurs prédéfinies -->
          <div class="grid grid-cols-6 gap-2">
            <button
              v-for="color in predefinedColors"
              :key="color"
              class="w-6 h-6 rounded-full border hover:scale-110 transition-transform"
              :style="{ backgroundColor: color }"
              @click="selectPresetColor(color)"
            ></button>
          </div>

          <!-- Contrôles de style compacts -->
          <div class="space-y-2">
            <div class="flex items-center gap-2">
              <span class="text-xs text-gray-500">Contour</span>
              <input
                type="color"
                v-model="strokeColor"
                class="w-6 h-6"
                @change="updateStyle({ strokeColor })"
                title="Couleur du contour"
              />
              <input
                type="range"
                v-model="strokeWidth"
                min="1"
                max="10"
                class="flex-1"
                @change="updateStyle({ strokeWidth })"
                title="Épaisseur du contour"
              />
            </div>

            <!-- Style de trait -->
            <div class="flex items-center gap-2">
              <span class="text-xs text-gray-500">Style</span>
              <select
                v-model="strokeStyle"
                class="flex-1 text-sm border rounded px-1 py-0.5"
                @change="updateStyle({ strokeStyle })"
              >
                <option v-for="style in strokeStyles" :key="style.value" :value="style.value">
                  {{ style.label }}
                </option>
              </select>
            </div>

            <div v-if="showFillOptions" class="flex items-center gap-2">
              <span class="text-xs text-gray-500">Remplissage</span>
              <input
                type="color"
                v-model="fillColor"
                class="w-6 h-6"
                @change="updateStyle({ fillColor })"
                title="Couleur de remplissage"
              />
              <input
                type="range"
                v-model="fillOpacity"
                min="0"
                max="1"
                step="0.1"
                class="flex-1"
                @change="updateStyle({ fillOpacity })"
                title="Opacité du remplissage"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import L from 'leaflet';

interface ShapeType {
  type: keyof typeof typeTranslations;
  properties: any;
  layer?: any;
  options?: {
    fillColor?: string;
    fillOpacity?: number;
    color?: string;
    opacity?: number;
    weight?: number;
    dashArray?: string;
  };
}

const props = defineProps<{
  currentTool: string;
  selectedShape: ShapeType | null;
}>();

const emit = defineEmits<{
  (e: 'tool-change', tool: string): void;
  (e: 'style-update', style: any): void;
  (e: 'delete-shape'): void;
}>();

const drawingTools = [
  { type: 'Circle', label: 'Cercle' },
  { type: 'Semicircle', label: 'Demi-cercle' },
  { type: 'Rectangle', label: 'Rectangle' },
  { type: 'Polygon', label: 'Polygone' },
  { type: 'Line', label: 'Ligne' },
  { type: 'Text', label: 'Texte' },
  { type: 'delete', label: 'Supprimer' }
];

// Couleurs prédéfinies
const predefinedColors = [
  '#2563EB', // Bleu
  '#DC2626', // Rouge
  '#059669', // Vert
  '#D97706', // Orange
  '#7C3AED', // Violet
  '#DB2777'  // Rose
];

// Types de trait
const strokeStyles = [
  { value: 'solid', label: 'Continu' },
  { value: 'dashed', label: 'Tirets' },
  { value: 'dotted', label: 'Pointillé' },
  { value: 'dashdot', label: 'Tiret-point' }
];

// Style
const fillColor = ref('#3B82F6');
const fillOpacity = ref(0.2);
const strokeColor = ref('#2563EB');
const strokeOpacity = ref(1);
const strokeWidth = ref(2);
const strokeStyle = ref('solid');

// Ajouter l'état pour les sections collapsables
const sectionsCollapsed = ref({
  style: false
});

// Ajouter le flag pour éviter les mises à jour récursives
let isUpdating = false;

const showFillOptions = computed(() => {
  if (!props.selectedShape?.properties?.type) return false;
  return ['Circle', 'Rectangle', 'Polygon'].includes(props.selectedShape.properties.type);
});

// Fonction pour basculer l'état des sections
const toggleSection = (section: 'style') => {
  sectionsCollapsed.value[section] = !sectionsCollapsed.value[section];
};

const getDashArray = (style: string): string => {
  switch (style) {
    case 'dashed': return '10,10';
    case 'dotted': return '2,5';
    case 'dashdot': return '10,5,2,5';
    default: return '';
  }
};

const selectPresetColor = (color: string) => {
  strokeColor.value = color;
  if (showFillOptions.value) {
    fillColor.value = color;
  }
  updateStyle({
    strokeColor: color,
    fillColor: showFillOptions.value ? color : undefined
  });
};

const updateStyle = (style: any) => {
  const updatedStyle: any = {
    ...style
  };

  // Gérer le style de trait
  if (style.strokeStyle) {
    updatedStyle.dashArray = getDashArray(style.strokeStyle);
  }

  // Convertir les valeurs numériques
  if (style.fillOpacity !== undefined) {
    updatedStyle.fillOpacity = parseFloat(style.fillOpacity);
  }
  if (style.strokeOpacity !== undefined) {
    updatedStyle.strokeOpacity = parseFloat(style.strokeOpacity);
  }
  if (style.strokeWidth !== undefined) {
    updatedStyle.weight = parseInt(style.strokeWidth);
  }

  // Mapper les propriétés pour Leaflet
  if (style.strokeColor) {
    updatedStyle.color = style.strokeColor;
  }

  emit('style-update', updatedStyle);
};

// Ajouter les traductions des types
const typeTranslations = {
  'Circle': 'Cercle',
  'Rectangle': 'Rectangle',
  'Polygon': 'Polygone',
  'Line': 'Ligne',
  'Semicircle': 'Demi-cercle',
  'unknown': 'Inconnu'
} as const;
</script>

<style scoped>
.drawing-tools {
  max-height: calc(100vh - 100px);
  overflow-y: auto;
  padding-right: 8px;
}

/* Personnaliser la scrollbar */
.drawing-tools::-webkit-scrollbar {
  width: 4px;
}

.drawing-tools::-webkit-scrollbar-track {
  background: #f1f1f1;
  border-radius: 2px;
}

.drawing-tools::-webkit-scrollbar-thumb {
  background: #cbd5e1;
  border-radius: 2px;
}

.drawing-tools::-webkit-scrollbar-thumb:hover {
  background: #94a3b8;
}

/* Animations */
.transform {
  transition: transform 0.2s ease-in-out;
}

/* Style pour les sections collapsables */
.border {
  border-color: #e5e7eb;
}

.rounded {
  border-radius: 0.375rem;
}

/* Hover effects */
button:not(:disabled):hover {
  transition: all 0.2s ease-in-out;
}

input[type="range"] {
  height: 4px;
  background: #e5e7eb;
  border-radius: 2px;
  outline: none;
}

input[type="range"]::-webkit-slider-thumb {
  -webkit-appearance: none;
  width: 12px;
  height: 12px;
  background: #3b82f6;
  border-radius: 50%;
  cursor: pointer;
  transition: all 0.2s ease-in-out;
}

input[type="range"]::-webkit-slider-thumb:hover {
  transform: scale(1.2);
}
</style> 