<!-- SearchLocation.vue -->
<template>
  <div class="absolute top-4 left-4 z-10 w-80">
    <div class="relative">
      <input
        type="text"
        v-model="searchQuery"
        @keyup.enter="searchLocation"
        placeholder="Rechercher une adresse..."
        class="w-full px-4 py-2 rounded-lg border border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
      />
      <button
        @click="searchLocation"
        class="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-gray-500 hover:text-gray-700"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          class="h-5 w-5"
          viewBox="0 0 20 20"
          fill="currentColor"
        >
          <path
            fill-rule="evenodd"
            d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z"
            clip-rule="evenodd"
          />
        </svg>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';

const searchQuery = ref('');
const emit = defineEmits<{
  (e: 'search', query: string): void;
}>();

const searchLocation = () => {
  if (searchQuery.value.trim()) {
    emit('search', searchQuery.value);
  }
};
</script> 