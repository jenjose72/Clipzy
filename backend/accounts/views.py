from django.shortcuts import render
from django.contrib.auth.models import User
from .models import UserProfile
from features.models import Follows
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

# Create your views here.

# Home view, only accessible to logged-in users
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def home(request):
    return Response({"message": "Welcome to the home page!", "user": request.user.username})

@api_view(['POST'])
def Signup(request):
    username = request.data.get('username')
    password = request.data.get('password')
    name= request.data.get('name')
    email= request.data.get('email')
    dob= request.data.get('dob')
    if not username or not password:
        return Response({"error": "Username and password are required."}, status=400)
    user = User.objects.create_user(username=username, password=password)
    userId=user.id
    try:
        user = User.objects.get(id=int(userId))
    except User.DoesNotExist:
        return Response({"error": "User does not exist."}, status=404)
    try:
        userProfile = UserProfile.objects.create(
            name=name,
            email=email,
            dob=dob,
            user=user
        )
        return Response({"message": "User profile created successfully.", "profileId": userProfile.id}, status=201)
    except Exception as e:
        return Response({"error": str(e)}, status=400)
    
#switch to JWT authentication

# @api_view(['POST'])
# def login(request):
#     username = request.data.get('username')
#     password = request.data.get('password')
#     if not username or not password:
#         return Response({"error": "Username and password are required."}, status=400)
#     try:
#         user = User.objects.get(username=username)
#         if user.check_password(password):
#             return Response({"message": "Login successful.", "userId": user.id}, status=200)
#         else:
#             return Response({"error": "Invalid password."}, status=400)
#     except User.DoesNotExist:
#         return Response({"error": "User does not exist."}, status=404)

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def getProfileInfo(request):
    print("Fetching profile info for user:", request.user.username)
    try:
        user = request.user
        userProfile = UserProfile.objects.get(user=user)
        followers, following = getUserFollowersAndFollowing(user)
        profile_data = {
            "name": userProfile.name,
            "email": userProfile.email,
            "dob": userProfile.dob,
            "userId": user.id,
            "username": user.username,
            "profile_pic": userProfile.profile_pic,
            "bio": userProfile.bio,
            "followers": followers,
            "following": following
        }
        return Response(profile_data, status=200)
    except UserProfile.DoesNotExist:
        return Response({"error": "User profile does not exist."}, status=404)
    except Exception as e:
        return Response({"error": str(e)}, status=500)

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def updateProfilePic(request):
    """Accepts JSON { "profile_pic": "<cloudinary_url>" } and saves to the UserProfile.
    Uses DRF authentication so `request.user` is populated the same way as other views.
    An empty string can be sent to remove the profile picture.
    """
    try:
        user = request.user
        userProfile = UserProfile.objects.get(user=user)
        # Allow profile_pic to be None or empty string (to remove picture)
        if 'profile_pic' not in request.data:
            return Response({"error": "profile_pic field is required in request"}, status=400)
        pic_url = request.data.get('profile_pic', '')
        userProfile.profile_pic = pic_url
        userProfile.save()
        message = "Profile picture removed" if not pic_url else "Profile picture updated"
        return Response({"message": message, "profile_pic": pic_url}, status=200)
    except UserProfile.DoesNotExist:
        return Response({"error": "User profile does not exist."}, status=404)
    except Exception as e:
        return Response({"error": str(e)}, status=500)
    
def getUserFollowersAndFollowing(user):
    followers = Follows.objects.filter(following=user).count()
    following = Follows.objects.filter(follower=user).count()
    return followers, following


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def updateBio(request):
    """Accepts JSON { "bio": "..." } and updates the user's profile bio."""
    try:
        user = request.user
        userProfile = UserProfile.objects.get(user=user)
        bio_text = request.data.get('bio', '')
        userProfile.bio = bio_text
        userProfile.save()
        return Response({"message": "Bio updated", "bio": bio_text}, status=200)
    except UserProfile.DoesNotExist:
        return Response({"error": "User profile does not exist."}, status=404)
    except Exception as e:
        return Response({"error": str(e)}, status=500)


@api_view(['POST'])
def request_otp(request):
    """Dummy endpoint to request an OTP for an email address.
    Accepts JSON { "email": "..." } and always responds with success for testing.
    """
    email = request.data.get('email')
    if not email:
        return Response({"error": "email is required"}, status=400)
    # In a real implementation we'd generate and send an OTP here.
    return Response({"message": "OTP requested", "email": email}, status=200)


@api_view(['POST'])
def verify_otp(request):
    """Dummy endpoint to verify an OTP.
    Accepts JSON { "email": "...", "otp": "..." } and returns success when otp is provided.
    """
    email = request.data.get('email')
    otp = request.data.get('otp')
    if not email or not otp:
        return Response({"error": "email and otp are required"}, status=400)
    # For testing, accept any OTP that is non-empty.
    return Response({"message": "OTP verified", "email": email}, status=200)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def getOtherUserProfileInfo(request):
    user_id = request.GET.get('user_id')
    if not user_id:
        return Response({"error": "user_id parameter is required."}, status=400)
    try:
        user = User.objects.get(id=user_id)
        userProfile = UserProfile.objects.get(user=user)
        followers, following = getUserFollowersAndFollowing(user)
        profile_data = {
            "name": userProfile.name,
            "email": userProfile.email,
            "dob": userProfile.dob,
            "userId": user.id,
            "username": user.username,
            "bio": userProfile.bio,
            "profile_pic": userProfile.profile_pic,
            "followers": followers,
            "following": following
        }
        return Response(profile_data, status=200)
    except User.DoesNotExist:
        return Response({"error": "User does not exist."}, status=404)
    except UserProfile.DoesNotExist:
        return Response({"error": "User profile does not exist."}, status=404)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def changePassword(request):
    """Change user password.
    Accepts JSON { "current_password": "...", "new_password": "..." }
    """
    try:
        user = request.user
        current_password = request.data.get('current_password')
        new_password = request.data.get('new_password')
        
        if not current_password or not new_password:
            return Response({"error": "Both current_password and new_password are required."}, status=400)
        
        # Verify current password
        if not user.check_password(current_password):
            return Response({"error": "Current password is incorrect."}, status=400)
        
        # Validate new password length
        if len(new_password) < 6:
            return Response({"error": "New password must be at least 6 characters long."}, status=400)
        
        # Set new password
        user.set_password(new_password)
        user.save()
        
        return Response({"message": "Password changed successfully."}, status=200)
    except Exception as e:
        return Response({"error": str(e)}, status=500)
