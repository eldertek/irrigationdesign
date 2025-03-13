from django.contrib.auth.models import AbstractUser
from django.db import models

class Utilisateur(AbstractUser):
    """
    Modèle d'utilisateur personnalisé avec gestion des rôles.
    Hérite de AbstractUser pour conserver les fonctionnalités de base de Django.
    """
    class Role(models.TextChoices):
        ADMIN = 'ADMIN', 'Administrateur'
        USINE = 'USINE', 'Usine'
        CONCESSIONNAIRE = 'CONCESSIONNAIRE', 'Concessionnaire'
        AGRICULTEUR = 'AGRICULTEUR', 'Agriculteur'

    role = models.CharField(
        max_length=20,
        choices=Role.choices,
        default=Role.AGRICULTEUR,
        verbose_name='Rôle'
    )

    usine = models.ForeignKey(
        'self',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        limit_choices_to={'role': Role.USINE},
        related_name='concessionnaires',
        verbose_name='Usine associée'
    )

    concessionnaire = models.ForeignKey(
        'self',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        limit_choices_to={'role': Role.CONCESSIONNAIRE},
        related_name='agriculteurs',
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
        constraints = [
            models.UniqueConstraint(
                fields=['email'],
                name='unique_email'
            )
        ]

    def __str__(self):
        """Représentation string de l'utilisateur utilisant le format standard."""
        return self.get_display_name()

    def save(self, *args, **kwargs):
        # Si c'est un nouveau utilisateur (pas encore d'ID)
        if not self.pk:
            self.must_change_password = True
        super().save(*args, **kwargs)

    @property
    def is_admin(self):
        return self.role == self.Role.ADMIN

    @property
    def is_usine(self):
        return self.role == self.Role.USINE

    @property
    def is_concessionnaire(self):
        return self.role == self.Role.CONCESSIONNAIRE

    @property
    def is_agriculteur(self):
        return self.role == self.Role.AGRICULTEUR

    def get_display_name(self):
        """Retourne le nom d'affichage standardisé de l'utilisateur."""
        full_name = f"{self.first_name} {self.last_name}".strip().upper()
        company = self.company_name or self.get_role_display()
        return f"{full_name} ({company})" if full_name else f"({company})"
