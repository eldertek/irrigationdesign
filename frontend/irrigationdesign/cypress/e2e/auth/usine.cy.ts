import { UserRole } from '../../support/types'

describe('Usine Role Access Tests', () => {
  beforeEach(() => {
    // Intercepter les appels API
    cy.intercept('POST', '/api/auth/login/').as('loginRequest')
    cy.intercept('GET', '/api/users/profile/').as('profileRequest')
    cy.intercept('GET', '/api/users/').as('usersRequest')
    cy.intercept('GET', '/api/users/concessionnaires/').as('concessionnaireRequest')
  })

  it('should login as usine and have access to authorized features', () => {
    // Login en tant qu'usine
    cy.visit('/login')
    cy.get('input[name="username"]').type('usine')
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
      cy.contains('Utilisateurs').should('be.visible')
    })

    // Vérifier l'accès à la page utilisateurs
    cy.contains('Utilisateurs').click()
    cy.url().should('include', '/users')
    cy.wait('@usersRequest')

    // Vérifier le titre spécifique pour l'usine
    cy.contains('h1', 'Gestion des concessionnaires et agriculteurs').should('be.visible')

    // Vérifier la présence du bouton de création d'utilisateur avec le bon libellé
    cy.contains('button', 'Nouveau concessionnaire/agriculteur').should('be.visible')

    // Vérifier les filtres disponibles
    cy.get('#role-filter').should('exist')
    cy.get('#usine-filter').should('not.exist') // L'usine ne doit pas voir ce filtre
    cy.get('#concessionnaire-filter').should('exist')
  })

  it('should have limited user creation options', () => {
    // Login en tant qu'usine
    cy.login('usine', 'adminpass')

    // Aller à la page utilisateurs
    cy.visit('/users')
    cy.wait('@usersRequest')

    // Ouvrir le modal de création d'utilisateur
    cy.contains('button', 'Nouveau concessionnaire/agriculteur').click()

    // Vérifier les options de rôle disponibles (limitées)
    cy.get('#user-role').should('exist').within(() => {
      cy.contains('Administrateur').should('not.exist')
      cy.contains('Usine').should('not.exist')
      cy.contains('Concessionnaire').should('exist')
      cy.contains('Agriculteur').should('exist')
    })
  })

  it('should only see plans related to their concessionnaires', () => {
    // Login en tant qu'usine
    cy.login('usine', 'adminpass')

    // Aller à la page des plans
    cy.visit('/plans')

    // Vérifier que seuls les plans liés à l'usine sont visibles
    cy.get('table tbody tr').each(($row) => {
      // Vérifier que chaque plan est lié à un concessionnaire de l'usine
      cy.wrap($row).find('[data-test="plan-concessionnaire"]')
        .invoke('attr', 'data-concessionnaire-usine')
        .should('eq', cy.state('user').id.toString())
    })
  })
}) 