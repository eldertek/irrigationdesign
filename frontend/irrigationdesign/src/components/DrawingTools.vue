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
      <!-- Informations rapides -->
      <div class="bg-gray-50 p-2 rounded text-sm">
        <div class="font-medium">
          {{ shapeTitle }}
        </div>
        <div v-if="shapeProperties?.area" class="text-gray-600">
          {{ formatArea(shapeProperties.area) }}
        </div>
      </div>

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

      <!-- Propriétés - Section collapsable -->
      <div class="border rounded overflow-hidden">
        <button 
          class="w-full px-3 py-2 flex justify-between items-center bg-gray-50 hover:bg-gray-100"
          @click="toggleSection('properties')"
        >
          <span class="font-medium">Propriétés</span>
          <svg 
            class="w-5 h-5 transform transition-transform"
            :class="{ 'rotate-180': !sectionsCollapsed.properties }"
            fill="none" 
            stroke="currentColor" 
            viewBox="0 0 24 24"
          >
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
          </svg>
        </button>
        <div v-show="!sectionsCollapsed.properties" class="p-3">
          <div class="space-y-1 text-sm">
            <div v-if="shapeProperties?.surfaceInterieure">
              Surface intérieure: {{ formatArea(shapeProperties.surfaceInterieure) }}
            </div>
            <div v-if="shapeProperties?.surfaceExterieure">
              Surface extérieure: {{ formatArea(shapeProperties.surfaceExterieure) }}
            </div>
            <div v-if="shapeProperties?.length">
              Longueur: {{ formatLength(shapeProperties.length) }}
            </div>
            <div v-if="shapeProperties?.perimeter">
              Périmètre: {{ formatLength(shapeProperties.perimeter) }}
            </div>
            <div v-if="shapeProperties?.radius">
              Rayon: {{ formatLength(shapeProperties.radius) }}
            </div>
            <div v-if="shapeProperties?.width">
              Largeur: {{ formatLength(shapeProperties.width) }}
            </div>
            <div v-if="shapeProperties?.height">
              Hauteur: {{ formatLength(shapeProperties.height) }}
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, toRaw, nextTick } from 'vue';
import L from 'leaflet';
import * as turf from '@turf/turf';

interface ShapeProperties {
  type: string;
  style: {
    color: string;
    weight: number;
    opacity: number;
    fillColor: string;
    fillOpacity: number;
    dashArray: string;
    fontSize?: number;
    backgroundColor?: string;
    backgroundOpacity?: number;
    borderColor?: string;
    borderOpacity?: number;
  };
  radius?: number;
  area?: number;
  perimeter?: number;
  orientation?: number;
  width?: number;
  height?: number;
  length?: number;
  text?: string;
  backgroundColor?: string;
  borderColor?: string;
  fontSize?: number;
  surfaceInterieure?: number;
  surfaceExterieure?: number;
}

interface CircleOptions extends L.CircleMarkerOptions {
  isSemicircle?: boolean;
}

interface ShapeType {
  type: keyof typeof typeTranslations;
  properties: ShapeProperties;
  layer?: any;
  options?: {
    fillColor?: string;
    fillOpacity?: number;
    color?: string;
    opacity?: number;
    weight?: number;
    dashArray?: string;
  };
  _lastProperties?: ShapeProperties;
}

const props = defineProps<{
  currentTool: string;
  selectedShape: ShapeType | null;
}>();

