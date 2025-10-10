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
    # If no categories provided, return the most recent clips (excluding requested ids)
    if not top_categories:
        print(f"clips(): No top_categories provided — returning {count} most recent clips excluding IDs: {exclude_ids}")
        qs = Clip.objects.exclude(id__in=exclude_ids).order_by('-created_at')[:count]
        final = [format_clip(c) for c in qs]
        print(f"clips(): returning {len(final)} clips (recent): {[c['id'] for c in final]}")
        return final

    # Find clips tagged with these categories and rank by how many matching tags they have
    print(f"clips(): Searching for clips with categories={top_categories}, exclude_ids={exclude_ids}, count={count}")
    clips_qs = (
        Clip.objects.exclude(id__in=exclude_ids)
        .filter(tags__category__name__in=top_categories)
        .annotate(match_count=Count('tags', filter=Q(tags__category__name__in=top_categories)))
        .order_by('-match_count', '-created_at')
        .distinct()
    )

    # Materialize the queryset and collect match info
    matched = list(clips_qs)
    match_info = [(c.id, getattr(c, 'match_count', 0)) for c in matched]
    print(f"clips(): Found {len(matched)} candidate clips matching categories. match_info (id,match_count): {match_info}")

    # Take the top `count` matches
    clips_list = matched[:count]

    # If we didn't find enough, pad with the most recent clips not already used
    if len(clips_list) < count:
        used_ids = [c.id for c in clips_list] + list(exclude_ids)
        needed = count - len(clips_list)
        extras_qs = Clip.objects.exclude(id__in=used_ids).order_by('-created_at')[:needed]
        extras = list(extras_qs)
        print(f"clips(): Not enough matched clips. Adding {len(extras)} recent extras (ids: {[c.id for c in extras]}) to pad to {count}")
        clips_list.extend(extras)

    final_ids = [c.id for c in clips_list]
    print(f"clips(): Final clip selection (ids): {final_ids}")
    return [format_clip(c) for c in clips_list]


def next_clip(user_data: Optional[pd.DataFrame], count: int = 1, exclude_ids: Optional[Iterable[int]] = None):
    """Return a tuple (clips_list, method_name, top_categories).

    This makes it possible for callers to know which selection strategy
    (Metadata, Trending, Model, or fallback) was used and what top categories
    were considered when fetching clips.
    """
    try:
        functions = [Metadata, Trending, Model]
        weights = [0.5, 0.2, 0.3]

        selected = random.choices(functions, weights)[0]
        top_categories = selected(user_data)
        method_name = selected.__name__
        print("returned data:", top_categories, method_name)
        return clips(top_categories, count, exclude_ids), method_name, top_categories
    except Exception as e:
        print(f"Error in next_clip selection: {e}, falling back to Metadata")
        try:
            top_categories = Metadata(user_data)
            method_name = 'Metadata(fallback)'
            return clips(top_categories, count, exclude_ids), method_name, top_categories
        except Exception as e2:
            print(f"Error in fallback: {e2}, returning recent clips")
            return clips([], count, exclude_ids), 'Recent', []