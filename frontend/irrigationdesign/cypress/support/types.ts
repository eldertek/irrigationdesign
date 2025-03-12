export enum UserRole {
  ADMIN = 'ADMIN',
  USINE = 'USINE',
  CONCESSIONNAIRE = 'CONCESSIONNAIRE',
  AGRICULTEUR = 'AGRICULTEUR'
}

export interface User {
  id: number
  username: string
  email: string
  first_name: string
  last_name: string
  role: UserRole
  company_name?: string
  is_active: boolean
  usine_id?: number
  concessionnaire_id?: number
}

export interface Plan {
  id: number
  nom: string
  description: string
  date_creation: string
  date_modification: string
  createur: User
  usine: User | null
  concessionnaire: User | null
  agriculteur: User | null
}

// Augmenter les types Cypress
declare global {
  namespace Cypress {
    interface Chainable {
      /**
       * Custom command to login with username and password
       * @example cy.login('admin', 'adminpass')
       */
      login(username: string, password: string): Chainable<void>
    }
  }
} 