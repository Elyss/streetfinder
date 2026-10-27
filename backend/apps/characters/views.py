from dataclasses                import asdict

from django.http                import Http404
from rest_framework.decorators  import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response    import Response

from .models import Character


# Move lists are public: no account needed to consult them
@api_view(['GET'])
@permission_classes([AllowAny])
def character_list(request):
    return Response([
        {'name': character.name, 'slug': character.slug, 'vitality': character.vitality}
        for character in Character.all()
    ])


@api_view(['GET'])
@permission_classes([AllowAny])
def character_detail(request, slug):
    character = Character.get(slug)
    if character is None:
        raise Http404
    return Response(asdict(character))
