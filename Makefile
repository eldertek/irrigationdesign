# Force l'utilisation de bash
SHELL := /bin/bash

.PHONY: install migrate run test shell clean frontend serve dev list-files cypress-tests cypress-admin cypress-usine cypress-concessionnaire cypress-agriculteur cypress-admin-ui cypress-usine-ui cypress-concessionnaire-ui cypress-agriculteur-ui cypress-open

# Variables
PYTHON = python
MANAGE = $(PYTHON) manage.py
PIP = pip
VENV = venv
ACTIVATE = . $(VENV)/bin/activate
NPM = npm

# Installation des dépendances
install:
	test -d $(VENV) || $(PYTHON) -m venv $(VENV)
	$(ACTIVATE) && $(PIP) install -r requirements.txt
	cd frontend/irrigationdesign && $(NPM) install

# Liste des fichiers pertinents
files:
	@echo "=== Liste des fichiers du projet ===" > out.txt
	
	# Frontend Vue.js
	@echo "\n=== Frontend Vue.js ===" >> out.txt
	
	@echo "\n--- Composants et Vues Vue ---" >> out.txt
	@for f in $$(find frontend/irrigationdesign/src -type f -name "*.vue" ! -path "*/node_modules/*" ! -name "index.html" ! -name "README.md" ! -name "*.config.js" ! -name "*.json"); do \
		if [ -s "$$f" ]; then \
			echo "\n$$f:" >> out.txt; \
			echo "\`\`\`vue" >> out.txt; \
			cat "$$f" >> out.txt; \
			echo "\`\`\`" >> out.txt; \
		fi \
	done
	
	@echo "\n--- Fichiers TypeScript ---" >> out.txt
	@for f in $$(find frontend/irrigationdesign/src -type f -name "*.ts" ! -path "*/node_modules/*" ! -name "index.html" ! -name "README.md" ! -name "*.config.js" ! -name "*.json"); do \
		if [ -s "$$f" ]; then \
			echo "\n$$f:" >> out.txt; \
			echo "\`\`\`typescript" >> out.txt; \
			cat "$$f" >> out.txt; \
			echo "\`\`\`" >> out.txt; \
		fi \
	done

	# Backend Django
	@echo "\n=== Backend Django ===" >> out.txt

	@for dir in api authentication plans irrigation_design; do \
		echo "\n--- Dossier $$dir ---" >> out.txt; \
		for f in $$(find $$dir -type f -name "*.py" ! -name "settings.py" ! -name "urls.py" ! -name "wsgi.py" ! -name "asgi.py" ! -name "__init__.py" ! -path "*/__pycache__/*"); do \
			if [ -s "$$f" ]; then \
				echo "\n$$f:" >> out.txt; \
				echo "\`\`\`python" >> out.txt; \
				cat "$$f" >> out.txt; \
				echo "\`\`\`" >> out.txt; \
			fi \
		done \
	done
	
	@echo "\nContenu généré dans out.txt"

# Migrations
migrate:
	$(MANAGE) makemigrations
	$(MANAGE) migrate

# Compilation du frontend
frontend:
	cd frontend/irrigationdesign && $(NPM) run build-only

# Collecte des fichiers statiques
collectstatic:
	$(MANAGE) collectstatic --noinput

# Nettoyage des fichiers statiques
clean-static:
	rm -rf static/frontend
	rm -rf staticfiles

# Lancement du serveur Django
run:
	lsof -ti:8000 | xargs kill -9 2>/dev/null || true
	$(MANAGE) runserver --insecure

# Lancement du serveur de développement frontend
dev-frontend:
	cd frontend/irrigationdesign && $(NPM) run dev

# Lancement des deux serveurs en développement (nécessite tmux)
dev: clean-static frontend
	mkdir -p static/frontend
	$(MAKE) collectstatic
	tmux kill-session -t irrigation 2>/dev/null || true
	tmux new-session -d -s irrigation '$(MAKE) run' \; \
	split-window -h '$(MAKE) dev-frontend' \; \
	attach

# Commande tout-en-un pour la production
serve: clean-static frontend collectstatic
	$(MANAGE) runserver --insecure

# Tests
test:
	$(MANAGE) test

# Shell Django
shell:
	$(MANAGE) shell

# Nettoyage des fichiers compilés
clean: clean-static
	find . -type d -name "__pycache__" -exec rm -r {} +
	find . -type f -name "*.pyc" -delete
	find . -type f -name "*.pyo" -delete
	find . -type f -name "*.pyd" -delete
	find . -type f -name ".DS_Store" -delete
	find . -type d -name "*.egg-info" -exec rm -r {} +
	find . -type d -name "*.egg" -exec rm -r {} +
	find . -type d -name ".pytest_cache" -exec rm -r {} +
	find . -type d -name ".coverage" -delete
	find . -type d -name "htmlcov" -exec rm -r {} +
	rm -rf frontend/irrigationdesign/dist

