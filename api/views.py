from django.shortcuts import render
from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action, api_view
from rest_framework.response import Response
from django.db.models import Q, Count
from .serializers import (
    UserSerializer,
    ConcessionnaireSerializer,
    ClientSerializer,
    PlanSerializer,
    FormeGeometriqueSerializer,
    ConnexionSerializer,
    TexteAnnotationSerializer,
    PlanDetailSerializer
)
from .permissions import IsAdmin, IsConcessionnaire, IsUsine
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
        """
        Filtre les utilisateurs selon:
        - Admin : tous les utilisateurs ou filtrés par rôle/usine/concessionnaire
        - Usine : ses concessionnaires et leurs agriculteurs
        - Concessionnaire : ses agriculteurs
        - Agriculteur : lui-même
        """
        user = self.request.user
        base_queryset = User.objects.annotate(plans_count=Count('plans'))
        
        # Récupérer les paramètres de filtrage
        role = self.request.query_params.get('role')
        usine_id = self.request.query_params.get('usine')
        concessionnaire_id = self.request.query_params.get('concessionnaire')
        
        print(f"\n[UserViewSet][get_queryset] ====== DÉBUT REQUÊTE ======")
        print(f"Utilisateur connecté: {user.username} (role: {user.role}, id: {user.id})")
        print(f"Paramètres reçus:")
        print(f"- role demandé: {role}")
        print(f"- usine_id: {usine_id}")
        print(f"- concessionnaire_id: {concessionnaire_id}")
        
        # Appliquer les filtres de base selon le rôle demandé
        if role:
            print(f"\nApplication du filtre de rôle: {role}")
            base_queryset = base_queryset.filter(role=role)
            print(f"Nombre d'utilisateurs après filtre de rôle: {base_queryset.count()}")

        # Filtrer selon le rôle de l'utilisateur connecté
        if user.role == ROLE_ADMIN:
            print("\nTraitement pour ADMIN")
            if usine_id:
                if role == ROLE_DEALER:
                    print(f"Filtrage des concessionnaires pour l'usine {usine_id}")
                    base_queryset = base_queryset.filter(usine_id=usine_id)
                elif role == ROLE_AGRICULTEUR:
                    print(f"Filtrage des agriculteurs pour l'usine {usine_id}")
                    base_queryset = base_queryset.filter(concessionnaire__usine_id=usine_id)
            if concessionnaire_id:
                print(f"Filtrage par concessionnaire: {concessionnaire_id}")
                base_queryset = base_queryset.filter(concessionnaire_id=concessionnaire_id)
        
        elif user.role == ROLE_USINE:
            print("\nTraitement pour USINE")
            if role == ROLE_DEALER:
                print("Filtrage des concessionnaires de l'usine")
                base_queryset = base_queryset.filter(usine=user)
            elif role == ROLE_AGRICULTEUR:
                print("Filtrage des agriculteurs de l'usine")
                base_queryset = base_queryset.filter(concessionnaire__usine=user)
                if concessionnaire_id:
                    print(f"Filtrage supplémentaire par concessionnaire: {concessionnaire_id}")
                    base_queryset = base_queryset.filter(concessionnaire_id=concessionnaire_id)
                    
                # Debug des agriculteurs trouvés
                agriculteurs = base_queryset.values('id', 'username', 'first_name', 'last_name', 'concessionnaire__username')
                print("\nAgriculteurs trouvés:")
                for agri in agriculteurs:
                    print(f"- {agri['username']} (ID: {agri['id']}, Concessionnaire: {agri['concessionnaire__username']})")
        
        elif user.role == ROLE_DEALER:
            print("\nTraitement pour CONCESSIONNAIRE")
            if role == ROLE_AGRICULTEUR:
                print("Filtrage des agriculteurs du concessionnaire")
                base_queryset = base_queryset.filter(concessionnaire=user)
            else:
                base_queryset = base_queryset.filter(id=user.id)
        
        else:  # ROLE_AGRICULTEUR
            print("\nTraitement pour AGRICULTEUR")
            base_queryset = base_queryset.filter(id=user.id)

        print(f"\nRequête SQL finale: {base_queryset.query}")
        result = base_queryset.distinct()
        print(f"Nombre total de résultats: {result.count()}")
        print("[UserViewSet][get_queryset] ====== FIN REQUÊTE ======\n")
        return result

    def get_permissions(self):
        if self.action == 'create':
            self.permission_classes = [permissions.IsAuthenticated, IsAdmin | IsUsine | IsConcessionnaire]
        elif self.action in ['update', 'partial_update', 'destroy']:
            self.permission_classes = [permissions.IsAuthenticated, IsAdmin | IsUsine | IsConcessionnaire]
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

