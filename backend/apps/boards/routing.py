from django.urls import path

from .consumers import BoardConsumer

websocket_urlpatterns = [
    path("ws/boards/<str:board_id>/", BoardConsumer.as_asgi()),
]
