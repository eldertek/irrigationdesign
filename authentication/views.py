from django.shortcuts import render
from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action
from rest_framework.response import Response
from django.contrib.auth import get_user_model
from .serializers import UserSerializer, DealerListSerializer
from rest_framework_simplejwt.views import TokenObtainPairView
from django.shortcuts import get_object_or_404

User = get_user_model()

class IsAdminOrDealer(permissions.BasePermission):
    """Permission personnalisée pour les administrateurs et les concessionnaires."""
    
    def has_permission(self, request, view):
        if not request.user.is_authenticated:
            return False
        return request.user.role in ['ADMIN', 'CONCESSIONNAIRE']

    def has_object_permission(self, request, view, obj):
        if request.user.role == 'ADMIN':
            return True
        if request.user.role == 'CONCESSIONNAIRE':
            # Le concessionnaire ne peut voir/modifier que ses utilisateurs
            return obj.concessionnaire == request.user
        return False

class UserViewSet(viewsets.ModelViewSet):
    """
    ViewSet pour la gestion des utilisateurs.
    Permet la création, la modification et la suppression d'utilisateurs
    avec gestion des permissions selon le rôle.
    """
    serializer_class = UserSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        """Retourne la liste des utilisateurs selon le rôle de l'utilisateur connecté."""
        user = self.request.user
        if user.role == 'ADMIN':
            return User.objects.all()
        elif user.role == 'CONCESSIONNAIRE':
            return User.objects.filter(concessionnaire=user)
        return User.objects.filter(id=user.id)

    def get_permissions(self):
        """Définit les permissions selon l'action."""
        if self.action in ['create', 'destroy', 'list']:
            permission_classes = [IsAdminOrDealer]
        else:
            permission_classes = [permissions.IsAuthenticated]
        return [permission() for permission in permission_classes]

    @action(detail=False, methods=['get'])
    def me(self, request):
        """Retourne les informations de l'utilisateur connecté."""
        serializer = self.get_serializer(request.user)
        return Response(serializer.data)

    @action(detail=False, methods=['get'])
    def dealers(self, request):
        """Retourne la liste des concessionnaires."""
        dealers = User.objects.filter(role='CONCESSIONNAIRE')
        serializer = DealerListSerializer(dealers, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=['post'])
    def set_dealer(self, request, pk=None):
        """Associe un concessionnaire à un utilisateur."""
        user = self.get_object()
        dealer_id = request.data.get('dealer_id')
        
        if not dealer_id:
            return Response(
                {'error': 'dealer_id est requis'},
                status=status.HTTP_400_BAD_REQUEST
            )

        dealer = get_object_or_404(User, id=dealer_id, role='CONCESSIONNAIRE')
        
        # Vérifie les permissions
        if request.user.role not in ['ADMIN', 'CONCESSIONNAIRE']:
            return Response(
                {'error': 'Permission refusée'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        if request.user.role == 'CONCESSIONNAIRE' and request.user != dealer:
            return Response(
                {'error': 'Un concessionnaire ne peut assigner que lui-même'},
                status=status.HTTP_403_FORBIDDEN
            )

        user.concessionnaire = dealer
        user.save()
        
        serializer = self.get_serializer(user)
        return Response(serializer.data)

    @action(detail=True, methods=['post'])
    def change_password(self, request, pk=None):
        """Change le mot de passe d'un utilisateur."""
        user = self.get_object()
        serializer = self.get_serializer(user, data=request.data, partial=True)
        
        if serializer.is_valid():
            serializer.save()
            return Response({'message': 'Mot de passe modifié avec succès'})
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

class CustomTokenObtainPairView(TokenObtainPairView):
    """Vue personnalisée pour l'obtention du token avec vérification du rôle."""
    
    def post(self, request, *args, **kwargs):
        response = super().post(request, *args, **kwargs)
        
        if response.status_code == 200:
            user = User.objects.get(username=request.data['username'])
            response.data['user'] = UserSerializer(user).data
            
        return response
