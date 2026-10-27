from rest_framework.routers import DefaultRouter

from .views import ComboViewSet

router = DefaultRouter()
router.register("api/combos", ComboViewSet, basename="combo")

urlpatterns = router.urls
