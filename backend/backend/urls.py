from django.contrib import admin
from django.urls import path, include

urlpatterns = [
    path('admin/', admin.site.urls),
    path('accounts/', include('accounts.urls')),
    path('features/', include('features.urls')),
    path('chat/', include('chat.urls')),
]