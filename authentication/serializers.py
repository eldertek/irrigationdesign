from rest_framework import serializers
from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password

User = get_user_model()

class UserSerializer(serializers.ModelSerializer):
    """Sérialiseur pour l'utilisateur avec gestion des rôles et du concessionnaire."""
    password = serializers.CharField(write_only=True, required=False)
    old_password = serializers.CharField(write_only=True, required=False)
    dealer_name = serializers.SerializerMethodField()
    full_name = serializers.SerializerMethodField()
    is_active = serializers.BooleanField(read_only=True)
    permissions = serializers.SerializerMethodField()
    
    class Meta:
        model = User
        fields = [
            'id', 'username', 'email', 'first_name', 'last_name',
            'password', 'old_password', 'role', 'concessionnaire',
            'dealer_name', 'company_name', 'must_change_password', 'phone',
            'full_name', 'is_active', 'permissions'
        ]
        read_only_fields = ['id']
        extra_kwargs = {
            'concessionnaire': {'required': False},
            'role': {'required': False}
        }

    def get_dealer_name(self, obj):
        """Retourne le nom du concessionnaire si l'utilisateur en a un."""
        if obj.concessionnaire:
            return obj.concessionnaire.company_name or obj.concessionnaire.get_full_name()
        return None

    def get_full_name(self, obj):
        """Retourne le nom complet de l'utilisateur."""
        if obj.company_name:
            return obj.company_name
        full_name = obj.get_full_name()
        return full_name if full_name else obj.username

    def get_permissions(self, obj):
        """Retourne les permissions de l'utilisateur basées sur son rôle."""
        permissions = {
            'can_manage_users': obj.role in ['ADMIN', 'CONCESSIONNAIRE'],
            'can_manage_plans': True,  # Tous les utilisateurs peuvent gérer leurs plans
            'can_view_all_plans': obj.role in ['ADMIN', 'CONCESSIONNAIRE'],
            'can_manage_dealers': obj.role == 'ADMIN'
        }
        return permissions

    def validate_password(self, value):
        """Valide le mot de passe selon les règles de Django."""
        validate_password(value)
        return value

    def create(self, validated_data):
        """Crée un nouvel utilisateur avec un mot de passe hashé."""
        password = validated_data.pop('password', None)
        user = super().create(validated_data)
        if password:
            user.set_password(password)
            user.save()
        return user

    def update(self, instance, validated_data):
        """Met à jour un utilisateur existant."""
        password = validated_data.pop('password', None)
        old_password = validated_data.pop('old_password', None)
        
        # Si un nouveau mot de passe est fourni
        if password:
            # Pour le changement de mot de passe, vérifie l'ancien mot de passe
            if instance.must_change_password or (old_password and instance.check_password(old_password)):
                instance.set_password(password)
                instance.must_change_password = False
            else:
                raise serializers.ValidationError({
                    'old_password': ['Mot de passe actuel incorrect.']
                })

        return super().update(instance, validated_data)

class DealerListSerializer(serializers.ModelSerializer):
    """Sérialiseur pour la liste des concessionnaires."""
    name = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ['id', 'username', 'company_name', 'name']

    def get_name(self, obj):
        """Retourne le nom complet ou le nom d'entreprise du concessionnaire."""
        return obj.company_name or obj.get_full_name() or obj.username 