from features.models import Clip
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from django.contrib.auth.models import User
from features.models import Follows
from .models import ChatRoom, Message


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def sendMessage(request):
    user = request.user
    room_id = request.data.get('room_id')
    content = request.data.get('content')
    video_id = request.data.get('video_id')
    if not room_id:
        return Response({'error': 'room_id required'}, status=status.HTTP_400_BAD_REQUEST)
    try:
        room = ChatRoom.objects.get(id=room_id, participants=user)
    except ChatRoom.DoesNotExist:
        return Response({'error': 'Chat room not found or access denied.'}, status=status.HTTP_404_NOT_FOUND)
    video = None
    if video_id:
        try:
            video = Clip.objects.get(id=video_id)
        except Clip.DoesNotExist:
            pass
    msg = Message.objects.create(room=room, sender=user, content=content, video=video)
    return Response({
        'id': msg.id,
        'sender': msg.sender.username,
        'content': msg.content,
        'video': msg.video.id if msg.video else None,
        'timestamp': msg.timestamp,
        'is_read': msg.is_read
    }, status=status.HTTP_201_CREATED)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def getMessages(request, room_id):
    user = request.user
    try:
        room = ChatRoom.objects.get(id=room_id, participants=user)
    except ChatRoom.DoesNotExist:
        return Response({'error': 'Chat room not found or access denied.'}, status=404)
    messages = Message.objects.filter(room=room).order_by('timestamp')
    messages_data = [
        {
            'id': msg.id,
            'sender': msg.sender.id,
            'content': msg.content,
            'video': msg.video.id if msg.video else None,
            'timestamp': msg.timestamp,
            'is_read': msg.is_read
        }
        for msg in messages
    ]
    return Response({'messages': messages_data})

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def getChats(request):
    user = request.user
    chat_rooms = ChatRoom.objects.filter(participants=user)
    if chat_rooms.exists():
        rooms_data = [
            {   
                "roomExists": True,
                "room_id": room.id,
                "room_name": room.name,
                "users": [u.username for u in room.participants.all()]
            }
            for room in chat_rooms
        ]
        return Response({"chat_rooms": rooms_data})
    else:
        following = Follows.objects.filter(follower=user).select_related('following')
        following_users = [
            {   
                "roomExists": False,
                "user_id": f.following.id,
                "username": f.following.username
            }
            for f in following
        ]
        return Response({"message": "No chat rooms found.", "following": following_users})
    
@api_view(['POST'])
@permission_classes([IsAuthenticated])
def createRoom(request):
    user = request.user
    participant_id = request.data.get('participant_id')
    if not participant_id:
        return Response({'error': 'participant_id required'}, status=400)
    try:
        participant = User.objects.get(id=participant_id)
    except User.DoesNotExist:
        return Response({'error': 'User not found'}, status=404)
    # Check if a room already exists with these two participants
    existing_rooms = ChatRoom.objects.filter(participants=user).filter(participants=participant)
    if existing_rooms.exists():
        room = existing_rooms.first()
        return Response({'room_id': room.id, 'roomExists': True})
    # Create new room
    room = ChatRoom.objects.create()
    room.participants.add(user, participant)
    room.save()
    return Response({'room_id': room.id, 'roomExists': False})


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def getUserId(request):
    user=request.user
    return Response({'userId': user.id})