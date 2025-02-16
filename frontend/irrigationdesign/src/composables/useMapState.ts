import { ref } from 'vue';
import type { Map as LeafletMap } from 'leaflet';
import * as L from 'leaflet';

export function useMapState() {
  const map = ref<LeafletMap | null>(null);
  const searchQuery = ref('');

  const baseMaps = {
    'OpenStreetMap': L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors'
    }),
    'Satellite': L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
      attribution: '© Esri'
    }),
    'Terrain': L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenTopoMap contributors'
    })
  };

  const initMap = (mapInstance: LeafletMap) => {
    map.value = mapInstance;
  };

  const handleMapSetLocation = ((event: CustomEvent) => {
    if (map.value && event.detail) {
      const { lat, lng, zoom } = event.detail;
      map.value.setView([lat, lng], zoom);
    }
  }) as EventListener;

  const searchLocation = async () => {
    if (!map.value || !searchQuery.value) return;

    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery.value)}`
      );
      const data = await response.json();

      if (data && data.length > 0) {
        const { lat, lon } = data[0];
        map.value.setView([lat, lon], 13);
      }
    } catch (error) {
      console.error('Erreur lors de la recherche de localisation:', error);
    }
  };

  return {
    map,
    searchQuery,
    initMap,
    searchLocation
  };
} 