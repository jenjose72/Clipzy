from django.db import models
from accounts.models import UserProfile

# Create your models here.
class Metadata(models.Model):
    name = models.CharField()

class UserMetadata(models.Model):
    name = models.ForeignKey(UserProfile, related_name='metadata', on_delete=models.CASCADE)
    categories = models.ForeignKey(Metadata, related_name='metadata', on_delete=models.CASCADE)
    weights = models.FloatField(default=0, blank=0)