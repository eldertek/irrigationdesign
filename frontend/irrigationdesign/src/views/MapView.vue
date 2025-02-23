<template>
  <div class="h-full flex">
    <!-- Carte -->
    <div class="flex-1 relative">
        <!-- Overlay de génération -->
        <div v-if="isGeneratingSynthesis" class="absolute inset-0 bg-black/30 backdrop-blur-sm z-[2000] flex items-center justify-center">
          <div class="bg-white/90 rounded-2xl p-8 max-w-md shadow-2xl border border-gray-100">
            <div class="flex flex-col items-center">
              <!-- Animation de chargement améliorée -->
              <div class="relative w-24 h-24 mb-6">
                <!-- Cercle principal rotatif -->
                <div class="absolute inset-0 border-4 border-primary-200 rounded-full"></div>
                <div class="absolute inset-0 border-4 border-primary-600 border-t-transparent rounded-full animate-spin"></div>
                <!-- Effet de progression -->
                <div class="absolute inset-2 border-2 border-primary-400/30 rounded-full animate-pulse"></div>
                <!-- Icône au centre -->
                <div class="absolute inset-0 flex items-center justify-center">
                  <svg class="w-8 h-8 text-primary-600 animate-bounce" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
                  </svg>
                </div>
              </div>
              
              <!-- Textes explicatifs -->
              <h3 class="text-xl font-semibold text-gray-900 mb-2">
                Génération de la synthèse
              </h3>
              <div class="space-y-2 text-center">
                <p class="text-primary-600 font-medium">
                  Capture des formes en cours...
                </p>
                <p class="text-sm text-gray-500">
                  Nous optimisons la qualité de vos captures pour un rendu parfait
                </p>
              </div>
            </div>
          </div>
        </div>

      <!-- Vue d'accueil quand aucun plan n'est chargé -->
      <div v-if="!currentPlan" class="absolute inset-0 flex items-center justify-center bg-gray-50 z-[1000]">
        <div class="text-center max-w-lg mx-auto p-8">
          <div class="relative w-48 h-48 mx-auto mb-12 rounded-full bg-gradient-to-br from-primary-100 to-primary-50 p-8 shadow-lg ring-4 ring-white">
            <img 
                src="@/assets/logo.jpeg" 
              alt="IrrigationDesign Logo" 
              class="w-full h-full object-contain filter drop-shadow-md"
            />
            <div class="absolute inset-0 rounded-full bg-gradient-to-t from-transparent to-white/10 pointer-events-none"></div>
          </div>
          <h1 class="text-3xl font-bold text-gray-900 mb-4">Bienvenue sur IrrigationDesign</h1>
          <p class="text-gray-600 mb-8">Pour commencer à dessiner, vous devez d'abord créer un nouveau plan ou charger un plan existant.</p>
          <div class="space-y-4">
            <button
              @click="showNewPlanModal = true"
              class="w-full flex items-center justify-center px-4 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 transition-colors duration-200"
            >
              <svg class="w-6 h-6 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/>
              </svg>
              Créer un nouveau plan
            </button>
            <button
              @click="showLoadPlanModal = true"
              class="w-full flex items-center justify-center px-4 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 transition-colors duration-200"
            >
              <svg class="w-6 h-6 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/>
              </svg>
              Charger un plan existant
            </button>
          </div>
        </div>
      </div>

      <div ref="mapContainer" class="absolute inset-0 w-full h-full"></div>
      
      <!-- Barre d'outils principale -->
        <div v-if="currentPlan && !isGeneratingSynthesis" class="absolute bottom-6 left-6 z-[1000]">
        <!-- Sélecteur de type de carte -->
        <div class="bg-white rounded-lg shadow-lg p-3 mb-3">
          <h2 class="text-sm font-semibold text-gray-700 mb-2">Type de carte</h2>
          <div class="grid grid-cols-3 gap-2">
            <button
              v-for="name in Object.keys(baseMaps) as Array<keyof typeof baseMaps>"
              :key="name"
              @click="changeBaseMap(name)"
              class="px-3 py-2 text-sm rounded-md transition-colors duration-200"
              :class="{
                'bg-primary-600 text-white': currentBaseMap === name,
                'bg-gray-100 text-gray-700 hover:bg-gray-200': currentBaseMap !== name
              }"
            >
              {{ name }}
            </button>
          </div>
        </div>

        <!-- Boutons de gestion des plans -->
        <div class="bg-white rounded-lg shadow-lg p-3 space-y-2">
          <div class="flex flex-col mb-2">
            <h1 class="text-xl font-bold text-gray-800 mb-1">
              {{ currentPlan?.nom || 'Aucun plan chargé' }}
            </h1>
            <span v-if="currentPlan?.description" class="text-sm text-gray-500">
              {{ currentPlan.description }}
            </span>
          </div>
          <div class="grid grid-cols-1 gap-2">
            <button
              @click="showNewPlanModal = true"
              class="flex items-center px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 transition-colors duration-200"
            >
              <svg class="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/>
              </svg>
              Nouveau plan
            </button>
            <button
              @click="showLoadPlanModal = true"
              class="flex items-center px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 transition-colors duration-200"
            >
              <svg class="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/>
              </svg>
              Charger un plan
            </button>
            <button
              v-if="currentPlan"
              @click="savePlan"
              class="flex items-center px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 transition-colors duration-200"
              :disabled="saving"
            >
              <svg v-if="!saving" class="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4"/>
              </svg>
              <svg v-else class="animate-spin h-5 w-5 mr-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              {{ saving ? 'Sauvegarde...' : 'Enregistrer' }}
            </button>
            <!-- Bouton d'ajustement de la vue -->
            <button
              @click="handleAdjustView"
              class="flex items-center px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 transition-colors duration-200"
            >
              <svg class="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"/>
              </svg>
              Ajuster la vue
            </button>
              <button
                @click="generateSynthesis"
                class="flex items-center px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 transition-colors duration-200"
              >
                <svg class="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
                </svg>
                Générer synthèse
            </button>
          </div>
          <!-- Indicateur de dernière sauvegarde -->
          <div v-if="currentPlan?.date_modification" class="text-xs text-gray-500 mt-2">
            Dernière sauvegarde : {{ formatLastSaved(currentPlan.date_modification) }}
          </div>
        </div>
      </div>

      <!-- Notification de sauvegarde réussie -->
      <div v-if="showSaveSuccess" 
           class="fixed bottom-6 right-6 bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded-lg shadow-lg z-[2000] flex items-center transform transition-all duration-300 ease-in-out"
           role="alert">
        <svg class="w-5 h-5 mr-2 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/>
        </svg>
        <span class="font-medium">Plan sauvegardé avec succès</span>
      </div>

      <!-- Outils de dessin -->
        <div v-if="currentPlan && !isGeneratingSynthesis" class="drawing-tools-container absolute top-4 right-4 z-[1000]">
        <DrawingTools
          :current-tool="currentTool"
          :selected-shape="selectedShape"
          @tool-change="setDrawingTool"
          @style-update="updateShapeStyle"
          @properties-update="updateShapeProperties"
          @delete-shape="deleteSelectedShape"
        />
      </div>

      <!-- Modal Nouveau Plan -->
      <NewPlanModal
        ref="newPlanModalRef"
        v-model="showNewPlanModal"
        @created="onPlanCreated"
        @dealerSelected="dealer => selectedDealer = dealer"
        @clientSelected="client => selectedClient = client"
      />

      <!-- Modal Charger un Plan -->
      <div v-if="showLoadPlanModal" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[2000]">
        <div class="bg-white rounded-lg p-6 max-w-2xl w-full mx-4">
          <div class="flex justify-between items-center mb-4">
            <h2 class="text-xl font-semibold text-gray-900">Charger un plan existant</h2>
            <button
              @click="showLoadPlanModal = false"
              class="text-gray-400 hover:text-gray-500 focus:outline-none"
            >
              <svg class="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <!-- Interface administrateur -->
          <div v-if="authStore.isAdmin" class="space-y-4">
            <!-- Étape 1: Sélection du concessionnaire -->
            <div v-if="!selectedDealer" class="space-y-2">
              <h3 class="font-medium text-gray-700">Sélectionnez un concessionnaire</h3>
              <div class="grid grid-cols-1 gap-2 max-h-96 overflow-y-auto">
                <template v-if="isLoadingDealers">
                  <div v-for="i in 3" :key="i" class="animate-pulse">
                    <div class="p-3 bg-white rounded-lg border border-gray-200">
                      <div class="h-5 bg-gray-200 rounded w-3/4 mb-2"></div>
                      <div class="h-4 bg-gray-100 rounded w-1/2"></div>
                    </div>
                  </div>
                </template>
                <template v-else>
                  <button
                    v-for="dealer in dealers"
                    :key="dealer.id"
                    @click="selectDealer(dealer)"
                    class="flex items-center p-3 text-left bg-white hover:bg-gray-50 rounded-lg border border-gray-200 transition-colors duration-200"
                  >
                    <div>
                      <div class="font-medium text-gray-900">{{ dealer.first_name }} {{ dealer.last_name }} ({{ dealer.company_name }})</div>
                    </div>
                    <svg class="w-5 h-5 ml-auto text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/>
                    </svg>
                  </button>
                </template>
              </div>
            </div>

            <!-- Étape 2: Sélection du client -->
            <div v-else-if="!selectedClient" class="space-y-2">
              <div class="flex items-center mb-4">
                <button
                  @click="backToDealerList"
                  class="flex items-center text-sm text-gray-600 hover:text-gray-900"
                >
                  <svg class="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"/>
                  </svg>
                  Retour à la liste des concessionnaires
                </button>
                <span class="mx-2 text-gray-400">|</span>
                <span class="text-sm text-gray-600">
                  {{ selectedDealer.first_name }} {{ selectedDealer.last_name }} ({{ selectedDealer.company_name }})
                </span>
              </div>
              <h3 class="font-medium text-gray-700">Sélectionnez un client</h3>
              <div class="grid grid-cols-1 gap-2 max-h-96 overflow-y-auto">
                <template v-if="isLoadingClients">
                  <div v-for="i in 3" :key="i" class="animate-pulse">
                    <div class="p-3 bg-white rounded-lg border border-gray-200">
                      <div class="h-5 bg-gray-200 rounded w-3/4 mb-2"></div>
                      <div class="h-4 bg-gray-100 rounded w-1/2"></div>
                    </div>
                  </div>
                </template>
                <template v-else>
                  <button
                    v-for="client in filteredClients"
                    :key="client.id"
                    @click="selectClient(client)"
                    class="flex items-center p-3 text-left bg-white hover:bg-gray-50 rounded-lg border border-gray-200 transition-colors duration-200"
                  >
                    <div>
                      <div class="font-medium text-gray-900">{{ client.first_name }} {{ client.last_name }} ({{ client.company_name }})</div>
                    </div>
                    <svg class="w-5 h-5 ml-auto text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/>
                    </svg>
                  </button>
                </template>
              </div>
            </div>

            <!-- Étape 3: Liste des plans du client -->
            <div v-else class="space-y-2">
              <div class="flex items-center mb-4">
                <button
                  @click="backToClientList"
                  class="flex items-center text-sm text-gray-600 hover:text-gray-900"
                >
                  <svg class="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"/>
                  </svg>
                  Retour à la liste des clients
                </button>
                <span class="mx-2 text-gray-400">|</span>
                <span class="text-sm text-gray-600">
                  {{ selectedClient.first_name }} {{ selectedClient.last_name }} ({{ selectedClient.company_name }})
                </span>
              </div>
              <h3 class="font-medium text-gray-700">Plans disponibles</h3>
              <div class="grid grid-cols-1 gap-2 max-h-96 overflow-y-auto">
                <template v-if="isLoadingPlans">
                  <div v-for="i in 3" :key="i" class="animate-pulse">
                    <div class="p-3 bg-white rounded-lg border border-gray-200">
                      <div class="h-5 bg-gray-200 rounded w-3/4 mb-2"></div>
                      <div class="h-4 bg-gray-100 rounded w-2/3 mb-2"></div>
                      <div class="h-3 bg-gray-50 rounded w-1/3"></div>
                    </div>
                  </div>
                </template>
                <template v-else>
                  <button
                    v-for="plan in clientPlans"
                    :key="plan.id"
                    @click="loadPlan(plan.id)"
                    class="w-full px-4 py-3 text-left bg-white hover:bg-gray-50 rounded-lg border border-gray-200 transition-colors duration-200"
                  >
                    <div class="font-medium text-gray-900">{{ plan.nom }}</div>
                    <div class="text-sm text-gray-500">{{ plan.description }}</div>
                    <div class="text-xs text-gray-400 mt-1">
                      Modifié le {{ formatLastSaved(plan.date_modification) }}
                    </div>
                  </button>
                </template>
              </div>
            </div>
          </div>

          <!-- Interface concessionnaire -->
          <div v-else-if="authStore.isDealer" class="space-y-4">
            <!-- Liste des clients -->
            <div v-if="!selectedClient" class="space-y-2">
              <h3 class="font-medium text-gray-700">Sélectionnez un client</h3>
              <div class="grid grid-cols-1 gap-2 max-h-96 overflow-y-auto">
                <template v-if="isLoadingClients">
                  <div v-for="i in 3" :key="i" class="animate-pulse">
                    <div class="p-3 bg-white rounded-lg border border-gray-200">
                      <div class="h-5 bg-gray-200 rounded w-3/4 mb-2"></div>
                      <div class="h-4 bg-gray-100 rounded w-1/2"></div>
                    </div>
                  </div>
                </template>
                <template v-else>
                  <button
                    v-for="client in filteredClients"
                    :key="client.id"
                    @click="selectClient(client)"
                    class="flex items-center p-3 text-left bg-white hover:bg-gray-50 rounded-lg border border-gray-200 transition-colors duration-200"
                  >
                    <div>
                      <div class="font-medium text-gray-900">{{ client.first_name }} {{ client.last_name }} ({{ client.company_name }})</div>
                    </div>
                    <svg class="w-5 h-5 ml-auto text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/>
                    </svg>
                  </button>
                </template>
              </div>
            </div>

            <!-- Liste des plans du client -->
            <div v-else class="space-y-2">
              <div class="flex items-center mb-4">
                <button
                  @click="backToClientList"
                  class="flex items-center text-sm text-gray-600 hover:text-gray-900"
                >
                  <svg class="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"/>
                  </svg>
                  Retour à la liste des clients
                </button>
                <span class="mx-2 text-gray-400">|</span>
                <span class="text-sm text-gray-600">
                  {{ selectedClient.first_name }} {{ selectedClient.last_name }}
                </span>
              </div>
              <h3 class="font-medium text-gray-700">Plans disponibles</h3>
              <div class="grid grid-cols-1 gap-2 max-h-96 overflow-y-auto">
                <template v-if="isLoadingPlans">
                  <div v-for="i in 3" :key="i" class="animate-pulse">
                    <div class="p-3 bg-white rounded-lg border border-gray-200">
                      <div class="h-5 bg-gray-200 rounded w-3/4 mb-2"></div>
                      <div class="h-4 bg-gray-100 rounded w-2/3 mb-2"></div>
                      <div class="h-3 bg-gray-50 rounded w-1/3"></div>
                    </div>
                  </div>
                </template>
                <template v-else>
                  <button
                    v-for="plan in clientPlans"
                    :key="plan.id"
                    @click="loadPlan(plan.id)"
                    class="w-full px-4 py-3 text-left bg-white hover:bg-gray-50 rounded-lg border border-gray-200 transition-colors duration-200"
                  >
                    <div class="font-medium text-gray-900">{{ plan.nom }}</div>
                    <div class="text-sm text-gray-500">{{ plan.description }}</div>
                    <div class="text-xs text-gray-400 mt-1">
                      Modifié le {{ formatLastSaved(plan.date_modification) }}
                    </div>
                  </button>
                </template>
              </div>
            </div>
          </div>

          <!-- Interface client -->
          <div v-else class="max-h-96 overflow-y-auto">
            <div v-if="irrigationStore.plans.length === 0" class="text-center py-8">
              <p class="text-gray-500">Aucun plan disponible</p>
            </div>
            <div v-else class="space-y-2">
              <button
                v-for="plan in irrigationStore.plans"
                :key="plan.id"
                @click="loadPlan(plan.id)"
                class="w-full px-4 py-3 text-left bg-white hover:bg-gray-50 rounded-lg border border-gray-200 transition-colors duration-200"
              >
                <div class="font-medium text-gray-900">{{ plan.nom }}</div>
                <div class="text-sm text-gray-500">{{ plan.description }}</div>
                <div class="text-xs text-gray-400 mt-1">
                  Modifié le {{ formatLastSaved(plan.date_modification) }}
                </div>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
  import { onMounted, ref, watch, onBeforeUnmount, onUnmounted, computed } from 'vue';
