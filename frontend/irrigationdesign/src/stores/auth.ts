import { defineStore } from 'pinia';
import axios from 'axios';

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
        const response = await axios.post('/api/token/', { username, password });
        const { access, user } = response.data;
        
        localStorage.setItem('token', access);
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
        const token = localStorage.getItem('access_token');
        if (!token) {
          this.isAuthenticated = false;
          return false;
        }

        // Configure axios avec le token
        axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
        
        // Vérifier si le token est valide en récupérant le profil
        await this.fetchUserProfile();
        this.isAuthenticated = true;
        return true;
      } catch (error) {
        this.isAuthenticated = false;
        localStorage.removeItem('access_token');
        throw error;
      }
    },

    async fetchUserProfile() {
      try {
        const response = await axios.get('/api/users/me/');
        this.user = response.data;
        this.mustChangePassword = response.data.must_change_password;
      } catch (error) {
        console.error('Error fetching user profile:', error);
        throw error;
      }
    },

    async changePassword(oldPassword: string, newPassword: string) {
      try {
        const response = await axios.post('/api/auth/change-password/', {
          old_password: oldPassword,
          new_password: newPassword
        })
        
        // Update the user state to reflect that password change is no longer required
        this.user = {
          ...this.user,
          must_change_password: false
        }
        
        return response.data
      } catch (error) {
        throw error
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

        const response = await axios.post('/api/token/refresh/', { refresh });
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
        const response = await axios.get('/api/utilisateurs/', {
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
        await axios.patch(`/api/utilisateurs/${userId}/`, {
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
        const response = await axios.post('/api/utilisateurs/', userData);
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
        const response = await axios.patch(`/api/utilisateurs/${userId}/`, {
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