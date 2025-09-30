from django.urls import path
from .views import get_next_clip, sendVideoMetrics

urlpatterns = [
    path("next_clip/", get_next_clip, name="get_next_clip"),
    path("sendVideoMetrics/", sendVideoMetrics, name="sendVideoMetrics"),
]