<!-- DrawingTools.vue -->
<template>
  <div class="drawing-tools">
    <div class="mb-6">
      <h3 class="text-lg font-semibold mb-4">Outils de dessin</h3>
      
      <!-- Outils de dessin -->
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
        <!-- Couleurs prédéfinies -->
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-2">
            Couleurs prédéfinies
          </label>
          <div class="grid grid-cols-6 gap-2">
            <button
              v-for="color in predefinedColors"
              :key="color"
              class="w-8 h-8 rounded-full border-2 border-gray-200"
              :style="{ backgroundColor: color }"
              @click="selectPresetColor(color)"
            ></button>
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
              type="range"
              v-model="strokeOpacity"
              min="0"
              max="1"
              step="0.1"
              class="flex-1"
              @change="updateStyle({ strokeOpacity })"
            />
            <span class="text-sm">{{ (strokeOpacity * 100).toFixed(0) }}%</span>
          </div>
        </div>

        <!-- Épaisseur de trait -->
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">
            Épaisseur de trait
          </label>
          <input
            type="range"
            v-model="strokeWidth"
            min="1"
            max="10"
            class="w-full"
            @change="updateStyle({ strokeWidth })"
          />
          <span class="text-sm">{{ strokeWidth }}px</span>
        </div>

        <!-- Type de trait -->
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">
            Type de trait
          </label>
          <select
            v-model="strokeStyle"
            class="w-full px-2 py-1 rounded border"
            @change="updateStyle({ dashArray: getDashArray(strokeStyle) })"
          >
            <option v-for="style in strokeStyles" :key="style.value" :value="style.value">
              {{ style.label }}
            </option>
          </select>
        </div>

        <!-- Couleur de remplissage (seulement pour les formes fermées) -->
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
            <span class="text-sm">{{ (fillOpacity * 100).toFixed(0) }}%</span>
          </div>
        </div>
      </div>
    </div>

    <div v-if="selectedShape?.properties" class="mb-6">
      <h3 class="text-lg font-semibold mb-4">Propriétés</h3>
      
      <div class="space-y-2 text-sm">
        <div class="font-medium">
          Type: {{ typeTranslations[selectedShape.properties.type as keyof typeof typeTranslations] || 'Non défini' }}
        </div>
        <div v-if="selectedShape.properties.area">
          Surface: {{ formatArea(selectedShape.properties.area) }}
        </div>
        <div v-if="selectedShape.properties.length">
          Longueur: {{ formatLengthInHa(selectedShape.properties.length) }}
        </div>
        <div v-if="selectedShape.properties.perimeter">
          Périmètre: {{ formatLengthInHa(selectedShape.properties.perimeter) }}
        </div>
        <div v-if="selectedShape.properties.radius">
          Rayon: {{ formatLengthInHa(selectedShape.properties.radius) }}
        </div>
        <div v-if="selectedShape.properties.width">
          Largeur: {{ formatLengthInHa(selectedShape.properties.width) }}
        </div>
        <div v-if="selectedShape.properties.height">
          Hauteur: {{ formatLengthInHa(selectedShape.properties.height) }}
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, toRaw } from 'vue';
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
}

interface CircleOptions extends L.CircleMarkerOptions {
  isSemicircle?: boolean;
}

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
  { type: 'Line', label: 'Ligne' },
  { type: 'Text', label: 'Texte' }
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

