import random
def load_model():
    from joblib import load
    try:
        model = load('clipRecmodel.pkl')
    except:
        raise Exception("Model not created yet.\nRun 'manage.py ClipModelTrain' first")
    return model

def Metadata(user_data):
    data = dict(sorted(user_data.items(), key=lambda item: item[1])[-5:])
    return data
def Trending(user_data):
    model = load_model()
    data = model.trending[:5]
    return data
def Model(user_data):
    model = load_model()
    data = model.predict(user_data)
    data = random.choice(data.keys, data.values, k=5)
    return data

def clips(data):
    # Fetch clips from database
    clip_link = "Temp"
    return clip_link

def next_clip(user_data):
    functions = [Metadata,Trending,Model]
    weights = [0.5,0.2,0.3]

    selected = random.choices(functions,weights)
    top_categories = selected(user_data)
    return clips(top_categories)