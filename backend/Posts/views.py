from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from django.db import transaction

from .next_clip import next_clip
from Posts.models import UserMetadata
from features.models import VideoCategory
from accounts.models import UserProfile
import pandas as pd


@api_view(['POST'])
@permission_classes([AllowAny])
def get_next_clip(request):
    user_id = request.data.get('user_id')  # Get from request data
    if not user_id:
        return Response(
            {"error": "user_id required"},
            status=status.HTTP_400_BAD_REQUEST
        )

    try:
        user_profile = UserProfile.objects.get(user__id=user_id)
    except UserProfile.DoesNotExist:
        return Response(
            {"error": "User profile not found"},
            status=status.HTTP_404_NOT_FOUND
        )

    qs = UserMetadata.objects.filter(name=user_profile).select_related('categories').values(
        'categories__name', 'weights'
    )
    df = pd.DataFrame(list(qs))
    categories = VideoCategory.objects.all().values_list('name', flat=True)

    if df.empty:
        user_data = pd.DataFrame(
            [ [0]*len(categories) ],
            index=[user_id],
            columns=categories
        )
    else:
        user_data = df.pivot_table(
            index=lambda x: user_id,  
            columns='categories__name',
            values='weights',
            fill_value=0
        )
        user_data = user_data.reindex(columns=categories, fill_value=0)

    try:
        result = next_clip(user_data)
    except Exception as e:
        return Response(
            {"error": str(e)},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )

    return Response({"clips": result}, status=status.HTTP_200_OK)

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def sendVideoMetrics(request):
    user = request.user
    metrics_data = request.data.get('metrics', [])
    
    if not metrics_data:
        return Response({'error': 'No metrics data provided.'}, status=400)
    
    # Print the metrics data to backend console/logs
    print("📊 Received Video Metrics from user:", user.username)
    print("📈 Metrics Data:")
    for metric in metrics_data:
        print(f"  Video ID: {metric.get('videoId')}")
        print(f"  Categories: {metric.get('categories', [])}")
        print(f"  Watch Percentage: {metric.get('watchPercentage', 0)}%")
        print(f"  Liked: {metric.get('liked', False)}")
        print(f"  Commented: {metric.get('commented', False)}")
        print("  ---")
    
    # Process metrics to update user metadata
    print("💾 PRODUCTION MODE: Actually saving metadata updates to database")
    try:
        user_profile = UserProfile.objects.get(user=user)
        updated_categories = set()
        
        for metric in metrics_data:
            video_id = metric.get('videoId')
            categories = metric.get('categories', [])
            watch_percentage = metric.get('watchPercentage', 0)
            liked = metric.get('liked', False)
            commented = metric.get('commented', False)
            
            # Check for negative engagement (low watch % with no interaction)
            if 5 <= watch_percentage <= 10 and not liked and not commented:
                print(f"👎 LOW ENGAGEMENT detected for video {video_id} - applying negative weights")
                negative_score = -0.3  # Negative penalty for disinterest
                
                for category_name in categories:
                    # Get or create the VideoCategory category
                    category_obj, created = VideoCategory.objects.get_or_create(name=category_name)
                    
                    # Get or create UserMetadata for this user-category combination
                    user_metadata, created = UserMetadata.objects.get_or_create(
                        name=user_profile,
                        categories=category_obj,
                        defaults={'weights': 0}
                    )
                    
                    print(f"  DEBUG: UserMetadata for {category_name} - created: {created}, current weight: {user_metadata.weights}")
                    
                    # Apply negative weight penalty
                    old_weight = user_metadata.weights
                    new_weight = max(0, old_weight + negative_score)  # Don't go below 0
                    
                    user_metadata.weights = new_weight
                    user_metadata.save()
                    
                    # Verify the save worked
                    user_metadata.refresh_from_db()
                    print(f"  VERIFIED SAVE: {category_name} weight is now {user_metadata.weights}")
                    
                    print(f"  APPLIED NEGATIVE PENALTY {category_name}: {old_weight} + ({negative_score}) = {new_weight}")
                    
                    updated_categories.add(category_name)
            else:
                # Calculate positive engagement score using mathematical formula:
                # current_weight + (video_watched_percent * 0.6) + 0.2(if liked) + 0.2(if commented)/2
                watch_score = (watch_percentage / 100) * 0.6  # Normalize watch percentage to 0-1 scale
                like_bonus = 0.2 if liked else 0
                comment_bonus = (0.2 if commented else 0) / 2  # Comment bonus is halved
                total_engagement_score = watch_score + like_bonus + comment_bonus
                
                print(f"📊 Video {video_id} engagement calculation:")
                print(f"  Watch %: {watch_percentage}%, Watch Score: {watch_score} (watch% * 0.6)")
                print(f"  Liked: {liked}, Like Bonus: {like_bonus} (0.2 if liked)")
                print(f"  Commented: {commented}, Comment Bonus: {comment_bonus} (0.2/2 if commented)")
                print(f"  Total Engagement Score: {total_engagement_score}")
                
                for category_name in categories:
                    # Get or create the VideoCategory category
                    category_obj, created = VideoCategory.objects.get_or_create(name=category_name)
                    
                    # Get or create UserMetadata for this user-category combination
                    user_metadata, created = UserMetadata.objects.get_or_create(
                        name=user_profile,
                        categories=category_obj,
                        defaults={'weights': 0}
                    )
                    
                    print(f"  DEBUG: UserMetadata for {category_name} - created: {created}, current weight: {user_metadata.weights}")
                    
                    # Apply the mathematical formula: current_weight + engagement_score
                    old_weight = user_metadata.weights
                    user_metadata.weights += total_engagement_score
                    user_metadata.save()
                    
                    # Verify the save worked
                    user_metadata.refresh_from_db()
                    print(f"  VERIFIED SAVE: {category_name} weight is now {user_metadata.weights}")
                    
                    print(f"  UPDATED {category_name}: {old_weight} + {total_engagement_score} = {user_metadata.weights}")
                    
                    updated_categories.add(category_name)
        
        # Calculate average weight across all updated categories for this user
        if updated_categories:
            user_metadata_entries = UserMetadata.objects.filter(
                name=user_profile,
                categories__name__in=updated_categories
            )
            
            if user_metadata_entries.exists():
                total_weight = sum(entry.weights for entry in user_metadata_entries)
                avg_weight = total_weight / len(updated_categories)
                print(f"📊 Average weight across {len(updated_categories)} categories: {avg_weight}")
                print(f"📊 Detailed category weights:")
                for entry in user_metadata_entries:
                    print(f"    {entry.categories.name}: {entry.weights}")
                
                # Optionally, you could store this average or use it for recommendations
                # For now, just log it
        
    except UserProfile.DoesNotExist:
        print(f"⚠️  UserProfile not found for user {user.username}")
    except Exception as e:
        print(f"❌ Error updating user metadata: {str(e)}")
    
    return Response({
        'message': 'Video metrics received and metadata updated successfully. Check backend logs for details.',
        'metrics_count': len(metrics_data),
        'mode': 'production'
    }, status=200)