import type { LatLngTuple } from 'leaflet';
import * as L from 'leaflet';
import 'leaflet-simple-map-screenshoter';
import DrawingTools from '../components/DrawingTools.vue';
import { useMapDrawing } from '../composables/useMapDrawing';
import { useMapState } from '../composables/useMapState';
import { useIrrigationStore } from '@/stores/irrigation';
import { useDrawingStore } from '@/stores/drawing';
import type { Plan } from '@/stores/irrigation';
  import type { DrawingElement, ShapeType, CircleData, RectangleData, SemicircleData, LineData, TextData } from '@/types/drawing';
import { CircleArc } from '@/utils/CircleArc';
import { useAuthStore } from '@/stores/auth';
  import type { UserDetails } from '@/types/user';
import api from '@/services/api';
import NewPlanModal from '@/components/NewPlanModal.vue';
  import jsPDF from 'jspdf';
  import logo from '@/assets/logo.jpeg';

const mapContainer = ref<HTMLElement | null>(null);
const irrigationStore = useIrrigationStore();
const drawingStore = useDrawingStore();
const shapes = ref<any[]>([]);

const {
  currentTool,
    selectedShape: selectedLeafletShape,
  map,
  initMap: initDrawing,
  setDrawingTool,
  updateShapeStyle,
  updateShapeProperties: updateShapeProps,
  featureGroup,
  adjustView,
  clearActiveControlPoints,
} = useMapDrawing();

