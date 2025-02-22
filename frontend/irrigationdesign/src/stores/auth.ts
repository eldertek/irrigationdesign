import { defineStore } from 'pinia';
import api from '@/services/api';

// Configuration d'Axios pour les requêtes API
api.defaults.baseURL = '/api';
api.defaults.headers.common['Content-Type'] = 'application/json';
api.defaults.withCredentials = true;

// Fonction utilitaire pour les logs de debug
const logRequestDetails = (config: any) => {
  console.log('Full request URL:', `${api.defaults.baseURL}${config.url}`);
  console.log('Request config:', {
    url: config.url,
    method: config.method,
    headers: config.headers,
    data: config.data,
    withCredentials: config.withCredentials,
    baseURL: api.defaults.baseURL
  });
};

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
    const authStore = useAuthStore();
    const originalRequest = error.config;

    // Si l'erreur est 401 et que ce n'est pas déjà une tentative de refresh
    // et que ce n'est pas une requête de refresh
    if (error.response?.status === 401 && 
        !originalRequest._retry && 
        !originalRequest.url?.includes('/token/refresh/')) {
      originalRequest._retry = true;
      try {
        // Vérifier si un token existe avant d'essayer de le rafraîchir
        const token = getCookie('access_token');
        if (!token) {
          throw new Error('No token available');
        }

        // Tenter de rafraîchir le token
        await authStore.refreshToken();
        const newToken = getCookie('access_token');
        if (newToken) {
          // Mettre à jour le token dans la requête originale
          originalRequest.headers.Authorization = `Bearer ${newToken}`;
          // Réessayer la requête originale
          return api(originalRequest);
        }
      } catch (refreshError) {
        // Si le refresh échoue, déconnecter l'utilisateur
        console.error('Token refresh failed:', refreshError);
        await authStore.logout();
        // Ne pas rediriger si on est déjà sur la page de login
        if (window.location.pathname !== '/login') {
          window.location.href = '/login';
        }
      }
    }
    return Promise.reject(error);
  }
);

interface User {
  id: number;
  username: string;
  email: string;
  user_type: 'admin' | 'dealer' | 'client';
  dealer?: number;
  dealer_name?: string;
  first_name: string;
  last_name: string;
  company_name?: string;
  must_change_password?: boolean;
  plans_count?: number;
}

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  mustChangePassword: boolean;
  initialized: boolean;
  loading: boolean;
  error: string | null;
  concessionnaires: any[];
}

// Fonction utilitaire pour définir un cookie sécurisé
function setSecureCookie(name: string, value: string, expiryDays: number = 1) {
  const date = new Date();
  date.setTime(date.getTime() + (expiryDays * 24 * 60 * 60 * 1000));
  const expires = `expires=${date.toUTCString()}`;
  document.cookie = `${name}=${value};${expires};path=/;secure;samesite=Strict`;
}

