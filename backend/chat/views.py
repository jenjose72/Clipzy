from django.shortcuts import render

# Create your views here.
def getUsers(request):
    currentUser=request.GET.get('userId')
    
    return 