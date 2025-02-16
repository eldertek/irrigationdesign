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
    TexteAnnotationSerializer
)
from .permissions import IsAdmin, IsDealer
from django.contrib.auth import get_user_model
from plans.models import Plan, FormeGeometrique, Connexion, TexteAnnotation
import requests

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
    queryset = Plan.objects.all()
    serializer_class = PlanSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        if user.role == 'admin':
            return Plan.objects.all()
        elif user.role == 'dealer':
            return Plan.objects.filter(
                Q(createur=user) | Q(createur__concessionnaire=user)
            )
        return Plan.objects.filter(createur=user)

    def perform_create(self, serializer):
        serializer.save(createur=self.request.user)

class FormeGeometriqueViewSet(viewsets.ModelViewSet):
    queryset = FormeGeometrique.objects.all()
    serializer_class = FormeGeometriqueSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return FormeGeometrique.objects.filter(plan__createur=self.request.user)

class ConnexionViewSet(viewsets.ModelViewSet):
    queryset = Connexion.objects.all()
    serializer_class = ConnexionSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return Connexion.objects.filter(plan__createur=self.request.user)

class TexteAnnotationViewSet(viewsets.ModelViewSet):
    queryset = TexteAnnotation.objects.all()
    serializer_class = TexteAnnotationSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return TexteAnnotation.objects.filter(plan__createur=self.request.user)

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
