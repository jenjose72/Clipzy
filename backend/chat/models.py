from django.db import models
from django.contrib.auth.models import User

class ChatRoom(models.Model):
    name = models.CharField(max_length=255, blank=True, null=True)
    participants = models.ManyToManyField(User, related_name="chatrooms")

class Message(models.Model):
    room = models.ForeignKey(ChatRoom, on_delete=models.CASCADE, related_name="messages")
    sender = models.ForeignKey(User, on_delete=models.CASCADE)
    content = models.TextField(blank=True, null=True)  # text msg
    video = models.ForeignKey("features.Clip", on_delete=models.SET_NULL, null=True, blank=True)  # shared TikTok
    timestamp = models.DateTimeField(auto_now_add=True)
    is_read = models.BooleanField(default=False)
