from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    UserViewSet,
    DealerViewSet,
    ClientViewSet,
    PlanViewSet,
    FormeGeometriqueViewSet,
    ConnexionViewSet,
    TexteAnnotationViewSet
)

router = DefaultRouter()
router.register(r'users', UserViewSet, basename='user')
router.register(r'dealers', DealerViewSet, basename='dealer')
router.register(r'clients', ClientViewSet, basename='client')
router.register(r'plans', PlanViewSet, basename='plan')
router.register(r'formes', FormeGeometriqueViewSet, basename='forme')
router.register(r'connexions', ConnexionViewSet, basename='connexion')
router.register(r'annotations', TexteAnnotationViewSet, basename='annotation')

urlpatterns = [
    path('', include(router.urls)),
] 