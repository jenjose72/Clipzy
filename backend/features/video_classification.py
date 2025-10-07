import os
import cv2
import base64
import json
from io import BytesIO
from PIL import Image
from collections import Counter
from dotenv import load_dotenv
import google.generativeai as genai

load_dotenv()
api_key = os.getenv("API_KEY")
if not api_key:
    raise ValueError("API_KEY not found in .env file")
genai.configure(api_key=api_key)

# List available models for debugging
# try:
#     models = genai.list_models()
#     print("📋 Available models:")
#     for model_info in models:
#         print(f"  - {model_info.name}")
# except Exception as e:
#     print(f"Error listing models: {e}")

model = genai.GenerativeModel("gemini-2.0-flash-lite")

def extract_frames(video_path, every_n_frames=80):
    cap = cv2.VideoCapture(video_path)
    frames = []
    count = 0
    while cap.isOpened():
        ret, frame = cap.read()
        if not ret:
            break
        if count % every_n_frames == 0:
            frames.append(frame)
        count += 1
    cap.release()
    return frames

def encode_image(frame):
    img = Image.fromarray(cv2.cvtColor(frame, cv2.COLOR_BGR2RGB))
    buffer = BytesIO()
    img.save(buffer, format="JPEG")
    return base64.b64encode(buffer.getvalue()).decode("utf-8")

def classify_frame(frame):
    try:
        b64_image = encode_image(frame)
        print(f"🔍 Processing frame with image size: {len(b64_image)} characters")

        response = model.generate_content([
            "Classify this frame into high-level categories like [Sports, Animals, Food, Cooking, Technology, Nature, People, Car, Funny, Racing, Romance, Music, Travel, Adventure, Relaxing, Dance, Fashion, Motivation]. Respond ONLY with a JSON list of labels. No extra text, no markdown.",
            {"mime_type": "image/jpeg", "data": b64_image}
        ])

        print(f"📡 API Response received. Has text: {hasattr(response, 'text')}")
        print(f"📡 Response object: {response}")
        print(f"📡 Response dir: {dir(response)}")

        if hasattr(response, 'text') and response.text:
            print(f"Response text: {response.text}")
            return response.text.strip()
        else:
            print("No text in response")
            return "[]"

    except Exception as e:
        print(f"Error in classify_frame: {str(e)}")
        print(f"Error type: {type(e)}")
        import traceback
        traceback.print_exc()
        return "[]"

def aggregate_labels(frame_labels):
    all_labels = []
    for lbl in frame_labels:
        cleaned_lbl = lbl.strip().replace("```json", "").replace("```", "").strip()
        try:
            parsed = json.loads(cleaned_lbl)
            all_labels.extend(parsed)
        except:
            cleaned = cleaned_lbl.replace("[", "").replace("]", "").replace('"', "")
            all_labels.extend([x.strip() for x in cleaned.split(",")])
    counts = Counter([x for x in all_labels if x])
    print("Label counts:", counts)
    return counts.most_common()
