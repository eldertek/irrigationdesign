import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import ChangePasswordForm from '@/components/auth/ChangePasswordForm.vue'

const router = createRouter({
  history: createWebHistory('/'),
  routes: [
    {
      path: '/',
      name: 'home',
      component: () => import('@/views/HomeView.vue'),
      meta: { 
        requiresAuth: true,
        allowedRoles: ['admin', 'dealer', 'client']
      }
    },
    {
      path: '/projects',
      name: 'projects',
      component: () => import('@/views/ProjectsView.vue'),
      meta: { 
        requiresAuth: true,
        allowedRoles: ['admin', 'dealer', 'client']
      }
    },
    {
      path: '/users',
      name: 'users',
      component: () => import('@/views/UsersView.vue'),
      meta: { 
        requiresAuth: true,
        allowedRoles: ['admin', 'dealer']
      }
    },
    {
      path: '/profile',
      name: 'profile',
      component: () => import('@/views/ProfileView.vue'),
      meta: { 
        requiresAuth: true,
        allowedRoles: ['admin', 'dealer', 'client']
      }
    },
    {
      path: '/settings',
      name: 'settings',
      component: () => import('@/views/SettingsView.vue'),
      meta: { 
        requiresAuth: true,
        allowedRoles: ['admin', 'dealer', 'client']
      }
    },
    {
      path: '/select-dealer',
      name: 'selectDealer',
      component: () => import('@/views/SelectDealerView.vue'),
      meta: { 
        requiresAuth: true,
        allowedRoles: ['client']
      }
    },
    {
      path: '/login',
      name: 'login',
      component: () => import('@/views/LoginView.vue'),
      meta: { requiresGuest: true }
    },
    {
      path: '/forgot-password',
      name: 'forgot-password',
      component: () => import('@/views/ForgotPasswordView.vue'),
      meta: { requiresGuest: true }
    },
    {
      path: '/reset-password/:token',
      name: 'reset-password',
      component: () => import('@/views/ResetPasswordView.vue'),
      meta: { requiresGuest: true }
    },
    {
      path: '/change-password',
      name: 'changePassword',
      component: ChangePasswordForm,
      meta: { 
        requiresAuth: true,
        allowedRoles: ['admin', 'dealer', 'client']
      }
    },
    {
      path: '/:pathMatch(.*)*',
      name: 'not-found',
      component: () => import('@/views/NotFoundView.vue')
    }
  ]
})

// Navigation guard
router.beforeEach(async (to, from, next) => {
  const authStore = useAuthStore()
  
  // Vérifier l'état initial au premier chargement
  if (!authStore.initialized) {
    try {
      await authStore.initialize(window.INITIAL_STATE)
    } catch (error) {
      console.error('Error initializing auth store:', error)
    }
  }

  const isAuthenticated = authStore.isAuthenticated
  const mustChangePassword = authStore.user?.must_change_password
  const userType = authStore.user?.user_type
  const hasDealer = authStore.hasDealer

  // Si la route nécessite une authentification et que l'utilisateur n'est pas authentifié
  if (to.meta.requiresAuth && !isAuthenticated) {
    next({ name: 'login' })
    return
  }

  // Si l'utilisateur doit changer son mot de passe
  if (isAuthenticated && mustChangePassword && to.name !== 'changePassword') {
    next({ name: 'changePassword' })
    return
  }

  // Si l'utilisateur est sur la route de changement de mot de passe mais n'a pas besoin de le changer
  if (to.name === 'changePassword' && !mustChangePassword) {
    next({ name: 'home' })
    return
  }

  // Vérification des rôles autorisés
  if (to.meta.allowedRoles && userType) {
    if (!to.meta.allowedRoles.includes(userType)) {
      next({ name: 'home' })
      return
    }
  }

  // Redirection vers la sélection du concessionnaire pour les clients sans concessionnaire
  if (isAuthenticated && userType === 'client' && !hasDealer && to.name !== 'selectDealer') {
    next({ name: 'selectDealer' })
    return
  }

  // Si l'utilisateur est authentifié et essaie d'accéder à une route guest
  if (to.meta.requiresGuest && isAuthenticated) {
    next({ name: 'home' })
    return
  }

  next()
})

export default router