const {
  initMap: initState,
  baseMaps,
  currentBaseMap,
  changeBaseMap
} = useMapState();

// Ajout des refs pour les modals
const showNewPlanModal = ref(false);
const showLoadPlanModal = ref(false);
const currentPlan = ref<Plan | null>(null);

// État pour la sauvegarde
const saving = ref(false);
const showSaveSuccess = ref(false);

// Ajout des imports et des refs nécessaires
const authStore = useAuthStore();
const dealers = ref<UserDetails[]>([]);
const dealerClients = ref<UserDetails[]>([]);
const clientPlans = ref<Plan[]>([]);
const selectedDealer = ref<UserDetails | null>(null);
const selectedClient = ref<UserDetails | null>(null);
const isLoadingDealers = ref(false);
const isLoadingClients = ref(false);
const isLoadingPlans = ref(false);

// Référence vers le composant NewPlanModal
const newPlanModalRef = ref<InstanceType<typeof NewPlanModal> | null>(null);

// Computed pour les clients filtrés selon le concessionnaire sélectionné
const filteredClients = computed(() => {
  console.log('[MapView][filteredClients] Computing with:', {
    userType: authStore.user?.user_type,
    selectedDealer: selectedDealer.value,
    dealerClients: dealerClients.value
  });

  if (authStore.user?.user_type === 'admin') {
    const clients = selectedDealer.value ? dealerClients.value : [];
    console.log('[MapView][filteredClients] Admin clients:', clients);
    return clients;
  } else if (authStore.user?.user_type === 'dealer') {
    console.log('[MapView][filteredClients] Dealer clients:', dealerClients.value);
    return dealerClients.value;
  }
  console.log('[MapView][filteredClients] No clients returned');
  return [];
});

  // Add computed property to transform Leaflet Layer to ShapeType
  const selectedShape = computed((): ShapeType | null => {
    if (!selectedLeafletShape.value) return null;
    return {
      type: selectedLeafletShape.value.properties?.type || 'unknown',
      properties: selectedLeafletShape.value.properties || {},
      layer: selectedLeafletShape.value
    };
});

