from django.shortcuts import render
from django.contrib.auth.models import User
from .models import UserProfile
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