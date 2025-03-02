<!-- DrawingTools.vue -->
<template>
  <div class="drawing-tools-sidebar">
    <!-- Header avec titre -->
    <div class="sidebar-header">
      <h3 class="sidebar-title">Outils</h3>
    </div>

    <!-- Outils de dessin - version compacte avec icônes -->
    <div class="tools-section">
      <div class="tools-grid">
        <button
          v-for="tool in drawingTools.filter(t => t.type !== 'delete')"
          :key="tool.type"
          class="tool-button"
          :class="{ active: currentTool === tool.type }"
          @click="$emit('tool-change', tool.type)"
          :title="tool.label"
        >
          <span class="icon" v-html="getToolIcon(tool.type)"></span>
        </button>
      </div>
      
      <!-- Bouton de suppression -->
      <button
        v-if="selectedShape"
        class="delete-button"
        :class="{ active: currentTool === 'delete' }"
        @click="$emit('delete-shape')"
        title="Supprimer la forme"
      >
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
        </svg>
      </button>
    </div>

    <!-- Séparateur -->
    <div class="sidebar-divider"></div>

    <!-- Sections collapsables pour les formes sélectionnées -->
    <div v-if="selectedShape && localProperties" class="properties-container">
      <!-- Style - Section collapsable -->
      <div class="sidebar-section">
        <button 
          class="section-header"
          @click="toggleSection('style')"
        >
          <span class="section-title">Style</span>
          <svg 
            class="section-icon"
            :class="{ 'rotate-180': !sectionsCollapsed.style }"
            fill="none" 
            stroke="currentColor" 
            viewBox="0 0 24 24"
          >
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
          </svg>
        </button>
        <div v-show="!sectionsCollapsed.style" class="section-content">
          <!-- Couleurs prédéfinies - compact -->
          <div class="color-grid">
            <button
              v-for="color in predefinedColors"
              :key="color"
              class="color-button"
              :style="{ backgroundColor: color }"
              @click="selectPresetColor(color)"
              :title="color"
            ></button>
          </div>

          <!-- Contrôles de style pour les formes standards (non TextRectangle) -->
          <div v-if="localProperties.type !== 'TextRectangle'" class="style-controls">
            <div class="control-row">
              <span class="control-label">Contour</span>
              <div class="control-inputs">
                <input
                  type="color"
                  v-model="strokeColor"
                  class="color-input"
                  @change="updateStyle({ strokeColor })"
                  title="Couleur du contour"
                />
                <input
                  type="range"
                  v-model="strokeWidth"
                  min="1"
                  max="10"
                  class="range-input"
                  @change="updateStyle({ strokeWidth })"
                  title="Épaisseur du contour"
                />
              </div>
            </div>

            <!-- Style de trait -->
            <div class="control-row">
              <span class="control-label">Style</span>
              <select
                v-model="strokeStyle"
                class="select-input"
                @change="updateStyle({ strokeStyle })"
              >
                <option v-for="style in strokeStyles" :key="style.value" :value="style.value">
                  {{ style.label }}
                </option>
              </select>
            </div>

            <div v-if="showFillOptions" class="control-row">
              <span class="control-label">Remplir</span>
              <div class="control-inputs">
                <input
                  type="color"
                  v-model="fillColor"
                  class="color-input"
                  @change="updateStyle({ fillColor })"
                  title="Couleur de remplissage"
                />
                <input
                  type="range"
                  v-model="fillOpacity"
                  min="0"
                  max="1"
                  step="0.1"
                  class="range-input"
                  @change="updateStyle({ fillOpacity })"
                  title="Opacité du remplissage"
                />
              </div>
            </div>
          </div>

          <!-- Options spécifiques au TextRectangle -->
          <div v-if="localProperties.type === 'TextRectangle'" class="text-controls">
            <!-- Contour du rectangle avec texte -->
            <div class="control-row">
              <span class="control-label">Contour</span>
              <div class="control-inputs">
                <input
                  type="color"
                  v-model="strokeColor"
                  class="color-input"
                  @change="updateStyle({ strokeColor })"
                  title="Couleur du contour"
                />
                <input
                  type="range"
                  v-model="strokeWidth"
                  min="1"
                  max="10"
                  class="range-input"
                  @change="updateStyle({ strokeWidth })"
                  title="Épaisseur du contour"
                />
              </div>
              </div>
              
            <!-- Remplissage du rectangle -->
            <div class="control-row">
              <span class="control-label">Remplir</span>
              <div class="control-inputs">
                <input
                  type="color"
                  v-model="fillColor"
                  class="color-input"
                  @change="updateStyle({ fillColor })"
                  title="Couleur de remplissage"
                />
                <input
                  type="range"
                  v-model="fillOpacity"
                  min="0"
                  max="1"
                  step="0.1"
                  class="range-input"
                  @change="updateStyle({ fillOpacity })"
                  title="Opacité du remplissage"
                />
              </div>
            </div>

            <!-- Contrôles spécifiques au texte -->
            <div class="control-row">
              <span class="control-label">Texte</span>
              <div class="control-inputs">
                <input
                  type="color"
                  v-model="textColor"
                  class="color-input"
                  @change="updateTextStyle({ textColor })"
                  title="Couleur du texte"
                />
                <select
                  v-model="fontSize"
                  class="select-input"
                  @change="updateTextStyle({ fontSize })"
                >
                  <option value="10px">10px</option>
                  <option value="12px">12px</option>
                  <option value="14px">14px</option>
                  <option value="16px">16px</option>
                  <option value="18px">18px</option>
                  <option value="20px">20px</option>
                  <option value="24px">24px</option>
                </select>
              </div>
              </div>
              
            <div class="control-row">
              <span class="control-label">Fond</span>
              <div class="control-inputs">
                <input
                  type="color"
                  v-model="textBackgroundColor"
                  class="color-input"
                  @change="updateTextStyle({ backgroundColor: textBackgroundColor })"
                  title="Couleur de fond"
                />
                <input
                  type="range"
                  v-model="textBackgroundOpacity"
                  min="0"
                  max="1"
                  step="0.1"
                  class="range-input"
                  @change="updateTextStyle({ backgroundOpacity: textBackgroundOpacity })"
                  title="Opacité du fond"
                />
              </div>
              </div>
              
              <!-- Police et alignement -->
            <div class="control-row">
              <span class="control-label">Police</span>
                <select
                  v-model="fontFamily"
                class="select-input"
                  @change="updateTextStyle({ fontFamily })"
                >
                  <option value="Arial, sans-serif">Arial</option>
                <option value="'Times New Roman', serif">Times</option>
                <option value="'Courier New', monospace">Courier</option>
                  <option value="Georgia, serif">Georgia</option>
                  <option value="Verdana, sans-serif">Verdana</option>
                </select>
              </div>
              
            <div class="control-row">
              <span class="control-label">Align.</span>
              <div class="button-group">
                  <button
                    v-for="align in textAlignOptions"
                    :key="align.value"
                  class="align-button"
                  :class="{ active: textAlign === align.value }"
                    @click="updateTextStyle({ textAlign: align.value })"
                    :title="align.label"
                  >
                    <span v-html="align.icon"></span>
                  </button>
                
                  <button
                  class="style-button"
                  :class="{ active: isBold }"
                    @click="toggleBold"
                    title="Gras"
                  >
                    B
                  </button>
                  <button
                  class="style-button"
                  :class="{ active: isItalic }"
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
      <div class="sidebar-section">
        <button 
          class="section-header"
          @click="toggleSection('properties')"
        >
          <span class="section-title">Propriétés</span>
          <svg 
            class="section-icon"
            :class="{ 'rotate-180': !sectionsCollapsed.properties }"
            fill="none" 
            stroke="currentColor" 
            viewBox="0 0 24 24"
          >
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
          </svg>
        </button>
        <div v-show="!sectionsCollapsed.properties" class="section-content">
          <div v-if="localProperties">
            <!-- Tableau compact des propriétés pour tous les types -->
            <div class="properties-grid">
            <!-- Cercle -->
              <template v-if="localProperties.type === 'Circle'">
                <span class="property-label">Rayon :</span>
                <span class="property-value">{{ formatMeasure(localProperties.radius || 0) }}</span>
                <span class="property-label">Surface :</span>
                <span class="property-value">{{ formatArea(localProperties.area || 0) }}</span>
              </template>

            <!-- Rectangle -->
              <template v-else-if="localProperties.type === 'Rectangle'">
                <span class="property-label">Largeur :</span>
                <span class="property-value">{{ formatMeasure(localProperties.width || 0) }}</span>
                <span class="property-label">Hauteur :</span>
                <span class="property-value">{{ formatMeasure(localProperties.height || 0) }}</span>
                <span class="property-label">Surface :</span>
                <span class="property-value">{{ formatArea(localProperties.area || 0) }}</span>
              </template>

            <!-- Demi-cercle -->
              <template v-else-if="localProperties.type === 'Semicircle'">
                <span class="property-label">Rayon :</span>
                <span class="property-value">{{ formatMeasure(localProperties.radius || 0) }}</span>
                <span class="property-label">Surface :</span>
                <span class="property-value">{{ formatArea(localProperties.area || 0) }}</span>
                <span class="property-label">Angle :</span>
                <span class="property-value">{{ formatAngle(localProperties.openingAngle || 0) }}</span>
              </template>

            <!-- Ligne -->
              <template v-else-if="localProperties.type === 'Line'">
                <span class="property-label">Longueur :</span>
                <span class="property-value">{{ formatMeasure(localProperties.length || 0) }}</span>
              </template>

            <!-- Polygone -->
              <template v-else-if="localProperties.type === 'Polygon'">
                <span class="property-label">Surface :</span>
                <span class="property-value">{{ formatArea(localProperties.area || 0) }}</span>
                <span class="property-label">Périmètre :</span>
                <span class="property-value">{{ formatMeasure(localProperties.perimeter || 0) }}</span>
              </template>

            <!-- Rectangle avec texte -->
              <template v-else-if="localProperties.type === 'TextRectangle'">
                <span class="property-label">Largeur :</span>
                <span class="property-value">{{ formatMeasure(localProperties.width || 0) }}</span>
                <span class="property-label">Hauteur :</span>
                <span class="property-value">{{ formatMeasure(localProperties.height || 0) }}</span>
                <span class="property-label">Surface :</span>
                <span class="property-value">{{ formatArea(localProperties.area || 0) }}</span>
                <span class="property-label">Rotation :</span>
                <span class="property-value">{{ formatAngle(localProperties.rotation || 0) }}</span>
                <span class="property-label col-span-2">Texte :</span>
                <span class="property-value col-span-2 truncate">{{ localProperties.text || 'Aucun texte' }}</span>
              </template>
              </div>
              </div>
          <div v-else class="no-properties">
            Aucune propriété disponible
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';

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