class ConcessionnaireViewSet(viewsets.ModelViewSet):
    queryset = User.objects.filter(role=ROLE_DEALER)
    serializer_class = ConcessionnaireSerializer
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
        concessionnaire = self.get_object()
        if request.user.role == ROLE_ADMIN or request.user == concessionnaire:
            clients = User.objects.filter(concessionnaire=concessionnaire, role=ROLE_AGRICULTEUR)
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
    permission_classes = [permissions.IsAuthenticated, IsConcessionnaire]

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

    @action(detail=True, methods=['post'])
    @transaction.atomic
    def save_with_elements(self, request, pk=None):
        """
        Sauvegarde un plan avec ses formes géométriques, connexions et annotations
        """
        print(f"\n[PlanViewSet][save_with_elements] Début de la sauvegarde - Plan ID: {pk}")
        print(f"[PlanViewSet][save_with_elements] URL de la requête: {request.path}")
        print(f"[PlanViewSet][save_with_elements] Méthode: {request.method}")
        print(f"[PlanViewSet][save_with_elements] User: {request.user.username} (role: {request.user.role})")
        
        try:
            plan = self.get_object()
            print(f"[PlanViewSet][save_with_elements] Plan trouvé: {plan.id} - {plan.nom}")
        except Exception as e:
            print(f"[PlanViewSet][save_with_elements] ERREUR lors de la récupération du plan: {str(e)}")
            raise
        
        # Vérifier les permissions
        if (plan.createur != request.user and 
            request.user.role not in [ROLE_ADMIN, ROLE_DEALER] and
            (request.user.role == ROLE_DEALER and plan.createur.concessionnaire != request.user)):
            print(f"[PlanViewSet][save_with_elements] Permission refusée pour l'utilisateur {request.user.username}")
            return Response(
                {'detail': 'Vous n\'avez pas la permission de modifier ce plan'},
                status=status.HTTP_403_FORBIDDEN
            )

        # Récupérer les données des éléments
        formes_data = request.data.get('formes', [])
        connexions_data = request.data.get('connexions', [])
        annotations_data = request.data.get('annotations', [])
        elements_to_delete = request.data.get('elementsToDelete', [])
        
        print(f"[PlanViewSet][save_with_elements] Données reçues:")
        print(f"- Formes: {len(formes_data)} éléments")
        print(f"- Connexions: {len(connexions_data)} éléments")
        print(f"- Annotations: {len(annotations_data)} éléments")
        print(f"- Éléments à supprimer: {elements_to_delete}")
        
        try:
            # Supprimer les éléments existants si demandé
            if request.data.get('clear_existing', False):
                print("[PlanViewSet][save_with_elements] Suppression de tous les éléments existants")
                plan.formes.all().delete()
                plan.connexions.all().delete()
                plan.annotations.all().delete()
            
            # Supprimer les éléments spécifiques demandés
            if elements_to_delete:
                print(f"[PlanViewSet][save_with_elements] Suppression des éléments: {elements_to_delete}")
                deleted_count = FormeGeometrique.objects.filter(
                    id__in=elements_to_delete,
                    plan=plan
                ).delete()[0]
                print(f"[PlanViewSet][save_with_elements] {deleted_count} éléments supprimés")

            # Créer/Mettre à jour les formes
            for forme_data in formes_data:
                forme_id = forme_data.pop('id', None)
                type_forme = forme_data.get('type_forme')
                data = forme_data.get('data', {})
                
                print(f"[PlanViewSet][save_with_elements] Traitement forme: ID={forme_id}, Type={type_forme}")
                
                if forme_id:
                    try:
                        forme = FormeGeometrique.objects.get(id=forme_id, plan=plan)
                        print(f"[PlanViewSet][save_with_elements] Mise à jour forme existante: {forme_id}")
                        forme.type_forme = type_forme
                        forme.data = data
                        forme.save()
                    except FormeGeometrique.DoesNotExist:
                        print(f"[PlanViewSet][save_with_elements] Forme {forme_id} non trouvée, création d'une nouvelle")
                        FormeGeometrique.objects.create(
                            plan=plan,
                            type_forme=type_forme,
                            data=data
                        )
                else:
                    print("[PlanViewSet][save_with_elements] Création d'une nouvelle forme")
                    FormeGeometrique.objects.create(
                        plan=plan,
                        type_forme=type_forme,
                        data=data
                    )

            # Sauvegarder les préférences
            if preferences := request.data.get('preferences'):
                print("[PlanViewSet][save_with_elements] Mise à jour des préférences")
                plan.preferences = preferences
                plan.save(update_fields=['preferences'])

            # Forcer la mise à jour de la date de modification
            plan.touch()
            print("[PlanViewSet][save_with_elements] Sauvegarde réussie")

            # Retourner le plan mis à jour
            serializer = PlanDetailSerializer(plan)
            return Response(serializer.data)

        except Exception as e:
            print(f"[PlanViewSet][save_with_elements] ERREUR lors de la sauvegarde: {str(e)}")
            print(f"[PlanViewSet][save_with_elements] Type d'erreur: {type(e)}")
            import traceback
            print(f"[PlanViewSet][save_with_elements] Traceback:\n{traceback.format_exc()}")
            return Response(
                {'detail': f'Erreur lors de la sauvegarde: {str(e)}'},
                status=status.HTTP_400_BAD_REQUEST
            )

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
        
        if plan.createur != user and user.role not in ['admin', 'concessionnaire']:
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
        elif user.role == 'concessionnaire':
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
        elif user.role == 'concessionnaire':
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