// Fonction pour sauvegarder la position dans les cookies
function saveMapPosition(mapInstance: L.Map) {
  const center = mapInstance.getCenter();
  const zoom = mapInstance.getZoom();
  const mapState = {
    lat: center.lat,
    lng: center.lng,
    zoom: zoom
  };
  document.cookie = `mapState=${JSON.stringify(mapState)};max-age=2592000;path=/`; // expire dans 30 jours
}

// Fonction pour récupérer la position depuis les cookies
function getMapPosition(): { lat: number; lng: number; zoom: number } | null {
  const cookies = document.cookie.split(';');
  const mapCookie = cookies.find(cookie => cookie.trim().startsWith('mapState='));
  if (mapCookie) {
    try {
      return JSON.parse(mapCookie.split('=')[1]);
    } catch (e) {
      console.error('Erreur lors de la lecture du cookie de position:', e);
      return null;
    }
  }
  return null;
}

onMounted(async () => {
  console.log('[onMounted] Starting initialization...');
  
  // Charger les plans
  await irrigationStore.fetchPlans();
  
  // Récupérer la dernière position sauvegardée ou utiliser la position par défaut
  const savedPosition = getMapPosition();
  const center: LatLngTuple = savedPosition 
    ? [savedPosition.lat, savedPosition.lng]
    : [46.603354, 1.888334];
  const zoom = savedPosition?.zoom ?? 6;

  // Initialiser la carte une seule fois
  if (mapContainer.value && !map.value) {
    // Initialiser les outils de dessin (qui crée aussi la carte)
    const mapInstance = initDrawing(mapContainer.value, center, zoom) as L.Map;
    
    // Configurer la langue française pour Leaflet-Geoman
    mapInstance.pm.setLang('fr');
    
    // Désactiver les contrôles de rotation par défaut
    mapInstance.pm.addControls({
      rotateMode: false
    });
    
    // Ajouter la couche de carte satellite Esri World Imagery
    L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
      attribution: 'Tiles © Esri — Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community',
      maxZoom: 19
    }).addTo(mapInstance);
    
    // Initialiser l'état de la carte avec l'instance existante
    initState(mapInstance);
    
    // Sauvegarder la position quand la carte bouge
    mapInstance.on('moveend', () => {
      saveMapPosition(mapInstance);
    });
    
    // Ajouter l'écouteur d'événement pour le changement de localisation
    window.addEventListener('map-set-location', ((event: CustomEvent) => {
      if (mapInstance && event.detail) {
        const { lat, lng, zoom } = event.detail;
        mapInstance.flyTo([lat, lng], zoom, {
          duration: 1.5,
          easeLinearity: 0.25
        });
      }
    }) as EventListener);
  }

  // Récupérer l'ID du dernier plan ouvert depuis le localStorage
  const lastPlanId = localStorage.getItem('lastPlanId');
  
  // Si un plan était ouvert précédemment, le charger
  if (lastPlanId) {
    try {
      await loadPlan(parseInt(lastPlanId));
    } catch (error) {
      console.error('Error loading last plan:', error);
    }
  }

  // Charger les concessionnaires au montage du composant si l'utilisateur est admin
  if (authStore.user?.user_type === 'admin') {
    console.log('[onMounted] Loading dealers for admin...');
    await loadDealers();
  }

  // Charger les clients si c'est un concessionnaire
  if (authStore.user?.user_type === 'dealer') {
    console.log('[onMounted] Loading clients for dealer...');
    await loadDealerClients();
  }
});

// Surveiller les changements dans le dessin
watch(() => drawingStore.hasUnsavedChanges, (newValue) => {
  if (newValue && currentPlan.value) {
    irrigationStore.markUnsavedChanges();
  }
});

// Surveiller l'initialisation de la carte
watch(map, async (newMap) => {
  if (newMap && irrigationStore.currentPlan) {
    clearMap();
    await drawingStore.loadPlanElements(irrigationStore.currentPlan.id);
    await loadPlan(irrigationStore.currentPlan.id);
  }
});

// Surveiller le plan courant dans le store
watch(() => irrigationStore.currentPlan, async (newPlan) => {
  if (newPlan) {
    currentPlan.value = newPlan;
    irrigationStore.setCurrentPlan(newPlan);
    drawingStore.setCurrentPlan(newPlan.id);
  } else {
    currentPlan.value = null;
    clearMap();
  }
}, { immediate: true });

// Nettoyer l'écouteur d'événement lors de la destruction du composant
onBeforeUnmount(() => {
  if (map.value) {
    map.value.off('moveend');
  }
});

  // Modifier la fonction loadPlan
