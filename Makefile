.PHONY: install migrate run test shell clean

# Variables
PYTHON = python
MANAGE = $(PYTHON) manage.py
PIP = pip
VENV = venv
ACTIVATE = . $(VENV)/bin/activate

# Installation des dépendances
install:
	test -d $(VENV) || $(PYTHON) -m venv $(VENV)
	$(ACTIVATE) && $(PIP) install -r requirements.txt

# Migrations
migrations:
	$(MANAGE) makemigrations

migrate:
	$(MANAGE) migrate

# Lancement du serveur
run:
	$(MANAGE) runserver

# Tests
test:
	$(MANAGE) test

# Shell Django
shell:
	$(MANAGE) shell

# Nettoyage des fichiers compilés
clean:
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

# Création d'un superutilisateur
createsuperuser:
	$(MANAGE) createsuperuser

# Collecte des fichiers statiques
collectstatic:
	$(MANAGE) collectstatic --noinput

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
	@echo "  make run          - Lance le serveur de développement"
	@echo "  make test         - Lance les tests"
	@echo "  make shell        - Lance le shell Django"
	@echo "  make clean        - Nettoie les fichiers compilés"
	@echo "  make createsuperuser - Crée un superutilisateur"
	@echo "  make collectstatic  - Collecte les fichiers statiques"
	@echo "  make lint         - Vérifie la syntaxe du code"
	@echo "  make format       - Formate le code avec black" 