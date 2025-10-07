"""Recommendation helper for Posts app.

This module exposes next_clip(user_data, count=1, exclude_ids=None)
which returns a list of clip dictionaries with the fields the frontend
expects: id, caption, clipUrl, likeCount, created_at, categories.

It uses user's metadata (pandas DataFrame with category columns) to
pick top categories and returns clips tagged with those categories,
filling with recent clips if needed.
"""
from typing import List, Iterable, Optional

import pandas as pd
from django.db.models import Count, Q


def next_clip(user_data: Optional[pd.DataFrame], count: int = 1, exclude_ids: Optional[Iterable[int]] = None) -> List[dict]:
    """Return up to `count` recommended clips as dicts.

    user_data: pandas DataFrame (one-row) where columns are category names
               and values are weights. If None or empty, falls back to
               returning recent clips.
    exclude_ids: iterable of clip ids to exclude from results.
    """
    from features.models import Clip

    if exclude_ids is None:
        exclude_ids = []
    else:
        # ensure list of ints
        exclude_ids = [int(i) for i in exclude_ids]

    # Helper to format Clip -> dict
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

    # If no user data or empty, return most recent clips
    if user_data is None or (isinstance(user_data, pd.DataFrame) and user_data.empty):
        qs = Clip.objects.exclude(id__in=exclude_ids).order_by('-created_at')[:count]
        return [format_clip(c) for c in qs]

    # Expect a one-row DataFrame; take that row's series
    try:
        series = user_data.iloc[0]
    except Exception:
        series = None

    if series is None or not hasattr(series, 'sort_values'):
        qs = Clip.objects.exclude(id__in=exclude_ids).order_by('-created_at')[:count]
        return [format_clip(c) for c in qs]

    # Pick top categories (non-zero) - limit to top 5
    top_series = series.sort_values(ascending=False).head(5)
    top_categories = [str(col) for col, val in top_series.items() if pd.notna(val) and float(val) > 0]

    if not top_categories:
        qs = Clip.objects.exclude(id__in=exclude_ids).order_by('-created_at')[:count]
        return [format_clip(c) for c in qs]

    # Find clips tagged with these categories, annotate by how many of the top categories they match
    clips_qs = (
        Clip.objects.exclude(id__in=exclude_ids)
        .filter(tags__category__name__in=top_categories)
        .annotate(match_count=Count('tags', filter=Q(tags__category__name__in=top_categories)))
        .order_by('-match_count', '-created_at')
        .distinct()
    )

    clips_list = list(clips_qs[:count])

    # If not enough results, pad with recent clips not already included
    if len(clips_list) < count:
        used_ids = [c.id for c in clips_list] + list(exclude_ids)
        extras = list(Clip.objects.exclude(id__in=used_ids).order_by('-created_at')[: (count - len(clips_list)) ])
        clips_list.extend(extras)

    return [format_clip(c) for c in clips_list]