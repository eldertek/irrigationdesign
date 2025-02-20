"""
URL configuration for irrigation_design project.

The `urlpatterns` list routes URLs to views. For more information please see:
    https://docs.djangoproject.com/en/5.1/topics/http/urls/
Examples:
Function views
    1. Add an import:  from my_app import views
    2. Add a URL to urlpatterns:  path('', views.home, name='home')
Class-based views
    1. Add an import:  from other_app.views import Home
    2. Add a URL to urlpatterns:  path('', Home.as_view(), name='home')
Including another URLconf
    1. Import the include() function: from django.urls import include, path
    2. Add a URL to urlpatterns:  path('blog/', include('blog.urls'))
"""

from django.contrib import admin
from django.urls import path, include, re_path
from django.conf import settings
from django.conf.urls.static import static
from django.views.generic import TemplateView
from rest_framework_simplejwt.views import (
    TokenObtainPairView,
    TokenRefreshView,
)
from rest_framework.documentation import include_docs_urls
from authentication.views import SecureIndexView, LoginView

# Routes publiques pour le frontend
public_routes = [
    path('login/', LoginView.as_view(), name='login'),
    path('forgot-password/', TemplateView.as_view(template_name='index.html'), name='forgot-password'),
    path('reset-password/<str:token>/', TemplateView.as_view(template_name='index.html'), name='reset-password'),
]

# Routes API
api_routes = [
    path('api/', include('api.urls')),
    path('api/', include('authentication.urls')),
]

# Routes d'administration et documentation
admin_routes = [
    path('admin/', admin.site.urls),
    path('docs/', include_docs_urls(title='API Documentation')),
]

urlpatterns = public_routes + api_routes + admin_routes

# Servir les fichiers statiques et média en développement
if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
    urlpatterns += static(settings.STATIC_URL, document_root=settings.STATIC_ROOT)

# Route par défaut - doit être authentifié
urlpatterns += [
    re_path(r'^(?!api/)(?!admin/)(?!static/)(?!media/).*$', TemplateView.as_view(template_name='index.html'), name='frontend'),
]
