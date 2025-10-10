from django.db import models
from django.contrib.auth.models import User  # Import Django's built-in User model

# Create your models here.
class UserProfile(models.Model):
    name = models.CharField(max_length=255)
    email = models.EmailField(unique=True)
    dob = models.DateField(null=True, blank=True)
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='profile')  # Refer to Auth User table
    # Track IDs of clips that have been shown to this user to avoid re-serving them
    # Stored as a JSON list of integers. Requires Django 3.1+ for JSONField on all DB backends.
    try:
        from django.db.models import JSONField  # type: ignore
    except Exception:
        # Fallback for older Django versions / DB backends — use TextField as simple fallback
        JSONField = None  # type: ignore

    if JSONField:
        watched_ids = JSONField(default=list, blank=True)
    else:
        from django.db import models as _models
        watched_ids = _models.TextField(default='[]', blank=True)
    # Optional profile picture URL (stored as text/URL)
    # short biography / about text
    bio = models.TextField(null=True, blank=True)

    # Optional profile picture URL (stored as text/URL)
    profile_pic = models.TextField(null=True, blank=True)