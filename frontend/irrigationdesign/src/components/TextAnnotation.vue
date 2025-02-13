<template>
  <div class="text-annotation-tool">
    <!-- Mode édition -->
    <div v-if="isEditing" class="text-editor bg-white shadow-lg rounded-lg p-4">
      <textarea
        v-model="editingText"
        class="w-full p-2 border rounded"
        rows="3"
        placeholder="Entrez votre texte..."
      ></textarea>
      <div class="mt-2 space-x-2">
        <input
          type="number"
          v-model="fontSize"
          class="w-20 p-1 border rounded"
          min="8"
          max="48"
        />
        <input
          type="number"
          v-model="rotation"
          class="w-20 p-1 border rounded"
          min="0"
          max="360"
        />
        <button
          @click="saveText"
          class="px-3 py-1 bg-primary-600 text-white rounded hover:bg-primary-700"
        >
          Sauvegarder
        </button>
        <button
          @click="cancelEdit"
          class="px-3 py-1 bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
        >
          Annuler
        </button>
      </div>
    </div>

    <!-- Texte affiché -->
    <div
      v-else
      class="text-annotation"
      :style="{
        fontSize: fontSize + 'px',
        transform: 'rotate(' + rotation + 'deg)'
      }"
      @dblclick="startEdit"
    >
      {{ text }}
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'

const props = defineProps({
  initialText: {
    type: String,
    default: ''
  },
  initialFontSize: {
    type: Number,
    default: 14
  },
  initialRotation: {
    type: Number,
    default: 0
  }
})

const emit = defineEmits(['update', 'delete'])

const isEditing = ref(false)
const editingText = ref(props.initialText)
const text = ref(props.initialText)
const fontSize = ref(props.initialFontSize)
const rotation = ref(props.initialRotation)

function startEdit() {
  isEditing.value = true
  editingText.value = text.value
}

function saveText() {
  text.value = editingText.value
  isEditing.value = false
  emit('update', {
    text: text.value,
    fontSize: fontSize.value,
    rotation: rotation.value
  })
}

function cancelEdit() {
  isEditing.value = false
  editingText.value = text.value
}
</script>

<style scoped>
.text-annotation {
  cursor: move;
  user-select: none;
  position: absolute;
  background: rgba(255, 255, 255, 0.8);
  padding: 2px 4px;
  border-radius: 2px;
}

.text-editor {
  position: absolute;
  z-index: 1000;
  min-width: 200px;
}
</style> 