async function loadPlan(planId: number) {
  try {
    clearMap();
    
    await drawingStore.loadPlanElements(planId);
    const plan = irrigationStore.getPlanById(planId);
    
    if (plan) {
      currentPlan.value = plan;
      irrigationStore.setCurrentPlan(plan);
      drawingStore.setCurrentPlan(plan.id);
      
      localStorage.setItem('lastPlanId', plan.id.toString());

      if (map.value && featureGroup.value) {
        drawingStore.getCurrentElements.forEach(element => {
          if (!featureGroup.value || !element.data) return;

            let layer: L.Layer | null = null;
          const { style = {}, ...otherData } = element.data;

          switch (element.type_forme) {
              case 'CERCLE': {
                const circleData = otherData as CircleData;
                if (circleData.center && circleData.radius) {
              layer = L.circle(
                    [circleData.center[1], circleData.center[0]],
                    { ...style, radius: circleData.radius }
                  );
                }
              break;
              }

              case 'RECTANGLE': {
                const rectData = otherData as RectangleData;
                if (rectData.bounds) {
              layer = L.rectangle([
                    [rectData.bounds.southWest[1], rectData.bounds.southWest[0]],
                    [rectData.bounds.northEast[1], rectData.bounds.northEast[0]]
              ], style);
                }
              break;
              }

              case 'DEMI_CERCLE': {
                const semiData = otherData as SemicircleData;
                if (semiData.center && semiData.radius) {
              layer = new CircleArc(
                    L.latLng(semiData.center[1], semiData.center[0]),
                    semiData.radius,
                    semiData.startAngle,
                    semiData.endAngle,
                style
              );
                }
              break;
              }

              case 'LIGNE': {
                const lineData = otherData as LineData;
                if (lineData.points) {
                  const points = lineData.points.map(p => L.latLng(p[1], p[0]));
                  layer = L.polyline(points, style);
                }
              break;
              }

              case 'TEXTE': {
                const textData = otherData as TextData;
                if (textData.position && textData.content) {
              const textIcon = L.divIcon({
                    html: `<div class="text-annotation" style="font-size: ${style.fontSize || '14px'}">${textData.content}</div>`,
                className: 'text-container'
              });
                  layer = L.marker([textData.position[1], textData.position[0]], {
                icon: textIcon,
                ...style
              });
                }
              break;
              }
          }

          if (layer) {
            layer.properties = {
              type: element.type_forme,
              style: style,
              ...otherData
            };

              featureGroup.value?.addLayer(layer);

            shapes.value.push({
              id: element.id,
              type: element.type_forme,
              layer: layer,
              properties: layer.properties
            });

              if (otherData.rotation && typeof (layer as any).setRotation === 'function') {
                (layer as any).setRotation(otherData.rotation);
            }
          }
        });
      }
    }
    showLoadPlanModal.value = false;
  } catch (error) {
    console.error('Erreur lors du chargement du plan:', error);
  }
}

  // Modifier la fonction savePlan
async function savePlan() {
  if (!currentPlan.value || !featureGroup.value) {
    console.warn('Aucun plan actif ou groupe de formes à sauvegarder');
    return;
  }

  saving.value = true;
  try {
      const elements: DrawingElement[] = [];
    
      featureGroup.value.eachLayer((layer: L.Layer) => {
      const baseData = {
        style: {
            color: (layer as any).options?.color || '#3388ff',
            fillColor: (layer as any).options?.fillColor || '#3388ff',
            fillOpacity: (layer as any).options?.fillOpacity || 0.2,
            weight: (layer as any).options?.weight || 3,
            opacity: (layer as any).options?.opacity || 1
          }
        };

        let type_forme: 'CERCLE' | 'RECTANGLE' | 'DEMI_CERCLE' | 'LIGNE' | 'TEXTE' | undefined;
        let data: any;

      if (layer instanceof L.Circle) {
        type_forme = 'CERCLE';
        data = {
          ...baseData,
            center: [(layer as L.Circle).getLatLng().lng, (layer as L.Circle).getLatLng().lat],
          radius: layer.getRadius()
        };
      } else if (layer instanceof L.Rectangle) {
        type_forme = 'RECTANGLE';
        const bounds = layer.getBounds();
        data = {
          ...baseData,
          bounds: {
            southWest: [bounds.getSouthWest().lng, bounds.getSouthWest().lat],
            northEast: [bounds.getNorthEast().lng, bounds.getNorthEast().lat]
          }
        };
        } else if ((layer as any).properties?.type === 'Semicircle') {
        type_forme = 'DEMI_CERCLE';
        data = {
          ...baseData,
            center: [(layer as L.Circle).getLatLng().lng, (layer as L.Circle).getLatLng().lat],
            radius: (layer as any).getRadius(),
            startAngle: (layer as any).properties.style.startAngle || 0,
            endAngle: (layer as any).properties.style.stopAngle || 180
        };
      } else if (layer instanceof L.Polyline && !(layer instanceof L.Polygon)) {
        type_forme = 'LIGNE';
          const latLngs = layer.getLatLngs() as L.LatLng[];
        data = {
          ...baseData,
            points: latLngs.map(ll => [ll.lng, ll.lat])
        };
        } else if ((layer as any).properties?.type === 'text') {
        type_forme = 'TEXTE';
        data = {
          ...baseData,
            position: [(layer as L.Marker).getLatLng().lng, (layer as L.Marker).getLatLng().lat],
            content: (layer as any).properties.text,
          style: {
              ...(layer as any).properties.style,
              fontSize: (layer as any).properties.style.fontSize
          }
        };
      }

      if (type_forme && data) {
        elements.push({
            id: (layer as any).id,
          type_forme,
          data: {
            ...data,
              rotation: (layer as any).properties?.rotation || 0
          }
        });
      }
    });
    
      drawingStore.elements = elements;
    await drawingStore.saveToPlan(currentPlan.value.id);
      
    showSaveSuccess.value = true;
    setTimeout(() => {
      showSaveSuccess.value = false;
    }, 3000);

  } catch (error) {
    console.error('Erreur lors de la sauvegarde du plan:', error);
  } finally {
    saving.value = false;
  }
}

// Nettoyer lors du démontage du composant
onUnmounted(() => {
    // Si l'utilisateur n'est plus connecté
    if (!authStore.user) {
    clearLastPlan();
  }
  irrigationStore.clearCurrentPlan();
  drawingStore.clearCurrentPlan();
});

// Fonction pour mettre à jour les propriétés d'une forme
function updateShapeProperties(properties: any) {
  updateShapeProps(properties);
}

// Fonction pour formater la date de dernière sauvegarde
function formatLastSaved(date: string): string {
  try {
    // Créer un objet Date à partir de la chaîne ISO
    const dateObj = new Date(date);
    
    // Vérifier si la date est valide
    if (isNaN(dateObj.getTime())) {
      console.error('Date invalide reçue:', date);
      return 'Date invalide';
    }

    // Formater la date en utilisant l'API Intl avec la timezone de Paris
    return new Intl.DateTimeFormat('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'Europe/Paris'
    }).format(dateObj);
  } catch (error) {
    console.error('Erreur lors du formatage de la date:', error);
    return 'Date invalide';
  }
}

