<template>
  <div class="drawing-interface">
    <!-- Barre d'outils flottante principale -->
    <div class="fixed top-20 left-1/2 transform -translate-x-1/2 z-20">
      <div class="bg-white rounded-full shadow-lg p-2 flex items-center space-x-2">
        <button
          v-for="tool in mainTools"
          :key="tool.type"
          @click="selectTool(tool)"
          class="tool-button p-2 rounded-full transition-all relative group"
          :class="[currentTool?.type === tool.type ? 'bg-primary-100 text-primary-600' : 'hover:bg-gray-100']"
          v-tooltip="tool.label"
        >
          <component :is="tool.icon" class="h-6 w-6" />
          <span class="sr-only">{{ tool.label }}</span>
        </button>

        <div class="h-6 w-px bg-gray-200"></div>

        <!-- Actions rapides -->
        <button
          v-if="canUndo"
          @click="undo"
          class="p-2 rounded-full hover:bg-gray-100 text-gray-600 transition-all"
          v-tooltip="'Annuler'"
        >
          <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 10h10a4 4 0 0 1 4 4v2M3 10l6 6m-6-6l6-6" />
          </svg>
        </button>
        <button
          v-if="canRedo"
          @click="redo"
          class="p-2 rounded-full hover:bg-gray-100 text-gray-600 transition-all"
          v-tooltip="'Rétablir'"
        >
          <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 10h-10a4 4 0 0 0-4 4v2M21 10l-6 6m6-6l-6-6" />
          </svg>
        </button>
      </div>
    </div>

    <!-- Panneau latéral contextuel -->
    <TransitionRoot
      as="template"
      :show="showDrawingOptions"
      enter="transform transition ease-in-out duration-300"
      enter-from="translate-x-full"
      enter-to="translate-x-0"
      leave="transform transition ease-in-out duration-300"
      leave-from="translate-x-0"
      leave-to="translate-x-full"
    >
      <div class="fixed right-0 top-16 bottom-0 w-80 bg-white shadow-lg z-10 overflow-y-auto">
        <div class="p-4 space-y-6">
          <!-- En-tête du panneau -->
          <div class="flex items-center justify-between">
            <h3 class="text-lg font-medium text-gray-900">
              {{ currentTool?.label || 'Options de dessin' }}
            </h3>
            <button
              @click="cancelDrawing"
              class="rounded-full p-1 hover:bg-gray-100 text-gray-400 hover:text-gray-500"
            >
              <svg class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <!-- Options de style -->
          <div class="space-y-4">
            <!-- Couleur avec préréglages -->
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-2">Couleur</label>
              <div class="flex flex-wrap gap-2">
                <button
                  v-for="color in presetColors"
                  :key="color.value"
                  @click="selectColor(color.value)"
                  class="w-8 h-8 rounded-full border-2 transition-all transform hover:scale-110"
                  :style="{ backgroundColor: color.value }"
                  :class="[shapeOptions.color === color.value ? 'border-primary-500 scale-110' : 'border-transparent']"
                  :title="color.label"
                />
                <div class="relative">
                  <input
                    type="color"
                    v-model="shapeOptions.color"
                    class="w-8 h-8 rounded-full cursor-pointer"
                  >
                </div>
              </div>
            </div>

            <!-- Épaisseur avec prévisualisation -->
            <div>
              <div class="flex items-center justify-between mb-2">
                <label class="block text-sm font-medium text-gray-700">Épaisseur</label>
                <span class="text-sm text-gray-500">{{ shapeOptions.weight }}px</span>
              </div>
              <div class="relative">
                <input
                  type="range"
                  v-model="shapeOptions.weight"
                  min="1"
                  max="10"
                  step="0.5"
                  class="w-full accent-primary-600"
                >
                <div class="mt-2 h-2 bg-current rounded-full" :style="{ height: shapeOptions.weight + 'px' }"></div>
              </div>
            </div>

            <!-- Options spécifiques aux formes -->
            <template v-if="hasSpecificOptions">
              <div class="border-t border-gray-200 pt-4">
                <h4 class="text-sm font-medium text-gray-700 mb-3">Options spécifiques</h4>

                <!-- Options pour le cercle -->
                <template v-if="currentTool?.type === 'cercle'">
                  <div class="space-y-3">
                    <label class="flex items-center space-x-2">
                      <Switch
                        v-model="shapeOptions.fixedRadius"
                        class="relative inline-flex h-5 w-10 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2"
                        :class="[shapeOptions.fixedRadius ? 'bg-primary-600' : 'bg-gray-200']"
                      >
                        <span
                          aria-hidden="true"
                          class="pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out"
                          :class="[shapeOptions.fixedRadius ? 'translate-x-5' : 'translate-x-0']"
                        />
                      </Switch>
                      <span class="text-sm text-gray-700">Rayon fixe</span>
                    </label>

                    <div v-if="shapeOptions.fixedRadius" class="flex items-center space-x-2">
                      <input
                        type="number"
                        v-model="shapeOptions.radius"
                        min="1"
                        step="0.5"
                        class="block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
                        :placeholder="units === 'metric' ? 'Mètres' : 'Pieds'"
                      >
                      <span class="text-sm text-gray-500">{{ units === 'metric' ? 'm' : 'ft' }}</span>
                    </div>
                  </div>
                </template>

                <!-- Options pour le demi-cercle -->
                <template v-if="currentTool?.type === 'demi-cercle'">
                  <div class="space-y-3">
                    <label class="block text-sm font-medium text-gray-700">
                      Orientation: {{ shapeOptions.orientation }}°
                    </label>
                    <div class="relative">
                      <input
                        type="range"
                        v-model="shapeOptions.orientation"
                        min="0"
                        max="360"
                        step="45"
                        class="w-full accent-primary-600"
                      >
                      <div class="absolute -top-2 left-1/2 transform -translate-x-1/2">
                        <svg class="h-4 w-4 text-primary-600" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M12 2l-4 4h8l-4-4z"/>
                        </svg>
                      </div>
                    </div>
                    <div class="grid grid-cols-4 gap-2 mt-2">
                      <button
                        v-for="angle in [0, 90, 180, 270]"
                        :key="angle"
                        @click="shapeOptions.orientation = angle"
                        class="p-2 text-sm rounded-lg border transition-colors"
                        :class="[
                          shapeOptions.orientation === angle
                            ? 'border-primary-500 bg-primary-50 text-primary-700'
                            : 'border-gray-200 hover:bg-gray-50'
                        ]"
                      >
                        {{ angle }}°
                      </button>
                    </div>
                  </div>
                </template>
              </div>
            </template>
          </div>

          <!-- Actions -->
          <div class="border-t border-gray-200 pt-4">
            <div class="flex justify-end space-x-3">
              <button
                @click="cancelDrawing"
                class="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
              >
                Annuler
              </button>
              <button
                @click="finishDrawing"
                class="px-4 py-2 text-sm font-medium text-white bg-primary-600 border border-transparent rounded-md shadow-sm hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
              >
                Terminer
              </button>
            </div>
          </div>
        </div>
      </div>
    </TransitionRoot>

    <!-- Barre de recherche flottante -->
    <div class="fixed top-20 left-4 z-10 w-80">
      <div class="relative">
        <input
          type="text"
          placeholder="Rechercher une adresse..."
          class="w-full pl-10 pr-4 py-2.5 text-sm bg-white rounded-full border border-gray-200 shadow-sm focus:border-primary-500 focus:ring-2 focus:ring-primary-200"
        >
        <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <svg class="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>
      </div>
    </div>

    <!-- Mode édition flottant -->
    <div class="fixed bottom-4 left-4 z-10">
      <div class="bg-white rounded-lg shadow-lg p-2">
        <Switch.Group as="div" class="flex items-center space-x-3">
          <Switch.Label class="text-sm text-gray-700">Mode édition</Switch.Label>
          <Switch
            v-model="isEditMode"
            class="relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2"
            :class="[isEditMode ? 'bg-primary-600' : 'bg-gray-200']"
          >
            <span
              aria-hidden="true"
              class="pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out"
              :class="[isEditMode ? 'translate-x-5' : 'translate-x-0']"
            />
          </Switch>
        </Switch.Group>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed } from 'vue'
