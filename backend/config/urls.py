"""
URL configuration for config project.

The `urlpatterns` list routes URLs to views. For more information please see:
    https://docs.djangoproject.com/en/6.0/topics/http/urls/
"""
from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.urls import path, include

urlpatterns = [
    path('admin/', admin.site.urls),
    path('', include('apps.core.urls')),
    path('', include('apps.accounts.urls')),
    path('', include('apps.characters.urls')),
    path('', include('apps.boards.urls')),
]

# In prod, Caddy serves /media/ directly (static() is a no-op when DEBUG is False)
urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
