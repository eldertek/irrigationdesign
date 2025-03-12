import axios from 'axios';
import { useAuthStore } from '@/stores/auth';

// Types nécessaires
export interface UserFilter {
  role?: string;
  usine?: number;
  concessionnaire?: number;
  include_plans?: boolean;
  search?: string;
  concessionnaire_id?: number;
  include_details?: boolean;
}

// Configuration de base de l'API
const api = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json'
  },
  withCredentials: true
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
    // Log pour debug
    console.log('Request config:', {
      url: config.url,
      method: config.method,
      headers: config.headers,
      withCredentials: config.withCredentials
    });
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
    // Si l'erreur est 401 et que ce n'est pas déjà une tentative de refresh
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      try {
        // Tenter de rafraîchir le token
        const authStore = useAuthStore();
        await authStore.refreshToken();
        // Récupérer le nouveau token
        const newToken = getCookie('access_token');
        if (newToken) {
          // Mettre à jour le token dans la requête originale
          originalRequest.headers.Authorization = `Bearer ${newToken}`;
          // Réessayer la requête originale
          return api(originalRequest);
        }
      } catch (refreshError) {
        console.error('Token refresh failed:', refreshError);
        // Rediriger vers la page de login
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

// Fonction utilitaire centrale pour récupérer les utilisateurs selon leur rôle et hiérarchie
export async function fetchUsersByHierarchy(params: {
  role: string;
  usineId?: number;
  concessionnaireId?: number;
  includeDetails?: boolean;
  search?: string;
}) {
  const filters: UserFilter = { 
    role: params.role 
  };

  if (params.usineId) {
    filters.usine = params.usineId;
  }

  if (params.concessionnaireId) {
    filters.concessionnaire = params.concessionnaireId;
  }

  if (params.includeDetails) {
    filters.include_plans = true;
  }

  if (params.search) {
    filters.search = params.search;
  }

  const response = await userService.getUsers(filters);
  return response.data;
}

// Service pour les utilisateurs
export const userService = {
  // Récupérer tous les utilisateurs avec filtrage optionnel
  async getUsers(filters: UserFilter = {}) {
    return await api.get('/users/', { params: filters });
  },
  
  // Récupérer un utilisateur spécifique
  async getUser(userId: number) {
    return await api.get(`/users/${userId}/`);
  },
  
  // Créer un nouvel utilisateur
  async createUser(userData: any) {
    return await api.post('/users/', userData);
  },
  
  // Mettre à jour un utilisateur existant
  async updateUser(userId: number, userData: any) {
    return await api.patch(`/users/${userId}/`, userData);
  },
  
  // Supprimer un utilisateur
  async deleteUser(userId: number) {
    return await api.delete(`/users/${userId}/`);
  },
  
  // Récupérer toutes les usines
  async getUsines() {
    return await api.get('/users/', { params: { role: 'USINE' } });
  },
  
  // Récupérer tous les concessionnaires (optionnellement filtrés par usine)
  async getConcessionnaires(usineId?: number) {
    const params: UserFilter = { role: 'CONCESSIONNAIRE' };
    if (usineId) {
      params.usine = usineId;
    }
    return await api.get('/users/', { params });
  },
  
  // Récupérer tous les agriculteurs d'un concessionnaire
  async getConcessionnaireAgriculteurs(concessionnaireId: number) {
    return await api.get('/users/', { 
      params: { 
        role: 'AGRICULTEUR',
        concessionnaire: concessionnaireId 
      } 
    });
  },
  
  // Récupérer tous les agriculteurs d'une usine
  async getUsineAgriculteurs(usineId: number) {
    return await api.get('/users/', { 
      params: { 
        role: 'AGRICULTEUR',
        usine: usineId 
      } 
    });
  },
  
  // Fonction unifiée pour récupérer les utilisateurs selon la hiérarchie
  async getUsersByHierarchy(params: {
    role: string;
    usineId?: number;
    concessionnaireId?: number;
    includeDetails?: boolean;
    search?: string;
  }) {
    const filters: UserFilter = { role: params.role };
    
    if (params.usineId) {
      filters.usine = params.usineId;
    }
    
    if (params.concessionnaireId) {
      filters.concessionnaire = params.concessionnaireId;
    }
    
    if (params.includeDetails) {
      filters.include_plans = true;
    }
    
    if (params.search) {
      filters.search = params.search;
    }
    
    return await api.get('/users/', { params: filters });
  },
  
  // Récupérer les concessionnaires d'une usine spécifique
  async getUsineConcessionnaires(usineId: number) {
    return await api.get('/users/', { 
      params: { 
        role: 'CONCESSIONNAIRE',
        usine: usineId 
      } 
    });
  },
  
  // Récupérer tous les agriculteurs liés à un concessionnaire
  async getAgriculteurs(concessionnaireId?: number, usineId?: number) {
    const params: UserFilter = { role: 'AGRICULTEUR' };
    
    if (concessionnaireId) {
      params.concessionnaire = concessionnaireId;
    }
    
    if (usineId) {
      params.usine = usineId;
    }
    
    return await api.get('/users/', { params });
  },
  
  // Assigner une usine à un concessionnaire
  async assignUsineToConcessionnaire(concessionnaireId: number, usineId: number) {
    return await api.patch(`/users/${concessionnaireId}/`, {
      usine: usineId
    });
  },
  
  // Assigner un concessionnaire à un agriculteur
  async assignConcessionnaireToAgriculteur(agriculteurId: number, concessionnaireId: number) {
    return await api.patch(`/users/${agriculteurId}/`, {
      concessionnaire: concessionnaireId
    });
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
  
  async getAgriculteurPlans(agriculteurId: number) {
    return await api.get('/plans/', { params: { agriculteur: agriculteurId } });
  },
  
  async createPlanForAgriculteur(planData: any) {
    return await api.post('/plans/', planData);
  },
  
  // Récupérer les plans d'une usine (inclut tous les plans des concessionnaires associés)
  async getUsinePlans(usineId: number) {
    return await api.get('/plans/', { params: { usine: usineId } });
  },
  
  // Récupérer les plans d'un concessionnaire
  async getConcessionnairePlans(concessionnaireId: number) {
    return await api.get('/plans/', { params: { concessionnaire: concessionnaireId } });
  },
  
  // Créer un plan pour un concessionnaire
  async createPlanForConcessionnaire(planData: any, concessionnaireId: number) {
    const data = { ...planData, concessionnaire: concessionnaireId };
    return await api.post('/plans/', data);
  },
  
  // Créer un plan pour une usine
  async createPlanForUsine(planData: any, usineId: number) {
    const data = { ...planData, usine: usineId };
    return await api.post('/plans/', data);
  }
};

export default api; 