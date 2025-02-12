from django.shortcuts import render
from rest_framework import viewsets, permissions
from rest_framework.decorators import action
from rest_framework.response import Response
from django.db.models import Q
from authentication.models import Utilisateur
from plans.models import Plan, FormeGeometrique, Connexion, TexteAnnotation
from .serializers import (
    UtilisateurSerializer,
    PlanSerializer,
    FormeGeometriqueSerializer,
    ConnexionSerializer,
    TexteAnnotationSerializer,
)

# Create your views here.

class UtilisateurViewSet(viewsets.ModelViewSet):
    queryset = Utilisateur.objects.all()
    serializer_class = UtilisateurSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        if user.role == Utilisateur.Role.ADMIN:
            return Utilisateur.objects.all()
        elif user.role == Utilisateur.Role.CONCESSIONNAIRE:
            return Utilisateur.objects.filter(
                Q(id=user.id) | Q(concessionnaire=user)
            )
        return Utilisateur.objects.filter(id=user.id)

class PlanViewSet(viewsets.ModelViewSet):
    queryset = Plan.objects.all()
    serializer_class = PlanSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        if user.role == Utilisateur.Role.ADMIN:
            return Plan.objects.all()
        elif user.role == Utilisateur.Role.CONCESSIONNAIRE:
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
