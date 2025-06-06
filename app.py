from flask import Flask, render_template, request, jsonify
import pandas as pd
import requests
from datetime import datetime
import os
import ml_model
from threading import Lock
import json

app = Flask(__name__)
lock = Lock()

# Configuration
API_KEY = "your_eskomsepush_api_key"
API_URL = "https://developer.sepush.co.za/business/2.0/"
DATA_FILE = "data/loadshedding_data.json"
USAGE_FILE = "data/usage_log.csv"
MODEL_FILE = "models/loadshedding_model.pkl"
AREAS_FILE = "data/sa_areas.json"

# Ensure directories exist
os.makedirs("data", exist_ok=True)
os.makedirs("models", exist_ok=True)

def log_usage(endpoint, area=None):
    """Log user access to a CSV file"""
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    with lock:
        try:
            df = pd.DataFrame([[timestamp, endpoint, area]], 
                             columns=["timestamp", "endpoint", "area"])
            df.to_csv(USAGE_FILE, mode='a', header=not os.path.exists(USAGE_FILE), index=False)
        except Exception as e:
            print(f"Error logging usage: {e}")

def fetch_loadshedding_data():
    """Fetch loadshedding data from API"""
    try:
        headers = {"token": API_KEY}
        
        # Get national status
        status_url = f"{API_URL}status"
        status_response = requests.get(status_url, headers=headers)
        status_response.raise_for_status()
        
        # Get areas (cached after first fetch)
        if not os.path.exists(AREAS_FILE):
            areas_url = f"{API_URL}areas_search?text=South Africa"
            areas_response = requests.get(areas_url, headers=headers)
            areas_response.raise_for_status()
            with open(AREAS_FILE, 'w') as f:
                json.dump(areas_response.json(), f)
        
        with open(AREAS_FILE) as f:
            areas_data = json.load(f)
        
        # Combine data
        data = {
            "national_status": status_response.json(),
            "areas": areas_data['areas'],
            "timestamp": datetime.now().isoformat()
        }
        
        with open(DATA_FILE, 'w') as f:
            json.dump(data, f)
            
        return data
    except Exception as e:
        print(f"Error fetching data: {e}")
        if os.path.exists(DATA_FILE):
            with open(DATA_FILE) as f:
                return json.load(f)
        return None

def get_area_schedule(area_id):
    """Get schedule for specific area"""
    try:
        headers = {"token": API_KEY}
        url = f"{API_URL}area?id={area_id}"
        response = requests.get(url, headers=headers)
        response.raise_for_status()
        return response.json()
    except Exception as e:
        print(f"Error fetching area schedule: {e}")
        return None

@app.route('/')
def dashboard():
    log_usage('dashboard')
    data = fetch_loadshedding_data()
    
    if data:
        # Prepare national summary
        national_status = data['national_status']['status']
        
        # Prepare data for visualizations
        national_stats = {
            'current_stage': national_status['eskom_stage'],
            'next_stage': national_status['eskom_next_stage'],
            'updated': national_status['updated']
        }
        
        # Train/update model
        ml_model.train_model(data)
        
        return render_template('index.html', 
                            national_stats=national_stats,
                            areas=data['areas'])
    else:
        return render_template('index.html', error="Failed to load data")

@app.route('/area/<area_id>')
def area_dashboard(area_id):
    area_schedule = get_area_schedule(area_id)
    log_usage('area_view', area_id)
    
    if area_schedule:
        # Prepare area-specific data
        events = area_schedule['events']
        schedule_stats = ml_model.analyze_schedule(events)
        
        # Make predictions
        prediction = ml_model.predict_loadshedding(area_id)
        
        return jsonify({
            'status': 'success',
            'schedule': events,
            'stats': schedule_stats,
            'prediction': prediction
        })
    return jsonify({'status': 'error', 'message': 'Failed to load area data'})

@app.route('/predict', methods=['POST'])
def predict():
    log_usage('prediction')
    try:
        area_id = request.json.get('area_id')
        days_ahead = request.json.get('days_ahead', 1)
        prediction = ml_model.predict_loadshedding(area_id, days_ahead)
        return jsonify({'prediction': prediction})
    except Exception as e:
        return jsonify({'error': str(e)}), 400

if __name__ == '__main__':
    app.run(debug=True)