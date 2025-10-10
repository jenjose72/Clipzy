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
@permission_classes([IsAuthenticated])
def get_next_clip(request):
    # Use authenticated user
    user = request.user
    if not user or not getattr(user, 'id', None):
        return Response({"error": "authentication required"}, status=status.HTTP_401_UNAUTHORIZED)

    # Accept optional parameters from the client
    try:
        count = int(request.data.get('count', 1))
    except Exception:
        count = 1

    exclude_ids = request.data.get('exclude_ids', [])
    # allow comma-separated string or list
    if isinstance(exclude_ids, str):
        exclude_ids = [int(x) for x in exclude_ids.split(',') if x.strip().isdigit()]
    elif isinstance(exclude_ids, list):
        try:
            exclude_ids = [int(x) for x in exclude_ids]
        except Exception:
            exclude_ids = []

    try:
        user_profile = UserProfile.objects.get(user__id=user.id)
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
            index=[user.id],
            columns=categories
        )
    else:
        user_data = df.pivot_table(
            index=lambda x: user.id,  
            columns='categories__name',
            values='weights',
            fill_value=0
        )
        user_data = user_data.reindex(columns=categories, fill_value=0)

    # Merge server-side watched IDs into exclude_ids so we don't re-serve clips to the same user
    try:
        if hasattr(user_profile, 'watched_ids'):
            try:
                if isinstance(user_profile.watched_ids, list):
                    watched_list = [int(x) for x in user_profile.watched_ids if x is not None]
                else:
                    import json
                    try:
                        watched_list = [int(x) for x in json.loads(user_profile.watched_ids or '[]')]
                    except Exception:
                        watched_list = []
                # merge
                exclude_ids = list(set(exclude_ids) | set(watched_list))
                print(f"get_next_clip: merged watched_ids into exclude_ids: {exclude_ids}")
            except Exception as e:
                print(f"get_next_clip: error reading watched_ids: {e}")
    except Exception:
        # no-op if user_profile doesn't have watched_ids
        pass

    try:
        result, method_used, top_categories = next_clip(user_data, count=count, exclude_ids=exclude_ids)
        # Log which selection method was used and the categories chosen
        print(f"next_clip selected method: {method_used}; categories: {top_categories}")
    except Exception as e:
        return Response(
            {"error": str(e)},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )

    # Record these clips as "watched/shown" for this user so we don't re-serve them
    try:
        returned_ids = [c.get('id') for c in result]
        # user_profile may have watched_ids as JSONField (list) or TextField storing JSON string
        if hasattr(user_profile, 'watched_ids'):
            try:
                # If it's a list-like field
                if isinstance(user_profile.watched_ids, list):
                    existing = set(user_profile.watched_ids)
                    existing.update([i for i in returned_ids if i is not None])
                    user_profile.watched_ids = list(existing)
                else:
                    # assume text field with JSON string
                    import json
                    try:
                        existing_list = json.loads(user_profile.watched_ids or '[]')
                    except Exception:
                        existing_list = []
                    existing = set(existing_list)
                    existing.update([i for i in returned_ids if i is not None])
                    user_profile.watched_ids = json.dumps(list(existing))
                user_profile.save()
                print(f"Marked clips as watched for user {user.username}: {returned_ids}")
            except Exception as e:
                print(f"Failed to update watched_ids for user {user.username}: {e}")
    except Exception as e:
        print(f"Error recording watched ids: {e}")

    return Response({"clips": result, "method": method_used, "categories": top_categories}, status=status.HTTP_200_OK)

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def sendVideoMetrics(request):
    user = request.user
    metrics_data = request.data.get('metrics', [])
    
    if not metrics_data:
        return Response({'error': 'No metrics data provided.'}, status=400)
    
    # Print the metrics data to backend console/logs
    print("🔄 RECEIVED VIDEO METRICS FROM USER:", user.username)
    print("📊 METRICS DATA:")
    for metric in metrics_data:
        print(f"  🎬 Video ID: {metric.get('videoId')}")
        print(f"  🏷️  Categories: {metric.get('categories', [])}")
        print(f"  👀 Watch Percentage: {metric.get('watchPercentage', 0)}%")
        print(f"  ❤️ Liked: {metric.get('liked', False)}")
        print(f"  💬 Commented: {metric.get('commented', False)}")
        print("  ---")
    
    # Process metrics to update user metadata
    print("💾 PRODUCTION MODE: UPDATING USER METADATA IN DATABASE")
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
                    
                    print(f"  🔍 UserMetadata for '{category_name}' - created: {created}, current weight: {user_metadata.weights}")
                    
                    # Apply negative weight penalty
                    old_weight = user_metadata.weights
                    new_weight = max(-1, min(1, old_weight + negative_score))  # Clamp between -1 and 1
                    
                    user_metadata.weights = new_weight
                    user_metadata.save()
                    
                    # Verify the save worked
                    user_metadata.refresh_from_db()
                    print(f"  ✅ UPDATED: {category_name}: {old_weight} + ({negative_score}) = {new_weight} (clamped to [-1,1])")
                    
                    updated_categories.add(category_name)
            else:
                # Calculate positive engagement score using mathematical formula:
                # current_weight + (video_watched_percent * 0.6) + 0.2(if liked) + 0.2(if commented)/2
                watch_score = (watch_percentage / 100) * 0.6  # Normalize watch percentage to 0-1 scale
                like_bonus = 0.2 if liked else 0
                comment_bonus = (0.2 if commented else 0) / 2  # Comment bonus is halved
                total_engagement_score = watch_score + like_bonus + comment_bonus
                
                print(f"� Video {video_id} engagement calculation:")
                print(f"  👀 Watch %: {watch_percentage}%, Watch Score: {watch_score:.3f} (watch% * 0.6)")
                print(f"  ❤️ Liked: {liked}, Like Bonus: {like_bonus:.1f} (0.2 if liked)")
                print(f"  💬 Commented: {commented}, Comment Bonus: {comment_bonus:.1f} (0.2/2 if commented)")
                print(f"  🎯 Total Engagement Score: {total_engagement_score:.3f}")
                
                for category_name in categories:
                    # Get or create the VideoCategory category
                    category_obj, created = VideoCategory.objects.get_or_create(name=category_name)
                    
                    # Get or create UserMetadata for this user-category combination
                    user_metadata, created = UserMetadata.objects.get_or_create(
                        name=user_profile,
                        categories=category_obj,
                        defaults={'weights': 0}
                    )
                    
                    print(f"  🔍 UserMetadata for '{category_name}' - created: {created}, current weight: {user_metadata.weights:.3f}")
                    
                    # Apply the mathematical formula: current_weight + engagement_score
                    old_weight = user_metadata.weights
                    user_metadata.weights += total_engagement_score
                    user_metadata.weights = max(-1, min(1, user_metadata.weights))  # Clamp between -1 and 1
                    user_metadata.save()
                    
                    # Verify the save worked
                    user_metadata.refresh_from_db()
                    clamped_note = " (clamped)" if abs(user_metadata.weights) == 1.0 else ""
                    print(f"  ✅ UPDATED: {category_name}: {old_weight:.3f} + {total_engagement_score:.3f} = {user_metadata.weights:.3f}{clamped_note} (range: -1 to 1)")
                    
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
                print(f"Average weight across {len(updated_categories)} categories: {avg_weight}")
                print(f"Detailed category weights:")
                for entry in user_metadata_entries:
                    print(f"    {entry.categories.name}: {entry.weights}")
                
                # Optionally, you could store this average or use it for recommendations
                # For now, just log it
        
        # Print final summary of all user metadata
        print("📋 FINAL USER METADATA SUMMARY FOR USER:", user.username)
        all_metadata = UserMetadata.objects.filter(name=user_profile).select_related('categories')
        if all_metadata.exists():
            print(f"  Total metadata entries: {all_metadata.count()}")
            for entry in all_metadata:
                print(f"    🏷️  {entry.categories.name}: {entry.weights} (range: -1 to 1)")
        else:
            print("  No metadata entries found")
        
    except UserProfile.DoesNotExist:
        print(f"❌ UserProfile not found for user {user.username}")
    except Exception as e:
        print(f"❌ Error updating user metadata: {str(e)}")
    
    return Response({
        'message': 'Video metrics received and metadata updated successfully. Check backend logs for details.',
        'metrics_count': len(metrics_data),
        'mode': 'production'
    }, status=200)
