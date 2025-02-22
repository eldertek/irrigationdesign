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
          {{ typeTranslations[selectedShape.properties.type] || 'Non défini' }}
        </div>
        <div v-if="selectedShape.properties.area" class="text-gray-600">
          {{ formatArea(selectedShape.properties.area) }}
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
            <div v-if="selectedShape.properties.surfaceInterieure">
              Surface intérieure: {{ formatArea(selectedShape.properties.surfaceInterieure) }}
        </div>
            <div v-if="selectedShape.properties.surfaceExterieure">
              Surface extérieure: {{ formatArea(selectedShape.properties.surfaceExterieure) }}
          </div>
            <div v-if="selectedShape.properties.length">
              Longueur: {{ formatLength(selectedShape.properties.length) }}
        </div>
            <div v-if="selectedShape.properties.perimeter">
              Périmètre: {{ formatLength(selectedShape.properties.perimeter) }}
            </div>
            <div v-if="selectedShape.properties.radius">
              Rayon: {{ formatLength(selectedShape.properties.radius) }}
            </div>
            <div v-if="selectedShape.properties.width">
              Largeur: {{ formatLength(selectedShape.properties.width) }}
            </div>
            <div v-if="selectedShape.properties.height">
              Hauteur: {{ formatLength(selectedShape.properties.height) }}
            </div>
          </div>
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
  surfaceInterieure?: number;
  surfaceExterieure?: number;
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

// Fonction pour basculer l'état des sections
const toggleSection = (section: 'style' | 'properties') => {
  sectionsCollapsed.value[section] = !sectionsCollapsed.value[section];
};

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
        shape instanceof L.Circle ? 'Circle' :
        shape instanceof L.Rectangle ? 'Rectangle' :
        shape instanceof L.Polygon && !(shape instanceof L.Polyline) ? 'Polygon' :
        shape instanceof L.Polyline ? 'Line' : 'unknown';
      
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
        const strokeWidth = shape.options?.weight || 3;
        const strokeWidthMeters = strokeWidth * 0.5; // Convertir l'épaisseur du trait en mètres (approximatif)
        
        baseProperties.radius = radius;
        
        if (detectedType === 'Circle') {
          // Surface intérieure : surface du cercle sans l'épaisseur du trait
          baseProperties.surfaceInterieure = Math.PI * Math.pow(radius - strokeWidthMeters, 2);
          
          // Surface extérieure : surface du cercle avec l'épaisseur du trait
          baseProperties.surfaceExterieure = Math.PI * Math.pow(radius + strokeWidthMeters, 2);
          
          // Surface totale : moyenne des deux surfaces
          baseProperties.area = (baseProperties.surfaceInterieure + baseProperties.surfaceExterieure) / 2;
          
          baseProperties.perimeter = 2 * Math.PI * radius;
        } else if (detectedType === 'Semicircle' || shape.constructor.name === 'CircleArc') {
          // Surface intérieure : surface du demi-cercle sans l'épaisseur du trait
          baseProperties.surfaceInterieure = (Math.PI * Math.pow(radius - strokeWidthMeters, 2)) / 2;
          
          // Surface extérieure : surface du demi-cercle avec l'épaisseur du trait
          baseProperties.surfaceExterieure = (Math.PI * Math.pow(radius + strokeWidthMeters, 2)) / 2;
          
          // Surface totale : moyenne des deux surfaces
          baseProperties.area = (baseProperties.surfaceInterieure + baseProperties.surfaceExterieure) / 2;
          
          baseProperties.perimeter = Math.PI * radius + 2 * radius;
        }
      } else if (shape instanceof L.Rectangle) {
        const bounds = shape.getBounds();
        const ne = bounds.getNorthEast();
        const sw = bounds.getSouthWest();
        const strokeWidth = shape.options?.weight || 3;
        const strokeWidthMeters = strokeWidth * 0.5;
        
        const width = turf.distance([sw.lng, sw.lat], [ne.lng, sw.lat], { units: 'meters' });
        const height = turf.distance([sw.lng, sw.lat], [sw.lng, ne.lat], { units: 'meters' });
        
        baseProperties.width = width;
        baseProperties.height = height;
        
        // Surface intérieure : surface sans l'épaisseur du trait
        baseProperties.surfaceInterieure = (width - strokeWidthMeters * 2) * (height - strokeWidthMeters * 2);
        
        // Surface extérieure : surface avec l'épaisseur du trait
        baseProperties.surfaceExterieure = (width + strokeWidthMeters * 2) * (height + strokeWidthMeters * 2);
        
        // Surface totale : moyenne des deux surfaces
        baseProperties.area = (baseProperties.surfaceInterieure + baseProperties.surfaceExterieure) / 2;
        
        baseProperties.perimeter = 2 * (width + height);
      } else if (shape instanceof L.Polygon) {
        const latLngs = shape.getLatLngs()[0] as L.LatLng[];
        const coordinates = latLngs.map((ll: L.LatLng) => [ll.lng, ll.lat]);
        coordinates.push(coordinates[0]); // Fermer le polygone
        const polygon = turf.polygon([coordinates]);
        const strokeWidth = shape.options?.weight || 3;
        const strokeWidthMeters = strokeWidth * 0.5;
        
        // Calculer le buffer intérieur et extérieur
        const innerPolygon = turf.buffer(polygon, -strokeWidthMeters, { units: 'meters' });
        const outerPolygon = turf.buffer(polygon, strokeWidthMeters, { units: 'meters' });
        
        baseProperties.surfaceInterieure = turf.area(innerPolygon);
        baseProperties.surfaceExterieure = turf.area(outerPolygon);
        baseProperties.area = (baseProperties.surfaceInterieure + baseProperties.surfaceExterieure) / 2;
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
    
    // Mettre à jour les contrôles UI avec les valeurs réelles
    fillColor.value = shape.options?.fillColor || '#3B82F6';
    fillOpacity.value = shape.options?.fillOpacity || 0.2;
    strokeColor.value = shape.options?.color || '#2563EB';
    strokeOpacity.value = shape.options?.opacity || 1;
    strokeWidth.value = shape.options?.weight || 2;
    strokeStyle.value = getStrokeStyleFromDashArray(shape.options?.dashArray);
    
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
  'Circle': 'Cercle',
  'Rectangle': 'Rectangle',
  'Polygon': 'Polygone',
  'Line': 'Ligne',
  'Semicircle': 'Demi-cercle',
  'unknown': 'Inconnu'
};

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