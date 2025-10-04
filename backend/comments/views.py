from django.shortcuts import render
from django.http import JsonResponse
from transformers import pipeline
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated, AllowAny
from features.models import Clip, Comment


model_path = "C:/Users/jenjo/Desktop/R/Project/Clipzy/backend/comments/hate_speech"
pipe = pipeline("text-classification", model=model_path, framework="pt")

def classify_text(text):

    if not text:
        return JsonResponse({"error": "No text provided"}, status=400)

    # Get prediction
    output = pipe(text)[0]
    label_map = {
        'LABEL_0': 'acceptable',
        'LABEL_1': 'inappropriate',
        'LABEL_2': 'offensive',
        'LABEL_3': 'violent'
    }
    predicted_label = label_map.get(output['label'], output['label'])

    return predicted_label


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def getComments(request):
    videoId = request.GET.get('videoId')
    if not videoId:
        return JsonResponse({'error': 'videoId is required'}, status=400)
    try:
        video = Clip.objects.get(id=videoId)
    except Clip.DoesNotExist:
        return JsonResponse({'error': 'Video not found'}, status=404)
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
    return JsonResponse({'comments': comments_data}, status=200)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def addComment(request):
    user = request.user
    post_id = request.data.get('video_id')
    content = request.data.get('content')

    if not post_id or not content:
        return JsonResponse({'error': 'video_id and content are required'}, status=400)

    # Classify the comment
    prediction_response = classify_text(content)

    if prediction_response == 'acceptable':
        try:
            clip = Clip.objects.get(id=post_id)
            comment = Comment.objects.create(clip=clip, user=user, comment=content)
            return JsonResponse({
                'message': 'Comment added successfully',
                'comment': {
                    'id': comment.id,
                    'user': user.username,
                    'comment': comment.comment,
                    'created_at': comment.created_at
                }
            }, status=201)
        except Clip.DoesNotExist:
            return JsonResponse({'error': 'Clip not found'}, status=404)
    else:
        return JsonResponse({'error': f'Comment not added due to classification: {prediction_response}'}, status=400)