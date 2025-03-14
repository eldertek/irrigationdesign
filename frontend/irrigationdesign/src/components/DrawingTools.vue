<!-- DrawingTools.vue -->
<template>
  <div class="h-full flex flex-col bg-white overflow-y-auto">
    <!-- Header avec titre -->
    <div class="p-3 bg-gray-50 border-b border-gray-200">
      <h3 class="text-sm font-semibold text-gray-700">Outils de dessin</h3>
    </div>
    <!-- Outils de dessin - version compacte avec icônes -->
    <div class="p-3 border-b border-gray-200">
      <div class="grid grid-cols-4 gap-1">
        <button
          v-for="tool in drawingTools.filter(t => t.type !== 'delete')"
          :key="tool.type"
          class="flex items-center justify-center p-2 rounded border"
          :class="{ 'bg-blue-50 border-blue-200 text-blue-700': currentTool === tool.type }"
          @click="$emit('tool-change', tool.type)"
          :title="tool.label"
        >
          <span class="icon" v-html="getToolIcon(tool.type)"></span>
        </button>
      </div>
      <!-- Bouton de suppression -->
      <button
        v-if="selectedShape"
        class="w-full mt-2 p-2 rounded border border-red-200 bg-red-50 text-red-600 hover:bg-red-100"
        :class="{ 'bg-red-100': currentTool === 'delete' }"
        @click="$emit('delete-shape')"
        title="Supprimer la forme"
      >
        <svg class="w-4 h-4 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
        </svg>
      </button>
    </div>
    <!-- Sections collapsables pour les formes sélectionnées -->
    <div v-if="selectedShape && localProperties" class="flex-1 overflow-y-auto">
      <!-- Style - Section collapsable -->
      <div class="p-3 border-b border-gray-200">
        <button 
          class="flex items-center justify-between w-full text-sm font-semibold text-gray-700"
          @click="toggleSection('style')"
        >
          <span>Style</span>
          <svg 
            class="w-4 h-4"
            :class="{ 'rotate-180': !sectionsCollapsed.style }"
            fill="none" 
            stroke="currentColor" 
            viewBox="0 0 24 24"
          >
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
          </svg>
        </button>
      </div>
      <div v-show="!sectionsCollapsed.style" class="p-3">
        <!-- Couleurs prédéfinies - compact -->
        <div class="grid grid-cols-6 gap-2 mb-4">
          <button
            v-for="color in predefinedColors"
            :key="color"
            class="w-8 h-8 rounded-full"
            :style="{ backgroundColor: color }"
            @click="selectPresetColor(color)"
            :title="color"
          ></button>
        </div>
        <!-- Contrôles de style pour les formes standards (non TextRectangle) -->
        <div v-if="localProperties.type !== 'TextRectangle'" class="space-y-4">
          <div class="flex items-center gap-4">
            <span class="w-20 text-sm font-semibold text-gray-700">Contour</span>
            <div class="flex items-center gap-2">
              <input
                type="color"
                v-model="strokeColor"
                class="w-16 h-8 rounded border"
                @change="updateStyle({ strokeColor })"
                title="Couleur du contour"
              />
              <input
                type="range"
                v-model="strokeWidth"
                min="1"
                max="10"
                class="w-16 h-2 rounded-md"
                @change="updateStyle({ strokeWidth })"
                title="Épaisseur du contour"
              />
            </div>
          </div>
          <!-- Style de trait -->
          <div class="flex items-center gap-4">
            <span class="w-20 text-sm font-semibold text-gray-700">Style</span>
            <select
              v-model="strokeStyle"
              class="w-full rounded border"
              @change="updateStyle({ strokeStyle })"
            >
              <option v-for="style in strokeStyles" :key="style.value" :value="style.value">
                {{ style.label }}
              </option>
            </select>
          </div>
          <div v-if="showFillOptions" class="flex items-center gap-4">
            <span class="w-20 text-sm font-semibold text-gray-700">Remplir</span>
            <div class="flex items-center gap-2">
              <input
                type="color"
                v-model="fillColor"
                class="w-16 h-8 rounded border"
                @change="updateStyle({ fillColor })"
                title="Couleur de remplissage"
              />
              <input
                type="range"
                v-model="fillOpacity"
                min="0"
                max="1"
                step="0.1"
                class="w-16 h-2 rounded-md"
                @change="updateStyle({ fillOpacity })"
                title="Opacité du remplissage"
              />
            </div>
          </div>
        </div>
        <!-- Options spécifiques au TextRectangle -->
        <div v-if="localProperties.type === 'TextRectangle'" class="space-y-4">
          <!-- Contour du rectangle avec texte -->
          <div class="flex items-center gap-4">
            <span class="w-20 text-sm font-semibold text-gray-700">Contour</span>
            <div class="flex items-center gap-2">
              <input
                type="color"
                v-model="strokeColor"
                class="w-16 h-8 rounded border"
                @change="updateStyle({ strokeColor })"
                title="Couleur du contour"
              />
              <input
                type="range"
                v-model="strokeWidth"
                min="1"
                max="10"
                class="w-16 h-2 rounded-md"
                @change="updateStyle({ strokeWidth })"
                title="Épaisseur du contour"
              />
            </div>
          </div>
          <!-- Remplissage du rectangle -->
          <div class="flex items-center gap-4">
            <span class="w-20 text-sm font-semibold text-gray-700">Remplir</span>
            <div class="flex items-center gap-2">
              <input
                type="color"
                v-model="fillColor"
                class="w-16 h-8 rounded border"
                @change="updateStyle({ fillColor })"
                title="Couleur de remplissage"
              />
              <input
                type="range"
                v-model="fillOpacity"
                min="0"
                max="1"
                step="0.1"
                class="w-16 h-2 rounded-md"
                @change="updateStyle({ fillOpacity })"
                title="Opacité du remplissage"
              />
            </div>
          </div>
          <!-- Contrôles spécifiques au texte -->
          <div class="flex items-center gap-4">
            <span class="w-20 text-sm font-semibold text-gray-700">Texte</span>
            <div class="flex items-center gap-2">
              <input
                type="color"
                v-model="textColor"
                class="w-16 h-8 rounded border"
                @change="updateTextStyle({ textColor })"
                title="Couleur du texte"
              />
            </div>
          </div>
          <!-- Police et alignement -->
          <div class="flex items-center gap-4">
            <span class="w-20 text-sm font-semibold text-gray-700">Police</span>
            <div class="flex items-center gap-2">
              <select
                v-model="fontFamily"
                class="w-full rounded border"
                @change="updateTextStyle({ fontFamily })"
              >
                <option value="Arial, sans-serif">Arial</option>
                <option value="'Times New Roman', serif">Times</option>
                <option value="'Courier New', monospace">Courier</option>
                <option value="Georgia, serif">Georgia</option>
                <option value="Verdana, sans-serif">Verdana</option>
              </select>
            </div>
          </div>
          <div class="flex items-center gap-4">
            <span class="w-20 text-sm font-semibold text-gray-700">Align.</span>
            <div class="flex items-center gap-2">
              <button
                v-for="align in textAlignOptions"
                :key="align.value"
                class="flex items-center justify-center p-2 rounded border"
                :class="{ 'bg-blue-50 border-blue-200 text-blue-700': currentTextAlign === align.value }"
                @click="updateTextStyle({ textAlign: align.value })"
                :title="align.label"
              >
                <span v-html="align.icon"></span>
              </button>
              <button
                class="flex items-center justify-center p-2 rounded border"
                :class="{ 'bg-blue-50 border-blue-200 text-blue-700': isBold }"
                @click="toggleBold"
                title="Gras"
              >
                B
              </button>
              <button
                class="flex items-center justify-center p-2 rounded border"
                :class="{ 'bg-blue-50 border-blue-200 text-blue-700': isItalic }"
                @click="toggleItalic"
                title="Italique"
              >
                I
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
    <!-- Propriétés - Section collapsable -->
    <div v-if="selectedShape && localProperties && localProperties.type !== 'TextRectangle'" class="p-3 border-t border-gray-200">
      <button 
        class="flex items-center justify-between w-full text-sm font-semibold text-gray-700"
        @click="toggleSection('properties')"
      >
        <span>Propriétés</span>
        <svg 
          class="w-4 h-4"
          :class="{ 'rotate-180': !sectionsCollapsed.properties }"
          fill="none" 
          stroke="currentColor" 
          viewBox="0 0 24 24"
        >
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      <div v-show="!sectionsCollapsed.properties" class="mt-3">
        <div v-if="localProperties">
          <!-- Tableau compact des propriétés pour tous les types -->
          <div class="grid grid-cols-1 gap-4">
            <!-- Cercle -->
            <template v-if="localProperties.type === 'Circle'">
              <span class="text-sm font-semibold text-gray-700">Rayon :</span>
              <span class="text-sm font-medium text-gray-500">{{ formatMeasure(localProperties.radius || 0) }}</span>
              <span class="text-sm font-semibold text-gray-700">Surface :</span>
              <span class="text-sm font-medium text-gray-500">{{ formatArea(localProperties.area || 0) }}</span>
            </template>
            <!-- Rectangle -->
            <template v-else-if="localProperties.type === 'Rectangle'">
              <span class="text-sm font-semibold text-gray-700">Largeur :</span>
              <span class="text-sm font-medium text-gray-500">{{ formatMeasure(localProperties.width || 0) }}</span>
              <span class="text-sm font-semibold text-gray-700">Hauteur :</span>
              <span class="text-sm font-medium text-gray-500">{{ formatMeasure(localProperties.height || 0) }}</span>
              <span class="text-sm font-semibold text-gray-700">Surface :</span>
              <span class="text-sm font-medium text-gray-500">{{ formatArea(localProperties.area || 0) }}</span>
            </template>
            <!-- Demi-cercle -->
            <template v-else-if="localProperties.type === 'Semicircle'">
              <span class="text-sm font-semibold text-gray-700">Rayon :</span>
              <span class="text-sm font-medium text-gray-500">{{ formatMeasure(localProperties.radius || 0) }}</span>
              <span class="text-sm font-semibold text-gray-700">Surface :</span>
              <span class="text-sm font-medium text-gray-500">{{ formatArea(localProperties.area || 0) }}</span>
              <span class="text-sm font-semibold text-gray-700">Angle :</span>
              <span class="text-sm font-medium text-gray-500">{{ formatAngle(localProperties.openingAngle || 0) }}</span>
            </template>
            <!-- Ligne -->
            <template v-else-if="localProperties.type === 'Line'">
              <span class="text-sm font-semibold text-gray-700">Longueur :</span>
              <span class="text-sm font-medium text-gray-500">{{ formatMeasure(localProperties.length || 0) }}</span>
            </template>
            <!-- Polygone -->
            <template v-else-if="localProperties.type === 'Polygon'">
              <span class="text-sm font-semibold text-gray-700">Surface :</span>
              <span class="text-sm font-medium text-gray-500">{{ formatArea(localProperties.area || 0) }}</span>
              <span class="text-sm font-semibold text-gray-700">Périmètre :</span>
              <span class="text-sm font-medium text-gray-500">{{ formatMeasure(localProperties.perimeter || 0) }}</span>
            </template>
            <!-- ElevationLine -->
            <template v-else-if="localProperties.type === 'ElevationLine'">
              <!-- Propriétés sur une seule colonne -->
              <div class="flex flex-col space-y-2 w-full">
                <div class="flex justify-between items-center">
                  <span class="text-sm font-semibold text-gray-700 whitespace-nowrap">Distance totale :</span>
                  <span class="text-sm font-medium text-gray-500 ml-2">{{ formatMeasure(localProperties.length || 0) }}</span>
                </div>
                
                <div class="flex justify-between items-center">
                  <span class="text-sm font-semibold text-gray-700 whitespace-nowrap">Dénivelé + :</span>
                  <span class="text-sm font-medium text-gray-500 ml-2">{{ formatMeasure(localProperties.elevationGain || 0) }}</span>
                </div>
                
                <div class="flex justify-between items-center">
                  <span class="text-sm font-semibold text-gray-700 whitespace-nowrap">Dénivelé - :</span>
                  <span class="text-sm font-medium text-gray-500 ml-2">{{ formatMeasure(localProperties.elevationLoss || 0) }}</span>
                </div>
                
                <div class="flex justify-between items-center">
                  <span class="text-sm font-semibold text-gray-700 whitespace-nowrap">Pente moy. :</span>
                  <span class="text-sm font-medium text-gray-500 ml-2">{{ formatSlope(localProperties.averageSlope || 0) }}</span>
                </div>
                
                <div class="flex justify-between items-center">
                  <span class="text-sm font-semibold text-gray-700 whitespace-nowrap">Pente max :</span>
                  <span class="text-sm font-medium text-gray-500 ml-2">{{ formatSlope(localProperties.maxSlope || 0) }}</span>
                </div>
              </div>

              <!-- Graphique du profil sur toute la largeur -->
              <div 
                ref="elevationProfileContainer"
                class="elevation-profile-container w-full h-48 bg-gray-50 rounded border border-gray-200 relative mt-4"
                @mousemove="handleProfileHover"
                @mouseleave="handleProfileLeave"
              >
                <canvas ref="elevationCanvas"></canvas>
              </div>
            </template>
          </div>
        </div>
        <div v-else class="text-center text-sm text-gray-500">
          Aucune propriété disponible
        </div>
      </div>
    </div>
    <!-- Section de personnalisation des points d'échantillonnage -->
    <div v-if="selectedShape && localProperties && localProperties.type === 'ElevationLine'" class="p-3 border-t border-gray-200">
      <!-- Section Points d'échantillonnage (toujours fermée par défaut) -->
      <button 
        class="flex items-center justify-between w-full text-sm font-semibold text-gray-700"
        @click="toggleSection('samplePoints')"
      >
        <span>Points d'échantillonnage</span>
        <svg 
          class="w-4 h-4"
          :class="{ 'rotate-180': !sectionsCollapsed.samplePoints }"
          fill="none" 
          stroke="currentColor" 
          viewBox="0 0 24 24"
        >
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      <div v-show="!sectionsCollapsed.samplePoints" class="mt-3">
        <!-- Points normaux -->
        <div class="mb-4">
          <h4 class="text-sm font-semibold mb-2">Points normaux</h4>
          <div class="grid grid-cols-2 gap-2">
            <div>
              <label class="text-xs text-gray-600">Taille</label>
              <input type="number" v-model="samplePointStyle.radius" min="2" max="10" step="1" 
                     class="w-full px-2 py-1 border rounded" @change="updateSamplePointStyle">
            </div>
            <div>
              <label class="text-xs text-gray-600">Couleur</label>
              <input type="color" v-model="samplePointStyle.color" 
                     class="w-full h-8 px-1 border rounded" @change="updateSamplePointStyle">
            </div>
            <div>
              <label class="text-xs text-gray-600">Opacité</label>
              <input type="range" v-model="samplePointStyle.fillOpacity" min="0" max="1" step="0.1" 
                     class="w-full" @change="updateSamplePointStyle">
            </div>
            <div>
              <label class="text-xs text-gray-600">Bordure</label>
              <input type="number" v-model="samplePointStyle.weight" min="1" max="5" step="1" 
                     class="w-full px-2 py-1 border rounded" @change="updateSamplePointStyle">
            </div>
          </div>
        </div>

        <!-- Points min/max -->
        <div>
          <h4 class="text-sm font-semibold mb-2">Points min/max</h4>
          <div class="grid grid-cols-2 gap-2">
            <div>
              <label class="text-xs text-gray-600">Taille</label>
              <input type="number" v-model="minMaxPointStyle.radius" min="4" max="12" step="1" 
                     class="w-full px-2 py-1 border rounded" @change="updateMinMaxPointStyle">
            </div>
            <div>
              <label class="text-xs text-gray-600">Bordure</label>
              <input type="number" v-model="minMaxPointStyle.weight" min="1" max="5" step="1" 
                     class="w-full px-2 py-1 border rounded" @change="updateMinMaxPointStyle">
            </div>
            <div>
              <label class="text-xs text-gray-600">Opacité</label>
              <input type="range" v-model="minMaxPointStyle.fillOpacity" min="0" max="1" step="0.1" 
                     class="w-full" @change="updateMinMaxPointStyle">
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue';
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
interface ShapeProperties {
  type: string;
  radius?: number;
  diameter?: number;
  area?: number;
  perimeter?: number;
  width?: number;
  height?: number;
  arcLength?: number;
  openingAngle?: number;
  length?: number;
  dimensions?: {
    width: number;
  };
  surfaceInfluence?: number;
  style?: any;
  rotation?: number;
  text?: string;
  // Propriétés spécifiques au profil altimétrique
  minElevation?: number;
  maxElevation?: number;
  elevationGain?: number;
  elevationLoss?: number;
  averageSlope?: number;
  maxSlope?: number;
  elevationData?: Array<{ distance: number; elevation: number }>;
}
interface ElevationData {
  distance: number;
  elevation: number;
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
// Variables réactives pour les propriétés et styles
const localProperties = ref<ShapeProperties | null>(null);
const textContent = ref('Double-cliquez pour éditer');
// Style
const fillColor = ref('#3B82F6');
const fillOpacity = ref(0.2);
const strokeColor = ref('#2563EB');
const strokeWidth = ref(2);
const strokeStyle = ref('solid');
// Styles spécifiques au texte
const textColor = ref('#000000');
const fontFamily = ref('Arial, sans-serif');
const textAlign = ref('center');
const isBold = ref(false);
const isItalic = ref(false);
// Sections collapsables
const sectionsCollapsed = ref({
  style: false,
  properties: false,
  samplePoints: true,
  elevationProfile: false
});
// Styles des points d'échantillonnage
const samplePointStyle = ref({
  radius: 4,
  color: '#FF4500',
  fillColor: '#FF4500',
  fillOpacity: 0.6,
  weight: 2,
  opacity: 0.8
});
// Styles des points min/max
const minMaxPointStyle = ref({
  radius: 6,
  weight: 3,
  opacity: 1,
  fillOpacity: 1
});
// Computed pour l'alignement actuel
const currentTextAlign = computed(() => {
  if (!props.selectedShape?.properties || props.selectedShape.properties.type !== 'TextRectangle') {
    return 'center';
  }
  return props.selectedShape.properties.style?.textAlign || 'center';
});
// Watchers
watch(
  () => props.selectedShape,
  (newShape) => {
    if (!newShape) {
      // Réinitialiser tous les styles aux valeurs par défaut
      localProperties.value = null;
      textAlign.value = 'center';
      isBold.value = false;
      isItalic.value = false;
      textContent.value = 'Double-cliquez pour éditer';
      // Réinitialiser les styles de base
      fillColor.value = '#3B82F6';
      fillOpacity.value = 0.2;
      strokeColor.value = '#2563EB';
      strokeWidth.value = 2;
      strokeStyle.value = 'solid';
      textColor.value = '#000000';
      fontFamily.value = 'Arial, sans-serif';
      return;
    }

    console.log('[DrawingTools] Changement de forme sélectionnée', {
      newShape,
      properties: newShape?.properties,
      type: newShape?.properties?.type,
      elevationData: newShape?.properties?.elevationData,
      length: newShape?.properties?.length,
      minElevation: newShape?.properties?.minElevation,
      maxElevation: newShape?.properties?.maxElevation,
      elevationGain: newShape?.properties?.elevationGain,
      elevationLoss: newShape?.properties?.elevationLoss,
      averageSlope: newShape?.properties?.averageSlope,
      maxSlope: newShape?.properties?.maxSlope
    });

    if (newShape) {
      localProperties.value = { ...newShape.properties };
      
      if (localProperties.value) {
        console.log('[DrawingTools] localProperties mis à jour', {
          type: localProperties.value.type,
          elevationData: localProperties.value.elevationData,
          length: localProperties.value.length,
          minElevation: localProperties.value.minElevation,
          maxElevation: localProperties.value.maxElevation,
          elevationGain: localProperties.value.elevationGain,
          elevationLoss: localProperties.value.elevationLoss,
          averageSlope: localProperties.value.averageSlope,
          maxSlope: localProperties.value.maxSlope
        });
      }
      
      // Récupérer les styles de la forme sélectionnée
      const style = newShape.properties?.style || {};
      
      // Mettre à jour les styles de base avec ceux de la forme
      fillColor.value = style.fillColor || '#3B82F6';
      fillOpacity.value = style.fillOpacity !== undefined ? style.fillOpacity : 0.2;
      strokeColor.value = style.color || '#2563EB';
      strokeWidth.value = style.weight || 2;
      strokeStyle.value = style.dashArray ? 'dashed' : 'solid';

      // Si c'est un TextRectangle, initialiser les propriétés de style de texte
      if (newShape.properties?.type === 'TextRectangle') {
        const textStyle = style.textStyle || {};
        textColor.value = textStyle.color || '#000000';
        fontFamily.value = textStyle.fontFamily || 'Arial, sans-serif';
        textAlign.value = textStyle.textAlign || 'center';
        isBold.value = textStyle.bold || false;
        isItalic.value = textStyle.italic || false;
        textContent.value = newShape.properties.text || 'Double-cliquez pour éditer';
        console.log('[DrawingTools] Initialisation du TextRectangle', {
          text: textContent.value,
          style: style
        });
      }

      // Initialiser les styles des points pour ElevationLine
      if (newShape.properties?.type === 'ElevationLine') {
        samplePointStyle.value = { ...newShape.properties.samplePointStyle };
        minMaxPointStyle.value = { ...newShape.properties.minMaxPointStyle };
      }
    } else {
      localProperties.value = null;
    }
  },
  { immediate: true, deep: true }
);
// Watcher pour les changements de texte
watch(
  () => props.selectedShape?.properties?.text,
  (newText) => {
    if (props.selectedShape?.properties?.type === 'TextRectangle') {
      console.log('[DrawingTools] Mise à jour du texte :', newText);
      textContent.value = newText || 'Double-cliquez pour éditer';
    }
  },
  { immediate: true }
);
// Watcher pour les changements de style
watch(
  () => props.selectedShape?.properties?.style,
  (newStyle) => {
    if (props.selectedShape?.properties && 
        props.selectedShape.properties.type === 'TextRectangle' && 
        newStyle) {
      // Mettre à jour les contrôles de style avec les nouvelles valeurs
      textColor.value = newStyle.textColor || '#000000';
      fontFamily.value = newStyle.fontFamily || 'Arial, sans-serif';
      isBold.value = newStyle.bold || false;
      isItalic.value = newStyle.italic || false;
    }
  },
  { deep: true }
);
// Debounce function to limit updates
const debounce = (fn: Function, delay: number) => {
  let timeout: number | null = null;
  return (...args: any[]) => {
    if (timeout !== null) {
      clearTimeout(timeout);
    }
    timeout = window.setTimeout(() => {
      fn(...args);
      timeout = null;
    }, delay);
  };
};
// Flag to prevent unnecessary update loops
let isUpdatingFromProps = false;
// Helper function to determine if two objects are deeply equal
const isEqual = (obj1: any, obj2: any): boolean => {
  if (obj1 === obj2) return true;
  if (obj1 === null || obj2 === null) return false;
  if (typeof obj1 !== 'object' || typeof obj2 !== 'object') return obj1 === obj2;
  const keys1 = Object.keys(obj1);
  const keys2 = Object.keys(obj2);
  if (keys1.length !== keys2.length) return false;
  for (const key of keys1) {
    if (!keys2.includes(key)) return false;
    if (!isEqual(obj1[key], obj2[key])) return false;
  }
  return true;
};
// Debounced handler for property changes to reduce log spam
const handlePropertyChange = debounce((newProperties: any, oldProperties: any) => {
  if (isUpdatingFromProps) return;
  console.log('[DrawingTools] Changement détecté dans localProperties', {
    newProperties,
    oldProperties,
    selectedShape: props.selectedShape
  });
}, 300); // Debounce 300ms
// Optimized watcher for local properties
watch(
  () => localProperties.value,
  (newProperties, oldProperties) => {
    if (newProperties && oldProperties && !isEqual(newProperties, oldProperties)) {
      handlePropertyChange(newProperties, oldProperties);
    }
  },
  { deep: true }
);
// Icônes pour les outils (SVG)
const getToolIcon = (toolType: string) => {
  const icons: Record<string, string> = {
    'Circle': '<svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10" /></svg>',
    'Semicircle': '<svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 12a10 10 0 0 1 20 0" /></svg>',
    'Rectangle': '<svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2" /></svg>',
    'Polygon': '<svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 3l9 7-3 9H6l-3-9 9-7z" /></svg>',
    'delete': '<svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2" /><line x1="10" y1="11" x2="10" y2="17" /><line x1="14" y1="11" x2="14" y2="17" /></svg>',
    'Line': '<svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 19l18-14" /></svg>',
    'TextRectangle': '<svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" /><path d="M9 8h6m-3 0v8" /></svg>',
    'ElevationLine': '<svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 12h3l3-9 6 18 3-9h3" /></svg>'
  };
  return icons[toolType] || '';
};
const drawingTools = [
  { type: 'Circle', label: 'Cercle' },
  { type: 'Semicircle', label: 'Demi-cercle' },
  { type: 'Rectangle', label: 'Rectangle' },
  { type: 'Polygon', label: 'Polygone' },
  { type: 'Line', label: 'Ligne' },
  { type: 'ElevationLine', label: 'Profil altimétrique' },
  { type: 'TextRectangle', label: 'Texte' },
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
// Options d'alignement de texte
const textAlignOptions = [
  { value: 'left', label: 'Aligné à gauche', icon: '&#8678;' },
  { value: 'center', label: 'Centré', icon: '&#8645;' },
  { value: 'right', label: 'Aligné à droite', icon: '&#8680;' }
];
const showFillOptions = computed(() => {
  const shapeType = props.selectedShape?.properties?.type;
  console.log('[DrawingTools] Calcul de showFillOptions', {
    shapeType,
    selectedShape: props.selectedShape
  });
  if (!shapeType) return false;
  return ['Circle', 'Rectangle', 'Polygon', 'Semicircle'].includes(shapeType) && shapeType !== 'ElevationLine';
});
// Fonction pour basculer l'état des sections
const toggleSection = (section: 'style' | 'properties' | 'samplePoints' | 'elevationProfile') => {
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
  if (showFillOptions.value || localProperties.value?.type === 'TextRectangle') {
    fillColor.value = color;
  }
  updateStyle({
    strokeColor: color,
    fillColor: (showFillOptions.value || localProperties.value?.type === 'TextRectangle') ? color : undefined
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
// Fonction spécifique pour mettre à jour le style du texte
const updateTextStyle = (style: any) => {
  if (props.selectedShape?.properties?.type !== 'TextRectangle') return;
  // Créer un objet de style complet avec les valeurs actuelles
  const updatedStyle = {
    textColor: props.selectedShape.properties.style?.textColor,
    fontFamily: props.selectedShape.properties.style?.fontFamily,
    textAlign: props.selectedShape.properties.style?.textAlign,
    bold: props.selectedShape.properties.style?.bold,
    italic: props.selectedShape.properties.style?.italic,
    ...style // Écraser avec les nouvelles valeurs
  };
  // Émettre l'événement avec le style complet
  emit('style-update', updatedStyle);
};
// Fonctions pour le texte
const toggleBold = () => {
  isBold.value = !isBold.value;
  updateTextStyle({ bold: isBold.value });
};
const toggleItalic = () => {
  isItalic.value = !isItalic.value;
  updateTextStyle({ italic: isItalic.value });
};
// Ajouter les traductions des types
const typeTranslations = {
  'Circle': 'Cercle',
  'Rectangle': 'Rectangle',
  'Polygon': 'Polygone',
  'Line': 'Ligne',
  'Semicircle': 'Demi-cercle',
  'TextRectangle': 'Rectangle avec texte',
  'ElevationLine': 'Profil altimétrique',
  'unknown': 'Inconnu'
} as const;
// Fonction pour formater les mesures
const formatMeasure = (value: number): string => {
  if (!value) return '0 m';
  if (value >= 1000) {
    return `${(value / 1000).toFixed(2)} km`;
  }
  return `${value.toFixed(2)} m`;
};
// Fonction pour formater les surfaces en hectares
const formatArea = (value: number): string => {
  if (!value) return '0 ha';
  return `${(value / 10000).toFixed(2)} ha`;
};
// Fonction pour formater les angles
const formatAngle = (angle: number): string => {
  if (!angle) return '0°';
  return `${((angle % 360 + 360) % 360).toFixed(1)}°`;
};
// Mettre à jour les styles des points
const updateSamplePointStyle = () => {
  if (props.selectedShape?.properties?.type === 'ElevationLine') {
    const style = {
      ...samplePointStyle.value,
      fillColor: samplePointStyle.value.color
    };
    (props.selectedShape.layer as any).setSamplePointStyle(style);
  }
};
const updateMinMaxPointStyle = () => {
  if (props.selectedShape?.properties?.type === 'ElevationLine') {
    (props.selectedShape.layer as any).setMinMaxPointStyle(minMaxPointStyle.value);
  }
};
// Nouvelles propriétés pour le graphique
const elevationCanvas = ref<HTMLCanvasElement | null>(null);
const canvasContext = ref<CanvasRenderingContext2D | null>(null);
// Nouvelle méthode pour formater les pentes
const formatSlope = (slope: number): string => {
  return `${slope.toFixed(1)}%`;
};
// Méthode pour dessiner le graphique
const drawElevationProfile = () => {
  if (!elevationCanvas.value || !props.selectedShape?.properties?.elevationData) {
    console.log('[DrawingTools] Impossible de dessiner le profil : canvas ou données manquantes', {
      canvas: !!elevationCanvas.value,
      data: !!props.selectedShape?.properties?.elevationData
    });
    return;
  }
  
  console.log('[DrawingTools] Dessin du profil avec les données:', {
    data: props.selectedShape.properties.elevationData,
    minElevation: props.selectedShape.properties.minElevation,
    maxElevation: props.selectedShape.properties.maxElevation
  });
  
  const ctx = elevationCanvas.value.getContext('2d');
  if (!ctx) return;
  
  canvasContext.value = ctx;
  const canvas = elevationCanvas.value;
  const data = props.selectedShape.properties.elevationData;
  
  // Ajuster la taille du canvas pour la résolution
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  
  // Définir la taille réelle du canvas en pixels
  canvas.width = rect.width * dpr;
  canvas.height = rect.height * dpr;
  
  // Ajuster le style CSS pour maintenir la taille d'affichage
  canvas.style.width = `${rect.width}px`;
  canvas.style.height = `${rect.height}px`;
  
  // Mettre à l'échelle le contexte
  ctx.scale(dpr, dpr);
  
  // Effacer le canvas
  ctx.clearRect(0, 0, rect.width, rect.height);
  
  // Calculer les dimensions utiles
  const padding = 30; // Augmenter le padding pour plus d'espace
  const width = rect.width - 2 * padding;
  const height = rect.height - 2 * padding;
  
  // Trouver les valeurs min/max
  const minElevation = props.selectedShape.properties.minElevation;
  const maxElevation = props.selectedShape.properties.maxElevation;
  const elevationRange = maxElevation - minElevation;
  
  // Ajouter une marge de 5% au-dessus et en-dessous
  const margin = elevationRange * 0.05;
  const yMin = minElevation - margin;
  const yMax = maxElevation + margin;
  
  // Fonctions de conversion
  const scaleX = (distance: number) => padding + (distance / data[data.length - 1].distance) * width;
  const scaleY = (elevation: number) => padding + height - ((elevation - yMin) / (yMax - yMin)) * height;
  
  // Dessiner le fond
  ctx.fillStyle = '#f8fafc';
  ctx.fillRect(padding, padding, width, height);
  
  // Dessiner la grille
  ctx.strokeStyle = '#e2e8f0';
  ctx.lineWidth = 1;
  
  // Dessiner les axes
  ctx.beginPath();
  ctx.moveTo(padding, padding);
  ctx.lineTo(padding, height + padding);
  ctx.lineTo(width + padding, height + padding);
  ctx.strokeStyle = '#94a3b8';
  ctx.stroke();
  
  // Graduations Y (altitude)
  const numYTicks = 5;
  for (let i = 0; i <= numYTicks; i++) {
    const elevation = yMin + (i / numYTicks) * (yMax - yMin);
    const y = scaleY(elevation);
    
    // Ligne de grille horizontale
    ctx.beginPath();
    ctx.strokeStyle = '#e2e8f0';
    ctx.moveTo(padding, y);
    ctx.lineTo(width + padding, y);
    ctx.stroke();
    
    // Graduation et label
    ctx.beginPath();
    ctx.strokeStyle = '#94a3b8';
    ctx.moveTo(padding - 5, y);
    ctx.lineTo(padding, y);
    ctx.stroke();
    
    ctx.fillStyle = '#64748b';
    ctx.font = '10px sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(`${Math.round(elevation)}m`, padding - 8, y + 4);
  }
  
  // Graduations X (distance)
  const numXTicks = 5;
  const maxDistance = data[data.length - 1].distance;
  for (let i = 0; i <= numXTicks; i++) {
    const distance = (i / numXTicks) * maxDistance;
    const x = scaleX(distance);
    
    // Ligne de grille verticale
    ctx.beginPath();
    ctx.strokeStyle = '#e2e8f0';
    ctx.moveTo(x, padding);
    ctx.lineTo(x, height + padding);
    ctx.stroke();
    
    // Graduation et label
    ctx.beginPath();
    ctx.strokeStyle = '#94a3b8';
    ctx.moveTo(x, height + padding);
    ctx.lineTo(x, height + padding + 5);
    ctx.stroke();
    
    ctx.fillStyle = '#64748b';
    ctx.font = '10px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`${Math.round(distance)}m`, x, height + padding + 16);
  }
  
  // Dessiner la courbe avec un dégradé
  const gradient = ctx.createLinearGradient(0, padding, 0, height + padding);
  gradient.addColorStop(0, 'rgba(255, 69, 0, 0.8)');  // Orange plus foncé en haut
  gradient.addColorStop(1, 'rgba(255, 69, 0, 0.2)');  // Orange plus clair en bas
  
  // Dessiner la courbe
  ctx.beginPath();
  ctx.moveTo(scaleX(data[0].distance), scaleY(data[0].elevation));
  data.forEach((point: ElevationData, i: number) => {
    if (i > 0) {
      ctx.lineTo(scaleX(point.distance), scaleY(point.elevation));
    }
  });
  
  // Tracer la courbe
  ctx.strokeStyle = '#FF4500';
  ctx.lineWidth = 2;
  ctx.stroke();
  
  // Remplir sous la courbe
  ctx.lineTo(scaleX(data[data.length - 1].distance), scaleY(yMin));
  ctx.lineTo(scaleX(data[0].distance), scaleY(yMin));
  ctx.closePath();
  ctx.fillStyle = gradient;
  ctx.fill();
  
  // Ajouter les points d'échantillonnage
  data.forEach((point: ElevationData) => {
    ctx.beginPath();
    ctx.arc(scaleX(point.distance), scaleY(point.elevation), 3, 0, Math.PI * 2);
    ctx.fillStyle = '#FF4500';
    ctx.fill();
    ctx.strokeStyle = 'white';
    ctx.lineWidth = 1;
    ctx.stroke();
  });
  
  console.log('[DrawingTools] Profil dessiné avec succès');
};
// Gestionnaire d'événements pour le survol
const handleProfileHover = (e: MouseEvent) => {
  if (!elevationCanvas.value || !props.selectedShape?.properties?.elevationData) return;
  
  const rect = elevationCanvas.value.getBoundingClientRect();
  const x = e.clientX - rect.left;
  
  const data = props.selectedShape.properties.elevationData;
  const padding = 30; // Utiliser la même valeur de padding que dans drawElevationProfile
  const width = rect.width - 2 * padding;
  
  // Calculer la distance correspondante en tenant compte du padding
  const distance = Math.max(0, Math.min(
    ((x - padding) / width) * data[data.length - 1].distance,
    data[data.length - 1].distance
  ));
  
  // Trouver le point le plus proche
  const point = data.reduce((prev: ElevationData, curr: ElevationData) => 
    Math.abs(curr.distance - distance) < Math.abs(prev.distance - distance) ? curr : prev
  );

  // Mettre à jour le marqueur sur la carte avec le tooltip
  if (props.selectedShape && props.selectedShape.layer && typeof props.selectedShape.layer.showElevationAt === 'function') {
    props.selectedShape.layer.showElevationAt(point.distance);
  }

  // Dessiner l'indicateur de position sur le graphique
  drawElevationProfile(); // Redessiner le graphique pour effacer l'ancien indicateur
  
  // Ajouter l'indicateur de position
  if (canvasContext.value) {
    const ctx = canvasContext.value;
    const rect = elevationCanvas.value.getBoundingClientRect();
    
    // Utiliser les mêmes fonctions de mise à l'échelle que dans drawElevationProfile
    const width = rect.width - 2 * padding;
    const height = rect.height - 2 * padding;
    const minElevation = props.selectedShape.properties.minElevation;
    const maxElevation = props.selectedShape.properties.maxElevation;
    const margin = (maxElevation - minElevation) * 0.05;
    const yMin = minElevation - margin;
    const yMax = maxElevation + margin;
    
    const scaleX = (d: number) => padding + (d / data[data.length - 1].distance) * width;
    const scaleY = (e: number) => padding + height - ((e - yMin) / (yMax - yMin)) * height;
    
    // Dessiner une ligne verticale
    ctx.beginPath();
    ctx.setLineDash([5, 5]);
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.3)';
    ctx.lineWidth = 1;
    ctx.moveTo(scaleX(point.distance), padding);
    ctx.lineTo(scaleX(point.distance), height + padding);
    ctx.stroke();
    ctx.setLineDash([]);
    
    // Dessiner un point plus gros à l'intersection
    ctx.beginPath();
    ctx.arc(scaleX(point.distance), scaleY(point.elevation), 6, 0, Math.PI * 2);
    ctx.fillStyle = '#FF4500';
    ctx.fill();
    ctx.strokeStyle = 'white';
    ctx.lineWidth = 2;
    ctx.stroke();
  }
};
// Gestionnaire pour quitter le graphique
const handleProfileLeave = () => {
  // Redessiner le graphique sans l'indicateur
  drawElevationProfile();
  
  // Cacher le marqueur sur la carte
  if (props.selectedShape && props.selectedShape.layer && typeof props.selectedShape.layer.hideElevationMarker === 'function') {
    props.selectedShape.layer.hideElevationMarker();
  }
};
// Observer les changements de taille
const resizeObserver = new ResizeObserver(() => {
  drawElevationProfile();
});
// Cycle de vie du composant
onMounted(() => {
  if (elevationCanvas.value) {
    resizeObserver.observe(elevationCanvas.value);
  }
  
  // Ajouter un gestionnaire de redimensionnement de fenêtre
  window.addEventListener('resize', handleResize);
});
onUnmounted(() => {
  if (elevationCanvas.value) {
    resizeObserver.unobserve(elevationCanvas.value);
  }
  
  // Nettoyer le gestionnaire de redimensionnement
  window.removeEventListener('resize', handleResize);
});
// Surveiller les changements de données d'élévation
watch(
  () => props.selectedShape?.properties?.elevationData,
  () => {
    nextTick(() => {
      if (elevationCanvas.value && elevationProfileContainer.value) {
        const containerRect = elevationProfileContainer.value.getBoundingClientRect();
        elevationCanvas.value.style.width = `${containerRect.width}px`;
        elevationCanvas.value.style.height = `${containerRect.height}px`;
        drawElevationProfile();
      }
    });
  },
  { deep: true }
);
// Ajouter après la déclaration des refs
const elevationProfileContainer = ref<HTMLElement | null>(null);

// Ajouter la fonction de gestion du redimensionnement
const handleResize = debounce(() => {
  if (elevationCanvas.value && elevationProfileContainer.value) {
    const containerRect = elevationProfileContainer.value.getBoundingClientRect();
    elevationCanvas.value.style.width = `${containerRect.width}px`;
    elevationCanvas.value.style.height = `${containerRect.height}px`;
    drawElevationProfile();
  }
}, 250);
</script>
<style scoped>
.h-full {
  height: 100%;
}
.flex {
  display: flex;
}
.flex-col {
  flex-direction: column;
}
.bg-white {
  background-color: white;
}
.overflow-y-auto {
  overflow-y: auto;
}
.p-3 {
  padding: 1rem;
}
.border-b {
  border-bottom: 1px solid #e2e8f0;
}
.text-sm {
  font-size: 0.875rem;
}
.font-semibold {
  font-weight: 600;
}
.text-gray-700 {
  color: #334155;
}
.sidebar-header {
  padding: 10px;
  background-color: #f8fafc;
  border-bottom: 1px solid #e2e8f0;
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.sidebar-title {
  font-size: 16px;
  font-weight: 600;
  color: #334155;
  margin: 0;
}
.tools-section {
  padding: 10px;
}
.tools-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 5px;
}
.tool-button {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 5px;
  border-radius: 4px;
  border: 1px solid #cbd5e1;
  background-color: white;
  color: #475569;
  transition: all 0.2s;
}
.tool-button:hover {
  background-color: #f1f5f9;
}
.tool-button.active {
  background-color: #e0f2fe;
  border-color: #7dd3fc;
  color: #0284c7;
}
.delete-button {
  display: flex;
  align-items: center;
  justify-content: center;
  margin-top: 5px;
  padding: 5px;
  width: 100%;
  border-radius: 4px;
  border: 1px solid #f87171;
  background-color: #fee2e2;
  color: #ef4444;
  transition: all 0.2s;
}
.delete-button:hover {
  background-color: #fecaca;
}
.delete-button.active {
  background-color: #fca5a5;
}
.sidebar-divider {
  height: 1px;
  background-color: #e2e8f0;
  margin: 0 10px;
}
.properties-container {
  padding: 10px;
  flex: 1;
  overflow-y: auto;
  max-height: calc(100vh - 200px); /* Ensure it doesn't overflow the viewport */
}
.sidebar-section {
  margin-bottom: 10px;
  border: 1px solid #e2e8f0;
  border-radius: 4px;
  overflow: hidden;
}
.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: 100%;
  padding: 8px 10px;
  background-color: #f8fafc;
  border: none;
  text-align: left;
  cursor: pointer;
}
.section-title {
  font-size: 14px;
  font-weight: 500;
  color: #334155;
}
.section-icon {
  width: 16px;
  height: 16px;
  transition: transform 0.2s;
}
.section-content {
  padding: 10px;
  background-color: white;
  max-height: 350px; /* Add max height to ensure it's scrollable */
  overflow-y: auto; /* Make it scrollable when content overflows */
}
/* Specific styles for text controls to ensure they're visible */
.text-controls {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding-bottom: 10px; /* Add padding to ensure last items are visible */
}
/* Ensure the style section expands when TextRectangle is selected */
.sidebar-section:has(.text-controls) .section-content {
  min-height: 250px;
}
.color-grid {
  display: grid;
  grid-template-columns: repeat(6, 1fr);
  gap: 5px;
  margin-bottom: 10px;
}
.color-button {
  width: 20px;
  height: 20px;
  border-radius: 50%;
  border: 1px solid #e2e8f0;
  cursor: pointer;
  transition: transform 0.2s;
}
.color-button:hover {
  transform: scale(1.2);
}
.style-controls, .text-controls {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.control-row {
  display: flex;
  align-items: center;
  gap: 8px;
}
.control-label {
  width: 60px;
  font-size: 12px;
  color: #64748b;
}
.control-inputs {
  display: flex;
  flex: 1;
  gap: 5px;
  align-items: center;
}
.color-input {
  width: 20px;
  height: 20px;
  padding: 0;
  border: 1px solid #e2e8f0;
  cursor: pointer;
}
.range-input {
  flex: 1;
  height: 4px;
}
.select-input {
  width: 100%;
  padding: 2px 5px;
  font-size: 12px;
  border: 1px solid #e2e8f0;
  border-radius: 3px;
  background-color: white;
}
.button-group {
  display: flex;
  border: 1px solid #e2e8f0;
  border-radius: 3px;
  overflow: hidden;
}
.align-button, .style-button {
  padding: 2px 6px;
  font-size: 12px;
  background-color: white;
  border: none;
  border-right: 1px solid #e2e8f0;
}
.align-button:last-child, .style-button:last-child {
  border-right: none;
}
.align-button.active, .style-button.active {
  background-color: #e0f2fe;
  color: #0284c7;
}
.properties-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 5px;
}
.property-label {
  font-size: 12px;
  color: #64748b;
}
.property-value {
  font-size: 12px;
  font-weight: 500;
  color: #334155;
  text-align: right;
}
.no-properties {
  text-align: center;
  color: #94a3b8;
  font-size: 12px;
  padding: 10px 0;
}
/* Pour les écrans plus petits */
@media (max-width: 640px) {
  .drawing-tools-sidebar {
    width: 200px;
  }
  .sidebar-title {
    font-size: 14px;
  }
  .tool-button, .color-button {
    width: 18px;
    height: 18px;
  }
  .control-label {
    width: 50px;
    font-size: 10px;
  }
  .property-label, .property-value {
    font-size: 10px;
  }
}
/* Animations */
.rotate-180 {
  transform: rotate(180deg);
}
.toggle-switch {
  position: relative;
  display: inline-block;
  width: 100%;
  height: 24px;
}
.toggle-switch input {
  opacity: 0;
  width: 0;
  height: 0;
}
.switch-label {
  position: absolute;
  cursor: pointer;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: #e2e8f0;
  border-radius: 12px;
  transition: .4s;
  text-align: center;
  line-height: 24px;
  font-size: 12px;
  color: #475569;
}
.switch-label:before {
  position: absolute;
  content: "";
  height: 18px;
  width: 18px;
  left: 3px;
  bottom: 3px;
  background-color: white;
  border-radius: 50%;
  transition: .4s;
}
input:checked + .switch-label {
  background-color: #3b82f6;
  color: white;
}
input:checked + .switch-label:before {
  transform: translateX(calc(100% - 6px));
}
input:focus + .switch-label {
  box-shadow: 0 0 1px #3b82f6;
}
/* Styles pour les inputs de type range */
input[type="range"] {
  -webkit-appearance: none;
  appearance: none;
  width: 100%;
  height: 4px;
  border-radius: 2px;
  background: #e2e8f0;
  outline: none;
}
input[type="range"]::-webkit-slider-thumb {
  -webkit-appearance: none;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: #3B82F6;
  cursor: pointer;
}
/* Styles pour les inputs de type color */
input[type="color"] {
  -webkit-appearance: none;
  appearance: none;
  padding: 0;
  border: none;
  border-radius: 4px;
  height: 32px;
}
input[type="color"]::-webkit-color-swatch-wrapper {
  padding: 0;
}
input[type="color"]::-webkit-color-swatch {
  border: none;
  border-radius: 4px;
}
.elevation-profile-container {
  width: 100% !important;
  height: 200px;
  background-color: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 4px;
  position: relative;
  overflow: hidden;
  margin-top: 1rem;
}

canvas {
  width: 100% !important;
  height: 100%;
  display: block;
}

.elevation-tooltip {
  z-index: 1000;
  white-space: nowrap;
}

/* Ajout de styles pour les propriétés */
.whitespace-nowrap {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* Ajuster la largeur de la section des propriétés */
.properties-container {
  min-width: 280px;
  padding: 1rem;
}

/* Ajuster l'espacement des propriétés */
.space-y-2 > * + * {
  margin-top: 0.5rem;
}

/* Ajuster l'espacement entre le label et la valeur */
.flex.justify-between > .ml-2 {
  margin-left: 1rem;
}
</style> 