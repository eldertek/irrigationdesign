from rest_framework import serializers
from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from .models import Utilisateur

User = get_user_model()

class UserDetailsSerializer(serializers.ModelSerializer):
    """Sérialiseur simplifié pour les détails d'utilisateur (utilisé dans les relations)."""
    display_name = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ['id', 'username', 'first_name', 'last_name', 'company_name', 'role', 'display_name']

    def get_display_name(self, obj):
        """Retourne le nom d'affichage standardisé de l'utilisateur."""
        return obj.get_display_name()

class UserNestedSerializer(UserDetailsSerializer):
    """Sérialiseur pour les relations imbriquées, évite les boucles infinies."""
    class Meta(UserDetailsSerializer.Meta):
        model = User
        fields = UserDetailsSerializer.Meta.fields

class UserSerializer(serializers.ModelSerializer):
    """Sérialiseur pour l'utilisateur avec gestion des rôles et du concessionnaire."""
    password = serializers.CharField(write_only=True, required=False)
    old_password = serializers.CharField(write_only=True, required=False)
    concessionnaire_name = serializers.SerializerMethodField()
    full_name = serializers.SerializerMethodField()
    is_active = serializers.BooleanField(read_only=True)
    permissions = serializers.SerializerMethodField()
    user_type = serializers.SerializerMethodField()
    concessionnaire_id = serializers.PrimaryKeyRelatedField(
        source='concessionnaire',
        queryset=User.objects.filter(role='CONCESSIONNAIRE'),
        required=False,
        allow_null=True,
        write_only=True
    )
    plans_count = serializers.SerializerMethodField()
    usine = UserNestedSerializer(read_only=True)
    usine_id = serializers.PrimaryKeyRelatedField(
        queryset=User.objects.filter(role='USINE'),
        source='usine',
        required=False,
        allow_null=True,
        write_only=True
    )
    concessionnaire = UserNestedSerializer(read_only=True)
    
    class Meta:
        model = User
        fields = [
            'id', 'username', 'email', 'first_name', 'last_name',
            'password', 'old_password', 'role', 'concessionnaire', 'concessionnaire_id',
            'concessionnaire_name', 'company_name', 'must_change_password', 'phone',
            'full_name', 'is_active', 'permissions', 'user_type', 'plans_count',
            'usine', 'usine_id'
        ]
        read_only_fields = ['id']
        extra_kwargs = {
            'role': {'required': True}
        }

    def validate(self, data):
        """Valide les données de l'utilisateur."""
        role = data.get('role', self.instance.role if self.instance else None)
        concessionnaire = data.get('concessionnaire')
        usine = data.get('usine')

        print(f"Validation des données: role={role}, concessionnaire={concessionnaire}, usine={usine}")

        # Validation pour les concessionnaires
        if role == 'CONCESSIONNAIRE':
            if not usine and (not self.instance or not self.instance.usine):
                raise serializers.ValidationError({
                    'usine': 'Une usine doit être spécifiée pour un concessionnaire'
                })

        # Validation pour les agriculteurs
        elif role == 'AGRICULTEUR':
            if not concessionnaire and (not self.instance or not self.instance.concessionnaire):
                raise serializers.ValidationError({
                    'concessionnaire': 'Un concessionnaire doit être spécifié pour un agriculteur'
                })
            
            # Vérifier que le concessionnaire existe et a une usine
            if concessionnaire:
                try:
                    concessionnaire = User.objects.get(id=concessionnaire.id if isinstance(concessionnaire, User) else concessionnaire)
                    if concessionnaire.role != 'CONCESSIONNAIRE':
                        raise serializers.ValidationError({
                            'concessionnaire': 'L\'utilisateur sélectionné n\'est pas un concessionnaire'
                        })
                    if not concessionnaire.usine:
                        raise serializers.ValidationError({
                            'concessionnaire': 'Le concessionnaire doit être rattaché à une usine'
                        })
                except User.DoesNotExist:
                    raise serializers.ValidationError({
                        'concessionnaire': 'Ce concessionnaire n\'existe pas'
                    })

        return data

    def to_representation(self, instance):
        """Surcharge la représentation pour inclure les relations imbriquées."""
        data = super().to_representation(instance)
        
        # Pour un concessionnaire, inclure son usine
        if instance.role == 'CONCESSIONNAIRE':
            data['usine'] = UserNestedSerializer(instance.usine).data if instance.usine else None
        
        # Pour un agriculteur, inclure son concessionnaire et l'usine associée
        elif instance.role == 'AGRICULTEUR':
            if instance.concessionnaire:
                concessionnaire_data = UserNestedSerializer(instance.concessionnaire).data
                # Si le concessionnaire a une usine, l'inclure dans ses données
                if instance.concessionnaire.usine:
                    concessionnaire_data['usine'] = UserNestedSerializer(instance.concessionnaire.usine).data
                data['concessionnaire'] = concessionnaire_data
                # Inclure aussi l'usine directement au niveau racine pour faciliter l'accès
                data['usine'] = UserNestedSerializer(instance.concessionnaire.usine).data if instance.concessionnaire.usine else None

        return data

    def get_concessionnaire_name(self, obj):
        """Retourne le nom du concessionnaire si l'utilisateur en a un."""
        if obj.concessionnaire:
            return obj.concessionnaire.get_display_name()
        return None

    def get_full_name(self, obj):
        """Retourne le nom complet de l'utilisateur."""
        return obj.get_display_name()

    def get_permissions(self, obj):
        """Retourne les permissions de l'utilisateur basées sur son rôle."""
        permissions = {
            'can_manage_users': obj.role in ['ADMIN', 'CONCESSIONNAIRE'],
            'can_manage_plans': True,  # Tous les utilisateurs peuvent gérer leurs plans
            'can_view_all_plans': obj.role in ['ADMIN', 'CONCESSIONNAIRE'],
            'can_manage_concessionnaires': obj.role == 'ADMIN'
        }
        return permissions

    def get_user_type(self, obj):
        """Maps the role field to the frontend's expected user_type values."""
        role_mapping = {
            'ADMIN': 'admin',
            'USINE': 'usine',
            'CONCESSIONNAIRE': 'concessionnaire',
            'AGRICULTEUR': 'agriculteur'
        }
        return role_mapping.get(obj.role, 'agriculteur')

    def get_plans_count(self, obj):
        """Retourne le nombre de plans de l'utilisateur."""
        return obj.plans.count()

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
        
        print("Update validated_data:", validated_data)
        
        # Si un nouveau mot de passe est fourni
        if password:
            if instance.must_change_password or (old_password and instance.check_password(old_password)):
                instance.set_password(password)
                instance.must_change_password = False
            else:
                raise serializers.ValidationError({
                    'old_password': ['Mot de passe actuel incorrect.']
                })

        # Gérer les relations selon le rôle
        role = validated_data.get('role', instance.role)
        
        # Pour un concessionnaire
        if role == 'CONCESSIONNAIRE':
            usine = validated_data.get('usine')
            if usine:
                instance.usine = usine
                instance.concessionnaire = None  # Un concessionnaire ne peut pas avoir de concessionnaire
            elif not instance.usine:
                raise serializers.ValidationError({
                    'usine': 'Une usine doit être spécifiée pour un concessionnaire'
                })
        
        # Pour un agriculteur
        elif role == 'AGRICULTEUR':
            concessionnaire = validated_data.get('concessionnaire')
            if concessionnaire:
                instance.concessionnaire = concessionnaire
                instance.usine = None  # Un agriculteur ne peut pas avoir d'usine directement
            elif not instance.concessionnaire:
                raise serializers.ValidationError({
                    'concessionnaire': 'Un concessionnaire doit être spécifié pour un agriculteur'
                })
        
        # Pour une usine
        elif role == 'USINE':
            instance.usine = None
            instance.concessionnaire = None
        
        # Pour un admin
        elif role == 'ADMIN':
            instance.usine = None
            instance.concessionnaire = None

        # Mettre à jour les autres champs
        for attr, value in validated_data.items():
            if attr not in ['usine', 'concessionnaire']:
                setattr(instance, attr, value)
        
        instance.save()
        return instance

class ConcessionnaireListSerializer(serializers.ModelSerializer):
    """Sérialiseur pour la liste des concessionnaires."""
    name = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ['id', 'username', 'company_name', 'name']

    def get_name(self, obj):
        """Retourne le nom d'affichage standardisé du concessionnaire."""
        return obj.get_display_name() 