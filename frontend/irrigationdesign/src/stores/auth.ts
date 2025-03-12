import { defineStore } from 'pinia';
import api, { userService } from '@/services/api';
// Configuration d'Axios pour les requêtes API
api.defaults.baseURL = '/api';
api.defaults.headers.common['Content-Type'] = 'application/json';
api.defaults.withCredentials = true;
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
// Types pour les utilisateurs
export interface User {
  id: number;
  username: string;
  email: string;
  user_type: 'admin' | 'usine' | 'concessionnaire' | 'agriculteur';
  role?: string;
  usine?: number | null;
  usine_name?: string;
  concessionnaire?: number | null;
  concessionnaire_name?: string;
  first_name: string;
  last_name: string;
  company_name?: string;
  must_change_password?: boolean;
  plans_count?: number;
  usine_ref?: UserReference | null;
  concessionnaire_ref?: UserReference | null;
  is_active?: boolean;
}
export interface UserReference {
  id: number;
  username: string;
  first_name: string;
  last_name: string;
  company_name?: string;
  role: string;
  display_name?: string;
  usine?: UserReference;
}
export interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  mustChangePassword: boolean;
  initialized: boolean;
  loading: boolean;
  error: string | null;
  concessionnaires: any[];
  usines: UserReference[];
  concessionnaires_list: UserReference[];
  agriculteurs: UserReference[];
}
// Fonction utilitaire pour définir un cookie sécurisé
function setSecureCookie(name: string, value: string, expiryDays: number = 1) {
  const date = new Date();
  date.setTime(date.getTime() + (expiryDays * 24 * 60 * 60 * 1000));
  const expires = `expires=${date.toUTCString()}`;
  document.cookie = `${name}=${value};${expires};path=/;secure;samesite=Strict`;
}
// Fonction utilitaire pour formater les noms d'utilisateurs
export function formatUserName(user: { first_name?: string; last_name?: string; company_name?: string; role?: string }): string {
  if (!user) return '-';
  
  const firstName = user.first_name || '';
  const lastName = user.last_name ? user.last_name.toUpperCase() : '';
  const fullName = `${firstName} ${lastName}`.trim();
  
  // Utiliser company_name ou role comme identifiant d'entreprise
  const company = user.company_name || user.role || '';
  
  if (!fullName && !company) return '-';
  if (!fullName) return `(${company})`;
  if (!company) return fullName;
  
  return `${fullName} (${company})`;
}
// Fonction utilitaire pour obtenir les initiales d'un utilisateur
export function getInitials(firstName: string = '', lastName: string = ''): string {
  return `${firstName?.charAt(0) || ''}${lastName?.charAt(0) || ''}`.toUpperCase();
}
// Fonction utilitaire pour obtenir les labels des rôles
export const roleLabels: Record<string, string> = {
  'ADMIN': 'Administrateur',
  'USINE': 'Usine',
  'CONCESSIONNAIRE': 'Concessionnaire',
  'AGRICULTEUR': 'Agriculteur'
};
// Fonction pour obtenir le label d'un rôle
export function getRoleLabel(role: string): string {
  return roleLabels[role] || role;
}
// Fonction pour obtenir la classe CSS d'un badge de rôle
export function getRoleBadgeClass(): string {
  return 'px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-gray-100 text-gray-800';
}
// Fonction pour obtenir la classe CSS d'un badge de statut
export function getStatusBadgeClass(isActive: boolean): string {
  return isActive
    ? 'px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800'
    : 'px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-red-100 text-red-800';
}
// Fonction utilitaire pour récupérer les utilisateurs selon la hiérarchie
export async function fetchUsersByHierarchy({ role, usineId, concessionnaireId, includeDetails = false }: {
  role: string;
  usineId?: number;
  concessionnaireId?: number;
  includeDetails?: boolean;
}) {
  const params: any = { role };
  
  if (usineId) {
    params.usine = usineId;
  }
  
  if (concessionnaireId) {
    params.concessionnaire = concessionnaireId;
  }
  
  if (includeDetails) {
    params.include_plans = true;
  }
  
  const response = await userService.getUsers(params);
  return response.data;
}
export const useAuthStore = defineStore('auth', {
  state: (): AuthState => ({
    user: null,
    isAuthenticated: false,
    mustChangePassword: false,
    initialized: false,
    loading: false,
    error: null,
    concessionnaires: [],
    usines: [],
    concessionnaires_list: [],
    agriculteurs: []
  }),
  getters: {
    isAdmin: (state) => state.user?.user_type === 'admin',
    isUsine: (state) => state.user?.user_type === 'usine',
    isConcessionnaire: (state) => state.user?.user_type === 'concessionnaire',
    isAgriculteur: (state) => state.user?.user_type === 'agriculteur',
    currentUser: (state) => state.user,
    hasConcessionnaire: (state) => Boolean(state.user?.concessionnaire),
    hasUsine: (state) => Boolean(state.user?.usine)
  },
  actions: {
    async initialize(initialState: any) {
      if (!initialState) {
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
      try {
        // Vérifier si un token existe avant d'essayer de le rafraîchir
        const token = getCookie('access_token');
        if (!token) {
          this.isAuthenticated = false;
          this.user = null;
          return false;
        }
        const response = await api.post('/token/refresh/');
        if (response.data.user) {
          this.user = response.data.user;
          this.isAuthenticated = true;
          this.mustChangePassword = response.data.user.must_change_password || false;
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
        const response = await api.post(`/users/change_password/`, {
          old_password: oldPassword,
          password: newPassword
        });
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
        const response = await api.post('/token/refresh/', {}, {
          withCredentials: true
        });
        const { access } = response.data;
        if (!access) {
          throw new Error('No access token received');
        }
        setSecureCookie('access_token', access, 1);
        this.isAuthenticated = true;
        return access;
      } catch (error: any) {
        console.error('Error refreshing token:', {
          status: error.response?.status,
          data: error.response?.data
        });
        if (error.response?.status === 401 || error.response?.status === 403) {
          await this.logout();
        }
        throw error;
      }
    },
    // Récupérer tous les utilisateurs avec filtrage optionnel
    async fetchUsers(filters = {}) {
      this.loading = true;
      try {
        const response = await userService.getUsers(filters);
        return response.data;
      } catch (error) {
        this.error = 'Erreur lors de la récupération des utilisateurs';
        throw error;
      } finally {
        this.loading = false;
      }
    },
    // Récupérer toutes les usines
    async fetchUsines() {
      this.loading = true;
      try {
        const response = await userService.getUsines();
        this.usines = response.data;
        return this.usines;
      } catch (error) {
        this.error = 'Erreur lors de la récupération des usines';
        throw error;
      } finally {
        this.loading = false;
      }
    },
    // Récupérer tous les concessionnaires d'une usine
    async fetchUsineConcessionnaires(usineId: number) {
      this.loading = true;
      try {
        const response = await userService.getUsineConcessionnaires(usineId);
        this.concessionnaires_list = response.data;
        return this.concessionnaires_list;
      } catch (error) {
        this.error = 'Erreur lors de la récupération des concessionnaires de l\'usine';
        throw error;
      } finally {
        this.loading = false;
      }
    },
    // Récupérer les agriculteurs d'un concessionnaire
    async fetchConcessionnaireAgriculteurs(concessionnaireId: number) {
      this.loading = true;
      try {
        const response = await userService.getAgriculteurs(concessionnaireId);
        this.agriculteurs = Array.isArray(response.data) ? response.data : [response.data];
        return this.agriculteurs;
      } catch (error) {
        this.error = 'Erreur lors de la récupération des agriculteurs';
        throw error;
      } finally {
        this.loading = false;
      }
    },
    // Récupérer les agriculteurs d'une usine
    async fetchUsineAgriculteurs(usineId: number) {
      this.loading = true;
      try {
        const response = await userService.getAgriculteurs(undefined, usineId);
        return Array.isArray(response.data) ? response.data : [response.data];
      } catch (error) {
        this.error = 'Erreur lors de la récupération des agriculteurs de l\'usine';
        throw error;
      } finally {
        this.loading = false;
      }
    },
    // Assigner une usine à un concessionnaire
    async setUsineForConcessionnaire(concessionnaireId: number, usineId: number) {
      this.loading = true;
      try {
        return await userService.assignUsineToConcessionnaire(concessionnaireId, usineId);
      } catch (error) {
        this.error = 'Erreur lors de l\'assignation de l\'usine au concessionnaire';
        throw error;
      } finally {
        this.loading = false;
      }
    },
    // Assigner un concessionnaire à un agriculteur
    async setConcessionnaireForAgriculteur(agriculteurId: number, concessionnaireId: number) {
      this.loading = true;
      try {
        return await userService.assignConcessionnaireToAgriculteur(agriculteurId, concessionnaireId);
      } catch (error) {
        this.error = 'Erreur lors de l\'assignation du concessionnaire à l\'agriculteur';
        throw error;
      } finally {
        this.loading = false;
      }
    },
    // Créer un nouvel utilisateur
    async createUser(userData: any) {
      this.loading = true;
      try {
        const response = await userService.createUser(userData);
        return response.data;
      } catch (error) {
        this.error = 'Erreur lors de la création de l\'utilisateur';
        throw error;
      } finally {
        this.loading = false;
      }
    },
    // Mettre à jour un utilisateur
    async updateUser(userId: number, userData: any) {
      this.loading = true;
      try {
        const response = await userService.updateUser(userId, userData);
        return response.data;
      } catch (error) {
        this.error = 'Erreur lors de la mise à jour de l\'utilisateur';
        throw error;
      } finally {
        this.loading = false;
      }
    },
    // Supprimer un utilisateur
    async deleteUser(userId: number) {
      this.loading = true;
      try {
        await userService.deleteUser(userId);
        return true;
      } catch (error) {
        this.error = 'Erreur lors de la suppression de l\'utilisateur';
        throw error;
      } finally {
        this.loading = false;
      }
    },
    async fetchConcessionnairesLegacy() {
      this.loading = true;
      try {
        const response = await api.get('/users/', {
          params: { role: 'concessionnaire' }
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
          this.user.concessionnaire = concessionnaireId;
        }
      } catch (error) {
        this.error = 'Erreur lors de la mise à jour du concessionnaire';
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
    },
    // Fonction unifiée pour récupérer les utilisateurs par hiérarchie
    async fetchUsersByRole(params: { role: string; usineId?: number; concessionnaireId?: number; includeDetails?: boolean }) {
      this.loading = true;
      try {
        return await fetchUsersByHierarchy(params);
      } catch (error) {
        console.error(`Error fetching ${params.role}:`, error);
        throw error;
      } finally {
        this.loading = false;
      }
    }
  }
}); 