import { Switch, TransitionRoot } from '@headlessui/vue'
import {
  PencilIcon,
  SquareIcon,
  CircleIcon,
  ArrowPathIcon,
  ArrowsPointingOutIcon
} from '@heroicons/vue/24/outline'
import { useToast } from 'vue-toastification'
import { useEventListener } from '@vueuse/core'

const toast = useToast()

const props = defineProps({
  units: {
    type: String,
    default: 'metric'
  }
})

const emit = defineEmits(['tool-selected', 'shape-confirmed', 'edit-mode-changed', 'undo', 'redo'])

const currentTool = ref(null)
const isEditMode = ref(false)
const canUndo = ref(false)
const canRedo = ref(false)

const mainTools = [
  {
    type: 'ligne',
    label: 'Ligne',
    icon: PencilIcon,
    shortcut: 'L'
  },
  {
    type: 'rectangle',
    label: 'Rectangle',
    icon: SquareIcon,
    shortcut: 'R'
  },
  {
    type: 'cercle',
    label: 'Cercle',
    icon: CircleIcon,
    shortcut: 'C'
  },
  {
    type: 'demi-cercle',
    label: 'Demi-cercle',
    icon: ArrowPathIcon,
    shortcut: 'S'
  },
  {
    type: 'connexion',
    label: 'Connexion',
    icon: ArrowsPointingOutIcon,
    shortcut: 'X'
  }
]

