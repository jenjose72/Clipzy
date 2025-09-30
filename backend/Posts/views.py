from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response

from .next_clip import next_clip
from Posts.models import UserMetadata
from features.models import VideoCategory
from accounts.models import UserProfile
import pandas as pd

@api_view(['POST'])
@permission_classes([AllowAny])
def get_next_clip(request):
    user_id = request.data.get('user_id', 1)  # Get from request data
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
    
    # Process metrics to SIMULATE user metadata updates (not actually saving)
    print("🎭 SIMULATION MODE: Calculating metadata updates but NOT saving to database")
    try:
        user_profile = UserProfile.objects.get(user=user)
        updated_categories = set()
        
        for metric in metrics_data:
            video_id = metric.get('videoId')
            categories = metric.get('categories', [])
            watch_percentage = metric.get('watchPercentage', 0)
            liked = metric.get('liked', False)
            commented = metric.get('commented', False)
            
            # Calculate engagement score using mathematical formula:
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
                
                # TEMPORARILY DISABLED: Apply the mathematical formula: current_weight + engagement_score
                old_weight = user_metadata.weights
                new_weight = old_weight + total_engagement_score
                
                # Print what would be updated (but don't save yet)
                print(f"  WOULD UPDATE {category_name}: {old_weight} + {total_engagement_score} = {new_weight}")
                
                # TEMPORARILY COMMENTED OUT: user_metadata.weights += total_engagement_score
                # TEMPORARILY COMMENTED OUT: user_metadata.save()
                
                updated_categories.add(category_name)
        
        # Calculate what the average weight would be across all updated categories for this user
        if updated_categories:
            user_metadata_entries = UserMetadata.objects.filter(
                name=user_profile,
                categories__name__in=updated_categories
            )
            
            if user_metadata_entries.exists():
                # Calculate current total and what it would be after updates
                current_total_weight = sum(entry.weights for entry in user_metadata_entries)
                # Simulate the updates for average calculation
                simulated_updates = {}
                for entry in user_metadata_entries:
                    category_name = entry.categories.name
                    if category_name in updated_categories:
                        # Find the engagement score for this category from the metrics
                        category_engagement = 0
                        for metric in metrics_data:
                            if category_name in metric.get('categories', []):
                                # Recalculate engagement for this metric
                                watch_pct = metric.get('watchPercentage', 0)
                                liked = metric.get('liked', False)
                                commented = metric.get('commented', False)
                                watch_score = (watch_pct / 100) * 0.6
                                like_bonus = 0.2 if liked else 0
                                comment_bonus = (0.2 if commented else 0) / 2
                                category_engagement = max(category_engagement, watch_score + like_bonus + comment_bonus)
                        simulated_updates[category_name] = entry.weights + category_engagement
                
                simulated_total_weight = sum(simulated_updates.values()) if simulated_updates else current_total_weight
                simulated_avg_weight = simulated_total_weight / len(updated_categories)
                
                print(f"📊 CURRENT average weight across {len(updated_categories)} categories: {current_total_weight / len(updated_categories)}")
                print(f"📊 SIMULATED average weight after updates: {simulated_avg_weight}")
                print(f"📊 Detailed category updates:")
                for cat, new_weight in simulated_updates.items():
                    current_entry = user_metadata_entries.filter(categories__name=cat).first()
                    current_weight = current_entry.weights if current_entry else 0
                    print(f"    {cat}: {current_weight} → {new_weight}")
                
                # Optionally, you could store this average or use it for recommendations
                # For now, just log it
        
    except UserProfile.DoesNotExist:
        print(f"⚠️  UserProfile not found for user {user.username}")
    except Exception as e:
        print(f"❌ Error updating user metadata: {str(e)}")
    
    return Response({
        'message': 'Video metrics received and SIMULATED metadata updates (not saved). Check backend logs for details.',
        'metrics_count': len(metrics_data),
        'mode': 'simulation'
    }, status=200)
