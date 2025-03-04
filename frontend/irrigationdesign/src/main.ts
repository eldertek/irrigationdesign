import './assets/main.css'
import { createApp } from 'vue'
import { createPinia } from 'pinia'
import { useAuthStore } from '@/stores/auth'
import App from './App.vue'
import router from './router'
const app = createApp(App)
const pinia = createPinia()
app.use(pinia)
app.use(router)
// Initialiser le store d'authentification
const authStore = useAuthStore(pinia)
if (window.INITIAL_STATE) {
  authStore.initialize(window.INITIAL_STATE)
}
app.mount('#app')
