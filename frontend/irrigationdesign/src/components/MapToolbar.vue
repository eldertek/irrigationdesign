<template>
  <div class="map-toolbar w-full">
    <!-- Version desktop -->
    <div class="hidden md:flex items-center space-x-2">
      <!-- Type de carte -->
      <div class="dropdown">
        <button class="btn-toolbar dropdown-toggle">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 mr-1" viewBox="0 0 20 20" fill="currentColor">
            <path fill-rule="evenodd" d="M12 1.586l-4 4V17h8V5.586l-4-4zM2 17V9.276l4-3.638V17H2zM2 8.162V3h4.5L12 8.5V17H6V5.638L2 8.162z" clip-rule="evenodd" />
          </svg>
          <span>{{ mapTypes[selectedMapType] }}</span>
        </button>
        <div class="dropdown-menu">
          <button 
            v-for="(label, type) in mapTypes" 
            :key="type" 
            class="dropdown-item" 
            :class="{ 'active': type === selectedMapType }"
            @click="changeMapType(type)"
          >
            {{ label }}
          </button>
        </div>
      </div>
      
      <!-- Outils de plan -->
      <div class="border-l pl-2">
        <div class="flex items-center space-x-1">
          <button @click="createNewPlan" class="btn-toolbar" title="Nouveau plan">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
              <path fill-rule="evenodd" d="M6 2a2 2 0 00-2 2v12a2 2 0 002 2h8a2 2 0 002-2V7.414A2 2 0 0015.414 6L12 2.586A2 2 0 0010.586 2H6zm5 6a1 1 0 10-2 0v2H7a1 1 0 100 2h2v2a1 1 0 102 0v-2h2a1 1 0 100-2h-2V8z" clip-rule="evenodd" />
            </svg>
            <span class="hidden lg:inline ml-1">Nouveau</span>
          </button>
          <button @click="loadPlan" class="btn-toolbar" title="Charger un plan">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
              <path fill-rule="evenodd" d="M2 6a2 2 0 012-2h4a1 1 0 010 2H4v10h10v-4a1 1 0 112 0v4a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" clip-rule="evenodd" />
              <path d="M10 9a1 1 0 011-1h5a1 1 0 110 2h-5a1 1 0 01-1-1z" />
              <path fill-rule="evenodd" d="M13 5a1 1 0 011 1v4a1 1 0 11-2 0V6a1 1 0 011-1z" clip-rule="evenodd" />
            </svg>
            <span class="hidden lg:inline ml-1">Charger</span>
          </button>
          <button @click="savePlan" class="btn-toolbar" title="Enregistrer le plan">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
              <path d="M7.707 10.293a1 1 0 10-1.414 1.414l3 3a1 1 0 001.414 0l3-3a1 1 0 00-1.414-1.414L11 11.586V6h5a2 2 0 012 2v7a2 2 0 01-2 2H4a2 2 0 01-2-2V8a2 2 0 012-2h5v5.586l-1.293-1.293zM9 4a1 1 0 012 0v2H9V4z" />
            </svg>
            <span class="hidden lg:inline ml-1">Enregistrer</span>
          </button>
        </div>
      </div>
      
      <!-- Outils de vue -->
      <div class="border-l pl-2">
        <div class="flex items-center space-x-1">
          <button @click="adjustView" class="btn-toolbar" title="Ajuster la vue">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
              <path d="M5 3a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2V5a2 2 0 00-2-2H5zM5 11a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2v-2a2 2 0 00-2-2H5zM11 5a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V5zM11 13a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
            </svg>
            <span class="hidden lg:inline ml-1">Ajuster</span>
          </button>
          <button @click="generateSummary" class="btn-toolbar" title="Générer une synthèse">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
              <path fill-rule="evenodd" d="M3 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clip-rule="evenodd" />
            </svg>
            <span class="hidden lg:inline ml-1">Synthèse</span>
          </button>
        </div>
      </div>
      
      <!-- Information de sauvegarde -->
      <div class="border-l pl-2 ml-auto">
        <div class="text-xs text-gray-500 hidden lg:block">
          Dernière sauvegarde : {{ lastSaveFormatted }}
        </div>
      </div>
    </div>
    
    <!-- Version mobile -->
    <div class="md:hidden">
      <div class="flex justify-between items-center">
        <button @click="showMobileMenu = !showMobileMenu" class="p-1 rounded border">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-gray-600" viewBox="0 0 20 20" fill="currentColor">
            <path fill-rule="evenodd" d="M3 5a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM3 10a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM3 15a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clip-rule="evenodd" />
          </svg>
        </button>
        
        <div class="flex space-x-1">
          <button @click="createNewPlan" class="p-1 rounded border bg-white">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
              <path fill-rule="evenodd" d="M6 2a2 2 0 00-2 2v12a2 2 0 002 2h8a2 2 0 002-2V7.414A2 2 0 0015.414 6L12 2.586A2 2 0 0010.586 2H6zm5 6a1 1 0 10-2 0v2H7a1 1 0 100 2h2v2a1 1 0 102 0v-2h2a1 1 0 100-2h-2V8z" clip-rule="evenodd" />
            </svg>
          </button>
          <button @click="savePlan" class="p-1 rounded border bg-white">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
              <path d="M7.707 10.293a1 1 0 10-1.414 1.414l3 3a1 1 0 001.414 0l3-3a1 1 0 00-1.414-1.414L11 11.586V6h5a2 2 0 012 2v7a2 2 0 01-2 2H4a2 2 0 01-2-2V8a2 2 0 012-2h5v5.586l-1.293-1.293zM9 4a1 1 0 012 0v2H9V4z" />
            </svg>
          </button>
          <button @click="adjustView" class="p-1 rounded border bg-white">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
              <path d="M5 3a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2V5a2 2 0 00-2-2H5zM5 11a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2v-2a2 2 0 00-2-2H5zM11 5a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V5zM11 13a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
            </svg>
          </button>
        </div>
      </div>
      
      <!-- Menu mobile -->
      <div v-if="showMobileMenu" class="mobile-menu mt-2 bg-white shadow-md rounded p-2 z-50">
        <div class="flex flex-col space-y-2">
          <!-- Type de carte -->
          <div class="flex flex-col">
            <span class="text-xs font-medium text-gray-500 mb-1">Type de carte</span>
            <div class="grid grid-cols-2 gap-1">
              <button
                v-for="(label, type) in mapTypes"
                :key="type"
                class="px-2 py-1 text-xs rounded border"
                :class="{ 'bg-blue-50 border-blue-200 text-blue-700': type === selectedMapType }"
                @click="changeMapType(type)"
              >
                {{ label }}
              </button>
            </div>
          </div>
          
          <!-- Outils de plan -->
          <div class="flex flex-col">
            <span class="text-xs font-medium text-gray-500 mb-1">Outils de plan</span>
            <div class="grid grid-cols-2 gap-1">
              <button @click="loadPlan" class="px-2 py-1 text-xs rounded border flex items-center justify-center">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3 mr-1" viewBox="0 0 20 20" fill="currentColor">
                  <path fill-rule="evenodd" d="M2 6a2 2 0 012-2h4a1 1 0 010 2H4v10h10v-4a1 1 0 112 0v4a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" clip-rule="evenodd" />
                  <path d="M10 9a1 1 0 011-1h5a1 1 0 110 2h-5a1 1 0 01-1-1z" />
                  <path fill-rule="evenodd" d="M13 5a1 1 0 011 1v4a1 1 0 11-2 0V6a1 1 0 011-1z" clip-rule="evenodd" />
                </svg>
                Charger
              </button>
              <button @click="generateSummary" class="px-2 py-1 text-xs rounded border flex items-center justify-center">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3 mr-1" viewBox="0 0 20 20" fill="currentColor">
                  <path fill-rule="evenodd" d="M3 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clip-rule="evenodd" />
                </svg>
                Synthèse
              </button>
            </div>
          </div>
          
          <!-- Information de sauvegarde -->
          <div class="text-xs text-gray-500 text-center pt-1 border-t">
            Dernière sauvegarde : {{ lastSaveFormatted }}
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';

