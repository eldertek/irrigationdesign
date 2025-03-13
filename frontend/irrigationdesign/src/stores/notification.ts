import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

export type NotificationType = 'success' | 'error' | 'info' | 'warning'

export interface Notification {
  id: number
  type: NotificationType
  message: string
  duration?: number
  timestamp: number
}

export const useNotificationStore = defineStore('notification', () => {
  const notifications = ref<Notification[]>([])
  const lastId = ref(0)
  const lastAddedId = ref<number | null>(null)
  
  // Obtenir toutes les notifications actives, triées par date (plus récentes en haut)
  const activeNotifications = computed(() => 
    [...notifications.value].sort((a, b) => b.timestamp - a.timestamp)
  )

  // Ajouter une nouvelle notification
  function addNotification({ type, message, duration = 5000 }: Omit<Notification, 'id' | 'timestamp'>) {
    const id = ++lastId.value
    const timestamp = Date.now()
    const notification = { id, type, message, duration, timestamp }
    notifications.value.push(notification)
    
    // Enregistrer l'ID de la dernière notification ajoutée pour l'animation
    lastAddedId.value = id

    // Auto-suppression après la durée spécifiée
    if (duration > 0) {
      setTimeout(() => {
        removeNotification(id)
      }, duration)
    }

    return id
  }

  // Variantes pratiques
  const success = (message: string, duration = 5000) => addNotification({ type: 'success', message, duration })
  const error = (message: string, duration = 5000) => addNotification({ type: 'error', message, duration })
  const info = (message: string, duration = 5000) => addNotification({ type: 'info', message, duration })
  const warning = (message: string, duration = 5000) => addNotification({ type: 'warning', message, duration })

  // Supprimer une notification par ID
  function removeNotification(id: number) {
    const index = notifications.value.findIndex(n => n.id === id)
    if (index !== -1) {
      notifications.value.splice(index, 1)
    }
    
    // Si c'était la dernière notification ajoutée, réinitialiser lastAddedId
    if (lastAddedId.value === id) {
      lastAddedId.value = null
    }
  }

  // Supprimer toutes les notifications
  function clearAll() {
    notifications.value = []
    lastAddedId.value = null
  }

  return { 
    notifications: activeNotifications,
    lastAddedId,
    addNotification, 
    removeNotification, 
    clearAll,
    success,
    error,
    info,
    warning
  }
}) 