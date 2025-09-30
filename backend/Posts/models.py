from django.db import models
from accounts.models import UserProfile
from features.models import VideoCategory

# Create your models here.
class UserMetadata(models.Model):
    name = models.ForeignKey(UserProfile, related_name='metadata', on_delete=models.CASCADE)
    categories = models.ForeignKey(VideoCategory, related_name='user_metadata', on_delete=models.CASCADE)
    weights = models.FloatField(default=0, blank=0)