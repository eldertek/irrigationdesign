import { UserRole } from '../../support/types'

describe('Agriculteur Role Access Tests', () => {
  beforeEach(() => {
    // Intercepter les appels API
    cy.intercept('POST', '/api/auth/login/').as('loginRequest')
    cy.intercept('GET', '/api/users/profile/').as('profileRequest')
    cy.intercept('GET', '/api/plans/').as('plansRequest')
  })

  it('should login as agriculteur and have most restricted access', () => {
    // Login en tant qu'agriculteur
    cy.visit('/login')
    cy.get('input[name="username"]').type('agriculteur')
    cy.get('input[name="password"]').type('adminpass')
    cy.get('button[type="submit"]').click()

    // Attendre la réponse du login et la redirection
    cy.wait('@loginRequest')
    cy.wait('@profileRequest')

    // Vérifier la redirection vers la page d'accueil
    cy.url().should('include', '/')

    // Vérifier la présence des éléments de navigation autorisés
    cy.get('nav').within(() => {
      cy.contains('Carte').should('be.visible')
      cy.contains('Plans').should('be.visible')
      // L'onglet Utilisateurs ne doit pas être visible
      cy.contains('Utilisateurs').should('not.exist')
    })

    // Vérifier que l'accès direct à /users est bloqué
    cy.visit('/users', { failOnStatusCode: false })
    cy.url().should('include', '/') // Devrait être redirigé vers l'accueil
  })

  it('should only see their own plans', () => {
    // Login en tant qu'agriculteur
    cy.login('agriculteur', 'adminpass')

    // Aller à la page des plans
    cy.visit('/plans')
    cy.wait('@plansRequest')

    // Vérifier le titre spécifique pour l'agriculteur
    cy.contains('h1', 'Mes plans').should('be.visible')

    // Vérifier que seuls les plans de l'agriculteur sont visibles
    cy.get('table tbody tr').each(($row) => {
      cy.wrap($row).find('[data-test="plan-agriculteur"]')
        .invoke('attr', 'data-agriculteur-id')
        .should('eq', cy.state('user').id.toString())
    })
  })

  it('should have read-only access to plan details', () => {
    // Login en tant qu'agriculteur
    cy.login('agriculteur', 'adminpass')

    // Aller à la page des plans
    cy.visit('/plans')
    cy.wait('@plansRequest')

    // Vérifier l'absence du bouton de création de plan
    cy.contains('button', 'Nouveau plan').should('not.exist')

    // Ouvrir un plan existant
    cy.get('table tbody tr').first().click()

    // Vérifier que les outils de modification sont désactivés
    cy.get('[data-test="drawing-toolbar"]').within(() => {
      cy.get('[data-test="tool-rectangle"]').should('be.disabled')
      cy.get('[data-test="tool-circle"]').should('be.disabled')
      cy.get('[data-test="tool-line"]').should('be.disabled')
      cy.get('[data-test="tool-text"]').should('be.disabled')
    })

    // Vérifier que le bouton de sauvegarde n'est pas présent
    cy.get('[data-test="save-plan-button"]').should('not.exist')
  })

  it('should have access to plan visualization features', () => {
    // Login en tant qu'agriculteur
    cy.login('agriculteur', 'adminpass')

    // Aller à la page carte avec un plan
    cy.visit('/plans')
    cy.wait('@plansRequest')
    cy.get('table tbody tr').first().click()

    // Vérifier la présence des outils de visualisation
    cy.get('[data-test="visualization-toolbar"]').within(() => {
      cy.get('[data-test="tool-zoom-in"]').should('exist').and('not.be.disabled')
      cy.get('[data-test="tool-zoom-out"]').should('exist').and('not.be.disabled')
      cy.get('[data-test="tool-pan"]').should('exist').and('not.be.disabled')
      cy.get('[data-test="tool-measure"]').should('exist').and('not.be.disabled')
    })

    // Vérifier l'accès aux informations du plan
    cy.get('[data-test="plan-info-panel"]').should('be.visible')
    cy.get('[data-test="plan-details"]').should('be.visible')
  })
}) 