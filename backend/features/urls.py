from django.urls import path
from .views import searchUsers, isFollowing, followUser, unfollowUser,likeVideo,getLikes

urlpatterns = [
    path('search/', searchUsers, name='searchUsers'),
    path('isFollowing/', isFollowing, name='isFollowing'),
    path('followUser/', followUser, name='followUser'),
    path('unfollowUser/', unfollowUser, name='unfollowUser'),
    path('addLikes/',likeVideo , name='addLikes'),
    path('getLikes/',getLikes, name='getLikes')
]
