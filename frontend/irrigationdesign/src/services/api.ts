import axios from 'axios';

// Configuration de base de l'API
const api = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json'
  },
  withCredentials: true // Important pour les cookies
});

// Fonction utilitaire pour obtenir un cookie
function getCookie(name: string): string | null {
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) return parts.pop()?.split(';').shift() || null;
  return null;
}

// Intercepteur pour ajouter le token aux requêtes
api.interceptors.request.use(
  (config) => {
    const token = getCookie('access_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    console.error('Request interceptor error:', error);
    return Promise.reject(error);
  }
);

// Intercepteur pour gérer les erreurs d'authentification
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      try {
        // Tenter de rafraîchir le token
        const response = await api.post('/token/refresh/');
        const token = getCookie('access_token');
        if (token) {
          originalRequest.headers.Authorization = `Bearer ${token}`;
          return api(originalRequest);
        }
      } catch (refreshError) {
        console.error('Token refresh failed:', refreshError);
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

// Service d'authentification
export const authService = {
  async login(username: string, password: string) {
    const response = await api.post('/token/', { username, password });
    return response.data;
  },

  async logout() {
    // Les cookies seront gérés côté serveur
    await api.post('/token/logout/');
  },

  async register(userData: { username: string; email: string; password: string }) {
    return await api.post('/register/', userData);
  },
};

// Service pour les plans d'irrigation
export const irrigationService = {
  async getPlans() {
    return await api.get('/plans/');
  },

  async createPlan(planData: any) {
    return await api.post('/plans/', planData);
  },

  async updatePlan(planId: number, planData: any) {
    return await api.put(`/plans/${planId}/`, planData);
  },

  async deletePlan(planId: number) {
    return await api.delete(`/plans/${planId}/`);
  },
};

export default api; 