// Ajouter la méthode adjustView dans les méthodes du composant
const handleAdjustView = () => {
  adjustView();
};

// Fonction pour supprimer la forme sélectionnée
const deleteSelectedShape = () => {
    if (selectedLeafletShape.value && featureGroup.value) {
    setDrawingTool('');  // Ceci va nettoyer les points de contrôle
      featureGroup.value.removeLayer(selectedLeafletShape.value as L.Layer);
      selectedLeafletShape.value = null;
  }
};

// Fonction pour charger les concessionnaires
async function loadDealers() {
  isLoadingDealers.value = true;
  try {
    const response = await api.get('/users/', {
      params: { role: 'CONCESSIONNAIRE' }
    });
    dealers.value = response.data;
  } catch (error) {
    console.error('Erreur lors du chargement des concessionnaires:', error);
  } finally {
    isLoadingDealers.value = false;
  }
}

// Fonction pour charger les clients d'un concessionnaire
async function loadDealerClients() {
  console.log('[loadDealerClients] Starting...');
  console.log('[loadDealerClients] authStore.user:', authStore.user);
  isLoadingClients.value = true;
  try {
    // Pour un concessionnaire, utiliser son propre ID
    const dealerId = authStore.user?.id;
    console.log('[loadDealerClients] Using dealerId:', dealerId);

    if (!dealerId) {
      console.error('[loadDealerClients] No dealer ID available');
      return;
    }

    const response = await api.get('/users/', {
      params: { 
        role: 'UTILISATEUR',
        concessionnaire: dealerId
      }
    });
    console.log('[loadDealerClients] Response:', response.data);
    
    // S'assurer que nous avons toujours un tableau
    if (Array.isArray(response.data)) {
      dealerClients.value = response.data;
    } else if (response.data) {
      dealerClients.value = [response.data];
    } else {
      dealerClients.value = [];
    }
    
    console.log('[loadDealerClients] Processed clients:', dealerClients.value);
  } catch (error) {
    console.error('[loadDealerClients] Error:', error);
    dealerClients.value = [];
  } finally {
    isLoadingClients.value = false;
  }
}

async function selectClient(client: UserDetails) {
  console.log('[MapView][selectClient] Starting with client:', client);
  console.log('[MapView][selectClient] Current state:', {
    selectedDealer: selectedDealer.value,
    selectedClient: selectedClient.value,
    newPlanModalRef: !!newPlanModalRef.value
  });

  if (newPlanModalRef.value) {
    console.log('[MapView][selectClient] Using NewPlanModal ref');
    newPlanModalRef.value.selectClient(client);
    selectedClient.value = client;
    console.log('[MapView][selectClient] Updated selectedClient:', selectedClient.value);

    // Charger les plans du client avec les paramètres de filtrage
    isLoadingPlans.value = true;
    try {
      const params: any = {
        client: client.id
      };
      
      // Ajouter le concessionnaire si présent
      if (selectedDealer.value) {
        params.concessionnaire = selectedDealer.value.id;
      }
      
      const response = await api.get('/plans/', {
        params: params
      });
      console.log('[MapView][selectClient] Loaded client plans:', response.data);
      clientPlans.value = response.data;
    } catch (error) {
      console.error('[MapView][selectClient] Error loading client plans:', error);
      clientPlans.value = [];
    } finally {
      isLoadingPlans.value = false;
    }
  } else {
    console.warn('[MapView][selectClient] NewPlanModal ref is not available');
  }
}

// Fonctions de navigation
function backToDealerList() {
  selectedDealer.value = null;
  selectedClient.value = null;
  dealerClients.value = [];
  clientPlans.value = [];
}

function backToClientList() {
  selectedClient.value = null;
  clientPlans.value = [];
}

// Ajouter la fonction de callback
async function onPlanCreated(planId: number) {
  const plan = await irrigationStore.getPlanById(planId);
  if (plan) {
    currentPlan.value = plan;
    irrigationStore.setCurrentPlan(plan);
    drawingStore.setCurrentPlan(plan.id);
    showNewPlanModal.value = false;
  }
}

// Fonctions de sélection
async function selectDealer(dealer: UserDetails) {
  try {
    if (newPlanModalRef.value) {
      await newPlanModalRef.value.selectDealer(dealer);
      selectedDealer.value = dealer;
      dealerClients.value = newPlanModalRef.value.dealerClients;
    } else {
      // Garder le warn car c'est utile pour le debug
      console.warn('[MapView][selectDealer] NewPlanModal ref is not available');
    }
  } catch (error) {
    // Garder l'error car c'est utile pour le debug
    console.error('[MapView][selectDealer] Error:', error);
  }
}

// Ajouter un watcher pour charger les clients quand un concessionnaire est sélectionné
watch(selectedDealer, async (newDealer) => {
  if (newDealer && authStore.user?.user_type === 'admin') {
    isLoadingClients.value = true;
    try {
      const response = await api.get('/users/', {
        params: { 
          role: 'UTILISATEUR',
          concessionnaire: newDealer.id 
        }
      });
      dealerClients.value = Array.isArray(response.data) ? response.data : [response.data];
    } catch (error) {
      // Garder l'error car c'est utile pour le debug
      console.error('[MapView][watch selectedDealer] Error loading clients:', error);
      dealerClients.value = [];
    } finally {
      isLoadingClients.value = false;
    }
  }
});

