from django.contrib.gis.db import models
from django.conf import settings
from django.utils import timezone
from django.core.exceptions import ValidationError
from authentication.models import Utilisateur

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
    usine = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='plans_usine',
        verbose_name='Usine assignée',
        limit_choices_to={'role': Utilisateur.Role.USINE}
    )
    concessionnaire = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='plans_concessionnaire',
        verbose_name='Concessionnaire assigné',
        limit_choices_to={'role': Utilisateur.Role.CONCESSIONNAIRE}
    )
    agriculteur = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='plans_agriculteur',
        verbose_name='Agriculteur assigné',
        limit_choices_to={'role': Utilisateur.Role.AGRICULTEUR}
    )
    preferences = models.JSONField(
        default=dict,
        blank=True,
        verbose_name='Préférences de dessin',
        help_text='Stocke les préférences de dessin (type de trait, couleurs, etc.)'
    )
    elements = models.JSONField(
        default=list,
        blank=True,
        verbose_name='Éléments du plan',
        help_text='Stocke les éléments du plan (formes, connexions, etc.)'
    )
    historique = models.JSONField(
        default=list,
        blank=True,
        verbose_name='Historique des modifications',
        help_text='Stocke l\'historique des modifications du plan'
    )

    class Meta:
        verbose_name = 'Plan'
        verbose_name_plural = 'Plans'
        ordering = ['-date_modification']

    def __str__(self):
        return f"{self.nom} (créé par {self.createur.get_full_name()})"

    def touch(self):
        """Force la mise à jour de la date de modification."""
        self.date_modification = timezone.now()
        self.save(update_fields=['date_modification'])

    def clean(self):
        """Valide les relations entre usine, concessionnaire et agriculteur."""
        super().clean()
        
        # Si un agriculteur est assigné, il doit avoir un concessionnaire
        if self.agriculteur and not self.concessionnaire:
            raise ValidationError({
                'concessionnaire': 'Un concessionnaire doit être assigné si un agriculteur est spécifié.'
            })
        
        # Si un concessionnaire est assigné, il doit avoir une usine
        if self.concessionnaire and not self.usine:
            raise ValidationError({
                'usine': 'Une usine doit être assignée si un concessionnaire est spécifié.'
            })
        
        # Vérifier que le concessionnaire appartient à l'usine
        if self.concessionnaire and self.usine and self.concessionnaire.usine != self.usine:
            raise ValidationError({
                'concessionnaire': 'Le concessionnaire doit appartenir à l\'usine spécifiée.'
            })
        
        # Vérifier que l'agriculteur appartient au concessionnaire
        if self.agriculteur and self.concessionnaire and self.agriculteur.concessionnaire != self.concessionnaire:
            raise ValidationError({
                'agriculteur': 'L\'agriculteur doit appartenir au concessionnaire spécifié.'
            })
        
        # Vérifier que l'agriculteur appartient indirectement à l'usine
        if self.agriculteur and self.usine and (not self.agriculteur.concessionnaire or self.agriculteur.concessionnaire.usine != self.usine):
            raise ValidationError({
                'agriculteur': 'L\'agriculteur doit appartenir à un concessionnaire rattaché à l\'usine spécifiée.'
            })

class FormeGeometrique(models.Model):
    """
    Modèle de base pour toutes les formes géométriques.
    """
    class TypeForme(models.TextChoices):
        RECTANGLE = 'RECTANGLE', 'Rectangle'
        CERCLE = 'CERCLE', 'Cercle'
        DEMI_CERCLE = 'DEMI_CERCLE', 'Demi-cercle'
        LIGNE = 'LIGNE', 'Ligne'
        TEXTE = 'TEXTE', 'Texte'

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
    
    # Stockage des données spécifiques à chaque type de forme
    data = models.JSONField(
        default=dict,
        blank=True,
        verbose_name='Données de la forme'
    )

    class Meta:
        verbose_name = 'Forme géométrique'
        verbose_name_plural = 'Formes géométriques'

    def __str__(self):
        return f"{self.get_type_forme_display()} dans {self.plan.nom}"

    def clean(self):
        """Valide les données selon le type de forme."""
        super().clean()
        if not self.data:
            raise ValidationError("Les données de la forme sont requises")

        if self.type_forme == self.TypeForme.CERCLE:
            if 'center' not in self.data or 'radius' not in self.data:
                raise ValidationError("Un cercle nécessite un centre et un rayon")
        elif self.type_forme == self.TypeForme.RECTANGLE:
            if 'bounds' not in self.data:
                raise ValidationError("Un rectangle nécessite des limites (bounds)")
        elif self.type_forme == self.TypeForme.DEMI_CERCLE:
            if not all(k in self.data for k in ['center', 'radius', 'startAngle', 'endAngle']):
                raise ValidationError("Un demi-cercle nécessite un centre, un rayon et des angles")
        elif self.type_forme == self.TypeForme.LIGNE:
            if 'points' not in self.data:
                raise ValidationError("Une ligne nécessite des points")
        elif self.type_forme == self.TypeForme.TEXTE:
            if not all(k in self.data for k in ['position', 'content']):
                raise ValidationError("Un texte nécessite une position et un contenu")

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