const emit = defineEmits<{
  (e: 'tool-change', tool: string): void;
  (e: 'style-update', style: any): void;
  (e: 'properties-update', properties: any): void;
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
const radius = ref(0);
const startAngle = ref(0);

const showFillOptions = computed(() => {
  if (!props.selectedShape?.properties?.type) return false;
  return ['Circle', 'Rectangle', 'Polygon'].includes(props.selectedShape.properties.type);
});

// Ajouter les refs pour les propriétés du texte
const textContent = ref('');
const fontSize = ref(14);
const textBackgroundColor = ref('#FFFFFF');
const textBackgroundOpacity = ref(1);
const textBorderColor = ref('#000000');
const textBorderOpacity = ref(1);

// Ajouter l'état pour les sections collapsables
const sectionsCollapsed = ref({
  style: false,
  properties: false
});

// Ajouter le flag pour éviter les mises à jour récursives
let isUpdating = false;

// Fonction utilitaire pour comparer les valeurs numériques avec une tolérance
const hasChanged = (a: number, b: number) => Math.abs((a || 0) - (b || 0)) > 0.0001;

// Fonction pour comparer les propriétés
const propertiesHaveChanged = (newProps: any, oldProps: any) => {
  if (!oldProps) return true;
  return hasChanged(newProps.radius, oldProps.radius) ||
    hasChanged(newProps.area, oldProps.area) ||
    hasChanged(newProps.perimeter, oldProps.perimeter) ||
    hasChanged(newProps.width, oldProps.width) ||
    hasChanged(newProps.height, oldProps.height) ||
    hasChanged(newProps.length, oldProps.length);
};

// Fonction pour basculer l'état des sections
const toggleSection = (section: 'style' | 'properties') => {
  sectionsCollapsed.value[section] = !sectionsCollapsed.value[section];
};

// Ajouter une ref pour les propriétés de la forme
const shapeProperties = ref<ShapeProperties | null>(null);

// Modifier le watcher pour utiliser la ref
watch(() => [props.selectedShape, props.selectedShape?.properties], ([shape]) => {
  if (isUpdating || !shape) return;
  
  try {
    isUpdating = true;
    
    const shapeAsType = shape as ShapeType;
    
    // Vérifier si la forme a des propriétés valides
    if (!shapeAsType.properties || !shapeAsType.properties.type) {
      console.warn('Invalid shape properties detected:', toRaw(shapeAsType.properties));
      return;
    }

    // Créer une copie des propriétés actuelles
    const currentProps = toRaw(shapeAsType.properties);
    const previousProps = shapeAsType._lastProperties;

    // Vérifier si les propriétés ont réellement changé
    if (previousProps && !propertiesHaveChanged(currentProps, previousProps)) {
      console.log('No significant property changes detected');
      return;
    }

    // Créer une nouvelle référence des propriétés
    const newProperties = { ...currentProps };
    
    // Mettre à jour dans le prochain tick pour éviter les boucles
    setTimeout(() => {
      try {
        // Sauvegarder l'état pour la prochaine comparaison
        shapeAsType._lastProperties = { ...newProperties };
        
        // Mettre à jour les contrôles UI
        fillColor.value = shapeAsType.options?.fillColor || '#3B82F6';
        fillOpacity.value = shapeAsType.options?.fillOpacity || 0.2;
        strokeColor.value = shapeAsType.options?.color || '#2563EB';
        strokeOpacity.value = shapeAsType.options?.opacity || 1;
        strokeWidth.value = shapeAsType.options?.weight || 2;
        strokeStyle.value = getStrokeStyleFromDashArray(shapeAsType.options?.dashArray || '');
        
        // Mettre à jour les propriétés spécifiques
        radius.value = newProperties.radius || 0;
        startAngle.value = newProperties.orientation || 0;

        if (shapeAsType.properties.type === 'text') {
          textContent.value = newProperties.text || '';
          fontSize.value = newProperties.style?.fontSize || 14;
          textBackgroundColor.value = newProperties.style?.backgroundColor || '#FFFFFF';
          textBackgroundOpacity.value = newProperties.style?.backgroundOpacity || 1;
          textBorderColor.value = newProperties.style?.borderColor || '#000000';
          textBorderOpacity.value = newProperties.style?.borderOpacity || 1;
        }

        // Mettre à jour la ref des propriétés pour forcer la réactivité
        shapeProperties.value = { ...newProperties };
        
        // Mettre à jour les propriétés de la forme
        shapeAsType.properties = { ...newProperties };

        // Émettre l'événement avec les nouvelles propriétés
        emit('properties-update', newProperties);
      } finally {
        isUpdating = false;
      }
    }, 0);
  } catch (error) {
    console.error('Error in shape update:', error);
    isUpdating = false;
  }
}, { immediate: true, deep: true });

const getDashArray = (style: string): string => {
  switch (style) {
    case 'dashed': return '10,10';
    case 'dotted': return '2,5';
    case 'dashdot': return '10,5,2,5';
    default: return '';
  }
};

const getStrokeStyleFromDashArray = (dashArray: string | null): string => {
  if (!dashArray) return 'solid';
  switch (dashArray) {
    case '10,10': return 'dashed';
    case '2,5': return 'dotted';
    case '10,5,2,5': return 'dashdot';
    default: return 'solid';
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

const updateProperties = (properties: any) => {
  if (isUpdating) return;
  
  try {
    isUpdating = true;
    
    if (props.selectedShape?.type === 'Semicircle') {
      // Pour les demi-cercles, mettre à jour l'orientation et les angles
      const orientation = properties.startAngle || startAngle.value;
      const updatedProperties = {
        ...toRaw(properties),
        orientation,
        style: {
          ...properties.style,
          startAngle: orientation,
          stopAngle: orientation + 180
        }
      };
      
      nextTick(() => {
        try {
          // Émettre l'événement avec les nouvelles propriétés
          emit('properties-update', updatedProperties);
        } finally {
          isUpdating = false;
        }
      });
    } else {
      // Pour les autres formes, créer une nouvelle référence
      const updatedProperties = { ...toRaw(properties) };
      
      nextTick(() => {
        try {
          // Émettre l'événement avec les nouvelles propriétés
          emit('properties-update', updatedProperties);
        } finally {
          isUpdating = false;
        }
      });
    }
  } catch (error) {
    console.error('Error in updateProperties:', error);
    isUpdating = false;
  }
};

const updateTextProperties = (properties: any) => {
  if (isUpdating) return;
  
  try {
    isUpdating = true;
    
    const updatedProperties = {
      ...toRaw(properties),
      type: 'text',
      style: {
        ...properties.style,
        backgroundColor: textBackgroundColor.value,
        backgroundOpacity: textBackgroundOpacity.value,
        borderColor: textBorderColor.value,
        borderOpacity: textBorderOpacity.value,
        fontSize: `${fontSize.value}px`,
        text: textContent.value,
        padding: '5px 10px',
        borderRadius: '3px',
        fontWeight: 'normal',
        color: '#000000'
      }
    };

    nextTick(() => {
      try {
        // Créer le HTML pour l'icône
        const html = `<div style="
          background-color: ${updatedProperties.style.backgroundColor};
          border: 1px solid ${updatedProperties.style.borderColor};
          padding: ${updatedProperties.style.padding};
          border-radius: ${updatedProperties.style.borderRadius};
          font-size: ${updatedProperties.style.fontSize};
          font-weight: ${updatedProperties.style.fontWeight};
          color: ${updatedProperties.style.color};
          opacity: ${updatedProperties.style.backgroundOpacity};"
        >${updatedProperties.style.text}</div>`;

        // Mettre à jour l'icône du marker
        if (props.selectedShape && props.selectedShape.layer) {
          const newIcon = L.divIcon({
            html: html,
            className: ''
          });
          props.selectedShape.layer.setIcon(newIcon);
        }

        // Émettre l'événement avec les nouvelles propriétés
        emit('properties-update', updatedProperties);
      } finally {
        isUpdating = false;
      }
    });
  } catch (error) {
    console.error('Error in updateTextProperties:', error);
    isUpdating = false;
  }
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

// Ajouter un computed pour le type de forme
const shapeType = computed(() => {
  if (!props.selectedShape?.properties?.type) return 'unknown';
  return props.selectedShape.properties.type as keyof typeof typeTranslations;
});

// Ajouter un computed pour le titre de la forme
const shapeTitle = computed(() => {
  return typeTranslations[shapeType.value] || 'Non défini';
});

const formatArea = (area: number): string => {
  if (area < 10000) {
    return `${area.toFixed(1)} m²`;
  }
  return `${(area / 10000).toFixed(2)} ha`;
};

const formatLength = (length: number): string => {
  if (length < 1000) {
    return `${length.toFixed(1)} m`;
  }
  return `${(length / 1000).toFixed(2)} km`;
};

const formatSlope = (slope: number): string => {
  return `${(slope * 100).toFixed(1)}%`;
};
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