// Ajouter une fonction pour nettoyer le localStorage lors de la déconnexion
function clearLastPlan() {
  localStorage.removeItem('lastPlanId');
}

  // Fonction pour nettoyer la carte
  function clearMap() {
    if (featureGroup.value) {
      featureGroup.value.clearLayers();
    }
    shapes.value = [];
  }

  // Fonction pour formater les mesures
  function formatMeasure(value: number, unit: string = 'm'): string {
    if (unit === 'm²') {
      return `${(value / 10000).toFixed(2)} ha`;
    } else if (unit === 'm') {
      if (value >= 1000) {
        return `${(value / 1000).toFixed(2)} km`;
      }
      return `${value.toFixed(2)} m`;
    }
    return `${value.toFixed(2)} ${unit}`;
  }

  // Fonction pour générer la synthèse
  const isGeneratingSynthesis = ref(false);

  // Fonction pour traduire le type de forme en français
  function getShapeTypeFr(type: string): string {
    const types: { [key: string]: string } = {
      'Circle': 'Cercle',
      'Rectangle': 'Rectangle',
      'Semicircle': 'Demi-cercle',
      'Line': 'Ligne',
      'Polygon': 'Polygone',
      'Text': 'Texte'
    };
    return types[type] || type;
  }

  async function generateSynthesis() {
    if (!currentPlan.value || !map.value || !featureGroup.value) {
      console.log('[generateSynthesis] Conditions initiales non remplies');
      return;
    }

    try {
      console.log('[generateSynthesis] Début de la génération');
      isGeneratingSynthesis.value = true;

      // Utiliser directement les détails du plan
      const concessionnaireDetails = currentPlan.value.concessionnaire_details;
      const clientDetails = currentPlan.value.client_details;

      // Désélectionner toute forme active
      if (selectedLeafletShape.value) {
        clearActiveControlPoints();
        selectedLeafletShape.value = null;
      }

      // Créer le PDF en mode paysage
      const pdf = new jsPDF('l', 'mm', 'a4');
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      
      // Page de garde
      const logoImg = new Image();
      logoImg.src = logo;
      await new Promise<void>((resolve) => {
        logoImg.onload = () => resolve();
        logoImg.onerror = () => resolve();
      });
      
      // Logo centré en haut
      pdf.addImage(logoImg, 'JPEG', (pageWidth - 60) / 2, 20, 60, 60);
      
      // Titre du plan
      pdf.setFontSize(24);
      pdf.setTextColor(0);
      pdf.text(currentPlan.value.nom || 'Sans titre', pageWidth/2, 100, { align: 'center' });
      
      // Informations du plan
      let yPos = 120;

      // Informations du concessionnaire et client
      pdf.setFontSize(14);
      if (concessionnaireDetails) {
        pdf.setFont('helvetica', 'bold');
        pdf.text('Concessionnaire:', 20, yPos);
        pdf.setFont('helvetica', 'normal');
        pdf.text(`${concessionnaireDetails.first_name} ${concessionnaireDetails.last_name}${concessionnaireDetails.company_name ? ` (${concessionnaireDetails.company_name})` : ''}`, 20, yPos + 8);
        yPos += 25;
      }
      
      if (clientDetails) {
        pdf.setFont('helvetica', 'bold');
        pdf.text('Client:', 20, yPos);
        pdf.setFont('helvetica', 'normal');
        pdf.text(`${clientDetails.first_name} ${clientDetails.last_name}${clientDetails.company_name ? ` (${clientDetails.company_name})` : ''}`, 20, yPos + 8);
        yPos += 25;
      }
      
      // Description
      if (currentPlan.value.description) {
        pdf.setFont('helvetica', 'bold');
        pdf.text('Description:', 20, yPos);
        pdf.setFont('helvetica', 'normal');
        const splitDescription = pdf.splitTextToSize(currentPlan.value.description, 150);
        pdf.text(splitDescription, 20, yPos + 8);
        yPos += 10 * splitDescription.length + 15;
      }

      // Dates en bas de page
      pdf.setFontSize(10);
      pdf.setTextColor(100);
      pdf.text(`Date de création: ${formatLastSaved(currentPlan.value.date_creation)}`, 20, pageHeight - 20);
      pdf.text(`Dernière modification: ${formatLastSaved(currentPlan.value.date_modification)}`, pageWidth - 20, pageHeight - 20, { align: 'right' });

      // Récupérer les formes
      const layers: L.Layer[] = [];
      featureGroup.value.eachLayer((layer: L.Layer) => layers.push(layer));
      console.log(`[generateSynthesis] Nombre de formes à traiter: ${layers.length}`);

      // Initialiser le screenshoter avec des options améliorées
      const screenshoter = L.simpleMapScreenshoter({
        hideElementsWithSelectors: [
          '.leaflet-control-container', 
          '.leaflet-pm-toolbar',
          '.leaflet-grid-layer',
          '.leaflet-grid-label'
        ],
        preventDownload: true
      }).addTo(map.value as L.Map);

      // Attendre que la carte soit chargée avant la capture
      await new Promise(resolve => setTimeout(resolve, 3000));

      // Pour chaque forme, créer une nouvelle page
      for (let i = 0; i < layers.length; i++) {
        pdf.addPage();

        // Ajouter le logo en filigrane
        const logoWidth = 30;
        const logoHeight = 30;
        pdf.addImage(logo, 'JPEG', pageWidth - logoWidth - 10, 10, logoWidth, logoHeight);

        // Ajouter les informations du client et concessionnaire en en-tête
        pdf.setFontSize(8);
        pdf.setTextColor(100);
        let yHeader = 25;
        if (concessionnaireDetails) {
          pdf.text(`Concessionnaire: ${concessionnaireDetails.first_name} ${concessionnaireDetails.last_name}${concessionnaireDetails.company_name ? ` (${concessionnaireDetails.company_name})` : ''}`, 20, yHeader);
          yHeader += 10;
        }
        if (clientDetails) {
          pdf.text(`Client: ${clientDetails.first_name} ${clientDetails.last_name}${clientDetails.company_name ? ` (${clientDetails.company_name})` : ''}`, 20, yHeader);
        }

        // Ajouter une barre de séparation élégante
        pdf.setDrawColor(200, 200, 200);
        pdf.setLineWidth(0.5);
        pdf.line(20, 45, pageWidth - 20, 45);

        const layer = layers[i];
        const properties = (layer as any).properties;

        // Titre de la forme sous la ligne de séparation
        if (properties) {
          pdf.setTextColor(0);
          pdf.setFontSize(16);
          pdf.setFont('helvetica', 'bold');
          pdf.text(getShapeTypeFr(properties.type), 20, 60);
        }

        // Ajuster la vue
        const bounds = (layer as any).getBounds?.() || (layer as any).getLatLng?.();
        if (bounds) {
          map.value.fitBounds(bounds instanceof L.LatLng ? L.latLngBounds([bounds]) : bounds, {
            padding: [50, 50]
          });
        }

        // Attendre que la carte soit complètement chargée
        await new Promise(resolve => setTimeout(resolve, 2000));

        // Forcer un rafraîchissement de la carte
        map.value.invalidateSize();

        // Attendre que toutes les tuiles soient chargées
        await new Promise<void>((resolve) => {
          const checkTiles = () => {
            const container = map.value?.getContainer();
            if (!container) {
              resolve();
              return;
            }

            const tiles = container.querySelectorAll('.leaflet-tile-loaded');
            const loading = container.querySelectorAll('.leaflet-tile-loading');

            if (loading.length === 0 && tiles.length > 0) {
              resolve();
            } else {
              setTimeout(checkTiles, 100);
            }
          };
          checkTiles();
        });

        try {
          // Capturer la carte
          const dataUrl = await screenshoter.takeScreen('image');
          const mapImage = await new Promise<HTMLImageElement>((resolve, reject) => {
            const img = new Image();
            img.onload = () => resolve(img);
            img.onerror = (error) => reject(error);
            img.src = dataUrl as unknown as string;
          });

          // Calculer les dimensions pour 60% de la largeur
          const imgWidth = pageWidth * 0.6 - 30;
          let imgHeight = (mapImage.height * imgWidth) / mapImage.width;
          
          if (imgHeight > pageHeight * 0.9) {
            imgHeight = pageHeight * 0.9;
          }
          // Ajuster le yOffset pour commencer après le titre de la forme (60 + marge)
          const yOffset = Math.max(80, (pageHeight - imgHeight) / 2);
          pdf.addImage(mapImage, 'PNG', 20, yOffset, imgWidth, imgHeight);

          // Section des propriétés (40% de la largeur)
          if (properties) {
            const propX = pageWidth * 0.6 + 10;
            let propY = 70; // Ajusté pour aligner avec le titre de la forme

            // Propriétés principales
            pdf.setFontSize(12);
            pdf.setFont('helvetica', 'normal');

            // Cercle
            if (properties.type === 'Circle') {
              pdf.text(`Rayon: ${formatMeasure(properties.radius)}`, propX, propY);
              propY += 10;
              pdf.text(`Diamètre: ${formatMeasure(properties.radius * 2)}`, propX, propY);
              propY += 10;
              pdf.text(`Surface: ${formatMeasure(properties.area, 'm²')}`, propX, propY);
              propY += 10;
              pdf.text(`Périmètre: ${formatMeasure(properties.perimeter)}`, propX, propY);
              propY += 10;
              if (properties.surfaceInterieure) {
                pdf.text(`Surface intérieure: ${formatMeasure(properties.surfaceInterieure, 'm²')}`, propX, propY);
                propY += 10;
              }
              if (properties.surfaceExterieure) {
                pdf.text(`Surface extérieure: ${formatMeasure(properties.surfaceExterieure, 'm²')}`, propX, propY);
                propY += 10;
              }
            }

            // Rectangle
            else if (properties.type === 'Rectangle') {
              pdf.text(`Largeur: ${formatMeasure(properties.width)}`, propX, propY);
              propY += 10;
              pdf.text(`Hauteur: ${formatMeasure(properties.height)}`, propX, propY);
              propY += 10;
              pdf.text(`Surface: ${formatMeasure(properties.area, 'm²')}`, propX, propY);
              propY += 10;
              pdf.text(`Périmètre: ${formatMeasure(properties.perimeter)}`, propX, propY);
              propY += 10;
              if (properties.surfaceInterieure) {
                pdf.text(`Surface intérieure: ${formatMeasure(properties.surfaceInterieure, 'm²')}`, propX, propY);
                propY += 10;
              }
              if (properties.surfaceExterieure) {
                pdf.text(`Surface extérieure: ${formatMeasure(properties.surfaceExterieure, 'm²')}`, propX, propY);
                propY += 10;
              }
            }

            // Ligne
            else if (properties.type === 'Line') {
              pdf.text(`Longueur: ${formatMeasure(properties.length)}`, propX, propY);
              propY += 10;
              if (properties.dimensions?.width) {
                pdf.text(`Largeur d'influence: ${formatMeasure(properties.dimensions.width)}`, propX, propY);
                propY += 10;
              }
              if (properties.surfaceInfluence) {
                pdf.text(`Surface d'influence: ${formatMeasure(properties.surfaceInfluence, 'm²')}`, propX, propY);
                propY += 10;
              }
            }

            // Polygone
            else if (properties.type === 'Polygon') {
              pdf.text(`Surface: ${formatMeasure(properties.area, 'm²')}`, propX, propY);
              propY += 10;
              pdf.text(`Périmètre: ${formatMeasure(properties.perimeter)}`, propX, propY);
              propY += 10;
              if (properties.surfaceInterieure) {
                pdf.text(`Surface intérieure: ${formatMeasure(properties.surfaceInterieure, 'm²')}`, propX, propY);
                propY += 10;
              }
              if (properties.surfaceExterieure) {
                pdf.text(`Surface extérieure: ${formatMeasure(properties.surfaceExterieure, 'm²')}`, propX, propY);
                propY += 10;
              }
            }

            // Demi-cercle
            else if (properties.type === 'Semicircle') {
              pdf.text(`Rayon: ${formatMeasure(properties.radius)}`, propX, propY);
              propY += 10;
              pdf.text(`Diamètre: ${formatMeasure(properties.radius * 2)}`, propX, propY);
              propY += 10;
              pdf.text(`Surface: ${formatMeasure(properties.area, 'm²')}`, propX, propY);
              propY += 10;
              pdf.text(`Périmètre: ${formatMeasure(properties.perimeter)}`, propX, propY);
              propY += 10;
              pdf.text(`Longueur d'arc: ${formatMeasure(properties.arcLength)}`, propX, propY);
              propY += 10;
              pdf.text(`Angle d'ouverture: ${properties.openingAngle.toFixed(1)}°`, propX, propY);
              propY += 10;
              if (properties.surfaceInterieure) {
                pdf.text(`Surface intérieure: ${formatMeasure(properties.surfaceInterieure, 'm²')}`, propX, propY);
                propY += 10;
              }
              if (properties.surfaceExterieure) {
                pdf.text(`Surface extérieure: ${formatMeasure(properties.surfaceExterieure, 'm²')}`, propX, propY);
                propY += 10;
              }
            }
          }
        } catch (error) {
          console.error(`[generateSynthesis] Erreur capture forme ${i + 1}:`, error);
        }
      }

      // Retirer le screenshoter
      map.value.removeControl(screenshoter);
      
      console.log('[generateSynthesis] Génération du PDF terminée');
      pdf.save(`synthese_${currentPlan.value.nom}.pdf`);

    } catch (error) {
      console.error('[generateSynthesis] Erreur:', error);
    } finally {
      isGeneratingSynthesis.value = false;
    }
}
</script>

<style>
@import '../styles/MapView.css';
</style> 