import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { authService } from '@/services/api';

export const useAuthStore = defineStore('auth', () => {
  const user = ref(null);
  const isAuthenticated = computed(() => !!user.value);

  async function login(username: string, password: string) {
    try {
      const response = await authService.login(username, password);
      user.value = {
        username,
        // Ajoutez d'autres informations utilisateur si nécessaire
      };
      return response;
    } catch (error) {
      console.error('Erreur de connexion:', error);
      throw error;
    }
  }

  async function logout() {
    try {
      await authService.logout();
      user.value = null;
    } catch (error) {
      console.error('Erreur de déconnexion:', error);
      throw error;
    }
  }

  async function register(userData: { username: string; email: string; password: string }) {
    try {
      const response = await authService.register(userData);
      return response;
    } catch (error) {
      console.error('Erreur d\'inscription:', error);
      throw error;
    }
  }

  // Vérifier l'état de l'authentification au chargement
  function checkAuth() {
    const token = localStorage.getItem('access_token');
    if (token) {
      // Vous pouvez ajouter ici une requête pour obtenir les informations de l'utilisateur
      user.value = {
        username: localStorage.getItem('username'),
      };
    }
  }

  return {
    user,
    isAuthenticated,
    login,
    logout,
    register,
    checkAuth,
  };
}); 