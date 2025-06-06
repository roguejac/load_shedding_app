// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    // Initialize map
    const map = L.map('map').setView([-28.4796, 24.6987], 5);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(map);

    // Initialize charts
    let timeChart, dayChart, stageChart;
    
    // Load initial data
    loadNationalData();
    populateAreaDropdown();
    updateCalendar();
    populateNotificationAreas();
    loadEnergyTips();
    
    // Event listeners
    document.getElementById('areaDropdown').addEventListener('change', function() {
        const selectedArea = this.value;
        if (selectedArea === 'national') {
            loadNationalData();
        } else {
            loadAreaData(selectedArea);
        }
    });
    
    document.getElementById('predictButton').addEventListener('click', makePrediction);
    document.getElementById('prevMonth').addEventListener('click', () => updateCalendar(-1));
    document.getElementById('nextMonth').addEventListener('click', () => updateCalendar(1));
    document.getElementById('applianceSelect').addEventListener('change', toggleCustomWatts);
    document.getElementById('addAppliance').addEventListener('click', addAppliance);
    document.getElementById('notificationForm').addEventListener('submit', handleNotificationSignup);
});

// Data Loading Functions
function loadNationalData() {
    fetch('/')
        .then(response => response.json())
        .then(data => {
            if (data.error) {
                showError(data.error);
                return;
            }
            
            updateStatusCard(data.national_stats, true);
            updateCharts(data.chartData);
            updateMap(data.mapData);
        })
        .catch(error => showError('Error loading national data: ' + error));
}

function loadAreaData(areaId) {
    fetch(`/area/${areaId}`)
        .then(response => response.json())
        .then(data => {
            if (data.status !== 'success') {
                showError(data.message);
                return;
            }
            
            updateStatusCard(data.stats, false, areaId);
            updateTimeChart(data.schedule);
            updateDayChart(data.schedule);
            updateStageChart(data.stats.stages_distribution);
            displayPrediction(data.prediction);
        })
        .catch(error => showError('Error loading area data: ' + error));
}

function populateAreaDropdown() {
    fetch('/')
        .then(response => response.json())
        .then(data => {
            if (!data.areas) return;
            
            const dropdown = document.getElementById('areaDropdown');
            const notificationDropdown = document.getElementById('notificationArea');
            
            // Clear existing options except first
            while (dropdown.options.length > 1) dropdown.remove(1);
            while (notificationDropdown.options.length > 1) notificationDropdown.remove(1);
            
            data.areas.forEach(area => {
                const option = document.createElement('option');
                option.value = area.id;
                option.textContent = area.name;
                dropdown.appendChild(option.cloneNode(true));
                notificationDropdown.appendChild(option);
            });
        })
        .catch(error => console.error('Error loading areas:', error));
}

function populateNotificationAreas() {
    // Already handled in populateAreaDropdown()
}

// UI Update Functions
function updateStatusCard(stats, isNational, areaName = '') {
    const title = isNational ? 'National Loadshedding Status' : `${areaName} Loadshedding Status`;
    document.getElementById('scopeTitle').textContent = title;
    
    if (isNational) {
        document.getElementById('currentStage').textContent = `Stage: ${stats.current_stage}`;
        document.getElementById('nextStage').textContent = `Next Stage: ${stats.next_stage || 'Unknown'}`;
        document.getElementById('updatedTime').textContent = new Date(stats.updated).toLocaleString();
    } else {
        document.getElementById('currentStage').textContent = `Average Duration: ${stats.average_duration.toFixed(1)}h`;
        document.getElementById('nextStage').textContent = `Total Hours: ${stats.total_hours.toFixed(1)}h`;
        document.getElementById('updatedTime').textContent = `Peak: Day ${stats.most_common_day + 1}, ${stats.most_common_hour}:00`;
    }
}

function updateCharts(data) {
    // Implementation would depend on your specific chart data structure
    // This would update all charts with national data
}

function updateMap(data) {
    // Implementation would depend on your map data structure
    // This would update the map with national hotspots
}

// Calendar Functions
let currentMonth = new Date().getMonth();
let currentYear = new Date().getFullYear();

function updateCalendar(monthChange = 0) {
    currentMonth += monthChange;
    if (currentMonth > 11) {
        currentMonth = 0;
        currentYear++;
    } else if (currentMonth < 0) {
        currentMonth = 11;
        currentYear--;
    }
    
    const monthNames = ["January", "February", "March", "April", "May", "June",
                       "July", "August", "September", "October", "November", "December"];
    document.getElementById('currentMonth').textContent = `${monthNames[currentMonth]} ${currentYear}`;
    
    fetch(`/api/calendar/${currentYear}/${currentMonth + 1}`)
        .then(response => response.json())
        .then(data => renderCalendar(data))
        .catch(error => console.error('Error loading calendar data:', error));
}

