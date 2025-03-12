from rest_framework import serializers
from rest_framework_gis.serializers import GeoFeatureModelSerializer
from django.contrib.auth import get_user_model
from plans.models import Plan, FormeGeometrique, Connexion, TexteAnnotation
from authentication.models import Utilisateur

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
    """Sérialiseur pour les plans d'irrigation."""
    createur = UserSerializer(read_only=True)
    usine = serializers.PrimaryKeyRelatedField(
        queryset=User.objects.filter(role=Utilisateur.Role.USINE),
        required=False,
        allow_null=True
    )
    concessionnaire = serializers.PrimaryKeyRelatedField(
        queryset=User.objects.filter(role=Utilisateur.Role.CONCESSIONNAIRE),
        required=False,
        allow_null=True
    )
    agriculteur = serializers.PrimaryKeyRelatedField(
        queryset=User.objects.filter(role=Utilisateur.Role.AGRICULTEUR),
        required=False,
        allow_null=True
    )

    class Meta:
        model = Plan
        fields = [
            'id', 'nom', 'description', 'date_creation', 'date_modification',
            'createur', 'usine', 'concessionnaire', 'agriculteur', 'preferences',
            'elements', 'historique'
        ]
        read_only_fields = ['date_creation', 'date_modification', 'historique']

    def validate(self, data):
        """Valide les relations entre usine, concessionnaire et agriculteur."""
        # Si un agriculteur est spécifié, vérifier qu'il a un concessionnaire
        if 'agriculteur' in data and data['agriculteur'] and not data.get('concessionnaire'):
            raise serializers.ValidationError({
                'concessionnaire': 'Un concessionnaire doit être spécifié si un agriculteur est assigné.'
            })

        # Si un concessionnaire est spécifié, vérifier qu'il a une usine
        if 'concessionnaire' in data and data['concessionnaire'] and not data.get('usine'):
            raise serializers.ValidationError({
                'usine': 'Une usine doit être spécifiée si un concessionnaire est assigné.'
            })

        return data

    def create(self, validated_data):
        print("[PlanSerializer] Création avec données:", validated_data)
        # Si un client est spécifié, il devient le créateur
        if 'agriculteur' in validated_data and validated_data['agriculteur']:
            validated_data['createur'] = validated_data['agriculteur']
        else:
            validated_data['createur'] = self.context['request'].user
        return super().create(validated_data)

    def update(self, instance, validated_data):
        print("[PlanSerializer] Début update avec données:", validated_data)
        
        # Si un client est assigné, il devient le créateur
        if 'agriculteur' in validated_data and validated_data['agriculteur']:
            instance.createur = validated_data['agriculteur']
        
        instance = super().update(instance, validated_data)
        print(f"[PlanSerializer] Fin update - concessionnaire_id: {instance.concessionnaire_id}, client_id: {instance.agriculteur_id}")
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
    usine = UserDetailsSerializer(read_only=True)
    usine_id = serializers.PrimaryKeyRelatedField(
        source='usine',
        queryset=User.objects.filter(role=Utilisateur.Role.USINE),
        required=False,
        allow_null=True,
        write_only=True
    )
    concessionnaire = UserDetailsSerializer(read_only=True)
    concessionnaire_id = serializers.PrimaryKeyRelatedField(
        source='concessionnaire',
        queryset=User.objects.filter(role=Utilisateur.Role.CONCESSIONNAIRE),
        required=False,
        allow_null=True,
        write_only=True
    )
    agriculteur = UserDetailsSerializer(read_only=True)
    agriculteur_id = serializers.PrimaryKeyRelatedField(
        source='agriculteur',
        queryset=User.objects.filter(role=Utilisateur.Role.AGRICULTEUR),
        required=False,
        allow_null=True,
        write_only=True
    )
    formes = FormeGeometriqueSerializer(many=True, read_only=True)
    connexions = ConnexionSerializer(many=True, read_only=True)
    annotations = TexteAnnotationSerializer(many=True, read_only=True)
    
    class Meta:
        model = Plan
        fields = [
            'id', 'nom', 'description', 'date_creation', 'date_modification',
            'createur', 'usine', 'usine_id', 'concessionnaire', 'concessionnaire_id',
            'agriculteur', 'agriculteur_id', 'formes', 'connexions', 'annotations',
            'preferences', 'elements', 'historique'
        ]
        read_only_fields = ['date_creation', 'date_modification', 'historique']

    def to_representation(self, instance):
        """
        Surcharge pour s'assurer que les relations sont renvoyées comme des objets.
        """
        print(f"\n[PlanDetailSerializer] Début to_representation pour plan {instance.id}")
        print(f"- Usine: {instance.usine_id} ({type(instance.usine_id)})")
        print(f"- Concessionnaire: {instance.concessionnaire_id} ({type(instance.concessionnaire_id)})")
        print(f"- Agriculteur: {instance.agriculteur_id} ({type(instance.agriculteur_id)})")
        
        # Utiliser super() pour obtenir la représentation de base
        data = super().to_representation(instance)
        
        print("\nDonnées sérialisées initiales:")
        print("- usine:", data.get('usine'))
        print("- concessionnaire:", data.get('concessionnaire'))
        print("- agriculteur:", data.get('agriculteur'))
        
        # S'assurer que les relations sont bien sérialisées en objets complets
        if data.get('usine') is None and instance.usine:
            print(f"[PlanDetailSerializer] Forçage sérialisation de usine: {instance.usine}")
            data['usine'] = UserDetailsSerializer(instance.usine, context=self.context).data
            
        if data.get('concessionnaire') is None and instance.concessionnaire:
            print(f"[PlanDetailSerializer] Forçage sérialisation de concessionnaire: {instance.concessionnaire}")
            data['concessionnaire'] = UserDetailsSerializer(instance.concessionnaire, context=self.context).data
            
        if data.get('agriculteur') is None and instance.agriculteur:
            print(f"[PlanDetailSerializer] Forçage sérialisation de agriculteur: {instance.agriculteur}")
            data['agriculteur'] = UserDetailsSerializer(instance.agriculteur, context=self.context).data
        
        print("\nDonnées sérialisées finales:")
        print("- usine:", data.get('usine'))
        print("- concessionnaire:", data.get('concessionnaire'))
        print("- agriculteur:", data.get('agriculteur'))
        
        return data

    def validate(self, data):
        """Valide les relations entre usine, concessionnaire et agriculteur."""
        print("\n[PlanDetailSerializer] Validation des données:", data)
        
        # Si un agriculteur est spécifié, vérifier qu'il a un concessionnaire
        if 'agriculteur' in data and data['agriculteur'] and not data.get('concessionnaire'):
            raise serializers.ValidationError({
                'concessionnaire': 'Un concessionnaire doit être spécifié si un agriculteur est assigné.'
            })

        # Si un concessionnaire est spécifié, vérifier qu'il a une usine
        if 'concessionnaire' in data and data['concessionnaire'] and not data.get('usine'):
            raise serializers.ValidationError({
                'usine': 'Une usine doit être spécifiée si un concessionnaire est assigné.'
            })

        return data

    def update(self, instance, validated_data):
        print("\n[PlanDetailSerializer] Début update avec données:", validated_data)
        print(f"État initial - usine: {instance.usine_id}, concessionnaire: {instance.concessionnaire_id}, agriculteur: {instance.agriculteur_id}")
        
        instance = super().update(instance, validated_data)
        
        print(f"État final - usine: {instance.usine_id}, concessionnaire: {instance.concessionnaire_id}, agriculteur: {instance.agriculteur_id}")
        return instance

    def create(self, validated_data):
        validated_data['createur'] = self.context['request'].user
        return super().create(validated_data) 