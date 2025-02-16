from django.utils.functional import SimpleLazyObject
from django.contrib.auth.middleware import get_user
from rest_framework_simplejwt.authentication import JWTAuthentication
from django.utils.deprecation import MiddlewareMixin
from django.conf import settings
import jwt
from django.shortcuts import redirect
from django.urls import resolve
from django.http import JsonResponse

def get_user_jwt(request):
    """
    Récupère l'utilisateur à partir du token JWT.
    """
    user = None
    try:
        auth_header = request.META.get('HTTP_AUTHORIZATION', '').split()
        if len(auth_header) == 2 and auth_header[0].lower() == 'bearer':
            jwt_token = auth_header[1]
            jwt_payload = jwt.decode(
                jwt_token,
                settings.SECRET_KEY,
                algorithms=['HS256']
            )
            user = JWTAuthentication().get_user(jwt_payload)
    except (jwt.InvalidTokenError, jwt.ExpiredSignatureError):
        pass
    return user or get_user(request)

class JWTAuthenticationMiddleware(MiddlewareMixin):
    """
    Middleware qui ajoute l'utilisateur authentifié à la requête via JWT.
    """
    def process_request(self, request):
        request.user = SimpleLazyObject(lambda: get_user_jwt(request))

class SessionExpiryMiddleware(MiddlewareMixin):
    """
    Middleware qui gère l'expiration des sessions et des tokens.
    """
    def process_response(self, request, response):
        if response.status_code == 401:  # Unauthorized
            # Si le token est expiré ou invalide, on nettoie les cookies
            response.delete_cookie('refresh_token')
        return response 

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
            
        # Vérifier si l'utilisateur est authentifié
        if not request.user.is_authenticated:
            if request.path_info.startswith('/api/'):
                # Pour les requêtes API, renvoyer une erreur 401
                return JsonResponse({'detail': 'Authentication credentials were not provided.'}, status=401)
            else:
                # Pour les autres requêtes, rediriger vers la page de connexion
                return redirect('/login/')
                
        return None 