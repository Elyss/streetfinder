from django.urls import path
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView

from . import views

urlpatterns = [
    path('api/auth/login/', TokenObtainPairView.as_view(), name='token-obtain'),
    path('api/auth/refresh/', TokenRefreshView.as_view(), name='token-refresh'),
    path('api/auth/me/', views.me, name='me'),
    path('api/auth/register/', views.register, name='register'),
    path('api/auth/profile/', views.update_profile, name='update-profile'),
    path('api/auth/password/forgot/', views.forgot_password, name='forgot-password'),
    path('api/auth/password/link/', views.check_link, name='check-link'),
    path('api/auth/password/reset/', views.reset_password, name='reset-password'),

    path('api/users/', views.users, name='users'),
    path('api/users/<int:user_id>/', views.delete_user, name='delete-user'),
    path('api/users/<int:user_id>/activation/', views.toggle_activation, name='toggle-activation'),
    path('api/users/<int:user_id>/admin/', views.toggle_admin, name='toggle-admin'),
]