function renderCalendar(calendarData) {
    const firstDay = new Date(currentYear, currentMonth, 1).getDay();
    const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
    
    const calendar = document.getElementById('calendar');
    calendar.innerHTML = '';
    
    // Add day headers
    ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].forEach(day => {
        const dayElement = document.createElement('div');
        dayElement.className = 'calendar-day header';
        dayElement.textContent = day;
        calendar.appendChild(dayElement);
    });
    
    // Add empty cells for days before the first day
    for (let i = 0; i < firstDay; i++) {
        const emptyDay = document.createElement('div');
        emptyDay.className = 'calendar-day';
        calendar.appendChild(emptyDay);
    }
    
    // Add days of the month
    calendarData.forEach(dayData => {
        const dayElement = document.createElement('div');
        dayElement.className = 'calendar-day';
        dayElement.textContent = dayData.day;
        
        if (dayData.has_shedding) {
            dayElement.classList.add('shedding');
            dayElement.setAttribute('data-stage', `Stage ${dayData.stage}`);
        }
        
        calendar.appendChild(dayElement);
    });
}

// Impact Calculator Functions
function toggleCustomWatts() {
    const customWatts = document.getElementById('customWatts');
    customWatts.style.display = this.value === 'custom' ? 'block' : 'none';
}

function addAppliance() {
    const applianceSelect = document.getElementById('applianceSelect');
    const customWatts = document.getElementById('customWatts');
    const hoursUsed = document.getElementById('hoursUsed');
    
    if (!applianceSelect.value || !hoursUsed.value) {
        showError("Please select an appliance and enter hours used");
        return;
    }
    
    const applianceList = document.getElementById('applianceList');
    const applianceItem = document.createElement('div');
    applianceItem.className = 'appliance-item';
    
    let watts, name;
    const applianceMap = {
        'fridge': { watts: 200, name: 'Fridge' },
        'tv': { watts: 150, name: 'TV' },
        'computer': { watts: 300, name: 'Computer' },
        'lights': { watts: 100, name: 'Lights' }
    };
    
    if (applianceSelect.value === 'custom') {
        watts = parseInt(customWatts.value) || 0;
        name = 'Custom Appliance';
        if (watts <= 0) {
            showError("Please enter valid wattage for custom appliance");
            return;
        }
    } else {
        watts = applianceMap[applianceSelect.value].watts;
        name = applianceMap[applianceSelect.value].name;
    }
    
    applianceItem.innerHTML = `
        <span>${name} (${watts}W)</span>
        <span>${hoursUsed.value} hrs/day</span>
        <span class="remove-appliance">×</span>
    `;
    
    applianceList.appendChild(applianceItem);
    updateCalculatorResults();
    
    // Add remove functionality
    applianceItem.querySelector('.remove-appliance').addEventListener('click', function() {
        applianceItem.remove();
        updateCalculatorResults();
    });
    
    // Reset form
    applianceSelect.value = '';
    customWatts.style.display = 'none';
    customWatts.value = '';
    hoursUsed.value = '';
}

function updateCalculatorResults() {
    const appliances = document.querySelectorAll('.appliance-item');
    let totalDailyWh = 0;
    
    appliances.forEach(appliance => {
        const wattMatch = appliance.textContent.match(/\((\d+)W\)/);
        const hoursMatch = appliance.textContent.match(/(\d+(\.\d+)?) hrs/);
        
        if (wattMatch && hoursMatch) {
            const watts = parseInt(wattMatch[1]);
            const hours = parseFloat(hoursMatch[1]);
            totalDailyWh += watts * hours;
        }
    });
    
    // Assume 4 hours of loadshedding per day
    const sheddingWh = totalDailyWh * (4 / 24);
    // Convert to 12V battery Ah (Wh / V = Ah)
    const batteryAh = sheddingWh / 12;
    
    document.getElementById('dailyUsage').textContent = (totalDailyWh / 1000).toFixed(2);
    document.getElementById('sheddingUsage').textContent = (sheddingWh / 1000).toFixed(2);
    document.getElementById('batterySize').textContent = batteryAh.toFixed(1);
}

// Notification Functions
function handleNotificationSignup(e) {
    e.preventDefault();
    
    const email = document.getElementById('notificationEmail').value;
    const area = document.getElementById('notificationArea').value;
    const stage = document.getElementById('notificationStage').value;
    
    if (!email || !area) {
        showNotificationMessage('Please fill in all required fields', 'error');
        return;
    }
    
    fetch('/api/notifications', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            email: email,
            area: area,
            stage: stage
        })
    })
    .then(response => response.json())
    .then(data => {
        if (data.status === 'success') {
            showNotificationMessage(
                `You'll receive alerts for ${area} when Stage ${stage} loadshedding is predicted.`,
                'success'
            );
            e.target.reset();
        } else {
            showNotificationMessage('Failed to save notification preferences', 'error');
        }
    })
    .catch(error => {
        showNotificationMessage('Error saving notification preferences', 'error');
    });
}

