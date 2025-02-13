<template>
  <div v-if="shape" class="shape-info-panel">
    <h3 class="title">
      {{ getShapeTitle(shape.type) }}
      <button class="close-button" @click="emit('close')">X</button>
    </h3>
    
    <div class="info-content">
      <!-- Dimensions spécifiques selon le type de forme -->
      <template v-if="shape.properties?.dimensions">
        <!-- Rectangle -->
        <template v-if="shape.type?.toLowerCase() === 'rectangle'">
          <div class="info-item">
            <span class="label">Largeur:</span>
            <span class="value">{{ formatDistance(shape.properties.dimensions.width) }}</span>
          </div>
          <div class="info-item">
            <span class="label">Longueur:</span>
            <span class="value">{{ formatDistance(shape.properties.dimensions.height) }}</span>
          </div>
        </template>

        <!-- Cercle -->
        <template v-if="shape.type?.toLowerCase() === 'cercle'">
          <div class="info-item">
            <span class="label">Rayon:</span>
            <span class="value">{{ formatDistance(shape.properties.dimensions.radius) }}</span>
          </div>
          <div class="info-item">
            <span class="label">Diamètre:</span>
            <span class="value">{{ formatDistance(shape.properties.dimensions.diameter) }}</span>
          </div>
        </template>

        <!-- Demi-cercle -->
        <template v-if="shape.type?.toLowerCase() === 'demi-cercle'">
          <div class="info-item">
            <span class="label">Rayon:</span>
            <span class="value">{{ formatDistance(shape.properties.dimensions.radius) }}</span>
          </div>
          <div class="info-item">
            <span class="label">Orientation:</span>
            <span class="value">{{ shape.properties.dimensions.orientation }}°</span>
          </div>
        </template>
      </template>

      <!-- Ligne -->
      <template v-if="shape.type?.toLowerCase() === 'line' && shape.properties">
        <div class="info-item">
          <span class="label">Longueur totale:</span>
          <span class="value">{{ formatDistance(shape.properties.length) }}</span>
        </div>
        <div class="info-item">
          <span class="label">Largeur d'influence:</span>
          <span class="value">{{ formatDistance(shape.properties.dimensions?.width || 0) }}</span>
        </div>
        <div class="info-item">
          <span class="label">Zone d'influence:</span>
          <span class="value">{{ formatArea(shape.properties.surfaceInfluence) }}</span>
        </div>
        <div class="info-item">
          <span class="label">Dénivelé:</span>
          <span class="value">{{ formatDistance(shape.properties.elevation?.difference || 0) }}</span>
        </div>
        <div class="info-item">
          <span class="label">Pente moyenne:</span>
          <span class="value">{{ formatSlope(shape.properties.elevation?.slope || 0) }}</span>
        </div>

        <!-- Profil d'élévation -->
        <div v-if="shape.properties.elevation?.profile" class="mt-4">
          <h4 class="subtitle">Profil d'élévation</h4>
          <ElevationProfile
            :points="shape.properties.elevation.profile"
            :min-elevation="shape.properties.elevation.minElevation"
            :max-elevation="shape.properties.elevation.maxElevation"
            :width="250"
            :height="150"
          />
        </div>
      </template>

      <!-- Surfaces pour les formes fermées -->
      <template v-if="shape.properties?.surfaceInterieure">
        <div class="surface-section">
          <div class="info-item">
            <span class="label">Surface intérieure:</span>
            <span class="value">{{ formatArea(shape.properties.surfaceInterieure) }}</span>
          </div>
          <div class="info-item">
            <span class="label">Surface extérieure:</span>
            <span class="value">{{ formatArea(shape.properties.surfaceExterieure) }}</span>
          </div>
          <div class="info-item">
            <span class="label">Périmètre:</span>
            <span class="value">{{ formatDistance(shape.properties.perimetre) }}</span>
          </div>
        </div>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import ElevationProfile from './ElevationProfile.vue'

const props = defineProps({
  shape: {
    type: Object,
    default: null
  },
  units: {
    type: String,
    default: 'metric'
  }
})

const emit = defineEmits(['close', 'edit', 'delete'])

// Vérifier si la forme est valide
const isValidShape = computed(() => {
  console.log('Shape data:', props.shape)
  return props.shape && 
         props.shape.type && 
         props.shape.properties &&
         (
           (props.shape.properties.dimensions && Object.keys(props.shape.properties.dimensions).length > 0) ||
           props.shape.properties.length ||
           props.shape.properties.surfaceInterieure
         )
})

function getShapeTitle(type: string): string {
  const titles = {
    rectangle: 'Rectangle',
    cercle: 'Cercle',
    'demi-cercle': 'Demi-cercle',
    ligne: 'Ligne'
  }
  return titles[type.toLowerCase()] || 'Forme'
}

function formatDistance(value: number): string {
  if (!value && value !== 0) return '0 m'
  return `${value.toFixed(2)} m`
}

function formatArea(value: number): string {
  if (!value && value !== 0) return '0 m²'
  return `${value.toFixed(2)} m²`
}

function formatSlope(value: number): string {
  if (!value && value !== 0) return '0 %'
  return `${value.toFixed(1)} %`
}
</script>

<style scoped>
.shape-info-panel {
  position: absolute;
  top: 20px;
  right: 20px;
  background: white;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
  padding: 16px;
  min-width: 280px;
  max-width: 320px;
  z-index: 1000;
  animation: slideIn 0.3s ease-out;
}

@keyframes slideIn {
  from {
    opacity: 0;
    transform: translateY(-10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.title {
  font-size: 16px;
  font-weight: 600;
  color: #1a1a1a;
  margin-bottom: 12px;
  padding-bottom: 8px;
  border-bottom: 1px solid #e5e7eb;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.close-button {
  padding: 4px;
  border-radius: 4px;
  color: #6b7280;
  transition: all 0.2s;
}

.close-button:hover {
  background-color: #f3f4f6;
  color: #1f2937;
}

.subtitle {
  font-size: 14px;
  font-weight: 500;
  color: #4b5563;
  margin-bottom: 8px;
}

.info-content {
  font-size: 14px;
}

.info-item {
  display: flex;
  justify-content: space-between;
  margin-bottom: 8px;
  padding: 4px 0;
}

.info-item:hover {
  background-color: #f9fafb;
}

.label {
  color: #4b5563;
}

.value {
  font-weight: 500;
  color: #1a1a1a;
}

.surface-section {
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid #e5e7eb;
}
</style> 