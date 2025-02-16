import { defineStore } from 'pinia';
import axios from 'axios';

// Configuration d'Axios pour les requêtes API
axios.defaults.baseURL = '/api';
axios.defaults.headers.common['Content-Type'] = 'application/json';

// Intercepteur pour ajouter le token aux requêtes
axios.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    console.log('Request config:', {
      url: config.url,
      method: config.method,
      headers: config.headers,
      data: config.data
    });
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
}

export const useAuthStore = defineStore('auth', {
  state: (): AuthState => ({
    user: null,
    token: localStorage.getItem('token'),
    isAuthenticated: false,
    mustChangePassword: false,
    initialized: false
  }),

  getters: {
    isAdmin: (state) => state.user?.user_type === 'admin',
    isDealer: (state) => state.user?.user_type === 'dealer',
    isClient: (state) => state.user?.user_type === 'client',
    currentUser: (state) => state.user,
    hasDealer: (state) => Boolean(state.user?.dealer)
  },

  actions: {
    initialize(initialState: any) {
      if (!initialState) return;
      
      if (initialState.isAuthenticated && initialState.user) {
        this.user = initialState.user;
        this.isAuthenticated = true;
        this.mustChangePassword = initialState.user.must_change_password || false;
      } else {
        this.user = null;
        this.isAuthenticated = false;
        this.mustChangePassword = false;
      }
      this.initialized = true;
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
        const response = await axios.get('/users/me/');
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
      localStorage.removeItem('token');
      localStorage.removeItem('refresh_token');
      this.user = null;
      this.token = null;
      this.isAuthenticated = false;
    },

    async refreshToken() {
      try {
        const refresh = localStorage.getItem('refresh_token');
        if (!refresh) throw new Error('No refresh token');

        const response = await axios.post('/token/refresh/', { refresh });
        const { access } = response.data;
        
        localStorage.setItem('token', access);
        this.token = access;
        
        return access;
      } catch (error) {
        console.error('Error refreshing token:', error);
        await this.logout();
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