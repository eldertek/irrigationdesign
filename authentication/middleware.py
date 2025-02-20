from django.utils.functional import SimpleLazyObject
from django.contrib.auth.middleware import get_user
from rest_framework_simplejwt.authentication import JWTAuthentication
from django.utils.deprecation import MiddlewareMixin
from django.conf import settings
import jwt
from django.http import JsonResponse

def get_user_jwt(request):
    """Récupère l'utilisateur à partir du token JWT."""
    user = None
    auth_header = request.META.get('HTTP_AUTHORIZATION', '').split()
    
    if len(auth_header) == 2 and auth_header[0].lower() == 'bearer':
        try:
            jwt_token = auth_header[1]
            jwt_payload = jwt.decode(
                jwt_token,
                settings.SECRET_KEY,
                algorithms=['HS256']
            )
            user = JWTAuthentication().get_user(jwt_payload)
        except (jwt.InvalidTokenError, jwt.ExpiredSignatureError):
            pass
    return user

class AuthenticationMiddleware(MiddlewareMixin):
    """Middleware pour gérer l'authentification et les redirections."""
    
    def process_request(self, request):
        # Liste des chemins qui ne nécessitent pas d'authentification
        public_paths = [
            '/api/token/',
            '/api/token/refresh/',
            '/api/register/',
            '/login/',
            '/static/',
            '/media/',
        ]
        
        # Ne vérifier que les requêtes API
        if not request.path_info.startswith('/api/'):
            return None
            
        # Vérifier si le chemin actuel est public
        if request.path_info in public_paths:
            return None
            
        # Pour les requêtes API protégées
        if not request.user.is_authenticated:
            return JsonResponse({
                'detail': 'Authentification requise'
            }, status=401)
            
        return None

class JWTAuthenticationMiddleware(MiddlewareMixin):
    """Middleware qui ajoute l'utilisateur authentifié à la requête via JWT."""
    
    def process_request(self, request):
        if request.path_info.startswith('/api/'):
            request.user = SimpleLazyObject(lambda: get_user_jwt(request) or get_user(request))

class SessionExpiryMiddleware(MiddlewareMixin):
    """Middleware qui gère l'expiration des sessions et des tokens."""
    
    def process_response(self, request, response):
        if response.status_code == 401:
            response.delete_cookie('access_token')
            response.delete_cookie('refresh_token')
        return response 