// Fonction utilitaire pour supprimer un cookie
function deleteCookie(name: string) {
  document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/`;
}

// Fonction utilitaire pour formater les noms d'utilisateurs
export function formatUserName(user: { first_name: string; last_name: string; company_name?: string }): string {
  if (!user) return 'Non spécifié';
  const name = `${user.first_name} ${user.last_name.toUpperCase()}`;
  return user.company_name ? `${name} (${user.company_name})` : name;
}

export const useAuthStore = defineStore('auth', {
  state: (): AuthState => ({
    user: null,
    isAuthenticated: false,
    mustChangePassword: false,
    initialized: false,
    loading: false,
    error: null,
    concessionnaires: []
  }),

  getters: {
    isAdmin: (state) => state.user?.user_type === 'admin',
    isDealer: (state) => state.user?.user_type === 'dealer',
    isClient: (state) => state.user?.user_type === 'client',
    currentUser: (state) => state.user,
    hasDealer: (state) => Boolean(state.user?.dealer)
  },

  actions: {
    async initialize(initialState: any) {
      console.log('Initializing auth store with state:', initialState);
      
      if (!initialState) {
        console.log('No initial state, attempting to restore session...');
        const restored = await this.restoreSession();
        this.initialized = true;
        return restored;
      }
      
      if (initialState.isAuthenticated && initialState.user) {
        this.user = initialState.user;
        this.isAuthenticated = true;
        this.mustChangePassword = initialState.user.must_change_password || false;
        this.initialized = true;
        return true;
      }
      
      const restored = await this.restoreSession();
      this.initialized = true;
      return restored;
    },

    async restoreSession() {
      console.log('Attempting to restore session...');
      try {
        // Vérifier si un token existe avant d'essayer de le rafraîchir
        const token = getCookie('access_token');
        if (!token) {
          console.log('No token found, skipping session restore');
          this.isAuthenticated = false;
          this.user = null;
          return false;
        }

        const response = await api.post('/token/refresh/');
        
        if (response.data.user) {
          this.user = response.data.user;
          this.isAuthenticated = true;
          this.mustChangePassword = response.data.user.must_change_password || false;
          console.log('Session restored successfully');
          return true;
        }
        
        // Si pas d'utilisateur dans la réponse, le récupérer
        await this.fetchUserProfile();
        return true;
      } catch (error) {
        console.error('Failed to restore session:', error);
        this.isAuthenticated = false;
        this.user = null;
        return false;
      }
    },

    async login(username: string, password: string) {
      try {
        const response = await api.post('/token/', { 
          username, 
          password 
        });
        
        if (!response.data.access) {
          throw new Error('Token d\'accès non reçu');
        }

        // Stocker le token dans un cookie sécurisé
        document.cookie = `access_token=${response.data.access}; path=/; secure; samesite=Strict`;
        
        // Récupérer le profil utilisateur
        const userProfile = await this.fetchUserProfile();
        this.user = userProfile;
        this.isAuthenticated = true;
        
        return true;
      } catch (error: any) {
        this.isAuthenticated = false;
        this.user = null;
        
        // Transformer l'erreur en message lisible
        if (error.response?.status === 401) {
          throw new Error('Identifiants incorrects');
        } else if (error.response?.data?.detail) {
          throw new Error(error.response.data.detail);
        }
        
        throw error;
      }
    },

    async logout() {
      this.user = null;
      this.isAuthenticated = false;
      this.mustChangePassword = false;
      
      // Supprimer les cookies
      document.cookie = 'access_token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
      document.cookie = 'refresh_token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
    },

    async checkAuth() {
      try {
        await this.fetchUserProfile();
        return true;
      } catch (error) {
        this.isAuthenticated = false;
        this.user = null;
        return false;
      }
    },

    async fetchUserProfile() {
      try {
        const response = await api.get('/users/me/');
        this.user = response.data;
        this.isAuthenticated = true;
        this.mustChangePassword = response.data.must_change_password || false;
        return response.data;
      } catch (error) {
        this.isAuthenticated = false;
        this.user = null;
        throw error;
      }
    },

    async changePassword(oldPassword: string, newPassword: string) {
      try {
        console.log('Attempting to change password...');
        const response = await api.post(`/users/change_password/`, {
          old_password: oldPassword,
          password: newPassword
        });
        
        console.log('Password change response:', response.data);
        
        this.user = {
          ...this.user,
          must_change_password: false
        } as User;
        
        return response.data;
      } catch (error) {
        console.error('Password change error:', error);
        throw error;
      }
    },

    async refreshToken() {
      try {
        console.log('Attempting to refresh token...');
        const response = await api.post('/token/refresh/', {}, {
          withCredentials: true
        });
        
        const { access } = response.data;
        if (!access) {
          throw new Error('No access token received');
        }
        
        console.log('Token refreshed successfully');
        setSecureCookie('access_token', access, 1);
        this.isAuthenticated = true;
        
        return access;
      } catch (error: any) {
        console.error('Error refreshing token:', {
          status: error.response?.status,
          data: error.response?.data
        });
        
        if (error.response?.status === 401 || error.response?.status === 403) {
          console.log('Token refresh failed with auth error, logging out');
          await this.logout();
        }
        
        throw error;
      }
    },

    async fetchConcessionnaires() {
      this.loading = true;
      try {
        const response = await api.get('/users/', {
          params: { role: 'dealer' }
        });
        this.concessionnaires = response.data;
      } catch (error) {
        this.error = 'Erreur lors de la récupération des concessionnaires';
        throw error;
      } finally {
        this.loading = false;
      }
    },

    async setConcessionnaire(userId: number, concessionnaireId: number) {
      this.loading = true;
      try {
        await api.patch(`/users/${userId}/`, {
          concessionnaire: concessionnaireId
        });
        if (this.user && this.user.id === userId) {
          this.user.dealer = concessionnaireId;
        }
      } catch (error) {
        this.error = 'Erreur lors de la mise à jour du concessionnaire';
        throw error;
      } finally {
        this.loading = false;
      }
    },

    async createUser(userData: {
      username: string;
      email: string;
      password: string;
      role: string;
      concessionnaire?: number;
    }) {
      this.loading = true;
      try {
        const response = await api.post('/users/', userData);
        return response.data;
      } catch (error) {
        this.error = 'Erreur lors de la création de l\'utilisateur';
        throw error;
      } finally {
        this.loading = false;
      }
    },

    async updateUserRole(userId: number, role: string) {
      this.loading = true;
      try {
        const response = await api.patch(`/users/${userId}/`, {
          role
        });
        if (this.user && this.user.id === userId) {
          this.user.user_type = role as User['user_type'];
        }
        return response.data;
      } catch (error) {
        this.error = 'Erreur lors de la mise à jour du rôle';
        throw error;
      } finally {
        this.loading = false;
      }
    },

    async updateUserEmail(email: string) {
      this.loading = true;
      try {
        const response = await api.patch(`/users/${this.user?.id}/`, {
          email
        });
        if (this.user) {
          this.user.email = email;
        }
        return response.data;
      } catch (error) {
        this.error = 'Erreur lors de la mise à jour de l\'email';
        throw error;
      } finally {
        this.loading = false;
      }
    },

    checkAccess(requiredRole: string[]): boolean {
      if (!this.user) return false;
      return requiredRole.includes(this.user.user_type);
    }
  }
}); 