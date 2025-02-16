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
    company_name = models.CharField(
        max_length=255,
        blank=True,
        null=True,
        verbose_name='Nom de l\'entreprise'
    )
    must_change_password = models.BooleanField(
        default=True,
        verbose_name='Doit changer le mot de passe'
    )
    phone = models.CharField(
        max_length=20,
        blank=True,
        null=True,
        verbose_name='Numéro de téléphone'
    )

    class Meta:
        verbose_name = 'Utilisateur'
        verbose_name_plural = 'Utilisateurs'

    def __str__(self):
        return f"{self.get_full_name()} ({self.get_role_display()})"

    def save(self, *args, **kwargs):
        # Si c'est un nouveau utilisateur (pas encore d'ID)
        if not self.pk:
            self.must_change_password = True
        super().save(*args, **kwargs)

    @property
    def is_admin(self):
        return self.role == self.Role.ADMIN

    @property
    def is_dealer(self):
        return self.role == self.Role.CONCESSIONNAIRE

    @property
    def is_client(self):
        return self.role == self.Role.UTILISATEUR

    def get_display_name(self):
        """Retourne le nom d'affichage de l'utilisateur."""
        if self.company_name:
            return self.company_name
        full_name = self.get_full_name()
        return full_name if full_name else self.username