// Variable locale réactive pour les propriétés
const localProperties = ref<ShapeProperties | null>(null);

// Watcher pour synchroniser les propriétés locales
watch(
  () => props.selectedShape,
  (newShape) => {
    console.log('[DrawingTools] Changement de forme sélectionnée', {
      newShape,
      properties: newShape?.properties
    });
    if (newShape) {
      localProperties.value = { ...newShape.properties };
      
      // Si c'est un TextRectangle, initialiser les propriétés de style de texte
      if (newShape.properties?.type === 'TextRectangle') {
        const style = newShape.properties?.style || {};
        textColor.value = style.textColor || '#000000';
        fontSize.value = style.fontSize || '14px';
        textBackgroundColor.value = style.backgroundColor || '#FFFFFF';
        textBackgroundOpacity.value = style.backgroundOpacity || 1;
        fontFamily.value = style.fontFamily || 'Arial, sans-serif';
        textAlign.value = style.textAlign || 'center';
        isBold.value = style.bold || false;
        isItalic.value = style.italic || false;
      }
    } else {
      localProperties.value = null;
    }
  },
  { deep: true, immediate: true }
);

// Watcher pour détecter les changements dans les propriétés locales
watch(
  () => localProperties.value,
  (newProperties, oldProperties) => {
    console.log('[DrawingTools] Changement détecté dans localProperties', {
      newProperties,
      oldProperties,
      selectedShape: props.selectedShape
    });
  },
  { deep: true }
);