# Création d'un superutilisateur
createsuperuser:
	$(MANAGE) createsuperuser

# Vérification de la syntaxe Python
lint:
	flake8 .
	black . --check

# Formatage du code
format:
	black .

# Tests Cypress
cypress-admin:
	mkdir -p logs
	cd frontend/irrigationdesign && npx cypress run --browser electron --spec "cypress/e2e/auth/admin.cy.ts" > ../../logs/admin-results.txt 2>&1

cypress-usine:
	mkdir -p logs
	cd frontend/irrigationdesign && npx cypress run --browser electron --spec "cypress/e2e/auth/usine.cy.ts" > ../../logs/usine-results.txt 2>&1

cypress-concessionnaire:
	mkdir -p logs
	cd frontend/irrigationdesign && npx cypress run --browser electron --spec "cypress/e2e/auth/concessionnaire.cy.ts" > ../../logs/concessionnaire-results.txt 2>&1

cypress-agriculteur:
	mkdir -p logs
	cd frontend/irrigationdesign && npx cypress run --browser electron --spec "cypress/e2e/auth/agriculteur.cy.ts" > ../../logs/agriculteur-results.txt 2>&1

# Mode visuel (avec interface graphique)
cypress-admin-ui:
	cd frontend/irrigationdesign && npx cypress run --browser electron --headed --no-exit --spec "cypress/e2e/auth/admin.cy.ts"

cypress-usine-ui:
	cd frontend/irrigationdesign && npx cypress run --browser electron --headed --no-exit --spec "cypress/e2e/auth/usine.cy.ts"

cypress-concessionnaire-ui:
	cd frontend/irrigationdesign && npx cypress run --browser electron --headed --no-exit --spec "cypress/e2e/auth/concessionnaire.cy.ts"

cypress-agriculteur-ui:
	cd frontend/irrigationdesign && npx cypress run --browser electron --headed --no-exit --spec "cypress/e2e/auth/agriculteur.cy.ts"

# Ouvrir Cypress en mode interactif
cypress-open:
	cd frontend/irrigationdesign && npx cypress open

# Exécute tous les tests Cypress séquentiellement
cypress-tests: cypress-admin cypress-usine cypress-concessionnaire cypress-agriculteur
	@echo "Tous les tests Cypress ont été exécutés. Les résultats sont disponibles dans le dossier /logs"

# Aide
help:
	@echo "Commandes disponibles:"
	@echo "  make install        - Installe les dépendances"
	@echo "  make migrations    - Crée les migrations"
	@echo "  make migrate       - Applique les migrations"
	@echo "  make frontend      - Compile le frontend"
	@echo "  make collectstatic - Collecte les fichiers statiques"
	@echo "  make clean-static  - Nettoie les fichiers statiques"
	@echo "  make run          - Lance le serveur Django avec support des fichiers statiques"
	@echo "  make dev-frontend  - Lance le serveur de développement frontend"
	@echo "  make dev          - Lance les deux serveurs en développement avec HMR"
	@echo "  make serve        - Prépare et lance l'application en mode production"
	@echo "  make test         - Lance les tests"
	@echo "  make shell        - Lance le shell Django"
	@echo "  make clean        - Nettoie les fichiers compilés"
	@echo "  make createsuperuser - Crée un superutilisateur"
	@echo "  make lint         - Vérifie la syntaxe du code"
	@echo "  make format       - Formate le code avec black"
	@echo "  make cypress-tests - Exécute tous les tests Cypress séquentiellement"
	@echo "  make cypress-admin - Exécute uniquement les tests admin"
	@echo "  make cypress-usine - Exécute uniquement les tests usine"
	@echo "  make cypress-concessionnaire - Exécute uniquement les tests concessionnaire"
	@echo "  make cypress-agriculteur - Exécute uniquement les tests agriculteur"
	@echo "  make cypress-admin-ui - Exécute uniquement les tests admin en mode visuel"
	@echo "  make cypress-usine-ui - Exécute uniquement les tests usine en mode visuel"
	@echo "  make cypress-concessionnaire-ui - Exécute uniquement les tests concessionnaire en mode visuel"
	@echo "  make cypress-agriculteur-ui - Exécute uniquement les tests agriculteur en mode visuel"
	@echo "  make cypress-open - Ouvre Cypress en mode interactif" 