// Initialiser les valeurs quand une forme est sélectionnée
watch(() => props.selectedShape, (shape) => {
  console.log('=== DRAWING TOOLS SHAPE UPDATE START ===');
  console.log('Raw shape object:', toRaw(shape));
  console.log('Shape constructor:', shape?.constructor?.name);
  
  if (shape) {
    // Vérifier si la forme a des propriétés valides
    if (!shape.properties || !shape.properties.type) {
      console.warn('Invalid shape properties detected:', toRaw(shape.properties));
      
      // Détecter le type de forme
      const detectedType = 
        shape instanceof L.Circle ? ((shape.options as CircleOptions)?.isSemicircle ? 'semicircle' : 'circle') :
        shape instanceof L.Rectangle ? 'rectangle' :
        shape instanceof L.Polygon ? 'polygon' :
        shape instanceof L.Polyline && !(shape instanceof L.Polygon) ? 'line' : 'unknown';
      
      console.log('Detected shape type:', detectedType);
      
      // Créer des propriétés de base
      const baseProperties: ShapeProperties = {
        type: detectedType,
        style: {
          color: shape.options?.color || '#3388ff',
          weight: shape.options?.weight || 3,
          opacity: shape.options?.opacity || 1,
          fillColor: shape.options?.fillColor || '#3388ff',
          fillOpacity: shape.options?.fillOpacity || 0.2,
          dashArray: shape.options?.dashArray || ''
        }
      };
      
      // Ajouter les propriétés spécifiques au type
      if (shape instanceof L.Circle) {
        const radius = shape.getRadius();
        baseProperties.radius = radius;
        
        if (detectedType === 'circle') {
          baseProperties.area = Math.PI * Math.pow(radius, 2);
          baseProperties.perimeter = 2 * Math.PI * radius;
        } else {
          baseProperties.area = (Math.PI * Math.pow(radius, 2)) / 2;
          baseProperties.perimeter = Math.PI * radius + 2 * radius;
        }
      } else if (shape instanceof L.Rectangle) {
        const bounds = shape.getBounds();
        const ne = bounds.getNorthEast();
        const sw = bounds.getSouthWest();
        const width = turf.distance([sw.lng, sw.lat], [ne.lng, sw.lat], { units: 'meters' });
        const height = turf.distance([sw.lng, sw.lat], [sw.lng, ne.lat], { units: 'meters' });
        baseProperties.width = width;
        baseProperties.height = height;
        baseProperties.area = width * height;
        baseProperties.perimeter = 2 * (width + height);
      } else if (shape instanceof L.Polygon) {
        const latLngs = shape.getLatLngs()[0] as L.LatLng[];
        const coordinates = latLngs.map((ll: L.LatLng) => [ll.lng, ll.lat]);
        coordinates.push(coordinates[0]); // Fermer le polygone
        const polygon = turf.polygon([coordinates]);
        baseProperties.area = turf.area(polygon);
        baseProperties.perimeter = turf.length(turf.lineString([...coordinates]), { units: 'meters' });
      } else if (shape instanceof L.Polyline && !(shape instanceof L.Polygon)) {
        const latLngs = shape.getLatLngs() as L.LatLng[];
        const coordinates = latLngs.map((ll: L.LatLng) => [ll.lng, ll.lat]);
        const line = turf.lineString(coordinates);
        baseProperties.length = turf.length(line, { units: 'meters' });
      }
      
      console.log('Created base properties:', baseProperties);
      
      // Mettre à jour les propriétés de la forme
      shape.properties = baseProperties;
    }

    console.log('Final shape properties:', toRaw(shape.properties));
    
    // Mettre à jour les contrôles UI
    fillColor.value = shape.properties.style?.fillColor || '#3B82F6';
    fillOpacity.value = shape.properties.style?.fillOpacity || 0.2;
    strokeColor.value = shape.properties.style?.color || '#2563EB';
    strokeOpacity.value = shape.properties.style?.opacity || 1;
    strokeWidth.value = shape.properties.style?.weight || 2;
    strokeStyle.value = getStrokeStyleFromDashArray(shape.properties.style?.dashArray);
    
    // Mettre à jour les propriétés spécifiques
    radius.value = shape.properties.radius || 0;
    startAngle.value = shape.properties.orientation || 0;
    
    console.log('Updated UI controls:', {
      fillColor: fillColor.value,
      fillOpacity: fillOpacity.value,
      strokeColor: strokeColor.value,
      strokeOpacity: strokeOpacity.value,
      strokeWidth: strokeWidth.value,
      strokeStyle: strokeStyle.value,
      radius: radius.value,
      startAngle: startAngle.value
    });

    if (shape && shape.properties?.type === 'text') {
      textContent.value = shape.properties.text || '';
      fontSize.value = shape.properties.style?.fontSize || 14;
      textBackgroundColor.value = shape.properties.style?.backgroundColor || '#FFFFFF';
      textBackgroundOpacity.value = shape.properties.style?.backgroundOpacity || 1;
      textBorderColor.value = shape.properties.style?.borderColor || '#000000';
      textBorderOpacity.value = shape.properties.style?.borderOpacity || 1;
    }
  }
  
  console.log('=== DRAWING TOOLS SHAPE UPDATE END ===');
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
  emit('style-update', {
    ...style,
    fillOpacity: style.fillOpacity !== undefined ? parseFloat(style.fillOpacity) : undefined,
    strokeOpacity: style.strokeOpacity !== undefined ? parseFloat(style.strokeOpacity) : undefined,
    strokeWidth: style.strokeWidth !== undefined ? parseInt(style.strokeWidth) : undefined
  });
};

const updateProperties = (properties: any) => {
  if (props.selectedShape?.type === 'Semicircle') {
    // Pour les demi-cercles, mettre à jour l'orientation et les angles
    const orientation = properties.startAngle || startAngle.value;
    emit('properties-update', {
      ...properties,
      orientation,
      style: {
        startAngle: orientation,
        stopAngle: orientation + 180
      }
    });
  } else {
    emit('properties-update', properties);
  }
};

// Ajouter la fonction de mise à jour des propriétés du texte
const updateTextProperties = (properties: any) => {
  const updatedProperties = {
    ...properties,
    type: 'text',
    style: {
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

  emit('properties-update', updatedProperties);
};

// Ajouter les traductions des types
const typeTranslations = {
  'circle': 'Cercle',
  'semicircle': 'Demi-cercle',
  'rectangle': 'Rectangle',
  'polygon': 'Polygone',
  'line': 'Ligne',
  'text': 'Texte',
  'unknown': 'Inconnu'
};

const formatArea = (area: number): string => {
  if (area < 10000) {
    return `${area.toFixed(1)} m²`;
  }
  return `${(area / 10000).toFixed(2)} ha`;
};

const formatLengthInHa = (length: number): string => {
  return `${(length / 100).toFixed(2)} ha`;
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
  max-height: calc(100vh - 100px);
  overflow-y: auto;
  padding-right: 8px;
}

/* Personnaliser la scrollbar pour une meilleure intégration */
.drawing-tools::-webkit-scrollbar {
  width: 6px;
}

.drawing-tools::-webkit-scrollbar-track {
  background: #f1f1f1;
  border-radius: 3px;
}

.drawing-tools::-webkit-scrollbar-thumb {
  background: #cbd5e1;
  border-radius: 3px;
}

.drawing-tools::-webkit-scrollbar-thumb:hover {
  background: #94a3b8;
}

/* Style pour les boutons de couleur prédéfinie */
.color-preset {
  transition: transform 0.1s ease-in-out;
}

.color-preset:hover {
  transform: scale(1.1);
}
</style> 