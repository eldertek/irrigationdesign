from django.shortcuts import render, redirect
from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action
from rest_framework.response import Response
from django.contrib.auth import get_user_model
from .serializers import UserSerializer, ConcessionnaireListSerializer
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView
from django.shortcuts import get_object_or_404
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.exceptions import TokenError, InvalidToken
from django.views.generic import TemplateView
from django.contrib.auth.mixins import LoginRequiredMixin, UserPassesTestMixin
from django.http import JsonResponse
from django.db.models import Q

User = get_user_model()

class IsAdminOrConcessionnaireOrUsine(permissions.BasePermission):
    """Permission personnalisée pour les administrateurs, les concessionnaires et les usines."""
    
    def has_permission(self, request, view):
        if not request.user.is_authenticated:
            return False
        return request.user.role in ['ADMIN', 'CONCESSIONNAIRE', 'USINE']

    def has_object_permission(self, request, view, obj):
        if request.user.role == 'ADMIN':
            return True
        if request.user.role == 'USINE':
            # L'usine peut gérer ses concessionnaires et leurs agriculteurs
            return (obj.role == 'CONCESSIONNAIRE' and obj.usine == request.user) or \
                   (obj.role == 'AGRICULTEUR' and obj.concessionnaire and obj.concessionnaire.usine == request.user)
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
        """Retourne la liste des utilisateurs selon le rôle de l'utilisateur connecté et les filtres."""
        user = self.request.user
        queryset = User.objects.all()

        # Appliquer les restrictions selon le rôle de l'utilisateur
        if user.role == 'ADMIN':
            base_queryset = queryset
        elif user.role == 'USINE':
            # Une usine peut voir ses concessionnaires et les agriculteurs de ses concessionnaires
            base_queryset = queryset.filter(
                Q(usine=user) |  # Ses concessionnaires
                Q(concessionnaire__usine=user)  # Les agriculteurs de ses concessionnaires
            )
        elif user.role == 'CONCESSIONNAIRE':
            base_queryset = queryset.filter(Q(id=user.id) | Q(concessionnaire=user))
        else:
            base_queryset = queryset.filter(id=user.id)
        
        # Filtrer par rôle si spécifié
        role = self.request.query_params.get('role')
        if role:
            # Cas spécial: usine recherchant des agriculteurs
            if user.role == 'USINE' and role == 'AGRICULTEUR':
                # On doit utiliser une requête spécifique qui cherche
                # les agriculteurs liés aux concessionnaires de l'usine
                result = queryset.filter(
                    role='AGRICULTEUR',
                    concessionnaire__usine=user
                )
            else:
                # Cas standard: on filtre le résultat de base par rôle
                result = base_queryset.filter(role=role)
        else:
            # Si pas de filtre de rôle, on utilise le queryset de base
            result = base_queryset

        # Filtrer par concessionnaire si spécifié
        concessionnaire_id = self.request.query_params.get('concessionnaire')
        if concessionnaire_id:
            result = result.filter(concessionnaire_id=concessionnaire_id)
            
        # Filtrer par usine si spécifié
        usine_id = self.request.query_params.get('usine')
        if usine_id:
            # Adaptons ce filtre selon le rôle demandé
            if role == 'AGRICULTEUR':
                # Pour les agriculteurs, on doit chercher ceux dont le concessionnaire
                # est lié à l'usine spécifiée
                result = result.filter(concessionnaire__usine_id=usine_id)
            else:
                # Pour les autres rôles, filtre direct par usine
                result = result.filter(usine_id=usine_id)

        return result.distinct()  # Assure qu'il n'y a pas de doublons

    def get_permissions(self):
        """Définit les permissions selon l'action."""
        if self.action in ['create', 'destroy', 'list']:
            permission_classes = [IsAdminOrConcessionnaireOrUsine]
        else:
            permission_classes = [permissions.IsAuthenticated]
        return [permission() for permission in permission_classes]

    @action(detail=False, methods=['get'])
    def me(self, request):
        """Retourne les informations de l'utilisateur connecté."""
        serializer = self.get_serializer(request.user)
        return Response(serializer.data)

    @action(detail=False, methods=['get'])
    def concessionnaires(self, request):
        """Retourne la liste des concessionnaires."""
        concessionnaires = User.objects.filter(role='CONCESSIONNAIRE')
        serializer = ConcessionnaireListSerializer(concessionnaires, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=['post'])
    def set_concessionnaire(self, request, pk=None):
        """Associe un concessionnaire à un utilisateur."""
        user = self.get_object()
        concessionnaire_id = request.data.get('concessionnaire_id')
        
        if not concessionnaire_id:
            return Response(
                {'error': 'concessionnaire_id est requis'},
                status=status.HTTP_400_BAD_REQUEST
            )

        concessionnaire = get_object_or_404(User, id=concessionnaire_id, role='CONCESSIONNAIRE')
        
        # Vérifie les permissions
        if request.user.role not in ['ADMIN', 'CONCESSIONNAIRE', 'USINE']:
            return Response(
                {'error': 'Permission refusée'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        if request.user.role == 'CONCESSIONNAIRE' and request.user != concessionnaire:
            return Response(
                {'error': 'Un concessionnaire ne peut assigner que lui-même'},
                status=status.HTTP_403_FORBIDDEN
            )
            
        if request.user.role == 'USINE' and (concessionnaire.usine != request.user):
            return Response(
                {'error': 'Une usine ne peut assigner que ses propres concessionnaires'},
                status=status.HTTP_403_FORBIDDEN
            )

        user.concessionnaire = concessionnaire
        user.save()
        
        serializer = self.get_serializer(user)
        return Response(serializer.data)

    @action(detail=False, methods=['post'])
    def change_password(self, request):
        """Change le mot de passe de l'utilisateur connecté."""
        user = request.user
        serializer = self.get_serializer(user, data=request.data, partial=True)
        
        if serializer.is_valid():
            serializer.save()
            return Response({'message': 'Mot de passe modifié avec succès'})
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['post'])
    def logout(self, request):
        """Déconnexion de l'utilisateur."""
        try:
            refresh_token = request.COOKIES.get('refresh_token')
            if refresh_token:
                token = RefreshToken(refresh_token)
                token.blacklist()
            
            response = Response({'message': 'Déconnexion réussie'})
            response.delete_cookie('refresh_token')
            return response
            
        except Exception as e:
            return Response(
                {'error': 'Erreur lors de la déconnexion'},
                status=status.HTTP_400_BAD_REQUEST
            )

class CustomTokenRefreshView(TokenRefreshView):
    """Vue personnalisée pour le rafraîchissement des tokens."""
    
    def post(self, request, *args, **kwargs):
        refresh_token = request.data.get('refresh')
        
        if not refresh_token:
            refresh_token = request.COOKIES.get('refresh_token')
            if not refresh_token:
                raise InvalidToken('Aucun token de rafraîchissement fourni')
        
        try:
            refresh = RefreshToken(refresh_token)
            data = {
                'access': str(refresh.access_token),
                'refresh': str(refresh)
            }
            
            # Récupérer l'utilisateur pour renvoyer ses informations
            user = User.objects.get(id=refresh.payload.get('user_id'))
            data['user'] = UserSerializer(user).data
            
            response = Response(data)
            response.set_cookie(
                'refresh_token',
                str(refresh),
                httponly=True,
                secure=True,
                samesite='Strict',
                max_age=24 * 60 * 60  # 1 jour
            )
            return response
            
        except TokenError as e:
            raise InvalidToken(str(e))

class CustomTokenObtainPairView(TokenObtainPairView):
    """Vue personnalisée pour l'obtention du token avec stockage sécurisé."""
    
    def post(self, request, *args, **kwargs):
        try:
            response = super().post(request, *args, **kwargs)
            
            if response.status_code == status.HTTP_200_OK:
                user = User.objects.get(username=request.data['username'])
                response.data['user'] = UserSerializer(user).data
                
                # Stocker le refresh token dans un cookie httpOnly
                response.set_cookie(
                    'refresh_token',
                    response.data['refresh'],
                    httponly=True,
                    secure=True,
                    samesite='Strict',
                    max_age=24 * 60 * 60  # 1 jour
                )
                
                # Supprimer le refresh token de la réponse JSON
                del response.data['refresh']
                
            return response
            
        except (InvalidToken, TokenError) as e:
            return Response(
                {'detail': 'Identifiants incorrects'},
                status=status.HTTP_401_UNAUTHORIZED
            )
        except Exception as e:
            return Response(
                {'detail': str(e)},
                status=status.HTTP_401_UNAUTHORIZED
            )

class LoginView(TemplateView):
    """Vue de connexion qui vérifie si l'utilisateur n'est pas déjà connecté."""
    template_name = 'index.html'

    def dispatch(self, request, *args, **kwargs):
        if request.user.is_authenticated:
            return redirect('/')
        return super().dispatch(request, *args, **kwargs)

class SecureIndexView(UserPassesTestMixin, TemplateView):
    """Vue sécurisée pour servir l'application frontend."""
    template_name = 'index.html'
    login_url = '/login/'
    
    def test_func(self):
        """Vérifie si l'utilisateur est authentifié et a un rôle valide."""
        # Ne pas appliquer aux requêtes API
        if self.request.path_info.startswith('/api/'):
            return True
            
        return (
            self.request.user.is_authenticated and 
            hasattr(self.request.user, 'role') and 
            self.request.user.role in ['ADMIN', 'CONCESSIONNAIRE', 'UTILISATEUR']
        )

    def handle_no_permission(self):
        """Redirige vers la page de connexion si l'utilisateur n'est pas autorisé."""
        # Ne pas rediriger les requêtes API
        if self.request.path_info.startswith('/api/'):
            return JsonResponse({
                'detail': 'Authentification requise'
            }, status=401)
            
        return redirect(self.login_url)
