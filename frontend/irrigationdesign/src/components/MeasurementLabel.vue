<template>
  <div 
    class="measurement-label"
    :class="{ 'is-hovering': isHovering }"
    @mouseenter="isHovering = true"
    @mouseleave="isHovering = false"
  >
    <div class="measurement-value">{{ formattedValue }}</div>
    <div v-if="showDetails && isHovering" class="measurement-details">
      <slot name="details"></slot>
    </div>
    <div class="measurement-line" :style="lineStyle"></div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';

const props = defineProps<{
  value: number;
  unit?: string;
  precision?: number;
  showDetails?: boolean;
  lineStyle?: object;
}>();

const isHovering = ref(false);

const formattedValue = computed(() => {
  const value = props.value.toFixed(props.precision || 2);
  return `${value} ${props.unit || 'm'}`;
});
</script>

<style scoped>
.measurement-label {
  position: absolute;
  font-family: 'Roboto Mono', monospace;
  font-size: 12px;
  color: #2563eb;
  background: rgba(255, 255, 255, 0.9);
  padding: 2px 6px;
  border-radius: 2px;
  border: 1px solid #2563eb;
  pointer-events: auto;
  cursor: default;
  transition: all 0.2s ease;
  z-index: 1000;
}

.measurement-label.is-hovering {
  background: white;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.measurement-value {
  white-space: nowrap;
}

.measurement-details {
  font-size: 10px;
  color: #64748b;
  margin-top: 2px;
  border-top: 1px dashed #cbd5e1;
  padding-top: 2px;
}

.measurement-line {
  position: absolute;
  border-top: 2px dashed #2563eb;
  width: 100%;
  top: 50%;
  left: 0;
  transform: translateY(-50%);
  z-index: -1;
}
</style> 