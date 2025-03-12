from django.shortcuts import render
from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action, api_view
from rest_framework.response import Response
from django.db.models import Q, Count
from .serializers import (
    UserSerializer,
    DealerSerializer,
    ClientSerializer,
    PlanSerializer,
    FormeGeometriqueSerializer,
    ConnexionSerializer,
    TexteAnnotationSerializer,
    PlanDetailSerializer
)
from .permissions import IsAdmin, IsDealer, IsUsine
from django.contrib.auth import get_user_model
from plans.models import Plan, FormeGeometrique, Connexion, TexteAnnotation
import requests
from django.db import transaction
from django.shortcuts import get_object_or_404
from rest_framework.exceptions import ValidationError
from rest_framework.exceptions import PermissionDenied

User = get_user_model()  # Ceci pointera vers authentication.Utilisateur

# Mise à jour des valeurs de rôle pour correspondre au modèle Utilisateur
ROLE_ADMIN = 'ADMIN'
ROLE_USINE = 'USINE'
ROLE_DEALER = 'CONCESSIONNAIRE'
ROLE_AGRICULTEUR = 'AGRICULTEUR'

# Create your views here.

class UserViewSet(viewsets.ModelViewSet):
    queryset = User.objects.all()
    serializer_class = UserSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        base_queryset = User.objects.annotate(plans_count=Count('plans'))
        
        if user.role == ROLE_ADMIN:
            return base_queryset.all()
        elif user.role == ROLE_USINE:
            # Une usine peut voir ses concessionnaires et les agriculteurs qui leur sont rattachés
            return base_queryset.filter(
                Q(role=ROLE_DEALER, usine=user) |  # Concessionnaires de l'usine
                Q(role=ROLE_AGRICULTEUR, concessionnaire__usine=user)  # Agriculteurs des concessionnaires de l'usine
            )
        elif user.role == ROLE_DEALER:
            return base_queryset.filter(role=ROLE_AGRICULTEUR, concessionnaire=user)
        return base_queryset.filter(id=user.id)

    def get_permissions(self):
        if self.action == 'create':
            self.permission_classes = [permissions.IsAuthenticated, IsAdmin | IsUsine | IsDealer]
        elif self.action in ['update', 'partial_update', 'destroy']:
            self.permission_classes = [permissions.IsAuthenticated, IsAdmin | IsUsine | IsDealer]
        return super().get_permissions()

    def update(self, request, *args, **kwargs):
        instance = self.get_object()
        partial = kwargs.pop('partial', False)
        
        # Vérifier si username/email existe déjà pour un autre utilisateur
        username = request.data.get('username')
        email = request.data.get('email')
        
        if username and User.objects.exclude(id=instance.id).filter(username=username).exists():
            return Response(
                {'username': ['Un utilisateur avec ce nom existe déjà']},
                status=status.HTTP_400_BAD_REQUEST
            )
            
        if email and User.objects.exclude(id=instance.id).filter(email=email).exists():
            return Response(
                {'email': ['Un utilisateur avec cet email existe déjà']},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Ne pas modifier le concessionnaire pour un concessionnaire
        if instance.role == ROLE_DEALER:
            if 'concessionnaire' in request.data:
                del request.data['concessionnaire']

        # Vérifier le concessionnaire uniquement pour les clients
        elif request.data.get('concessionnaire'):
            try:
                concessionnaire = User.objects.get(
                    id=request.data['concessionnaire'],
                    role=ROLE_DEALER
                )
            except User.DoesNotExist:
                return Response(
                    {'concessionnaire': ['Ce concessionnaire n\'existe pas']},
                    status=status.HTTP_400_BAD_REQUEST
                )

        serializer = self.get_serializer(instance, data=request.data, partial=partial)
        serializer.is_valid(raise_exception=True)
        self.perform_update(serializer)
        return Response(serializer.data)

    def create(self, request, *args, **kwargs):
        # Vérifier si username/email existe déjà
        username = request.data.get('username')
        email = request.data.get('email')
        
        if User.objects.filter(username=username).exists():
            return Response(
                {'username': ['Un utilisateur avec ce nom existe déjà.']},
                status=status.HTTP_400_BAD_REQUEST
            )
            
        if User.objects.filter(email=email).exists():
            return Response(
                {'email': ['Un utilisateur avec cet email existe déjà.']},
                status=status.HTTP_400_BAD_REQUEST
            )

        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        self.perform_create(serializer)
        headers = self.get_success_headers(serializer.data)
        return Response(serializer.data, status=status.HTTP_201_CREATED, headers=headers)

    def perform_update(self, serializer):
        data = serializer.validated_data
        instance = serializer.instance
        
        # Empêcher la modification du rôle sauf pour les admins
        if 'role' in data and not self.request.user.is_admin:
            raise ValidationError({
                'role': ['Seul un administrateur peut modifier le rôle']
            })
            
        serializer.save()

    def perform_create(self, serializer):
        """
        Lors de la création d'un plan:
        - Le créateur est toujours l'utilisateur courant
        - Vérifie l'existence et la validité des relations usine/concessionnaire/agriculteur
        - Pour un concessionnaire, vérifie que l'agriculteur lui appartient
        - Pour un agriculteur, il est automatiquement assigné comme agriculteur
        """
        user = self.request.user
        data = {}

        # Validation des relations
        usine = serializer.validated_data.get('usine')
        concessionnaire = serializer.validated_data.get('concessionnaire')
        agriculteur = serializer.validated_data.get('agriculteur')

        print(f"[PlanViewSet] perform_create - Données validées: {serializer.validated_data}")

        # Vérifier l'existence de l'usine
        if usine:
            if usine.role != ROLE_USINE:
                raise ValidationError({'usine': 'L\'utilisateur sélectionné n\'est pas une usine'})

        # Vérifier l'existence du concessionnaire
        if concessionnaire:
            if concessionnaire.role != ROLE_DEALER:
                raise ValidationError({'concessionnaire': 'L\'utilisateur sélectionné n\'est pas un concessionnaire'})
            # Vérifier que le concessionnaire appartient à l'usine
            if usine and concessionnaire.usine != usine:
                raise ValidationError({'concessionnaire': 'Ce concessionnaire n\'appartient pas à l\'usine sélectionnée'})

        # Vérifier l'existence de l'agriculteur
        if agriculteur:
            if agriculteur.role != ROLE_AGRICULTEUR:
                raise ValidationError({'agriculteur': 'L\'utilisateur sélectionné n\'est pas un agriculteur'})
            # Vérifier que l'agriculteur appartient au concessionnaire
            if concessionnaire and agriculteur.concessionnaire != concessionnaire:
                raise ValidationError({'agriculteur': 'Cet agriculteur n\'appartient pas au concessionnaire sélectionné'})

        # Gestion selon le rôle de l'utilisateur
        if user.role == ROLE_DEALER:
            if not agriculteur:
                raise ValidationError({'agriculteur': 'Un agriculteur doit être spécifié'})
            data['concessionnaire'] = user
            data['usine'] = user.usine
        elif user.role == ROLE_AGRICULTEUR:
            data['agriculteur'] = user
            data['concessionnaire'] = user.concessionnaire
            data['usine'] = user.usine
        else:
            # Pour admin et usine, utiliser les valeurs validées
            data['usine'] = usine
            data['concessionnaire'] = concessionnaire
            data['agriculteur'] = agriculteur

        print(f"[PlanViewSet] perform_create - Données finales: {data}")
        serializer.save(createur=user, **data)

    def perform_update(self, serializer):
        """
        Lors de la mise à jour d'un plan:
        - Vérifie les permissions selon le rôle
        - Maintient la cohérence des relations client/concessionnaire
        - Si un client est retiré, il perd l'accès au plan
        - Si un concessionnaire est retiré, il perd l'accès au plan et le client aussi
        """
        instance = serializer.instance
        user = self.request.user

        if user.role == ROLE_DEALER and instance.concessionnaire != user:
            raise PermissionDenied("Vous ne pouvez pas modifier les plans d'autres concessionnaires")
        elif user.role == ROLE_AGRICULTEUR and instance.agriculteur != user:
            raise PermissionDenied("Vous ne pouvez pas modifier ce plan")

        # Si le concessionnaire est retiré, retirer aussi le client
        if 'concessionnaire' in serializer.validated_data and not serializer.validated_data['concessionnaire']:
            serializer.validated_data['agriculteur'] = None

        serializer.save()

    @action(detail=True, methods=['post'])
    @transaction.atomic
    def save_with_elements(self, request, pk=None):
        """
        Sauvegarde un plan avec ses formes géométriques, connexions et annotations
        """
        plan = self.get_object()
        
        # Vérifier les permissions
        if (plan.createur != request.user and 
            request.user.role not in [ROLE_ADMIN, ROLE_DEALER] and
            (request.user.role == ROLE_DEALER and plan.createur.concessionnaire != request.user)):
            return Response(
                {'detail': 'Vous n\'avez pas la permission de modifier ce plan'},
                status=status.HTTP_403_FORBIDDEN
            )

        # Récupérer les données des éléments
        formes_data = request.data.get('formes', [])
        connexions_data = request.data.get('connexions', [])
        annotations_data = request.data.get('annotations', [])
        
        # Récupérer les identifiants des éléments à supprimer
        elements_to_delete = request.data.get('elementsToDelete', [])
        
        # Log pour debugging
        print(f"Plan {pk} - Sauvegarde - Éléments: {len(formes_data)}, À supprimer: {len(elements_to_delete)}")

        try:
            # Supprimer les éléments existants si demandé
            if request.data.get('clear_existing', False):
                plan.formes.all().delete()
                plan.connexions.all().delete()
                plan.annotations.all().delete()
            
            # Supprimer les éléments spécifiques demandés
            if elements_to_delete:
                # Sécuriser: ne supprimer que les éléments appartenant à ce plan
                FormeGeometrique.objects.filter(
                    id__in=elements_to_delete,
                    plan=plan
                ).delete()
                print(f"Plan {pk} - {len(elements_to_delete)} éléments supprimés")

            # Créer/Mettre à jour les formes
            for forme_data in formes_data:
                forme_id = forme_data.pop('id', None)
                
                # Valider les données de la forme selon son type
                type_forme = forme_data.get('type_forme')
                data = forme_data.get('data', {})
                
                # Ajouter les styles par défaut si nécessaire
                if 'style' not in data:
                    data['style'] = {
                        'color': '#3388ff',
                        'fillColor': '#3388ff',
                        'fillOpacity': 0.2,
                        'weight': 3,
                        'opacity': 1
                    }
                
                # Mettre à jour ou créer la forme
                if forme_id:
                    try:
                        forme = FormeGeometrique.objects.get(id=forme_id, plan=plan)
                        forme.type_forme = type_forme
                        forme.data = data
                        forme.save()
                    except FormeGeometrique.DoesNotExist:
                        # Si l'ID n'existe pas, créer une nouvelle forme
                        FormeGeometrique.objects.create(
                            plan=plan,
                            type_forme=type_forme,
                            data=data
                        )
                else:
                    FormeGeometrique.objects.create(
                        plan=plan,
                        type_forme=type_forme,
                        data=data
                    )

            # Créer/Mettre à jour les connexions
            for connexion_data in connexions_data:
                connexion_id = connexion_data.pop('id', None)
                if connexion_id:
                    connexion = get_object_or_404(Connexion, id=connexion_id, plan=plan)
                    serializer = ConnexionSerializer(connexion, data=connexion_data)
                else:
                    serializer = ConnexionSerializer(data=connexion_data)
                
                serializer.is_valid(raise_exception=True)
                serializer.save(plan=plan)

            # Créer/Mettre à jour les annotations
            for annotation_data in annotations_data:
                annotation_id = annotation_data.pop('id', None)
                if annotation_id:
                    annotation = get_object_or_404(TexteAnnotation, id=annotation_id, plan=plan)
                    serializer = TexteAnnotationSerializer(annotation, data=annotation_data)
                else:
                    serializer = TexteAnnotationSerializer(data=annotation_data)
                
                serializer.is_valid(raise_exception=True)
                serializer.save(plan=plan)

            # Sauvegarder les préférences si elles sont fournies
            preferences = request.data.get('preferences')
            if preferences:
                plan.preferences = preferences
                plan.save(update_fields=['preferences'])

            # Forcer la mise à jour de la date de modification
            plan.touch()

            # Retourner le plan mis à jour avec tous ses éléments
            serializer = PlanDetailSerializer(plan)
            return Response(serializer.data)

        except Exception as e:
            # En cas d'erreur, annuler toutes les modifications (transaction.atomic)
            return Response(
                {'detail': f'Erreur lors de la sauvegarde: {str(e)}'},
                status=status.HTTP_400_BAD_REQUEST
            )

class DealerViewSet(viewsets.ModelViewSet):
    queryset = User.objects.filter(role=ROLE_DEALER)
    serializer_class = DealerSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        if user.role == ROLE_ADMIN:
            return User.objects.filter(role=ROLE_DEALER)
        return User.objects.none()

    @action(detail=True, methods=['get'])
    def clients(self, request, pk=None):
        """
        Récupère la liste des clients d'un concessionnaire.
        """
        dealer = self.get_object()
        if request.user.role == ROLE_ADMIN or request.user == dealer:
            clients = User.objects.filter(concessionnaire=dealer, role=ROLE_AGRICULTEUR)
            serializer = ClientSerializer(clients, many=True)
            return Response(serializer.data)
        return Response(
            {'detail': 'Vous n\'avez pas la permission d\'accéder à ces données.'},
            status=status.HTTP_403_FORBIDDEN
        )

    def perform_create(self, serializer):
        serializer.save(role=ROLE_DEALER)

class ClientViewSet(viewsets.ModelViewSet):
    serializer_class = ClientSerializer
    permission_classes = [permissions.IsAuthenticated, IsDealer]

    def get_queryset(self):
        user = self.request.user
        if user.role == 'ADMIN':
            return User.objects.filter(role='AGRICULTEUR')
        elif user.role == 'CONCESSIONNAIRE':
            return User.objects.filter(concessionnaire=user, role='AGRICULTEUR')
        return User.objects.none()

    def perform_create(self, serializer):
        if self.request.user.role == 'CONCESSIONNAIRE':
            serializer.save(role='AGRICULTEUR', concessionnaire=self.request.user)
        else:
            serializer.save(role='AGRICULTEUR')

class PlanViewSet(viewsets.ModelViewSet):
    """
    ViewSet pour gérer les plans d'irrigation.
    """
    serializer_class = PlanSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        """
        Filtre les plans selon:
        - Admin : tous les plans ou filtrés par concessionnaire/agriculteur
        - Usine : plans où l'usine est assignée ou liée à ses concessionnaires
        - Concessionnaire : uniquement ses plans ou ceux de ses agriculteurs
        - Agriculteur : uniquement ses plans
        """
        user = self.request.user
        base_queryset = Plan.objects.all()

        # Récupérer les paramètres de filtrage
        concessionnaire_id = self.request.query_params.get('concessionnaire')
        agriculteur_id = self.request.query_params.get('agriculteur')
        usine_id = self.request.query_params.get('usine')

        if user.role == ROLE_ADMIN:
            if concessionnaire_id:
                base_queryset = base_queryset.filter(concessionnaire_id=concessionnaire_id)
            if agriculteur_id:
                base_queryset = base_queryset.filter(agriculteur_id=agriculteur_id)
            if usine_id:
                base_queryset = base_queryset.filter(usine_id=usine_id)
            return base_queryset
        elif user.role == ROLE_USINE:
            # Une usine peut voir les plans où elle est assignée directement
            # ou liés à ses concessionnaires et leurs agriculteurs
            base_queryset = base_queryset.filter(
                Q(usine=user) |  # Plans directement liés à l'usine
                Q(concessionnaire__usine=user) |  # Plans liés aux concessionnaires de l'usine
                Q(agriculteur__concessionnaire__usine=user)  # Plans liés aux agriculteurs des concessionnaires de l'usine
            )
            
            # Filtres additionnels si spécifiés
            if concessionnaire_id:
                base_queryset = base_queryset.filter(concessionnaire_id=concessionnaire_id)
            if agriculteur_id:
                base_queryset = base_queryset.filter(agriculteur_id=agriculteur_id)
                
            return base_queryset
        elif user.role == ROLE_DEALER:
            # Filtrer d'abord par le concessionnaire connecté
            base_queryset = base_queryset.filter(concessionnaire=user)
            # Si un agriculteur est spécifié, filtrer par cet agriculteur
            if agriculteur_id:
                base_queryset = base_queryset.filter(agriculteur_id=agriculteur_id)
            return base_queryset
        else:  # agriculteur
            return base_queryset.filter(agriculteur=user)

    def get_serializer_class(self):
        """
        Retourne le serializer approprié selon le contexte.
        """
        print(f"[PlanViewSet] get_serializer_class - Action: {self.action}, Params: {self.request.query_params}")
        
        # Si l'action est 'list' et que le paramètre include_details est True, utiliser PlanDetailSerializer
        if self.action == 'list' and self.request.query_params.get('include_details') == 'true':
            print("[PlanViewSet] Utilisation de PlanDetailSerializer pour la liste avec détails")
            return PlanDetailSerializer
        elif self.action in ['retrieve', 'update', 'partial_update', 'save_with_elements']:
            print(f"[PlanViewSet] Utilisation de PlanDetailSerializer pour {self.action}")
            return PlanDetailSerializer
        
        print(f"[PlanViewSet] Utilisation de PlanSerializer par défaut pour {self.action}")
        return PlanSerializer

class FormeGeometriqueViewSet(viewsets.ModelViewSet):
    """
    ViewSet pour gérer les formes géométriques.
    """
    serializer_class = FormeGeometriqueSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        """
        Ne retourne que les formes des plans accessibles à l'utilisateur
        """
        user = self.request.user
        if user.role == ROLE_ADMIN:
            return FormeGeometrique.objects.all()
        elif user.role == ROLE_DEALER:
            return FormeGeometrique.objects.filter(
                plan__createur__in=[user.id] + list(user.utilisateurs.values_list('id', flat=True))
            )
        else:  # client
            return FormeGeometrique.objects.filter(plan__createur=user)

    def perform_create(self, serializer):
        """
        Vérifie que l'utilisateur a le droit de créer une forme sur ce plan
        """
        plan = serializer.validated_data['plan']
        user = self.request.user
        
        if plan.createur != user and user.role not in ['admin', 'dealer']:
            raise PermissionError('Vous n\'avez pas la permission de modifier ce plan')
        
        serializer.save()

class ConnexionViewSet(viewsets.ModelViewSet):
    """
    ViewSet pour gérer les connexions entre formes.
    """
    serializer_class = ConnexionSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        if user.role == 'admin':
            return Connexion.objects.all()
        elif user.role == 'dealer':
            return Connexion.objects.filter(
                plan__createur__in=[user.id] + list(user.clients.values_list('id', flat=True))
            )
        else:  # client
            return Connexion.objects.filter(plan__createur=user)

class TexteAnnotationViewSet(viewsets.ModelViewSet):
    """
    ViewSet pour gérer les annotations textuelles.
    """
    serializer_class = TexteAnnotationSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        if user.role == 'admin':
            return TexteAnnotation.objects.all()
        elif user.role == 'dealer':
            return TexteAnnotation.objects.filter(
                plan__createur__in=[user.id] + list(user.clients.values_list('id', flat=True))
            )
        else:  # client
            return TexteAnnotation.objects.filter(plan__createur=user)

@api_view(['POST'])
def elevation_proxy(request):
    """
    Proxy pour les requêtes d'élévation vers l'API Open-Elevation.
    """
    try:
        points = request.data.get('points', [])
        
        # Reformater les points pour l'API Open-Elevation
        try:
            locations = [
                {
                    'latitude': float(point['latitude']),
                    'longitude': float(point['longitude'])
                }
                for point in points
            ]
        except (KeyError, TypeError, ValueError) as e:
            return Response(
                {'error': f'Format de données invalide: {str(e)}'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Appel à l'API Open-Elevation
        response = requests.post(
            'https://api.open-elevation.com/api/v1/lookup',
            json={'locations': locations}
        )
        
        if response.status_code == 200:
            return Response(response.json())
        
        # Si l'API principale échoue, essayer l'API de fallback
        fallback_response = requests.post(
            'https://elevation-api.io/api/elevation',
            json={'points': [{'lat': p['latitude'], 'lng': p['longitude']} for p in points]}
        )
        
        if fallback_response.status_code == 200:
            # Reformater la réponse pour correspondre au format attendu
            elevation_data = fallback_response.json()
            results = [
                {
                    'latitude': points[i]['latitude'],
                    'longitude': points[i]['longitude'],
                    'elevation': e['elevation']
                }
                for i, e in enumerate(elevation_data['elevations'])
            ]
            return Response({'results': results})
        
        return Response(
            {'error': 'Les services d\'élévation sont indisponibles'},
            status=status.HTTP_503_SERVICE_UNAVAILABLE
        )
        
    except Exception as e:
        print("Erreur complète:", str(e))
        return Response(
            {'error': str(e)},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )
