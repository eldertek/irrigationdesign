from django.utils.functional import SimpleLazyObject
from django.contrib.auth.middleware import get_user
from rest_framework_simplejwt.authentication import JWTAuthentication
from django.utils.deprecation import MiddlewareMixin
from django.conf import settings
import jwt
from django.shortcuts import redirect
from django.urls import resolve
from django.http import JsonResponse
from rest_framework_simplejwt.tokens import RefreshToken

def get_user_jwt(request):
    """
    Récupère l'utilisateur à partir du token JWT.
    """
    user = None
    try:
        # Vérifier d'abord le token dans l'en-tête Authorization
        auth_header = request.META.get('HTTP_AUTHORIZATION', '').split()
        jwt_token = None
        
        if len(auth_header) == 2 and auth_header[0].lower() == 'bearer':
            jwt_token = auth_header[1]
        else:
            # Si pas de token dans l'en-tête, vérifier le refresh token
            refresh_token = request.COOKIES.get('refresh_token')
            if refresh_token:
                try:
                    # Tenter de rafraîchir le token
                    refresh = RefreshToken(refresh_token)
                    jwt_token = str(refresh.access_token)
                    # Mettre à jour l'en-tête Authorization
                    request.META['HTTP_AUTHORIZATION'] = f'Bearer {jwt_token}'
                except Exception as e:
                    print(f"Error refreshing token: {e}")
                    return None

        if jwt_token:
            try:
                jwt_payload = jwt.decode(
                    jwt_token,
                    settings.SECRET_KEY,
                    algorithms=['HS256']
                )
                user = JWTAuthentication().get_user(jwt_payload)
                if user:
                    return user
            except (jwt.InvalidTokenError, jwt.ExpiredSignatureError) as e:
                print(f"Token validation error: {e}")
                
    except Exception as e:
        print(f"Authentication error: {e}")
        
    return None

class AuthenticationMiddleware(MiddlewareMixin):
    """Middleware pour gérer l'authentification et les redirections."""
    
    def process_request(self, request):
        # Liste des chemins qui ne nécessitent pas d'authentification
        public_paths = [
            '/login/',
            '/forgot-password/',
            '/api/token/',
            '/api/token/refresh/',
            '/admin/',
            '/static/',
            '/media/',
        ]
        
        # Vérifier si le chemin actuel est public
        current_path = request.path_info
        if any(current_path.startswith(path) for path in public_paths):
            return None
            
        # Si le chemin commence par /reset-password/, il est public
        if current_path.startswith('/reset-password/'):
            return None
            
        # Pour les requêtes API, utiliser l'authentification JWT
        if current_path.startswith('/api/'):
            if not request.user.is_authenticated:
                return JsonResponse(
                    {'detail': 'Authentication credentials were not provided.'}, 
                    status=401
                )
            return None
            
        # Pour les requêtes frontend (non-API)
        if not request.user.is_authenticated:
            # Vérifier si un refresh token est présent
            refresh_token = request.COOKIES.get('refresh_token')
            if refresh_token:
                try:
                    # Tenter de rafraîchir le token
                    refresh = RefreshToken(refresh_token)
                    access_token = str(refresh.access_token)
                    
                    # Mettre à jour l'en-tête Authorization
                    request.META['HTTP_AUTHORIZATION'] = f'Bearer {access_token}'
                    
                    # Réinitialiser l'utilisateur avec le nouveau token
                    request.user = SimpleLazyObject(lambda: get_user_jwt(request))
                    
                    # Si l'utilisateur est maintenant authentifié, continuer
                    if request.user.is_authenticated:
                        return None
                except Exception as e:
                    print(f"Error refreshing token in middleware: {e}")
            
            # Si toujours pas authentifié, rediriger vers login
            return redirect('/login/')
                
        return None

class JWTAuthenticationMiddleware(MiddlewareMixin):
    """
    Middleware qui ajoute l'utilisateur authentifié à la requête via JWT.
    """
    def process_request(self, request):
        request.user = SimpleLazyObject(lambda: get_user_jwt(request) or get_user(request))

class SessionExpiryMiddleware(MiddlewareMixin):
    """
    Middleware qui gère l'expiration des sessions et des tokens.
    """
    def process_response(self, request, response):
        if response.status_code == 401:  # Unauthorized
            # Si le token est expiré ou invalide, on nettoie les cookies
            response.delete_cookie('refresh_token')
        return response 