from joblib import dump
import os
import time
import django
import numpy as np
import pandas as pd

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()
from posts.models import Metadata, UserMetadata
from accounts.models import UserProfile

def get_user_category_matrix():
    qs = UserMetadata.objects.select_related('user', 'metadata').values(
        'user__id', 'user__name', 'metadata__id', 'metadata__name', 'weight'
    )
    df = pd.DataFrame(list(qs))

    if df.empty:
        users = UserProfile.objects.all().values('id', 'name')
        categories = Metadata.objects.all().values('id', 'name')
        return pd.DataFrame(
            0,
            index=[u['name'] for u in users],
            columns=[c['name'] for c in categories]
        )

    matrix = df.pivot_table(
        index='user__name',
        columns='metadata__name',
        values='weight',
        fill_value=0
    )
    matrix.index.name = 'Uname'
    matrix.columns.name = 'Category'
    return matrix

class ClipRecommender:
  def __init__(self):
    self.C = None
    self.features = None
    self.lastdf = None
    self.trending = []
    self.norm = None

  def fit(self, df: pd.DataFrame, drop_cols=("Uname",)):
    self.features = [c for c in df.columns if c not in set(drop_cols)]
    if self.lastdf is not None:
      common = df.merge(self.lastdf, on="Uname", suffixes=("_new", "_old"))
      trending_scores = {}
      for f in self.features:
        trending_scores[f] = (common[f + "_new"] - common[f + "_old"]).sum()
      self.trending = sorted(trending_scores.items(), key=lambda x:x[1], reverse=True)

      X_new = df[self.features].iloc[len(self.lastdf):].to_numpy(dtype=float)
      Xn_new = X_new / self.norm
      self.C += Xn_new.T @ Xn_new
    else:
      X = df[self.features].to_numpy(dtype=float)
      self.norm = np.linalg.norm(X, axis=0, keepdims=True)
      self.norm[self.norm == 0] = 1
      Xn = X / self.norm
      self.C = Xn.T @ Xn

    self.lastdf = df.copy()
    return self

  def predict(self, x: dict, squash=True):
    vec = np.array([float(x.get(f, 0.0)) for f in self.features])
    vec = vec / self.norm.flatten()
    adjusted = self.C @ vec

    if squash:
      adjusted = np.tanh(adjusted)
      adjusted = 0.8 * adjusted + 0.2 * vec

    return {f: float(f"{a:.6f}") for f, a in zip(self.features, adjusted)}

model = ClipRecommender()
while True:
    df = get_user_category_matrix()
    model.fit(df)
    dump(model,'clipRecmodel.pkl')
    time.sleep(2*60*60) # Sleep for 2 hours
