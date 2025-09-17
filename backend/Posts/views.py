from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response

from .queue_builder import next_clip   # your functions live here


@api_view(['POST'])
@permission_classes([AllowAny])
def get_next_clip(request):
    user_data = request.data.get("user_data")
    if not user_data:
        return Response(
            {"error": "user_data required"},
            status=status.HTTP_400_BAD_REQUEST
        )

    try:
        result = next_clip(user_data)
    except Exception as e:
        return Response(
            {"error": str(e)},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )

    return Response({"clips": result}, status=status.HTTP_200_OK)