// Watcher plus spécifique pour détecter les changements dans les propriétés de la forme sélectionnée
watch(
  () => props.selectedShape?.properties,
  (newProperties) => {

    if (newProperties && props.selectedShape) {
      // Mise à jour proactive des propriétés locales
      localProperties.value = { ...newProperties };
      
      // Si c'est un TextRectangle, mettre à jour les styles
      if (newProperties.type === 'TextRectangle' && newProperties.style) {
        const style = newProperties.style;
        textColor.value = style.textColor || '#000000';
        fontSize.value = style.fontSize || '14px';
        textBackgroundColor.value = style.backgroundColor || '#FFFFFF';
        textBackgroundOpacity.value = style.backgroundOpacity || 1;
        fontFamily.value = style.fontFamily || 'Arial, sans-serif';
        textAlign.value = style.textAlign || 'center';
        isBold.value = style.bold || false;
        isItalic.value = style.italic || false;
      }
    }
  },
  { deep: true, immediate: true }
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
    'TextRectangle': '<svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" /><path d="M9 8h6m-3 0v8" /></svg>'
  };
  
  return icons[toolType] || '';
};

const drawingTools = [
  { type: 'Circle', label: 'Cercle' },
  { type: 'Semicircle', label: 'Demi-cercle' },
  { type: 'Rectangle', label: 'Rectangle' },
  { type: 'Polygon', label: 'Polygone' },
  { type: 'Line', label: 'Ligne' },
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

// Style
const fillColor = ref('#3B82F6');
const fillOpacity = ref(0.2);
const strokeColor = ref('#2563EB');
const strokeWidth = ref(2);
const strokeStyle = ref('solid');

// Styles spécifiques au texte
const textColor = ref('#000000');
const fontSize = ref('14px');
const textBackgroundColor = ref('#FFFFFF');
const textBackgroundOpacity = ref(1);
const fontFamily = ref('Arial, sans-serif');
const textAlign = ref('center');
const isBold = ref(false);
const isItalic = ref(false);

// Ajouter l'état pour les sections collapsables
const sectionsCollapsed = ref({
  style: false,
  properties: false
});

const showFillOptions = computed(() => {
  const shapeType = props.selectedShape?.properties?.type;
  console.log('[DrawingTools] Calcul de showFillOptions', {
    shapeType,
    selectedShape: props.selectedShape
  });
  if (!shapeType) return false;
  return ['Circle', 'Rectangle', 'Polygon', 'Semicircle'].includes(shapeType);
});

// Fonction pour basculer l'état des sections
const toggleSection = (section: 'style' | 'properties') => {
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
  
  // Si on met à jour les propriétés de texte, on les envoie au parent
  emit('style-update', { ...style }); 
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
</script>

<style scoped>
.drawing-tools-sidebar {
  position: absolute;
  top: 0;
  right: 0;
  width: 250px;
  height: 100%;
  background-color: white;
  box-shadow: -2px 0 5px rgba(0, 0, 0, 0.1);
  display: flex;
  flex-direction: column;
  z-index: 10;
  transition: width 0.3s;
  overflow-y: auto;
  margin-top: 50px; /* Ajout d'une marge en haut pour éviter le chevauchement avec MapToolbar */
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

</style> 