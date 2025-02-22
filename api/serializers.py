from rest_framework import serializers
from rest_framework_gis.serializers import GeoFeatureModelSerializer
from django.contrib.auth import get_user_model
from plans.models import Plan, FormeGeometrique, Connexion, TexteAnnotation

User = get_user_model()  # Ceci pointera vers authentication.Utilisateur

class UserSerializer(serializers.ModelSerializer):
    concessionnaire_name = serializers.CharField(source='concessionnaire.get_full_name', read_only=True)
    
    class Meta:
        model = User
        fields = ['id', 'username', 'email', 'first_name', 'last_name', 
                 'role', 'concessionnaire', 'concessionnaire_name', 'company_name', 
                 'phone', 'date_joined']
        read_only_fields = ['date_joined']
        extra_kwargs = {
            'password': {'write_only': True}
        }

    def create(self, validated_data):
        user = User.objects.create_user(**validated_data)
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

class UserDetailsSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['id', 'username', 'email', 'first_name', 'last_name', 'role', 'company_name', 'phone']

class PlanSerializer(serializers.ModelSerializer):
    createur = UserDetailsSerializer(read_only=True)
    concessionnaire = serializers.PrimaryKeyRelatedField(
        queryset=User.objects.filter(role='CONCESSIONNAIRE'),
        required=False,
        allow_null=True
    )
    client = serializers.PrimaryKeyRelatedField(
        queryset=User.objects.filter(role='UTILISATEUR'),
        required=False,
        allow_null=True
    )
    concessionnaire_details = UserDetailsSerializer(source='concessionnaire', read_only=True)
    client_details = UserDetailsSerializer(source='client', read_only=True)
    
    class Meta:
        model = Plan
        fields = ['id', 'nom', 'description', 'date_creation', 'date_modification', 
                 'createur', 'concessionnaire', 'client', 'preferences',
                 'concessionnaire_details', 'client_details']
        read_only_fields = ['date_creation', 'date_modification', 'createur']

    def validate(self, data):
        request = self.context.get('request')
        if not request or not request.user:
            raise serializers.ValidationError("Utilisateur non authentifié")

        user = request.user
        concessionnaire = data.get('concessionnaire')
        client = data.get('client')

        # Validation selon le rôle
        if user.role == 'CONCESSIONNAIRE':
            # Un concessionnaire doit spécifier un client
            if not client:
                raise serializers.ValidationError({
                    "client": "Un client doit être sélectionné"
                })
            # Le client doit appartenir au concessionnaire
            if client.concessionnaire != user:
                raise serializers.ValidationError({
                    "client": "Ce client ne vous appartient pas"
                })
            # Le concessionnaire est automatiquement assigné
            data['concessionnaire'] = user

        elif user.role == 'UTILISATEUR':
            # Un client crée toujours un plan pour lui-même
            data['client'] = user
            # Le concessionnaire est soit spécifié, soit celui du client
            if not concessionnaire:
                data['concessionnaire'] = user.concessionnaire

        # Validation générale de la cohérence client/concessionnaire
        if client and concessionnaire:
            if client.concessionnaire != concessionnaire:
                raise serializers.ValidationError({
                    "client": "Le client doit appartenir au concessionnaire sélectionné"
                })

        return data

    def create(self, validated_data):
        print("[PlanSerializer] Création avec données:", validated_data)
        # Si un client est spécifié, il devient le créateur
        if 'client' in validated_data and validated_data['client']:
            validated_data['createur'] = validated_data['client']
        else:
            validated_data['createur'] = self.context['request'].user
        return super().create(validated_data)

    def update(self, instance, validated_data):
        print("[PlanSerializer] Début update avec données:", validated_data)
        
        # Si un client est assigné, il devient le créateur
        if 'client' in validated_data and validated_data['client']:
            instance.createur = validated_data['client']
        
        instance = super().update(instance, validated_data)
        print(f"[PlanSerializer] Fin update - concessionnaire_id: {instance.concessionnaire_id}, client_id: {instance.client_id}")
        return instance

class FormeGeometriqueSerializer(serializers.ModelSerializer):
    class Meta:
        model = FormeGeometrique
        fields = ['id', 'plan', 'type_forme', 'data']
        read_only_fields = ['id']

    def validate(self, attrs):
        """Valide les données selon le type de forme."""
        type_forme = attrs.get('type_forme')
        data = attrs.get('data', {})

        if not data:
            raise serializers.ValidationError("Les données de la forme sont requises")

        # Validation spécifique selon le type de forme
        if type_forme == FormeGeometrique.TypeForme.CERCLE:
            if 'center' not in data or 'radius' not in data:
                raise serializers.ValidationError("Un cercle nécessite un centre et un rayon")
        elif type_forme == FormeGeometrique.TypeForme.RECTANGLE:
            if 'bounds' not in data:
                raise serializers.ValidationError("Un rectangle nécessite des limites (bounds)")
        elif type_forme == FormeGeometrique.TypeForme.DEMI_CERCLE:
            if not all(k in data for k in ['center', 'radius', 'startAngle', 'endAngle']):
                raise serializers.ValidationError("Un demi-cercle nécessite un centre, un rayon et des angles")
        elif type_forme == FormeGeometrique.TypeForme.LIGNE:
            if 'points' not in data:
                raise serializers.ValidationError("Une ligne nécessite des points")
        elif type_forme == FormeGeometrique.TypeForme.TEXTE:
            if not all(k in data for k in ['position', 'content']):
                raise serializers.ValidationError("Un texte nécessite une position et un contenu")

        return attrs

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
    createur = UserDetailsSerializer(read_only=True)
    concessionnaire = serializers.PrimaryKeyRelatedField(
        queryset=User.objects.filter(role='CONCESSIONNAIRE'),
        required=False,
        allow_null=True
    )
    client = serializers.PrimaryKeyRelatedField(
        queryset=User.objects.filter(role='UTILISATEUR'),
        required=False,
        allow_null=True
    )
    formes = FormeGeometriqueSerializer(many=True, read_only=True)
    connexions = ConnexionSerializer(many=True, read_only=True)
    annotations = TexteAnnotationSerializer(many=True, read_only=True)
    
    class Meta:
        model = Plan
        fields = [
            'id', 'nom', 'description', 'date_creation', 
            'date_modification', 'createur', 'concessionnaire',
            'client', 'formes', 'connexions', 'annotations', 
            'preferences', 'elements', 'historique'
        ]
        read_only_fields = ['id', 'date_creation', 'date_modification', 'createur']

    def validate(self, data):
        print("[PlanDetailSerializer] Début validation avec données:", data)
        concessionnaire = data.get('concessionnaire')
        client = data.get('client')

        if client and not concessionnaire:
            raise serializers.ValidationError({
                "concessionnaire": "Un concessionnaire doit être sélectionné pour assigner un client"
            })

        if client and concessionnaire:
            if client.concessionnaire_id != concessionnaire.id:
                raise serializers.ValidationError({
                    "client": "Le client doit appartenir au concessionnaire sélectionné"
                })

        return data

    def update(self, instance, validated_data):
        print("[PlanDetailSerializer] Début update avec données:", validated_data)
        
        # Si un client est assigné, il devient le créateur
        if 'client' in validated_data and validated_data['client']:
            instance.createur = validated_data['client']
            
        instance = super().update(instance, validated_data)
        print(f"[PlanDetailSerializer] Fin update - concessionnaire_id: {instance.concessionnaire_id}, client_id: {instance.client_id}")
        return instance

    def create(self, validated_data):
        validated_data['createur'] = self.context['request'].user
        return super().create(validated_data) 