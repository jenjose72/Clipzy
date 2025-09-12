
from django.contrib.auth.models import User
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny,IsAuthenticated
from rest_framework.response import Response
from .models import Follows, Clip, Like

# Create your views here.
@api_view(['GET'])
@permission_classes([AllowAny])
def searchUsers(request):
    searchKeyword = request.GET.get('q', '').strip()
    if not searchKeyword:
        return Response({'results': []})
    users = User.objects.filter(username__icontains=searchKeyword)
    results = [
        {
            'username': user.username,
            'id': user.id,
        }
        for user in users
    ]
    return Response({'results': results})

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def isFollowing(request):
    user1=request.user
    user2Id=request.GET.get('user2Id')
    user2=User.objects.get(id=user2Id)
    is_following = Follows.objects.filter(follower=user1, following=user2).exists()
    return Response({'isFollowing': is_following})

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def followUser(request):
    follower_id = request.user.id
    following_id = request.data.get('following_id')
    if not follower_id or not following_id:
        return Response({'error': 'Both follower_id and following_id are required.'}, status=400)
    try:
        follower = User.objects.get(id=follower_id)
        following = User.objects.get(id=following_id)
    except User.DoesNotExist:
        return Response({'error': 'User not found.'}, status=404)
    if Follows.objects.filter(follower=follower, following=following).exists():
        return Response({'message': 'Already following.'}, status=200)
    Follows.objects.create(follower=follower, following=following)
    return Response({'message': 'Now following user.'}, status=201)

@api_view(['POST'])
@permission_classes([AllowAny])
def unfollowUser(request):
    follower_id = request.user.id
    following_id = request.data.get('following_id')
    if not follower_id or not following_id:
        return Response({'error': 'Both follower_id and following_id are required.'}, status=400)
    try:
        follower = User.objects.get(id=follower_id)
        following = User.objects.get(id=following_id)
    except User.DoesNotExist:
        return Response({'error': 'User not found.'}, status=404)
    follow_relation = Follows.objects.filter(follower=follower, following=following)
    if not follow_relation.exists():
        return Response({'message': 'Not following this user.'}, status=200)
    follow_relation.delete()
    return Response({'message': 'Unfollowed user.'}, status=200)

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def getLikes(request):
    user = request.user
    videoId = request.data.get('videoId')
    if not videoId:
        return Response({'error': 'videoId is required.'}, status=400)
    liked_videos = list(user.likes.filter(clip_id=videoId).values_list('clip_id', flat=True))
    return Response({'liked_videos': liked_videos}, status=200)

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def likeVideo(request):
    user = request.user
    video_id = request.data.get('video_id')
    if not video_id:
        return Response({'error': 'video_id is required.'}, status=400)
    if user.likes.filter(clip_id=video_id).exists():
        return Response({'message': 'Video already liked.'}, status=200)
    try:
        video = Clip.objects.get(id=video_id)
        video.likeCount += 1
        video.save()
    except Clip.DoesNotExist:
        return Response({'error': 'Video not found.'}, status=404)
    Like.objects.create(user=user, clip=video)
    return Response({'message': 'Video liked.'}, status=201)

