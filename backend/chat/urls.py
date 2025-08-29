from django.urls import path
from .views import getChats, createRoom, getMessages, sendMessage

urlpatterns = [
    path('getChats/', getChats, name='getChats'),
    path('createRoom/', createRoom, name='createRoom'),
    path('getMessages/<int:room_id>/', getMessages, name='getMessages'),
    path('sendMessage/', sendMessage, name='sendMessage'),
]
