from rest_framework import permissions

class IsAdmin(permissions.BasePermission):
    def has_permission(self, request, view):
        return request.user and request.user.role == 'admin'

class IsDealer(permissions.BasePermission):
    def has_permission(self, request, view):
        return request.user and request.user.role in ['admin', 'dealer']

    def has_object_permission(self, request, view, obj):
        if request.user.role == 'admin':
            return True
        return obj.concessionnaire == request.user

class IsOwnerOrDealer(permissions.BasePermission):
    def has_object_permission(self, request, view, obj):
        if request.user.role == 'admin':
            return True
        if request.user.role == 'dealer':
            return obj.user.concessionnaire == request.user
        return obj.user == request.user 