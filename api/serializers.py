from rest_framework import serializers
from rest_framework_gis.serializers import GeoFeatureModelSerializer
from authentication.models import Utilisateur
from plans.models import Plan, FormeGeometrique, Connexion, TexteAnnotation

class UtilisateurSerializer(serializers.ModelSerializer):
    class Meta:
        model = Utilisateur
        fields = ('id', 'username', 'email', 'first_name', 'last_name', 'role', 'concessionnaire')
        read_only_fields = ('role',)

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