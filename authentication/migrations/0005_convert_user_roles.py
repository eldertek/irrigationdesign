from django.db import migrations

def convert_user_roles(apps, schema_editor):
    Utilisateur = apps.get_model('authentication', 'Utilisateur')
    # Convertir tous les utilisateurs avec le rôle 'UTILISATEUR' en 'AGRICULTEUR'
    Utilisateur.objects.filter(role='UTILISATEUR').update(role='AGRICULTEUR')

def reverse_convert_user_roles(apps, schema_editor):
    Utilisateur = apps.get_model('authentication', 'Utilisateur')
    # Reconvertir tous les utilisateurs avec le rôle 'AGRICULTEUR' en 'UTILISATEUR'
    Utilisateur.objects.filter(role='AGRICULTEUR').update(role='UTILISATEUR')

class Migration(migrations.Migration):
    dependencies = [
        ('authentication', '0004_utilisateur_usine_alter_utilisateur_concessionnaire_and_more'),
    ]

    operations = [
        migrations.RunPython(convert_user_roles, reverse_convert_user_roles),
    ] 