from django.urls import path
from .views import get_next_clip

urlpatterns = [
    path("/next_clip/", get_next_clip, name="get_next_clip"),
]