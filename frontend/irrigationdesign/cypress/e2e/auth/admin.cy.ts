import { UserRole } from '../../support/types'

describe('Admin Role Access Tests', () => {
  beforeEach(() => {
    // Intercepter les appels API
    cy.intercept('POST', '/api/auth/login/').as('loginRequest')
    cy.intercept('GET', '/api/users/profile/').as('profileRequest')
    cy.intercept('GET', '/api/users/').as('usersRequest')
  })

  it('should login as admin and have access to all features', () => {
    // Login en tant qu'admin
    cy.visit('/login')
    cy.get('input[name="username"]').type('admin')
    cy.get('input[name="password"]').type('adminpass')
    cy.get('button[type="submit"]').click()

    // Attendre la réponse du login et la redirection
    cy.wait('@loginRequest')
    cy.wait('@profileRequest')

    // Vérifier la redirection vers la page d'accueil
    cy.url().should('include', '/')

    // Vérifier la présence de tous les éléments de navigation
    cy.get('nav').within(() => {
      cy.contains('Carte').should('be.visible')
      cy.contains('Plans').should('be.visible')
      cy.contains('Utilisateurs').should('be.visible')
    })

    // Vérifier l'accès à la page utilisateurs
    cy.contains('Utilisateurs').click()
    cy.url().should('include', '/users')
    cy.wait('@usersRequest')

    // Vérifier la présence du bouton de création d'utilisateur
    cy.contains('button', 'Nouvel utilisateur').should('be.visible')

    // Vérifier les filtres disponibles
    cy.get('#role-filter').should('exist')
    cy.get('#usine-filter').should('exist')
    cy.get('#concessionnaire-filter').should('exist')

    // Vérifier l'accès aux plans
    cy.contains('Plans').click()
    cy.url().should('include', '/plans')

    // Vérifier le titre de la section plans
    cy.contains('h1', 'Tous les plans').should('be.visible')
  })

  it('should have access to all user creation options', () => {
    // Login en tant qu'admin
    cy.login('admin', 'adminpass')

    // Aller à la page utilisateurs
    cy.visit('/users')
    cy.wait('@usersRequest')

    // Ouvrir le modal de création d'utilisateur
    cy.contains('button', 'Nouvel utilisateur').click()

    // Vérifier les options de rôle disponibles
    cy.get('#user-role').should('exist').within(() => {
      cy.contains('Administrateur').should('exist')
      cy.contains('Usine').should('exist')
      cy.contains('Concessionnaire').should('exist')
      cy.contains('Agriculteur').should('exist')
    })
  })
}) 