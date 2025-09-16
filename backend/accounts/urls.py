from django.urls import path
from .views import Signup, home, getProfileInfo, getOtherUserProfileInfo, request_otp, verify_otp
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView

urlpatterns = [
    path('signup/', Signup, name='Signup'),
    #path('signup2/', signupSecond, name='signupSecond'),
    # path('login/', login, name='login'),
    path('home/', home, name='home'),
    path('profile/', getProfileInfo, name='getProfileInfo'),
    path('token/', TokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    path('getOtherProfile/', getOtherUserProfileInfo, name='getOtherProfile')
    ,
    path('request-otp/', request_otp, name='request_otp'),
    path('verify-otp/', verify_otp, name='verify_otp')
]