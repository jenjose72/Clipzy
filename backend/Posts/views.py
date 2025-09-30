from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response

from .next_clip import next_clip
from posts.models import Metadata, UserMetadata
import pandas as pd

@api_view(['POST'])
@permission_classes([AllowAny])
def get_next_clip(request):
    user_id = 1
    if not user_id:
        return Response(
            {"error": "user_id required"},
            status=status.HTTP_400_BAD_REQUEST
        )

    qs = UserMetadata.objects.filter(user_id=user_id).select_related('metadata').values(
        'metadata__name', 'weight'
    )
    df = pd.DataFrame(list(qs))
    categories = Metadata.objects.all().values_list('name', flat=True)

    if df.empty:
        user_data = pd.DataFrame(
            [ [0]*len(categories) ],
            index=[user_id],
            columns=categories
        )
    else:
        user_data = df.pivot_table(
            index=lambda x: user_id,  
            columns='metadata__name',
            values='weight',
            fill_value=0
        )
        user_data = user_data.reindex(columns=categories, fill_value=0)

    try:
        result = next_clip(user_data)
    except Exception as e:
        return Response(
            {"error": str(e)},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )

    return Response({"clips": result}, status=status.HTTP_200_OK)
