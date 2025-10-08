from joblib import dump
import os
import time
import django
import numpy as np
import pandas as pd

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()
from Posts.models import UserMetadata
from accounts.models import UserProfile
from features.models import VideoCategory

def get_user_category_matrix():
    qs = UserMetadata.objects.select_related('name', 'categories').values(
        'name__id', 'name__name', 'categories__id', 'categories__name', 'weights'
    )
    df = pd.DataFrame(list(qs))

    if df.empty:
        users = UserProfile.objects.all().values('id', 'name')
        categories = VideoCategory.objects.all().values('id', 'name')
        return pd.DataFrame(
            0,
            index=[u['name'] for u in users],
            columns=[c['name'] for c in categories]
        )

    matrix = df.pivot_table(
        index='name__name',
        columns='categories__name',
        values='weights',
        fill_value=0
    )
    matrix.index.name = 'Uname'
    matrix.columns.name = 'Category'
    return matrix

from model import ClipRecommender

model = ClipRecommender()
while True:
    df = get_user_category_matrix()
    model.fit(df)
    dump(model,'clipRecmodel.pkl')
    # Sleep for 2 hours
    