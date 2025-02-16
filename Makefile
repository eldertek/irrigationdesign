# Force l'utilisation de bash
SHELL := /bin/bash

.PHONY: install migrate run test shell clean frontend serve dev list-files

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
list-files:
	@echo "=== Liste des fichiers du projet ===" > out.txt
	@echo "\n=== Backend Django ===" >> out.txt
	
	@echo "\n--- Fichiers principaux ---" >> out.txt
	@for f in $$(find . -maxdepth 1 -name "manage.py"); do \
		echo "\n$$f:" >> out.txt; \
		echo "\`\`\`python" >> out.txt; \
		cat "$$f" >> out.txt; \
		echo "\`\`\`" >> out.txt; \
	done
	
	@echo "\n--- Configuration Django ---" >> out.txt
	@for f in $$(find ./irrigation_design -type f -name "*.py" ! -path "*/migrations/*"); do \
		echo "\n$$f:" >> out.txt; \
		echo "\`\`\`python" >> out.txt; \
		cat "$$f" >> out.txt; \
		echo "\`\`\`" >> out.txt; \
	done
	
	@echo "\n--- Applications Django ---\n" >> out.txt
	
	@echo "api:" >> out.txt
	@for f in $$(find ./api -type f -name "*.py" ! -path "*/migrations/*" ! -path "*/__pycache__/*"); do \
		echo "\n$$f:" >> out.txt; \
		echo "\`\`\`python" >> out.txt; \
		cat "$$f" >> out.txt; \
		echo "\`\`\`" >> out.txt; \
	done
	
	@echo "\nauthentication:" >> out.txt
	@for f in $$(find ./authentication -type f -name "*.py" ! -path "*/migrations/*" ! -path "*/__pycache__/*"); do \
		echo "\n$$f:" >> out.txt; \
		echo "\`\`\`python" >> out.txt; \
		cat "$$f" >> out.txt; \
		echo "\`\`\`" >> out.txt; \
	done
	
	@echo "\nplans:" >> out.txt
	@for f in $$(find ./plans -type f -name "*.py" ! -path "*/migrations/*" ! -path "*/__pycache__/*"); do \
		echo "\n$$f:" >> out.txt; \
		echo "\`\`\`python" >> out.txt; \
		cat "$$f" >> out.txt; \
		echo "\`\`\`" >> out.txt; \
	done
	
	@echo "\n=== Frontend Vue.js ===" >> out.txt
	
	@echo "\n--- Templates Django ---" >> out.txt
	@for f in $$(find ./templates -type f -name "*.html"); do \
		echo "\n$$f:" >> out.txt; \
		echo "\`\`\`html" >> out.txt; \
		cat "$$f" >> out.txt; \
		echo "\`\`\`" >> out.txt; \
	done
	
	@echo "\n--- Composants Vue ---" >> out.txt
	@for f in $$(find frontend/irrigationdesign/src/components -type f -name "*.vue" ! -path "*/node_modules/*"); do \
		echo "\n$$f:" >> out.txt; \
		echo "\`\`\`vue" >> out.txt; \
		cat "$$f" >> out.txt; \
		echo "\`\`\`" >> out.txt; \
	done
	
	@echo "\n--- Vues Vue ---" >> out.txt
	@for f in $$(find frontend/irrigationdesign/src/views -type f -name "*.vue" ! -path "*/node_modules/*"); do \
		echo "\n$$f:" >> out.txt; \
		echo "\`\`\`vue" >> out.txt; \
		cat "$$f" >> out.txt; \
		echo "\`\`\`" >> out.txt; \
	done
	
	@echo "\n--- Store et État ---" >> out.txt
	@for f in $$(find frontend/irrigationdesign/src/stores -type f -name "*.ts" ! -path "*/node_modules/*"); do \
		echo "\n$$f:" >> out.txt; \
		echo "\`\`\`typescript" >> out.txt; \
		cat "$$f" >> out.txt; \
		echo "\`\`\`" >> out.txt; \
	done
	
	@echo "\n--- Services et Types ---" >> out.txt
	@for f in $$(find frontend/irrigationdesign/src/services frontend/irrigationdesign/src/types -type f -name "*.ts" ! -path "*/node_modules/*"); do \
		echo "\n$$f:" >> out.txt; \
		echo "\`\`\`typescript" >> out.txt; \
		cat "$$f" >> out.txt; \
		echo "\`\`\`" >> out.txt; \
	done
	
	@echo "\n--- Configuration Frontend ---" >> out.txt
	@for f in $$(find frontend/irrigationdesign -maxdepth 1 -type f \( -name "*.json" -o -name "*.ts" -o -name "*.config.*" \) ! -path "*/node_modules/*"); do \
		echo "\n$$f:" >> out.txt; \
		if [[ $$f == *.json ]]; then \
			echo "\`\`\`json" >> out.txt; \
		elif [[ $$f == *.ts ]]; then \
			echo "\`\`\`typescript" >> out.txt; \
		else \
			echo "\`\`\`" >> out.txt; \
		fi; \
		cat "$$f" >> out.txt; \
		echo "\`\`\`" >> out.txt; \
	done
	
	@echo "\n--- Routes ---" >> out.txt
	@for f in $$(find frontend/irrigationdesign/src/router -type f -name "*.ts" ! -path "*/node_modules/*"); do \
		echo "\n$$f:" >> out.txt; \
		echo "\`\`\`typescript" >> out.txt; \
		cat "$$f" >> out.txt; \
		echo "\`\`\`" >> out.txt; \
	done
	
	@echo "\n--- Styles ---" >> out.txt
	@for f in $$(find frontend/irrigationdesign/src/assets -type f \( -name "*.css" -o -name "*.scss" \) ! -path "*/node_modules/*"); do \
		echo "\n$$f:" >> out.txt; \
		echo "\`\`\`css" >> out.txt; \
		cat "$$f" >> out.txt; \
		echo "\`\`\`" >> out.txt; \
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