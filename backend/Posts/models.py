from django.db import models
from accounts.models import UserProfile

# Create your models here.
class Categories(models.Model):
    Category_name = models.CharField()

class Metadata(models.Model):
    name = models.ForeignKey(UserProfile, related_name='metadata', on_delete=models.CASCADE)
    categories = models.ForeignKey(Categories, related_name='metadata', on_delete=models.CASCADE)
    weights = models.FloatField(default=0, blank=0)