from rest_framework import permissions

class IsAdmin(permissions.BasePermission):
    def has_permission(self, request, view):
        return request.user and request.user.role == 'ADMIN'

class IsDealer(permissions.BasePermission):
    def has_permission(self, request, view):
        return request.user and request.user.role in ['ADMIN', 'CONCESSIONNAIRE']

    def has_object_permission(self, request, view, obj):
        if request.user.role == 'ADMIN':
            return True
        return obj.concessionnaire == request.user