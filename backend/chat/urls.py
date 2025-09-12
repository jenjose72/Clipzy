from django.urls import path
from .views import getChats, createRoom, getMessages, sendMessage,getUserId 

urlpatterns = [
    path('getChats/', getChats, name='getChats'),
    path('createRoom/', createRoom, name='createRoom'),
    path('getMessages/<int:room_id>/', getMessages, name='getMessages'),
    path('sendMessage/', sendMessage, name='sendMessage'),
    path('getUserId/', getUserId, name='getUserId'),
]
