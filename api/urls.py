from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    ConcessionnaireViewSet,
    ClientViewSet,
    PlanViewSet,
    FormeGeometriqueViewSet,
    ConnexionViewSet,
    TexteAnnotationViewSet,
    elevation_proxy
)

router = DefaultRouter()
router.register(r'users/concessionnaires', ConcessionnaireViewSet, basename='concessionnaire')
router.register(r'users/clients', ClientViewSet, basename='client')
router.register(r'plans', PlanViewSet, basename='plan')
router.register(r'formes', FormeGeometriqueViewSet, basename='forme')
router.register(r'connexions', ConnexionViewSet, basename='connexion')
router.register(r'annotations', TexteAnnotationViewSet, basename='annotation')

urlpatterns = [
    path('', include(router.urls)),
    path('elevation/', elevation_proxy, name='elevation-proxy'),
] 