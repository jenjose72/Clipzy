"""Recommendation helper for Posts app.

This module exposes next_clip(user_data, count=1, exclude_ids=None)
which returns a list of clip dictionaries with the fields the frontend
expects: id, caption, clipUrl, likeCount, created_at, categories.

It randomly selects between Metadata, Trending, or Model based on weights,
then fetches clips based on the selected categories.
"""
from typing import List, Iterable, Optional
import random
import pandas as pd
from django.db.models import Count, Q


def load_model():
    import os
    from joblib import load
    model_path = os.path.join(os.path.dirname(__file__), '..', 'clipRecmodel.pkl')
    try:
        model = load(model_path)
    except FileNotFoundError:
        raise Exception("Model not created yet.\nRun 'manage.py ClipModelTrain' first")
    except Exception as e:
        raise Exception(f"Error loading model: {e}")
    return model


def Metadata(user_data):
    if user_data is None or (isinstance(user_data, pd.DataFrame) and user_data.empty):
        return []
    try:
        series = user_data.iloc[0]
        data = dict(sorted(series.items(), key=lambda item: item[1])[-5:])
        return list(data.keys())
    except:
        return []


def Trending(user_data):
    try:
        model = load_model()
        data = [item[0] for item in model.trending[:5]]
        return data
    except Exception as e:
        print(f"Error in Trending: {e}")
        return []


def Model(user_data):
    try:
        model = load_model()
        data = model.predict(user_data)
        # Assuming data is a dict with categories as keys and scores as values
        if isinstance(data, dict):
            categories = list(data.keys())
            weights = list(data.values())
            selected = random.choices(categories, weights=weights, k=5)
            return selected
        else:
            # If not dict, assume list
            return random.sample(data, min(5, len(data)))
    except Exception as e:
        print(f"Error in Model: {e}")
        return []


def clips(top_categories, count=1, exclude_ids=None):
    """Fetch clips from database based on top_categories."""
    from features.models import Clip

    if exclude_ids is None:
        exclude_ids = []
    else:
        exclude_ids = [int(i) for i in exclude_ids]

    def format_clip(clip_obj):
        categories = list(clip_obj.tags.all().values_list('category__name', flat=True))
        return {
            'id': clip_obj.id,
            'caption': clip_obj.caption,
            'clipUrl': clip_obj.clipUrl,
            'likeCount': clip_obj.likeCount,
            'created_at': clip_obj.created_at.isoformat() if getattr(clip_obj, 'created_at', None) is not None else None,
            'categories': categories,
        }

    if not top_categories:
        qs = Clip.objects.exclude(id__in=exclude_ids).order_by('-created_at')[:count]
        return [format_clip(c) for c in qs]

    # Find clips tagged with these categories
    clips_qs = (
        Clip.objects.exclude(id__in=exclude_ids)
        .filter(tags__category__name__in=top_categories)
        .annotate(match_count=Count('tags', filter=Q(tags__category__name__in=top_categories)))
        .order_by('-match_count', '-created_at')
        .distinct()
    )

    clips_list = list(clips_qs[:count])

    # If not enough, pad with recent
    if len(clips_list) < count:
        used_ids = [c.id for c in clips_list] + list(exclude_ids)
        extras = list(Clip.objects.exclude(id__in=used_ids).order_by('-created_at')[: (count - len(clips_list))])
        clips_list.extend(extras)

    return [format_clip(c) for c in clips_list]


def next_clip(user_data: Optional[pd.DataFrame], count: int = 1, exclude_ids: Optional[Iterable[int]] = None) -> List[dict]:
    try:
        functions = [Metadata, Trending, Model]
        weights = [0.5, 0.2, 0.3]

        selected = random.choices(functions, weights)[0]
        top_categories = selected(user_data)
        print("returned data:", top_categories,selected.__name__)
        return clips(top_categories, count, exclude_ids)
    except Exception as e:
        print(f"Error in next_clip selection: {e}, falling back to Metadata")
        try:
            top_categories = Metadata(user_data)
            return clips(top_categories, count, exclude_ids)
        except Exception as e2:
            print(f"Error in fallback: {e2}, returning recent clips")
            return clips([], count, exclude_ids)