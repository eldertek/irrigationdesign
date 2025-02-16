import { ref } from 'vue';
import axios from 'axios';

const MAX_POINTS_PER_REQUEST = 100;
const ELEVATION_API_URL = 'https://api.open-elevation.com/api/v1/lookup';
const FALLBACK_API_URL = 'https://elevation-api.io/api/elevation'; // API alternative

interface ElevationPoint {
  latitude: number;
  longitude: number;
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
      
      const response = await axios.post(ELEVATION_API_URL, {
        locations: processedPoints.map(p => ({
          latitude: p.latitude,
          longitude: p.longitude
        }))
      });

      return response.data.results;
    } catch (primaryError) {
      console.error('Primary elevation API failed:', primaryError);
      
      try {
        // Tentative avec l'API de fallback
        const response = await axios.post(FALLBACK_API_URL, {
          points: points.map(p => ({
            lat: p.latitude,
            lng: p.longitude
          }))
        });

        return response.data.elevations.map((e: any, i: number) => ({
          latitude: points[i].latitude,
          longitude: points[i].longitude,
          elevation: e.elevation
        }));
      } catch (fallbackError) {
        console.error('Fallback elevation API failed:', fallbackError);
        error.value = 'Le service d\'élévation est temporairement indisponible. Réessayez plus tard.';
        throw new Error('Both elevation APIs failed');
      }
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

    // Calcul de la pente moyenne
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