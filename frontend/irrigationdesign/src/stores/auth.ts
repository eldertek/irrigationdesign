import { defineStore } from 'pinia';
import axios from 'axios';

interface User {
  id: number;
  username: string;
  email: string;
}

interface LoginCredentials {
  username: string;
  password: string;
}

interface RegisterData {
  username: string;
  email: string;
  password: string;
  password2: string;
}

export const useAuthStore = defineStore('auth', {
  state: () => ({
    user: null as User | null,
    token: localStorage.getItem('token'),
    loading: false,
    error: null as string | null
  }),

  getters: {
    isAuthenticated: (state) => !!state.token,
    getUser: (state) => state.user
  },

  actions: {
    async login(credentials: LoginCredentials) {
      this.loading = true;
      this.error = null;
      try {
        const response = await axios.post('/api/auth/login/', credentials);
        this.token = response.data.token;
        localStorage.setItem('token', response.data.token);
        axios.defaults.headers.common['Authorization'] = `Token ${response.data.token}`;
        await this.fetchUser();
      } catch (error) {
        this.error = 'Erreur lors de la connexion';
        throw error;
      } finally {
        this.loading = false;
      }
    },

    async register(data: RegisterData) {
      this.loading = true;
      this.error = null;
      try {
        const response = await axios.post('/api/auth/register/', data);
        this.token = response.data.token;
        localStorage.setItem('token', response.data.token);
        axios.defaults.headers.common['Authorization'] = `Token ${response.data.token}`;
        await this.fetchUser();
      } catch (error) {
        this.error = 'Erreur lors de l\'inscription';
        throw error;
      } finally {
        this.loading = false;
      }
    },

    async fetchUser() {
      if (!this.token) return;

      this.loading = true;
      this.error = null;
      try {
        const response = await axios.get('/api/auth/user/');
        this.user = response.data;
      } catch (error) {
        this.error = 'Erreur lors de la récupération des informations utilisateur';
        throw error;
      } finally {
        this.loading = false;
      }
    },

    async logout() {
      try {
        await axios.post('/api/auth/logout/');
      } catch (error) {
        console.error('Erreur lors de la déconnexion:', error);
      } finally {
        this.token = null;
        this.user = null;
        localStorage.removeItem('token');
        delete axios.defaults.headers.common['Authorization'];
      }
    },

    async updateProfile(data: Partial<User>) {
      this.loading = true;
      this.error = null;
      try {
        const response = await axios.patch('/api/auth/user/', data);
        this.user = response.data;
      } catch (error) {
        this.error = 'Erreur lors de la mise à jour du profil';
        throw error;
      } finally {
        this.loading = false;
      }
    },

    async changePassword(data: { old_password: string; new_password: string }) {
      this.loading = true;
      this.error = null;
      try {
        await axios.post('/api/auth/password/change/', data);
      } catch (error) {
        this.error = 'Erreur lors du changement de mot de passe';
        throw error;
      } finally {
        this.loading = false;
      }
    },

    initializeAuth() {
      if (this.token) {
        axios.defaults.headers.common['Authorization'] = `Token ${this.token}`;
        this.fetchUser();
      }
    }
  }
}); 