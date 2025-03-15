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
    mapInstance.options.zoomAnimation = true;
    
    // Ajouter la couche initiale
    activeLayer.value = baseMaps[currentBaseMap.value as keyof typeof baseMaps];
    activeLayer.value.addTo(mapInstance);

    // Gérer les changements de couche de base via l'événement natif
    mapInstance.on('baselayerchange', (e: any) => {
      currentBaseMap.value = e.name;
      activeLayer.value = e.layer;
    });
  };

  const changeBaseMap = async (baseMapName: keyof typeof baseMaps) => {
    if (!map.value || !baseMaps[baseMapName]) return;
    
    try {
      // Vérifier si la couche demandée est déjà active
      if (currentBaseMap.value === baseMapName) return;
      
      // Désactiver les animations temporairement
      const wasAnimated = map.value.options.zoomAnimation;
      map.value.options.zoomAnimation = false;
      
      // Mémoriser l'état actuel de la carte
      const currentCenter = map.value.getCenter();
      const currentZoom = map.value.getZoom();
      
      // Retirer proprement l'ancienne couche
      if (activeLayer.value && map.value.hasLayer(activeLayer.value)) {
        map.value.removeLayer(activeLayer.value);
      }
      
      // Attendre que la couche soit retirée
      await new Promise(resolve => setTimeout(resolve, 50));
      
      if (!map.value) return;
      
      // Ajouter la nouvelle couche
      activeLayer.value = baseMaps[baseMapName];
      activeLayer.value.addTo(map.value);
      currentBaseMap.value = baseMapName;
      
      // Réinitialiser la vue sans animation
      map.value.setView(currentCenter, currentZoom, { animate: false });
      
      // Forcer un recalcul de la taille
      map.value.invalidateSize({ animate: false, pan: false });
      
      // Restaurer l'état des animations après un court délai
      setTimeout(() => {
        if (map.value) {
          map.value.options.zoomAnimation = wasAnimated && baseMapName !== 'Cadastre';
        }
      }, 100);
      
    } catch (error) {
      console.error('Erreur lors du changement de carte de base:', error);
      // En cas d'erreur, essayer de restaurer un état stable
      if (map.value) {
        map.value.options.zoomAnimation = true;
        map.value.invalidateSize({ animate: false, pan: false });
      }
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
        map.value.setView([lat, lon], 13, { animate: currentBaseMap.value !== 'Cadastre' });
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