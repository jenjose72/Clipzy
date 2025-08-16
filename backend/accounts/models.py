from django.db import models
from django.contrib.auth.models import User  # Import Django's built-in User model

# Create your models here.
class UserProfile(models.Model):
    name = models.CharField(max_length=255)
    email = models.EmailField(unique=True)
    dob = models.DateField(null=True, blank=True)
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='profile')  # Refer to Auth User table