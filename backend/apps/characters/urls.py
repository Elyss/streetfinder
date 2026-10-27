from django.urls import path
from .views import character_detail, character_list

urlpatterns = [
    path('api/characters/', character_list, name='character-list'),
    path('api/characters/<slug:slug>/', character_detail, name='character-detail'),
]
