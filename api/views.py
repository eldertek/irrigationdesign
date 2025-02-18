from django.shortcuts import render
from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action, api_view
from rest_framework.response import Response
from django.db.models import Q
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
from .permissions import IsAdmin, IsDealer
from django.contrib.auth import get_user_model
from plans.models import Plan, FormeGeometrique, Connexion, TexteAnnotation
import requests
from django.db import transaction
from django.shortcuts import get_object_or_404

User = get_user_model()

# Create your views here.

class UserViewSet(viewsets.ModelViewSet):
    queryset = User.objects.all()
    serializer_class = UserSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        if user.role == 'admin':
            return User.objects.all()
        elif user.role == 'dealer':
            return User.objects.filter(concessionnaire=user)
        return User.objects.filter(id=user.id)

    def get_permissions(self):
        if self.action in ['create', 'update', 'partial_update', 'destroy']:
            self.permission_classes = [IsAdmin]
        return super().get_permissions()

class DealerViewSet(viewsets.ModelViewSet):
    queryset = User.objects.filter(role='dealer')
    serializer_class = DealerSerializer
    permission_classes = [IsAdmin]

    def perform_create(self, serializer):
        serializer.save(role='dealer')

    @action(detail=True, methods=['get'])
    def clients(self, request, pk=None):
        dealer = self.get_object()
        clients = User.objects.filter(concessionnaire=dealer)
        serializer = ClientSerializer(clients, many=True)
        return Response(serializer.data)

class ClientViewSet(viewsets.ModelViewSet):
    serializer_class = ClientSerializer
    permission_classes = [permissions.IsAuthenticated, IsDealer]

    def get_queryset(self):
        user = self.request.user
        if user.role == 'admin':
            return User.objects.filter(role='client')
        elif user.role == 'dealer':
            return User.objects.filter(concessionnaire=user, role='client')
        return User.objects.none()

    def perform_create(self, serializer):
        if self.request.user.role == 'dealer':
            serializer.save(role='client', concessionnaire=self.request.user)
        else:
            serializer.save(role='client')

class PlanViewSet(viewsets.ModelViewSet):
    """
    ViewSet pour gérer les plans d'irrigation.
    """
    serializer_class = PlanSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        """
        Filtre les plans selon le rôle de l'utilisateur :
        - Admin : tous les plans
        - Dealer : ses plans et ceux de ses clients
        - Client : uniquement ses plans
        """
        user = self.request.user
        if user.role == 'admin':
            return Plan.objects.all()
        elif user.role == 'dealer':
            # Récupérer les plans du dealer et de ses clients
            return Plan.objects.filter(
                createur__in=[user.id] + list(user.clients.values_list('id', flat=True))
            )
        else:  # client
            return Plan.objects.filter(createur=user)

    def get_serializer_class(self):
        """
        Utilise un sérialiseur différent pour les détails d'un plan
        """
        if self.action in ['retrieve', 'create', 'update', 'partial_update']:
            return PlanDetailSerializer
        return self.serializer_class

    def perform_create(self, serializer):
        """
        Associe automatiquement le créateur au plan
        """
        serializer.save(createur=self.request.user)

    @action(detail=True, methods=['post'])
    @transaction.atomic
    def save_with_elements(self, request, pk=None):
        """
        Sauvegarde un plan avec ses formes géométriques, connexions et annotations
        """
        plan = self.get_object()
        
        # Vérifier les permissions
        if plan.createur != request.user and request.user.role not in ['admin', 'dealer']:
            return Response(
                {'detail': 'Vous n\'avez pas la permission de modifier ce plan'},
                status=status.HTTP_403_FORBIDDEN
            )

        # Récupérer les données des éléments
        formes_data = request.data.get('formes', [])
        connexions_data = request.data.get('connexions', [])
        annotations_data = request.data.get('annotations', [])

        try:
            # Supprimer les éléments existants si demandé
            if request.data.get('clear_existing', False):
                plan.formes.all().delete()
                plan.connexions.all().delete()
                plan.annotations.all().delete()

            # Créer/Mettre à jour les formes
            for forme_data in formes_data:
                forme_id = forme_data.pop('id', None)
                if forme_id:
                    forme = get_object_or_404(FormeGeometrique, id=forme_id, plan=plan)
                    serializer = FormeGeometriqueSerializer(forme, data=forme_data)
                else:
                    serializer = FormeGeometriqueSerializer(data=forme_data)
                
                serializer.is_valid(raise_exception=True)
                serializer.save(plan=plan)

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

            # Retourner le plan mis à jour avec tous ses éléments
            serializer = PlanDetailSerializer(plan)
            return Response(serializer.data)

        except Exception as e:
            # En cas d'erreur, annuler toutes les modifications (transaction.atomic)
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
        if user.role == 'admin':
            return FormeGeometrique.objects.all()
        elif user.role == 'dealer':
            return FormeGeometrique.objects.filter(
                plan__createur__in=[user.id] + list(user.clients.values_list('id', flat=True))
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
