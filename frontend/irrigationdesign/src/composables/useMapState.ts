import { ref } from 'vue';
import type { Map as LeafletMap } from 'leaflet';
import * as L from 'leaflet';

export function useMapState() {
  const map = ref<LeafletMap | null>(null);
  const searchQuery = ref('');
  const currentBaseMap = ref('Ville');
  const activeLayer = ref<any>(null);

  const baseMaps = {
    'Ville': L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors',
      maxZoom: 19,
      updateWhenZooming: false,
      updateWhenIdle: true,
      noWrap: true,
      keepBuffer: 5,
    }),
    'Satellite': L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
      attribution: '© Esri',
      maxZoom: 19,
      updateWhenZooming: false,
      updateWhenIdle: true,
      noWrap: true,
      keepBuffer: 5,
    }),
    'Cadastre': L.tileLayer('https://data.geopf.fr/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=CADASTRALPARCELS.PARCELLAIRE_EXPRESS&STYLE=normal&FORMAT=image/png&TILEMATRIXSET=PM&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}', {
      attribution: 'Cadastre - Carte © IGN/Geoportail',
      maxZoom: 19,
      updateWhenZooming: false,
      updateWhenIdle: true,
      noWrap: true,
      keepBuffer: 5,
    })
  };

  const initMap = (mapInstance: LeafletMap) => {
    map.value = mapInstance;
    mapInstance.options.zoomSnap = 0.5;
    mapInstance.options.wheelPxPerZoomLevel = 120;
    
    // Ajouter la couche initiale
    activeLayer.value = baseMaps[currentBaseMap.value as keyof typeof baseMaps];
    activeLayer.value.addTo(mapInstance);

    // Gérer les changements de couche de base via l'événement natif
    mapInstance.on('baselayerchange', (e: any) => {
      currentBaseMap.value = e.name;
      activeLayer.value = e.layer;
      
      // Mettre à jour les options d'animation en fonction de la couche
      if (e.name === 'Cadastre') {
        map.value!.options.zoomAnimation = false;
      } else {
        map.value!.options.zoomAnimation = true;
      }
      
      // Force le recalcul des dimensions après le changement
      setTimeout(() => {
        if (map.value) {
          map.value.invalidateSize(true);
        }
      }, 100);
    });
  };

  const changeBaseMap = (baseMapName: keyof typeof baseMaps) => {
    if (!map.value || !baseMaps[baseMapName]) return;
    
    try {
      // Vérifier si la couche demandée est déjà active
      if (currentBaseMap.value === baseMapName) return;
      
      // Retirer proprement l'ancienne couche si elle existe
      if (activeLayer.value) {
        // @ts-ignore - Contourner les problèmes de typage de Leaflet
        if (map.value.hasLayer(activeLayer.value)) {
          // @ts-ignore - Contourner les problèmes de typage de Leaflet
          map.value.removeLayer(activeLayer.value);
        }
      }
      
      // Attendre un court instant pour s'assurer que la couche précédente est bien nettoyée
      setTimeout(() => {
        if (!map.value) return;
        
        // Mettre à jour les options d'animation en fonction de la couche
        map.value.options.zoomAnimation = baseMapName !== 'Cadastre';
        
        // Ajouter la nouvelle couche
        activeLayer.value = baseMaps[baseMapName];
        // @ts-ignore - Contourner les problèmes de typage de Leaflet
        activeLayer.value.addTo(map.value);
        currentBaseMap.value = baseMapName;
        
        // Forcer un recalcul de la taille après le changement
        map.value.invalidateSize(true);
        
        // Désactiver temporairement le zoom pour éviter les conflits pendant la transition
        const currentZoom = map.value.getZoom();
        map.value.setView(map.value.getCenter(), currentZoom, { animate: false });
      }, 50);
    } catch (error) {
      console.error('Erreur lors du changement de carte de base:', error);
    }
  };

  const searchLocation = async () => {
    if (!map.value || !searchQuery.value) return;
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery.value)}`
      );
      const data = await response.json();
      if (data && data.length > 0) {
        const { lat, lon } = data[0];
        const useAnimation = currentBaseMap.value !== 'Cadastre';
        map.value.setView([lat, lon], 13, { animate: useAnimation });
      }
    } catch (error) {
      console.error('Erreur lors de la recherche de localisation:', error);
    }
  };

  return {
    map,
    searchQuery,
    currentBaseMap,
    baseMaps,
    initMap,
    searchLocation,
    changeBaseMap
  };
} 