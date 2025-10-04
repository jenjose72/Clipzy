from django.urls import path
from .views import addComment, getComments

urlpatterns = [
    path("addComment/", addComment, name="addComment"),
    path("getComments/", getComments, name="getComments"),

]