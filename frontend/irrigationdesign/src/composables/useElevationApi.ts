import { ref } from 'vue';
import axios from 'axios';

const MAX_POINTS_PER_REQUEST = 100;

interface ElevationPoint {
  lat: number;
  lng: number;
  elevation?: number;
}

export function useElevationApi() {
  const loading = ref(false);
  const error = ref<string | null>(null);

  const simplifyPoints = (points: ElevationPoint[]): ElevationPoint[] => {
    if (points.length <= MAX_POINTS_PER_REQUEST) return points;

    const step = Math.ceil(points.length / MAX_POINTS_PER_REQUEST);
    return points.filter((_, index) => index % step === 0);
  };

  const fetchElevation = async (points: ElevationPoint[], useSimplification = true): Promise<ElevationPoint[]> => {
    loading.value = true;
    error.value = null;

    try {
      const processedPoints = useSimplification ? simplifyPoints(points) : points;
      
      // Log des points avant l'envoi
      console.log('Points à envoyer:', processedPoints);
      
      const payload = {
        points: processedPoints.map(p => ({
          latitude: p.lat,
          longitude: p.lng
        }))
      };
      
      // Log du payload complet
      console.log('Payload complet:', payload);
      
      const response = await axios.post('/elevation/', payload);

      // Convertir la réponse au format attendu
      return response.data.results.map((r: any) => ({
        lat: r.latitude,
        lng: r.longitude,
        elevation: r.elevation
      }));
    } catch (err) {
      console.error('Erreur lors de la récupération des données d\'élévation:', err);
      error.value = 'Le service d\'élévation est temporairement indisponible. Réessayez plus tard.';
      throw err;
    } finally {
      loading.value = false;
    }
  };

  const calculateElevationProfile = async (points: ElevationPoint[]): Promise<{
    profile: ElevationPoint[];
    stats: {
      minElevation: number;
      maxElevation: number;
      totalAscent: number;
      totalDescent: number;
      averageSlope: number;
    };
  }> => {
    const elevationData = await fetchElevation(points);
    
    let minElevation = Infinity;
    let maxElevation = -Infinity;
    let totalAscent = 0;
    let totalDescent = 0;
    
    elevationData.forEach((point, i) => {
      const elevation = point.elevation || 0;
      minElevation = Math.min(minElevation, elevation);
      maxElevation = Math.max(maxElevation, elevation);
      
      if (i > 0) {
        const prevElevation = elevationData[i - 1].elevation || 0;
        const diff = elevation - prevElevation;
        if (diff > 0) totalAscent += diff;
        else totalDescent += Math.abs(diff);
      }
    });

    const firstPoint = elevationData[0];
    const lastPoint = elevationData[elevationData.length - 1];
    const elevationDiff = (lastPoint.elevation || 0) - (firstPoint.elevation || 0);
    const distance = points.length; // À remplacer par la vraie distance en mètres
    const averageSlope = (distance > 0) ? (elevationDiff / distance) : 0;

    return {
      profile: elevationData,
      stats: {
        minElevation,
        maxElevation,
        totalAscent,
        totalDescent,
        averageSlope
      }
    };
  };

  return {
    loading,
    error,
    fetchElevation,
    calculateElevationProfile
  };
} 