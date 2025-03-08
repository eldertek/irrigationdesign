<template>
  <div class="relative w-full">
    <input
      v-model="searchQuery"
      @input="handleSearchInput"
      type="text"
      placeholder="Rechercher une adresse..."
      class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
    />
    <!-- Résultats de la recherche -->
    <div 
      v-if="searchResults.length > 0" 
      class="search-results w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-y-auto"
    >
      <div
        v-for="result in searchResults"
        :key="result.place_id"
        @click="selectAddress(result)"
        class="px-4 py-2 hover:bg-gray-100 cursor-pointer"
      >
        {{ result.display_name }}
      </div>
    </div>
  </div>
</template>
<script setup lang="ts">
import { ref } from 'vue'
import debounce from 'lodash/debounce'
interface SearchResult {
  place_id: number;
  display_name: string;
  lat: string;
  lon: string;
}
const searchQuery = ref('')
const searchResults = ref<SearchResult[]>([])
const emit = defineEmits(['select-location'])
const searchAddress = debounce(async (query: string) => {
  if (query.length < 3) {
    searchResults.value = []
    return
  }
  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}`
    )
    const data = await response.json()
    searchResults.value = data
  } catch (error) {
    console.error('Erreur lors de la recherche d\'adresse:', error)
    searchResults.value = []
  }
}, 300)
function handleSearchInput() {
  searchAddress(searchQuery.value)
}
function selectAddress(result: any) {
  searchQuery.value = result.display_name
  searchResults.value = []
  emit('select-location', {
    lat: parseFloat(result.lat),
    lng: parseFloat(result.lon)
  })
}
</script>
<style>
.relative {
  position: relative;
  z-index: 1002;
}
.search-results {
  position: absolute;
  z-index: 1001;
}
</style> 