const emit = defineEmits<{
  (e: 'change-map-type', type: string): void;
  (e: 'create-new-plan'): void;
  (e: 'load-plan'): void;
  (e: 'save-plan'): void;
  (e: 'adjust-view'): void;
  (e: 'generate-summary'): void;
}>();

const props = defineProps<{
  lastSave?: Date;
}>();

// État
const selectedMapType = ref('standard');
const showMobileMenu = ref(false);

// Types de carte disponibles
const mapTypes = {
  standard: 'Ville',
  satellite: 'Satellite',
  cadastre: 'Cadastre'
};

// Formater la date de dernière sauvegarde
const lastSaveFormatted = computed(() => {
  if (!props.lastSave) return 'Jamais';
  
  const date = new Date(props.lastSave);
  return date.toLocaleString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
});

// Méthodes
const changeMapType = (type: string) => {
  selectedMapType.value = type;
  emit('change-map-type', type);
  closeMobileMenu();
};

const createNewPlan = () => {
  emit('create-new-plan');
  closeMobileMenu();
};

const loadPlan = () => {
  emit('load-plan');
  closeMobileMenu();
};

const savePlan = () => {
  emit('save-plan');
  closeMobileMenu();
};

const adjustView = () => {
  emit('adjust-view');
  closeMobileMenu();
};

const generateSummary = () => {
  emit('generate-summary');
  closeMobileMenu();
};

const closeMobileMenu = () => {
  showMobileMenu.value = false;
};
</script>

<style scoped>
.map-toolbar {
  background-color: white;
  border-top: 1px solid #e5e7eb;
  border-bottom: 1px solid #e5e7eb;
  padding: 0.5rem 1rem;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
  position: sticky;
  top: 0;
  z-index: 20;
}

.dropdown {
  position: relative;
  display: inline-block;
}

.dropdown-toggle {
  display: flex;
  align-items: center;
}

.dropdown-menu {
  display: none;
  position: absolute;
  top: 100%;
  left: 0;
  z-index: 30;
  min-width: 10rem;
  padding: 0.5rem 0;
  background-color: white;
  border: 1px solid #e5e7eb;
  border-radius: 0.25rem;
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
}

.dropdown:hover .dropdown-menu {
  display: block;
}

.dropdown-item {
  display: block;
  width: 100%;
  padding: 0.25rem 1rem;
  text-align: left;
  font-size: 0.875rem;
}

.dropdown-item:hover {
  background-color: #f3f4f6;
}

.dropdown-item.active {
  background-color: #ebf5ff;
  color: #2563eb;
}

.btn-toolbar {
  display: flex;
  align-items: center;
  background-color: white;
  border: 1px solid #e5e7eb;
  border-radius: 0.25rem;
  padding: 0.25rem 0.5rem;
  font-size: 0.75rem;
  font-weight: 500;
  color: #4b5563;
  transition: all 0.2s;
}

.btn-toolbar:hover {
  background-color: #f9fafb;
  border-color: #d1d5db;
}

.btn-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: white;
  border: 1px solid #e5e7eb;
  border-radius: 0.25rem;
  padding: 0.25rem;
  color: #4b5563;
  transition: all 0.2s;
}

.btn-icon:hover {
  background-color: #f9fafb;
  border-color: #d1d5db;
}

.mobile-menu {
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  margin: 0 0.5rem;
}
</style> 