const presetColors = [
  { label: 'Bleu', value: '#3388ff' },
  { label: 'Rouge', value: '#dc2626' },
  { label: 'Vert', value: '#059669' },
  { label: 'Orange', value: '#d97706' },
  { label: 'Violet', value: '#7c3aed' }
]

const shapeOptions = reactive({
  color: presetColors[0].value,
  weight: 3,
  opacity: 0.8,
  radius: 10,
  orientation: 0,
  fixedRadius: false,
  lineType: 'straight'
})

const showDrawingOptions = computed(() => currentTool.value !== null)
const hasSpecificOptions = computed(() => ['cercle', 'demi-cercle', 'ligne'].includes(currentTool.value?.type))

// Raccourcis clavier
useEventListener('keydown', (e) => {
  if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return

  const tool = mainTools.find(t => t.shortcut.toLowerCase() === e.key.toLowerCase())
  if (tool) {
    selectTool(tool)
    toast.info(`Outil ${tool.label} sélectionné`)
  }

  if (e.key === 'Escape') {
    cancelDrawing()
  }

  if (e.key === 'Enter' && currentTool.value) {
    finishDrawing()
  }

  if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
    if (e.shiftKey) {
      redo()
    } else {
      undo()
    }
  }
})

function selectTool(tool) {
  currentTool.value = tool
  emit('tool-selected', { tool, options: shapeOptions })
}

function selectColor(color) {
  shapeOptions.color = color
}

function finishDrawing() {
  emit('shape-confirmed', { tool: currentTool.value, options: shapeOptions })
  currentTool.value = null
  toast.success('Forme créée avec succès')
}

function cancelDrawing() {
  currentTool.value = null
  emit('tool-selected', null)
}

function toggleEditMode() {
  isEditMode.value = !isEditMode.value
  emit('edit-mode-changed', isEditMode.value)
  toast.info(isEditMode.value ? 'Mode édition activé' : 'Mode édition désactivé')
}

function undo() {
  emit('undo')
}

function redo() {
  emit('redo')
}
</script>

<style scoped>
/* Animations fluides */
.tool-button {
  @apply transition-all duration-200 ease-in-out;
}

.tool-button:hover {
  @apply transform scale-110;
}

/* Personnalisation des contrôles */
input[type="color"] {
  -webkit-appearance: none;
  padding: 0;
  border: none;
  border-radius: 9999px;
  height: 2rem;
  width: 2rem;
  cursor: pointer;
}

input[type="color"]::-webkit-color-swatch-wrapper {
  padding: 0;
}

input[type="color"]::-webkit-color-swatch {
  border: none;
  border-radius: 9999px;
}

/* Personnalisation du slider */
input[type="range"] {
  @apply rounded-lg overflow-hidden appearance-none bg-gray-200;
  height: 6px;
}

input[type="range"]::-webkit-slider-thumb {
  @apply appearance-none w-4 h-4 rounded-full bg-primary-600 cursor-pointer;
  box-shadow: -100vw 0 0 100vw theme('colors.primary.600');
}

input[type="range"]::-moz-range-thumb {
  @apply appearance-none w-4 h-4 rounded-full bg-primary-600 cursor-pointer border-0;
}

input[type="range"]::-moz-range-track {
  @apply bg-gray-200;
}

input[type="range"]::-moz-range-progress {
  @apply bg-primary-600;
}

/* Tooltip personnalisé */
.tooltip {
  @apply invisible absolute z-50 px-2 py-1 text-xs text-white bg-gray-900 rounded opacity-0 transition-opacity duration-200;
}

.group:hover .tooltip {
  @apply visible opacity-100;
}
</style> 