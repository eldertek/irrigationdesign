from rest_framework import permissions

class IsAdmin(permissions.BasePermission):
    def has_permission(self, request, view):
        return request.user and request.user.role == 'ADMIN'

class IsUsine(permissions.BasePermission):
    def has_permission(self, request, view):
        return request.user and request.user.role == 'USINE'

    def has_object_permission(self, request, view, obj):
        if request.user.role == 'ADMIN':
            return True
        if request.user.role == 'USINE':
            # Une usine peut gérer ses concessionnaires
            if hasattr(obj, 'role') and obj.role == 'CONCESSIONNAIRE':
                return obj.usine == request.user
            # Une usine peut gérer les agriculteurs de ses concessionnaires
            if hasattr(obj, 'role') and obj.role == 'AGRICULTEUR':
                return obj.concessionnaire and obj.concessionnaire.usine == request.user
            # Pour les plans, permettre l'accès si l'usine est liée
            if hasattr(obj, 'usine'):
                return obj.usine == request.user
            # Pour les plans, permettre l'accès si le concessionnaire appartient à l'usine
            if hasattr(obj, 'concessionnaire') and obj.concessionnaire:
                return obj.concessionnaire.usine == request.user
        return False

class IsConcessionnaire(permissions.BasePermission):
    def has_permission(self, request, view):
        return request.user and request.user.role in ['ADMIN', 'USINE', 'CONCESSIONNAIRE']

    def has_object_permission(self, request, view, obj):
        if request.user.role == 'ADMIN':
            return True
        if request.user.role == 'USINE':
            return hasattr(obj, 'role') and obj.role in ['CONCESSIONNAIRE', 'AGRICULTEUR'] and \
                   ((obj.role == 'CONCESSIONNAIRE' and obj.usine == request.user) or 
                    (obj.role == 'AGRICULTEUR' and obj.concessionnaire and obj.concessionnaire.usine == request.user))
        return hasattr(obj, 'concessionnaire') and obj.concessionnaire == request.user and obj.role == 'AGRICULTEUR'