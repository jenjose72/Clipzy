import random

def Metadata(user_data):
    data = dict(sorted(user_data.items(), key=lambda item: item[1])[-5:])
    return data

def Trending(user_data):
    return "In Progress"

def Model(user_data):
    from joblib import load
    model = load('clipRecmodel.pkl')
    data = model.predict(user_data)
    data = random.choice(data.keys, data.values, k=5)
    return data

def clips(data):
    # Fetch clips from database
    clip_link = "Temp"
    return clip_link

def next_clip():
    functions = ['Metadata','Trending','Model']
    weights = [0.5,0.3,0.2]

    selected = random.choices(functions,weights)
    top_categories = selected(user_data)
    return clips(top_categories)