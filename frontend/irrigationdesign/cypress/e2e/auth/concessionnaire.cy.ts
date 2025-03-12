import { UserRole } from '../../support/types'

describe('Concessionnaire Role Access Tests', () => {
  beforeEach(() => {
    // Intercepter les appels API
    cy.intercept('POST', '/api/auth/login/').as('loginRequest')
    cy.intercept('GET', '/api/users/profile/').as('profileRequest')
    cy.intercept('GET', '/api/users/').as('usersRequest')
    cy.intercept('GET', '/api/users/agriculteurs/').as('agriculteursRequest')
  })

  it('should login as concessionnaire and have restricted access', () => {
    // Login en tant que concessionnaire
    cy.visit('/login')
    cy.get('input[name="username"]').type('concessionnaire')
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

  it('should only see their own agriculteurs in plans view', () => {
    // Login en tant que concessionnaire
    cy.login('concessionnaire', 'adminpass')

    // Aller à la page des plans
    cy.visit('/plans')

    // Vérifier le titre spécifique pour le concessionnaire
    cy.contains('h1', 'Plans des agriculteurs').should('be.visible')

    // Vérifier que seuls les plans liés aux agriculteurs du concessionnaire sont visibles
    cy.get('table tbody tr').each(($row) => {
      cy.wrap($row).find('[data-test="plan-concessionnaire"]')
        .invoke('attr', 'data-concessionnaire-id')
        .should('eq', cy.state('user').id.toString())
    })
  })

  it('should have access to create plans for their agriculteurs', () => {
    // Login en tant que concessionnaire
    cy.login('concessionnaire', 'adminpass')

    // Aller à la page des plans
    cy.visit('/plans')

    // Vérifier la présence du bouton de création de plan
    cy.contains('button', 'Nouveau plan').click()

    // Dans le modal de création de plan
    cy.get('[data-test="new-plan-modal"]').within(() => {
      // Vérifier que seuls les agriculteurs du concessionnaire sont listés
      cy.get('#client-select option').each(($option) => {
        if ($option.val() !== '') {
          cy.wrap($option)
            .invoke('attr', 'data-concessionnaire-id')
            .should('eq', cy.state('user').id.toString())
        }
      })
    })
  })

  it('should have access to map tools for plan creation', () => {
    // Login en tant que concessionnaire
    cy.login('concessionnaire', 'adminpass')

    // Aller à la page carte
    cy.visit('/')

    // Vérifier la présence des outils de dessin
    cy.get('[data-test="drawing-toolbar"]').within(() => {
      cy.get('[data-test="tool-rectangle"]').should('exist')
      cy.get('[data-test="tool-circle"]').should('exist')
      cy.get('[data-test="tool-line"]').should('exist')
      cy.get('[data-test="tool-text"]').should('exist')
    })

    // Vérifier l'accès aux fonctionnalités de sauvegarde
    cy.get('[data-test="save-plan-button"]').should('exist')
  })
}) 