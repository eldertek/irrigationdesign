import { defineStore } from 'pinia';
import axios from 'axios';

// Configuration d'Axios pour les requêtes API
axios.defaults.baseURL = '/api';
axios.defaults.headers.common['Content-Type'] = 'application/json';
axios.defaults.withCredentials = true;

// Fonction utilitaire pour les logs de debug
const logRequestDetails = (config: any) => {
  console.log('Full request URL:', `${axios.defaults.baseURL}${config.url}`);
  console.log('Request config:', {
    url: config.url,
    method: config.method,
    headers: config.headers,
    data: config.data,
    withCredentials: config.withCredentials,
    baseURL: axios.defaults.baseURL
  });
};

// Intercepteur pour ajouter le token aux requêtes
axios.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    logRequestDetails(config);
    return config;
  },
  (error) => {
    console.error('Request interceptor error:', error);
    return Promise.reject(error);
  }
);

// Intercepteur pour gérer les erreurs 401
axios.interceptors.response.use(
  (response) => {
    console.log('Response:', {
      url: response.config.url,
      status: response.status,
      data: response.data
    });
    return response;
  },
  async (error) => {
    console.error('Response error:', {
      url: error.config?.url,
      status: error.response?.status,
      data: error.response?.data
    });

    if (error.response?.status === 401) {
      const authStore = useAuthStore();
      // Ne pas tenter de rafraîchir le token si on est déjà en train de le faire
      // ou si on est sur la route de login
      if (!error.config.url.includes('/token/') && !error.config._retry) {
        error.config._retry = true;
        try {
          await authStore.refreshToken();
          const token = localStorage.getItem('token');
          error.config.headers.Authorization = `Bearer ${token}`;
          return axios(error.config);
        } catch (refreshError) {
          console.error('Token refresh failed:', refreshError);
          await authStore.logout();
          window.location.href = '/login';
          return Promise.reject(refreshError);
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
}

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  mustChangePassword: boolean;
  initialized: boolean;
  loading: boolean;
  error: string | null;
  concessionnaires: any[];
}

export const useAuthStore = defineStore('auth', {
  state: (): AuthState => ({
    user: null,
    token: localStorage.getItem('token'),
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
        await this.restoreSession();
        return;
      }
      
      if (initialState.isAuthenticated && initialState.user) {
        this.user = initialState.user;
        this.isAuthenticated = true;
        this.mustChangePassword = initialState.user.must_change_password || false;
      } else {
        await this.restoreSession();
      }
      
      this.initialized = true;
    },

    async restoreSession() {
      console.log('Attempting to restore session...');
      try {
        // Tenter de rafraîchir le token
        const newToken = await this.refreshToken();
        if (newToken) {
          // Si on a un nouveau token, récupérer le profil
          await this.fetchUserProfile();
          this.isAuthenticated = true;
          console.log('Session restored successfully');
        }
      } catch (error) {
        console.error('Failed to restore session:', error);
        this.isAuthenticated = false;
        this.user = null;
        localStorage.removeItem('token');
      }
    },

    async login(username: string, password: string) {
      try {
        const response = await axios.post('/token/', { username, password });
        const { access, refresh, user } = response.data;
        
        localStorage.setItem('token', access);
        localStorage.setItem('refresh_token', refresh);
        this.token = access;
        this.user = user;
        this.isAuthenticated = true;
        
        return true;
      } catch (error) {
        console.error('Login error:', error);
        throw error;
      }
    },

    async checkAuth() {
      try {
        const token = localStorage.getItem('token');
        if (!token) {
          this.isAuthenticated = false;
          return false;
        }

        // Vérifier si le token est valide en récupérant le profil
        await this.fetchUserProfile();
        this.isAuthenticated = true;
        return true;
      } catch (error) {
        this.isAuthenticated = false;
        localStorage.removeItem('token');
        localStorage.removeItem('refresh_token');
        throw error;
      }
    },

    async fetchUserProfile() {
      try {
        console.log('Fetching user profile...');
        // S'assurer que l'URL commence par un slash mais n'inclut pas /api
        const response = await axios.get('/users/me/');
        console.log('User profile response:', response.data);
        this.user = response.data;
        this.mustChangePassword = response.data.must_change_password;
      } catch (error) {
        console.error('Error fetching user profile:', error);
        throw error;
      }
    },

    async changePassword(oldPassword: string, newPassword: string) {
      try {
        console.log('Attempting to change password for user:', this.user?.id);
        const response = await axios.post(`/users/${this.user?.id}/change_password/`, {
          old_password: oldPassword,
          password: newPassword // Changed from new_password to password
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

    async logout() {
      console.log('Logging out...');
      try {
        // Tenter d'invalider le refresh token côté serveur
        await axios.post('/token/logout/', {}, {
          withCredentials: true
        });
      } catch (error) {
        console.error('Error during logout:', error);
      } finally {
        localStorage.removeItem('token');
        localStorage.removeItem('refresh_token');
        this.user = null;
        this.token = null;
        this.isAuthenticated = false;
        this.mustChangePassword = false;
      }
    },

    async refreshToken() {
      try {
        console.log('Attempting to refresh token...');
        const response = await axios.post('/token/refresh/', {}, {
          withCredentials: true // S'assurer que les cookies sont envoyés
        });
        
        const { access } = response.data;
        if (!access) {
          throw new Error('No access token received');
        }
        
        console.log('Token refreshed successfully');
        localStorage.setItem('token', access);
        this.token = access;
        
        return access;
      } catch (error: any) {
        console.error('Error refreshing token:', {
          status: error.response?.status,
          data: error.response?.data
        });
        
        // Si l'erreur est 401 ou 403, on déconnecte l'utilisateur
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
        const response = await axios.get('/utilisateurs/', {
          params: { role: 'CONCESSIONNAIRE' }
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
        await axios.patch(`/utilisateurs/${userId}/`, {
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
        const response = await axios.post('/utilisateurs/', userData);
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
        const response = await axios.patch(`/utilisateurs/${userId}/`, {
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

    checkAccess(requiredRole: string[]): boolean {
      if (!this.user) return false;
      return requiredRole.includes(this.user.user_type);
    }
  }
}); 