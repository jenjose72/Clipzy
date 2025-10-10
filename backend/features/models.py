from django.db import models

# Create your models here.
class Clip(models.Model):
    caption = models.CharField(max_length=255)
    clipUrl= models.URLField()
    uploader = models.ForeignKey('auth.User', related_name='clips', on_delete=models.SET_NULL, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    likeCount = models.IntegerField(default=0)
    viewCount = models.IntegerField(default=0)

class Like(models.Model):
    clip = models.ForeignKey(Clip, related_name='likes', on_delete=models.CASCADE)
    user = models.ForeignKey('auth.User', related_name='likes', on_delete=models.CASCADE)
    created_at = models.DateTimeField(auto_now_add=True)

class Comment(models.Model):
    clip = models.ForeignKey(Clip, related_name='comments', on_delete=models.CASCADE)
    user = models.ForeignKey('auth.User', related_name='comments', on_delete=models.CASCADE)
    comment = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)

class views(models.Model):
    clip = models.ForeignKey(Clip, related_name='views', on_delete=models.CASCADE)
    user = models.ForeignKey('auth.User', related_name='views', on_delete=models.CASCADE)
    created_at = models.DateTimeField(auto_now_add=True)

class Follows(models.Model):
    follower = models.ForeignKey('auth.User', related_name='following', on_delete=models.CASCADE)
    following = models.ForeignKey('auth.User', related_name='followers', on_delete=models.CASCADE)
    created_at = models.DateTimeField(auto_now_add=True)

class VideoCategory(models.Model):
    name= models.CharField(max_length=100, unique=True)\
    
class TaggedVideo(models.Model):
    clip = models.ForeignKey(Clip, related_name='tags', on_delete=models.CASCADE)
    category = models.ForeignKey(VideoCategory, related_name='tagged_videos', on_delete=models.CASCADE)
    created_at = models.DateTimeField(auto_now_add=True)