function showNotificationMessage(message, type) {
    const messageElement = document.getElementById('notificationMessage');
    messageElement.textContent = message;
    messageElement.className = type;
    messageElement.style.display = 'block';
    
    setTimeout(() => {
        messageElement.style.display = 'none';
    }, 5000);
}

// Prediction Functions
function makePrediction() {
    const areaId = document.getElementById('areaDropdown').value;
    const daysAhead = document.getElementById('predictionDays').value;
    
    fetch('/predict', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            area_id: areaId === 'national' ? null : areaId,
            days_ahead: daysAhead
        })
    })
    .then(response => response.json())
    .then(data => {
        if (data.error) {
            document.getElementById('predictionResult').innerHTML = 
                `<p class="error">Error: ${data.error}</p>`;
            return;
        }
        
        displayPrediction(data.prediction);
    })
    .catch(error => {
        document.getElementById('predictionResult').innerHTML = 
            `<p class="error">Error making prediction: ${error.message}</p>`;
    });
}

function displayPrediction(prediction) {
    const predictionElement = document.getElementById('predictionResult');
    
    if (!prediction) {
        predictionElement.innerHTML = '<p>No prediction available</p>';
        return;
    }
    
    const scope = prediction.scope || (prediction.area_id ? 'area' : 'national');
    const scopeText = scope === 'national' ? 'nationally' : `in ${prediction.area_id}`;
    
    predictionElement.innerHTML = `
        <p><strong>Date:</strong> ${prediction.date}</p>
        <p><strong>Predicted Stage:</strong> ${prediction.predicted_stage}</p>
        <p><em>Prediction is for ${scopeText}</em></p>
    `;
}

// Energy Tips Functions
function loadEnergyTips() {
    fetch('/api/energy-tips')
        .then(response => response.json())
        .then(data => {
            const tipsContainer = document.getElementById('energyTips');
            if (tipsContainer && data.tips) {
                tipsContainer.innerHTML = data.tips.map(tip => 
                    `<li>${tip}</li>`
                ).join('');
            }
        })
        .catch(error => console.error('Error loading energy tips:', error));
}

// Chart Functions
function updateTimeChart(schedule) {
    const ctx = document.getElementById('timeChart').getContext('2d');
    
    // Process schedule to get time distribution
    const hours = Array(24).fill(0);
    schedule.forEach(event => {
        const start = new Date(event.start);
        hours[start.getHours()]++;
    });
    
    if (timeChart) timeChart.destroy();
    
    timeChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: Array.from({length: 24}, (_, i) => `${i}:00`),
            datasets: [{
                label: 'Loadshedding Occurrences by Hour',
                data: hours,
                backgroundColor: 'rgba(75, 192, 192, 0.6)',
                borderColor: 'rgba(75, 192, 192, 1)',
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            scales: {
                y: {
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: 'Occurrences'
                    }
                },
                x: {
                    title: {
                        display: true,
                        text: 'Hour of Day'
                    }
                }
            }
        }
    });
}

function updateDayChart(schedule) {
    const ctx = document.getElementById('dayChart').getContext('2d');
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const dayCounts = Array(7).fill(0);
    
    schedule.forEach(event => {
        const start = new Date(event.start);
        dayCounts[start.getDay()]++;
    });
    
    if (dayChart) dayChart.destroy();
    
    dayChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: days,
            datasets: [{
                label: 'Loadshedding by Day of Week',
                data: dayCounts,
                backgroundColor: [
                    'rgba(255, 99, 132, 0.6)',
                    'rgba(54, 162, 235, 0.6)',
                    'rgba(255, 206, 86, 0.6)',
                    'rgba(75, 192, 192, 0.6)',
                    'rgba(153, 102, 255, 0.6)',
                    'rgba(255, 159, 64, 0.6)',
                    'rgba(199, 199, 199, 0.6)'
                ],
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: {
                    position: 'right',
                }
            }
        }
    });
}

function updateStageChart(stageDistribution) {
    const ctx = document.getElementById('stageChart').getContext('2d');
    const stages = Object.keys(stageDistribution).sort();
    const counts = stages.map(stage => stageDistribution[stage]);
    
    if (stageChart) stageChart.destroy();
    
    stageChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: stages,
            datasets: [{
                label: 'Stage Occurrence',
                data: counts,
                fill: false,
                borderColor: 'rgb(75, 192, 192)',
                tension: 0.1
            }]
        },
        options: {
            responsive: true,
            scales: {
                y: {
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: 'Occurrences'
                    }
                },
                x: {
                    title: {
                        display: true,
                        text: 'Loadshedding Stage'
                    }
                }
            }
        }
    });
}

// Utility Functions
function showError(message) {
    console.error(message);
    // You could implement a more visible error display here
}