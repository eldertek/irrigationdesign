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
    class Meta:
        model = Plan
        fields = '__all__'
        read_only_fields = ('createur',)

    def create(self, validated_data):
        validated_data['createur'] = self.context['request'].user
        return super().create(validated_data)

class FormeGeometriqueSerializer(GeoFeatureModelSerializer):
    class Meta:
        model = FormeGeometrique
        geo_field = 'geometrie'
        fields = '__all__'
        read_only_fields = ('surface',)

class ConnexionSerializer(GeoFeatureModelSerializer):
    class Meta:
        model = Connexion
        geo_field = 'geometrie'
        fields = '__all__'

class TexteAnnotationSerializer(GeoFeatureModelSerializer):
    class Meta:
        model = TexteAnnotation
        geo_field = 'position'
        fields = '__all__' 