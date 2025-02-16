.PHONY: install migrate run test shell clean frontend serve dev

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

# Migrations
migrations:
	$(MANAGE) makemigrations

migrate:
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