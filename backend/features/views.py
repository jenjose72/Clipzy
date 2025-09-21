from django.contrib.auth.models import User
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny,IsAuthenticated
from rest_framework.response import Response
from .models import Follows, Clip, Like,Comment
from .video_classification import extract_frames, encode_image, classify_frame, aggregate_labels
import os

from django.core.files.storage import default_storage
from django.core.files.base import ContentFile

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
    videoId = request.GET.get('videoId')
    if not videoId:
        return Response({'error': 'videoId is required.'}, status=400)
    try:
        video = Clip.objects.get(id=videoId)
    except Clip.DoesNotExist:
        return Response({'error': 'Video not found.'}, status=404)
    return Response({'likesCount': video.likeCount}, status=200)

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
    except Clip.DoesNotExist:
        return Response({'error': 'Video not found.'}, status=404)
    Like.objects.create(user=user, clip=video)
    video.likeCount = Like.objects.filter(clip=video).count()
    video.save()
    return Response({'message': 'Video liked.'}, status=201)

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def unlikeVideo(request):
    user = request.user
    video_id = request.data.get('video_id')
    if not video_id:
        return Response({'error': 'video_id is required.'}, status=400)
    try:
        video = Clip.objects.get(id=video_id)
    except Clip.DoesNotExist:
        return Response({'error': 'Video not found.'}, status=404)
    like_instance = Like.objects.filter(user=user, clip=video)
    if not like_instance.exists():
        return Response({'message': 'Video not liked yet.'}, status=200)
    like_instance.delete()
    video.likeCount = Like.objects.filter(clip=video).count()
    video.save()
    return Response({'message': 'Video unliked.'}, status=200)  

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def addComment(request):
    user = request.user
    video_id = request.data.get('video_id')
    content = request.data.get('content', '').strip()
    if not video_id or not content:
        return Response({'error': 'Both video_id and content are required.'}, status=400)
    try:
        video = Clip.objects.get(id=video_id)
    except Clip.DoesNotExist:
        return Response({'error': 'Video not found.'}, status=404)
    comment = Comment.objects.create(user=user, clip=video, comment=content)
    return Response({
        'message': 'Comment added.',
        'comment': {
            'id': comment.id,
            'user': user.username,
            'comment': comment.comment,
            'created_at': comment.created_at
        }
    }, status=201)

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def removeComment(request):
    user = request.user
    comment_id = request.data.get('comment_id')
    if not comment_id:
        return Response({'error': 'comment_id is required.'}, status=400)
    try:
        comment = Comment.objects.get(id=comment_id, user=user)
    except Comment.DoesNotExist:
        return Response({'error': 'Comment not found or access denied.'}, status=404)
    comment.delete()
    return Response({'message': 'Comment removed.'}, status=200)

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def getComments(request):
    videoId = request.GET.get('videoId')
    if not videoId:
        return Response({'error': 'videoId is required.'}, status=400)
    try:
        video = Clip.objects.get(id=videoId)
    except Clip.DoesNotExist:
        return Response({'error': 'Video not found.'}, status=404)
    comments = Comment.objects.filter(clip=video).order_by('-created_at')
    comments_data = [
        {
            'id': comment.id,
            'user': comment.user.username,
            'comment': comment.comment,
            'created_at': comment.created_at
        }
        for comment in comments
    ]
    return Response({'comments': comments_data}, status=200)

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def postClip(request):
    user = request.user
    video_url = request.POST.get('video_url')
    description = request.POST.get('description', '').strip()
    video_file = request.FILES.get('file')
    if not video_url:
        return Response({'error': 'video_url is required.'}, status=400)
    # Save the video file temporarily if present
    temp_path = None
    if video_file:
        temp_path = default_storage.save(f'temp_uploads/{video_file.name}', ContentFile(video_file.read()))
        temp_full_path = default_storage.path(temp_path)
        # Run classification pipeline
        try:
            frames = extract_frames(temp_full_path, every_n_frames=60)
            frame_labels = [classify_frame(f) for f in frames[:5]]
            final_labels = aggregate_labels(frame_labels)
        except Exception as e:
            final_labels = []
        # Optionally, delete the temp file after processing
        try:
            os.remove(temp_full_path)
        except Exception:
            pass
    else:
        final_labels = []
    clip = Clip.objects.create(caption=description, clipUrl=video_url)
    # Tagging logic for categories
    from .models import VideoCategory, TaggedVideo
    for label, _ in final_labels:
        category_obj, created = VideoCategory.objects.get_or_create(name=label)
        TaggedVideo.objects.create(clip=clip, category=category_obj)
    return Response({
        'message': 'Clip posted successfully.',
        'labels': final_labels,
    })



