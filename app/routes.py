from flask import Blueprint, jsonify, request
from datetime import datetime, timedelta
import random

bp = Blueprint('routes', __name__)

@bp.route('/api/calendar/<int:year>/<int:month>')
def get_calendar_data(year, month):
    """Generate mock calendar data with predicted loadshedding days"""
    days_in_month = (datetime(year, month % 12 + 1, 1) - timedelta(days=1)).day
    calendar_data = []
    
    for day in range(1, days_in_month + 1):
        date = datetime(year, month, day)
        # Mock prediction - more likely on weekdays
        is_weekday = date.weekday() < 5
        has_shedding = is_weekday and random.random() > 0.3
        stage = random.randint(1, 4) if has_shedding else 0
        
        calendar_data.append({
            'day': day,
            'has_shedding': has_shedding,
            'stage': stage
        })
    
    return jsonify(calendar_data)

@bp.route('/api/notifications', methods=['POST'])
def handle_notification():
    """Handle notification signups"""
    data = request.json
    # In a real app, store this in a database
    return jsonify({
        'status': 'success',
        'message': 'Notification preferences saved'
    })

@bp.route('/api/energy-tips')
def get_energy_tips():
    """Get context-aware energy saving tips"""
    tips = [
        "Turn off geyser during peak hours to save electricity",
        "Use LED bulbs which consume less power",
        "Unplug devices when not in use to prevent phantom load",
        "Set air conditioner to 23°C for optimal efficiency",
        "Use natural light during the day instead of artificial lighting"
    ]
    return jsonify({'tips': tips})