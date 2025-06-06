import pandas as pd
import numpy as np
from sklearn.ensemble import RandomForestClassifier
from sklearn.preprocessing import LabelEncoder
from sklearn.model_selection import train_test_split
import pickle
import os
from datetime import datetime, timedelta
import json

MODEL_FILE = "models/loadshedding_model.pkl"
AREA_MODELS_DIR = "models/area_models"

os.makedirs(AREA_MODELS_DIR, exist_ok=True)

def preprocess_data(events):
    """Convert schedule events into features"""
    features = []
    for event in events:
        start = datetime.fromisoformat(event['start'])
        end = datetime.fromisoformat(event['end'])
        
        features.append({
            'day_of_week': start.weekday(),
            'hour': start.hour,
            'duration': (end - start).total_seconds() / 3600,
            'month': start.month,
            'stage': event['stage']
        })
    return pd.DataFrame(features)

def train_model(data):
    """Train national model"""
    # National model predicts stage based on time features
    all_events = []
    for area in data['areas']:
        if 'events' in area:
            all_events.extend(area['events'])
    
    if not all_events:
        return None
    
    df = preprocess_data(all_events)
    
    # Encode categorical features
    le = LabelEncoder()
    df['stage_encoded'] = le.fit_transform(df['stage'])
    
    X = df[['day_of_week', 'hour', 'month']]
    y = df['stage_encoded']
    
    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2)
    
    model = RandomForestClassifier(n_estimators=100)
    model.fit(X_train, y_train)
    
    # Save model and encoder
    with open(MODEL_FILE, 'wb') as f:
        pickle.dump({'model': model, 'encoder': le}, f)
    
    return model

def analyze_schedule(events):
    """Analyze schedule to return statistics"""
    if not events:
        return None
    
    df = preprocess_data(events)
    
    stats = {
        'most_common_day': df['day_of_week'].mode()[0],
        'most_common_hour': df['hour'].mode()[0],
        'average_duration': df['duration'].mean(),
        'total_hours': df['duration'].sum(),
        'stages_distribution': df['stage'].value_counts().to_dict()
    }
    
    return stats

def predict_loadshedding(area_id=None, days_ahead=1):
    """Predict loadshedding for an area or nationally"""
    prediction_date = datetime.now() + timedelta(days=days_ahead)
    
    if area_id:
        # Load area-specific model if exists
        area_model_path = f"{AREA_MODELS_DIR}/{area_id}.pkl"
        if os.path.exists(area_model_path):
            with open(area_model_path, 'rb') as f:
                area_model = pickle.load(f)
            
            features = pd.DataFrame([{
                'day_of_week': prediction_date.weekday(),
                'hour': 18,  # Evening peak
                'month': prediction_date.month
            }])
            
            prediction = area_model.predict(features)[0]
            return {
                'date': prediction_date.strftime("%Y-%m-%d"),
                'predicted_stage': prediction,
                'area_id': area_id
            }
    
    # Default to national prediction
    if os.path.exists(MODEL_FILE):
        with open(MODEL_FILE, 'rb') as f:
            model_data = pickle.load(f)
        
        features = pd.DataFrame([{
            'day_of_week': prediction_date.weekday(),
            'hour': 18,  # Evening peak
            'month': prediction_date.month
        }])
        
        stage_encoded = model_data['model'].predict(features)[0]
        stage = model_data['encoder'].inverse_transform([stage_encoded])[0]
        
        return {
            'date': prediction_date.strftime("%Y-%m-%d"),
            'predicted_stage': stage,
            'scope': 'national'
        }
    
    return None