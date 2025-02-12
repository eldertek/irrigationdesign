from django.contrib.auth.models import AbstractUser
from django.db import models

class Utilisateur(AbstractUser):
    """
    Modèle d'utilisateur personnalisé avec gestion des rôles.
    Hérite de AbstractUser pour conserver les fonctionnalités de base de Django.
    """
    class Role(models.TextChoices):
        ADMIN = 'ADMIN', 'Administrateur'
        CONCESSIONNAIRE = 'CONCESSIONNAIRE', 'Concessionnaire'
        UTILISATEUR = 'UTILISATEUR', 'Utilisateur Final'

    role = models.CharField(
        max_length=20,
        choices=Role.choices,
        default=Role.UTILISATEUR,
        verbose_name='Rôle'
    )
    concessionnaire = models.ForeignKey(
        'self',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        limit_choices_to={'role': Role.CONCESSIONNAIRE},
        related_name='utilisateurs',
        verbose_name='Concessionnaire associé'
    )

    class Meta:
        verbose_name = 'Utilisateur'
        verbose_name_plural = 'Utilisateurs'

    def __str__(self):
        return f"{self.get_full_name()} ({self.get_role_display()})"
