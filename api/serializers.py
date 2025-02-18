from rest_framework import serializers
from rest_framework_gis.serializers import GeoFeatureModelSerializer
from django.contrib.auth import get_user_model
from plans.models import Plan, FormeGeometrique, Connexion, TexteAnnotation
from .models import UserProfile

User = get_user_model()

class UserProfileSerializer(serializers.ModelSerializer):
    class Meta:
        model = UserProfile
        fields = ['address', 'created_at', 'updated_at']

class UserSerializer(serializers.ModelSerializer):
    profile = UserProfileSerializer(read_only=True)
    concessionnaire_name = serializers.CharField(source='concessionnaire.get_full_name', read_only=True)
    
    class Meta:
        model = User
        fields = ['id', 'username', 'email', 'first_name', 'last_name', 
                 'role', 'concessionnaire', 'concessionnaire_name', 'company_name', 
                 'phone', 'profile', 'date_joined']
        read_only_fields = ['date_joined']
        extra_kwargs = {
            'password': {'write_only': True}
        }

    def create(self, validated_data):
        user = User.objects.create_user(**validated_data)
        UserProfile.objects.create(user=user)
        return user

class DealerSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['id', 'username', 'email', 'first_name', 'last_name', 
                 'company_name', 'phone']
        read_only_fields = ['role']

    def validate(self, data):
        if self.instance and self.instance.role != 'dealer':
            raise serializers.ValidationError("Cet utilisateur n'est pas un concessionnaire")
        return data

class ClientSerializer(serializers.ModelSerializer):
    concessionnaire = serializers.PrimaryKeyRelatedField(
        queryset=User.objects.filter(role='dealer')
    )
    
    class Meta:
        model = User
        fields = ['id', 'username', 'email', 'first_name', 'last_name', 
                 'concessionnaire', 'company_name', 'phone']
        read_only_fields = ['role']

    def validate(self, data):
        if not data.get('concessionnaire'):
            raise serializers.ValidationError("Un concessionnaire doit être spécifié")
        return data

class PlanSerializer(serializers.ModelSerializer):
    createur = UserSerializer(read_only=True)
    
    class Meta:
        model = Plan
        fields = [
            'id', 'nom', 'description', 'date_creation', 
            'date_modification', 'createur'
        ]
        read_only_fields = ['id', 'date_creation', 'date_modification', 'createur']

    def create(self, validated_data):
        validated_data['createur'] = self.context['request'].user
        return super().create(validated_data)

class FormeGeometriqueSerializer(serializers.ModelSerializer):
    class Meta:
        model = FormeGeometrique
        fields = ['id', 'plan', 'type_forme', 'geometrie', 'surface', 'proprietes']
        read_only_fields = ['id']

    def validate(self, data):
        """
        Vérifie que l'utilisateur a le droit de modifier ce plan
        """
        request = self.context.get('request')
        if request and request.user:
            plan = data.get('plan')
            if plan and plan.createur != request.user and request.user.role not in ['admin', 'dealer']:
                raise serializers.ValidationError("Vous n'avez pas la permission de modifier ce plan")
        return data

class ConnexionSerializer(serializers.ModelSerializer):
    class Meta:
        model = Connexion
        fields = ['id', 'plan', 'forme_source', 'forme_destination', 'geometrie']
        read_only_fields = ['id']

    def validate(self, data):
        """
        Vérifie que les formes appartiennent au même plan
        """
        plan = data.get('plan')
        forme_source = data.get('forme_source')
        forme_destination = data.get('forme_destination')

        if forme_source and forme_destination:
            if forme_source.plan != plan or forme_destination.plan != plan:
                raise serializers.ValidationError(
                    "Les formes source et destination doivent appartenir au même plan"
                )

        return data

class TexteAnnotationSerializer(serializers.ModelSerializer):
    class Meta:
        model = TexteAnnotation
        fields = ['id', 'plan', 'texte', 'position', 'rotation']
        read_only_fields = ['id']

class PlanDetailSerializer(serializers.ModelSerializer):
    createur = UserSerializer(read_only=True)
    formes = FormeGeometriqueSerializer(many=True, read_only=True)
    connexions = ConnexionSerializer(many=True, read_only=True)
    annotations = TexteAnnotationSerializer(many=True, read_only=True)
    
    class Meta:
        model = Plan
        fields = [
            'id', 'nom', 'description', 'date_creation', 
            'date_modification', 'createur', 'formes',
            'connexions', 'annotations'
        ]
        read_only_fields = ['id', 'date_creation', 'date_modification', 'createur'] 