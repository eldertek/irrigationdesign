// ***********************************************
// This example commands.js shows you how to
// create various custom commands and overwrite
// existing commands.
//
// For more comprehensive examples of custom
// commands please read more here:
// https://on.cypress.io/custom-commands
// ***********************************************

Cypress.Commands.add('login', (username: string, password: string) => {
  cy.session(
    [username, password],
    () => {
      cy.visit('/login')
      cy.get('input[name="username"]').type(username)
      cy.get('input[name="password"]').type(password)
      cy.get('button[type="submit"]').click()
      
      // Attendre que la redirection soit effectuée
      cy.url().should('not.include', '/login')
      
      // Stocker l'ID de l'utilisateur pour les tests
      cy.window().then((win) => {
        const user = win.localStorage.getItem('user')
        if (user) {
          cy.state('user', JSON.parse(user))
        }
      })
    },
    {
      validate() {
        cy.window().its('localStorage').invoke('getItem', 'token').should('exist')
      },
      cacheAcrossSpecs: true
    }
  )
})

// Commande pour vérifier l'accès à une route
Cypress.Commands.add('checkRouteAccess', (route: string, shouldHaveAccess: boolean) => {
  cy.visit(route, { failOnStatusCode: false })
  if (shouldHaveAccess) {
    cy.url().should('include', route)
  } else {
    cy.url().should('not.include', route)
  }
})

// Commande pour vérifier la présence d'un élément de navigation
Cypress.Commands.add('checkNavItem', (itemText: string, shouldExist: boolean) => {
  cy.get('nav').within(() => {
    if (shouldExist) {
      cy.contains(itemText).should('be.visible')
    } else {
      cy.contains(itemText).should('not.exist')
    }
  })
})

// Commande pour vérifier les permissions sur les plans
Cypress.Commands.add('checkPlanPermissions', (canCreate: boolean, canEdit: boolean, canDelete: boolean) => {
  // Vérifier le bouton de création
  if (canCreate) {
    cy.contains('button', 'Nouveau plan').should('exist')
  } else {
    cy.contains('button', 'Nouveau plan').should('not.exist')
  }

  // Vérifier les boutons d'édition et de suppression sur le premier plan
  cy.get('table tbody tr').first().within(() => {
    if (canEdit) {
      cy.get('[data-test="edit-plan"]').should('exist')
    } else {
      cy.get('[data-test="edit-plan"]').should('not.exist')
    }

    if (canDelete) {
      cy.get('[data-test="delete-plan"]').should('exist')
    } else {
      cy.get('[data-test="delete-plan"]').should('not.exist')
    }
  })
})

// Commande pour vérifier les outils de dessin
Cypress.Commands.add('checkDrawingTools', (shouldBeEnabled: boolean) => {
  cy.get('[data-test="drawing-toolbar"]').within(() => {
    const assertion = shouldBeEnabled ? 'not.be.disabled' : 'be.disabled'
    cy.get('[data-test="tool-rectangle"]').should(assertion)
    cy.get('[data-test="tool-circle"]').should(assertion)
    cy.get('[data-test="tool-line"]').should(assertion)
    cy.get('[data-test="tool-text"]').should(assertion)
  })
})

// Déclaration des types pour TypeScript
declare global {
  namespace Cypress {
    interface Chainable {
      login(username: string, password: string): Chainable<void>
      checkRouteAccess(route: string, shouldHaveAccess: boolean): Chainable<void>
      checkNavItem(itemText: string, shouldExist: boolean): Chainable<void>
      checkPlanPermissions(canCreate: boolean, canEdit: boolean, canDelete: boolean): Chainable<void>
      checkDrawingTools(shouldBeEnabled: boolean): Chainable<void>
    }
  }
} 