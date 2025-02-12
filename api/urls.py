from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    UtilisateurViewSet,
    PlanViewSet,
    FormeGeometriqueViewSet,
    ConnexionViewSet,
    TexteAnnotationViewSet,
)

router = DefaultRouter()
router.register(r'utilisateurs', UtilisateurViewSet)
router.register(r'plans', PlanViewSet)
router.register(r'formes', FormeGeometriqueViewSet)
router.register(r'connexions', ConnexionViewSet)
router.register(r'annotations', TexteAnnotationViewSet)

urlpatterns = [
    path('', include(router.urls)),
] 