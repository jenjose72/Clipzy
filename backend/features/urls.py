from django.urls import path
from .views import searchUsers, isFollowing, followUser,postClip, unfollowUser,likeVideo,getLikes,unlikeVideo,addComment,removeComment,getComments

urlpatterns = [
    path('search/', searchUsers, name='searchUsers'),
    path('isFollowing/', isFollowing, name='isFollowing'),
    path('followUser/', followUser, name='followUser'),
    path('unfollowUser/', unfollowUser, name='unfollowUser'),
    path('addLikes/',likeVideo , name='addLikes'),
    path('getLikes/',getLikes, name='getLikes'),
    path('unlikeVideo/',unlikeVideo, name='unlikeVideo'),
    path('addComment/',addComment, name='addComment'),
    path('removeComment/',removeComment, name='removeComment'),
    path('getComments/',getComments, name='getComments'),
    path('postClip/',postClip, name='postClip'),
]
