import { ref } from 'vue';
import type { Map as LeafletMap } from 'leaflet';
import * as L from 'leaflet';

export function useMapState() {
  const map = ref<LeafletMap | null>(null);
  const searchQuery = ref('');
  const currentBaseMap = ref('Ville');

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
    L.control.layers(baseMaps).addTo(mapInstance);
    baseMaps[currentBaseMap.value as keyof typeof baseMaps].addTo(mapInstance);

    mapInstance.on('baselayerchange', (e) => {
      if (e.name === 'Cadastre') {
        mapInstance.options.zoomAnimation = false;
      } else {
        mapInstance.options.zoomAnimation = true;
      }
    });
  };

  const changeBaseMap = (baseMapName: keyof typeof baseMaps) => {
    if (!map.value || !baseMaps[baseMapName]) return;
    Object.values(baseMaps).forEach(layer => {
      if (map.value?.hasLayer(layer)) {
        map.value.removeLayer(layer);
      }
    });
    baseMaps[baseMapName].addTo(map.value as L.Map);
    currentBaseMap.value = baseMapName;
    
    if (baseMapName === 'Cadastre' && map.value) {
      map.value.options.zoomAnimation = false;
    } else if (map.value) {
      map.value.options.zoomAnimation = true;
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