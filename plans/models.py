from django.contrib.gis.db import models
from django.conf import settings

class Plan(models.Model):
    """
    Modèle représentant un plan d'irrigation.
    """
    nom = models.CharField(max_length=200, verbose_name='Nom du plan')
    description = models.TextField(blank=True, verbose_name='Description')
    date_creation = models.DateTimeField(auto_now_add=True, verbose_name='Date de création')
    date_modification = models.DateTimeField(auto_now=True, verbose_name='Dernière modification')
    createur = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='plans',
        verbose_name='Créateur'
    )

    class Meta:
        verbose_name = 'Plan'
        verbose_name_plural = 'Plans'
        ordering = ['-date_modification']

    def __str__(self):
        return f"{self.nom} (créé par {self.createur.get_full_name()})"

class FormeGeometrique(models.Model):
    """
    Modèle de base pour toutes les formes géométriques.
    """
    class TypeForme(models.TextChoices):
        RECTANGLE = 'RECTANGLE', 'Rectangle'
        CERCLE = 'CERCLE', 'Cercle'
        DEMI_CERCLE = 'DEMI_CERCLE', 'Demi-cercle'
        LIGNE = 'LIGNE', 'Ligne'

    plan = models.ForeignKey(
        Plan,
        on_delete=models.CASCADE,
        related_name='formes',
        verbose_name='Plan associé'
    )
    type_forme = models.CharField(
        max_length=20,
        choices=TypeForme.choices,
        verbose_name='Type de forme'
    )
    geometrie = models.GeometryField(srid=4326, verbose_name='Géométrie')
    surface = models.FloatField(
        null=True,
        blank=True,
        verbose_name='Surface (m²)'
    )
    
    # Stockage des propriétés spécifiques (rayon, largeur, etc.) en JSON
    proprietes = models.JSONField(
        default=dict,
        blank=True,
        verbose_name='Propriétés spécifiques'
    )

    class Meta:
        verbose_name = 'Forme géométrique'
        verbose_name_plural = 'Formes géométriques'

    def __str__(self):
        return f"{self.get_type_forme_display()} dans {self.plan.nom}"

class Connexion(models.Model):
    """
    Modèle représentant une connexion entre deux formes géométriques.
    """
    plan = models.ForeignKey(
        Plan,
        on_delete=models.CASCADE,
        related_name='connexions',
        verbose_name='Plan associé'
    )
    forme_source = models.ForeignKey(
        FormeGeometrique,
        on_delete=models.CASCADE,
        related_name='connexions_sortantes',
        verbose_name='Forme source'
    )
    forme_destination = models.ForeignKey(
        FormeGeometrique,
        on_delete=models.CASCADE,
        related_name='connexions_entrantes',
        verbose_name='Forme destination'
    )
    geometrie = models.LineStringField(
        srid=4326,
        verbose_name='Géométrie de la connexion'
    )

    class Meta:
        verbose_name = 'Connexion'
        verbose_name_plural = 'Connexions'

    def __str__(self):
        return f"Connexion entre {self.forme_source} et {self.forme_destination}"

class TexteAnnotation(models.Model):
    """
    Modèle pour les textes et annotations sur le plan.
    """
    plan = models.ForeignKey(
        Plan,
        on_delete=models.CASCADE,
        related_name='annotations',
        verbose_name='Plan associé'
    )
    texte = models.CharField(max_length=500, verbose_name='Texte')
    position = models.PointField(srid=4326, verbose_name='Position')
    rotation = models.FloatField(
        default=0,
        verbose_name='Rotation (degrés)'
    )

    class Meta:
        verbose_name = 'Texte d\'annotation'
        verbose_name_plural = 'Textes d\'annotation'

    def __str__(self):
        return f"Annotation sur {self.plan.nom}: {self.texte[:30]}..."
