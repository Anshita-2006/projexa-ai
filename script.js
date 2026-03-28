// Mock comprehensive global air quality data (5000+ locations: all countries, states, major cities)
const globalAqiData = {
    globalAvg: 142,
    pollutedCities: 2478,
    locations: [
        // Sample countries with capitals and major cities (in reality, this would be 5000+ entries)
        { name: 'New Delhi, India', lat: 28.6139, lng: 77.2090, aqi: 285, pm25: 180, no2: 85, o3: 120, trend: [-10, 20, 50, 120, 200, 285], prediction: 'Very Unhealthy', country: 'India', state: 'Delhi' },
        { name: 'Beijing, China', lat: 39.9042, lng: 116.4074, aqi: 198, pm25: 145, no2: 92, o3: 98, trend: [50, 80, 110, 150, 180, 198], prediction: 'Hazardous', country: 'China', state: 'Beijing' },
        { name: 'Los Angeles, USA', lat: 34.0522, lng: -118.2437, aqi: 78, pm25: 45, no2: 32, o3: 65, trend: [60, 55, 70, 75, 80, 78], prediction: 'Moderate', country: 'USA', state: 'California' },
        { name: 'London, UK', lat: 51.5074, lng: -0.1278, aqi: 65, pm25: 38, no2: 45, o3: 52, trend: [70, 68, 65, 62, 60, 65], prediction: 'Good', country: 'UK', state: 'England' },
        { name: 'Sydney, Australia', lat: -33.8688, lng: 151.2093, aqi: 42, pm25: 25, no2: 18, o3: 35, trend: [45, 40, 38, 42, 44, 42], prediction: 'Good', country: 'Australia', state: 'NSW' },
        // Add more... (in full version: all 195 countries, states/provinces, 5000+ cities)
        // For demo, generate procedurally more points
        ...generateMockCities(5000)
    ]
};

function generateMockCities(count) {
    const cities = [];
    const countries = ['India', 'China', 'USA', 'Brazil', 'Russia', 'Japan', 'Germany', 'UK', 'France', 'Australia'];
    const states = ['Delhi', 'Beijing', 'California', 'Sao Paulo', 'Moscow', 'Tokyo', 'Bavaria', 'London', 'Paris', 'NSW'];
    for (let i = 0; i < count; i++) {
        cities.push({
            name: `City ${i + 1}, ${countries[i % 10]}`, 
            lat: -90 + Math.random() * 180, 
            lng: -180 + Math.random() * 360,
            aqi: Math.floor(20 + Math.random() * 300),
            pm25: Math.floor(10 + Math.random() * 200),
            no2: Math.floor(5 + Math.random() * 150),
            o3: Math.floor(10 + Math.random() * 100),
            trend: Array(6).fill().map(() => Math.floor(20 + Math.random() * 280)),
            prediction: getAqiLabel(Math.floor(20 + Math.random() * 300)),
            country: countries[i % 10],
            state: states[i % 10]
        });
    }
    return cities;
}

function getAqiLabel(aqi) {
    if (aqi <= 50) return 'Good';
    if (aqi <= 100) return 'Moderate';
    if (aqi <= 150) return 'Unhealthy';
    if (aqi <= 200) return 'Bad';
    return 'Hazardous';
}

let map;
let currentLocation = null;

// Search functionality
let searchTimeout;
let searchMarkersLayer;
let indiaLayer;
let indiaCitiesLayer;

document.addEventListener('DOMContentLoaded', function() {
    initParticles();
    initThemeToggle();
    initMap();
    initCharts();
    updateTopCities();
    initSearch();
    gsap.from('.hero-content', { duration: 1.5, y: 100, opacity: 0, ease: 'bounce.out' });
    gsap.from('.card', { duration: 1, y: 50, opacity: 0, stagger: 0.2, ease: 'power2.out' });
});

// Initialize search
function initSearch() {
    const searchInput = document.getElementById('searchInput');
    const clearBtn = document.getElementById('clearSearch');
    const resultsDiv = document.getElementById('searchResults');
    
    // Add click handler for search results (safer than inline onclick)
    resultsDiv.addEventListener('click', (e) => {
        const resultItem = e.target.closest('.search-result-item');
        if (resultItem) {
            const locData = resultItem.getAttribute('data-location');
            if (locData) {
                try {
                    const loc = JSON.parse(locData.replace(/\\\\'/g, "'"));
                    selectSearchResult(loc);
                } catch (err) {
                    console.error('Search result parse error:', err);
                }
            }
        }
    });

    // Test data - ensure search works immediately
    window.testData = [...globalAqiData.locations.slice(0, 5), ...getAllIndianCitiesAndStates().slice(0, 5)];

    searchInput.addEventListener('input', (e) => {
        console.log('Search input:', e.target.value);
        clearTimeout(searchTimeout);
        const query = e.target.value.toLowerCase().trim();
        
        clearBtn.style.display = query ? 'flex' : 'none';
        
        if (query.length < 2) {
            resultsDiv.classList.add('hidden');
            return;
        }

        searchTimeout = setTimeout(() => {
            performSearch(query);
        }, 150); // Professional fast response
    });

    clearBtn.addEventListener('click', () => {
        console.log('Clear clicked'); // Debug
        searchInput.value = '';
        clearBtn.style.display = 'none';
        resultsDiv.classList.add('hidden');
        clearSearchResults();
        if (map) map.flyTo([20, 0], 2);
    });

    // Close results on outside click
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.search-container') && !e.target.closest('.search-results')) {
            resultsDiv.classList.add('hidden');
        }
    });

    // Auto demo search "delhi" on load
    setTimeout(() => {
        searchInput.value = 'delhi';
        searchInput.dispatchEvent(new Event('input', {bubbles: true}));
    }, 1000);
}

function performSearch(query) {
    console.log('Searching for:', query);
    
    const allData = window.searchResultsCache || [...getAllIndianCitiesAndStates(), ...globalAqiData.locations.slice(0,500)];
    
    // Professional fuzzy match - case insensitive, partial
    const scoreMatch = (text, q) => {
        if (!text) return 0;
        const t = text.toLowerCase();
        const qu = q.toLowerCase();
        if (t === qu) return 100;
        if (t.includes(qu)) return 50;
        if (t.replace(/[^a-z]/g, '').includes(qu.replace(/[^a-z]/g, ''))) return 20;
        return 0;
    };
    
    const results = allData
        .map(loc => ({
            ...loc,
            score: Math.max(
                scoreMatch(loc.name, query),
                scoreMatch(loc.state || '', query),
                scoreMatch(loc.stateName || '', query),
                scoreMatch(loc.country || '', query)
            )
        }))
        .filter(loc => loc.score > 10)
        .sort((a, b) => b.score - a.score)
        .slice(0, 8);
    
    console.log(`Found ${results.length} results for "${query}" (top score: ${results[0]?.score || 0})`);
    displaySearchResults(results);
}

function getAllIndianCitiesAndStates() {
    // All 28 States as searchable entries
    const states = {
        'Andhra Pradesh': { lat: 15.9129, lng: 79.7403, avgAqi: 98, pm25: 65, no2: 42, o3: 55, type: 'state', majorCities: ['Visakhapatnam', 'Vijayawada'] },
        'Arunachal Pradesh': { lat: 28.18, lng: 94.7278, avgAqi: 75, pm25: 45, no2: 30, o3: 50, type: 'state', majorCities: ['Itanagar'] },
        'Assam': { lat: 26.1445, lng: 92.7778, avgAqi: 85, pm25: 55, no2: 38, o3: 60, type: 'state', majorCities: ['Guwahati'] },
        'Bihar': { lat: 25.5941, lng: 85.1376, avgAqi: 185, pm25: 130, no2: 75, o3: 95, type: 'state', majorCities: ['Patna'] },
        'Chhattisgarh': { lat: 21.2514, lng: 81.6299, avgAqi: 110, pm25: 75, no2: 50, o3: 70, type: 'state', majorCities: ['Raipur'] },
        'Goa': { lat: 15.2993, lng: 74.1240, avgAqi: 65, pm25: 40, no2: 25, o3: 45, type: 'state', majorCities: ['Panaji'] },
        'Gujarat': { lat: 22.2587, lng: 71.1924, avgAqi: 210, pm25: 145, no2: 88, o3: 110, type: 'state', majorCities: ['Ahmedabad', 'Surat'] },
        'Haryana': { lat: 29.0588, lng: 77.0390, avgAqi: 220, pm25: 155, no2: 90, o3: 115, type: 'state', majorCities: ['Gurugram'] },
        'Himachal Pradesh': { lat: 31.1048, lng: 77.1734, avgAqi: 70, pm25: 42, no2: 28, o3: 48, type: 'state', majorCities: ['Shimla'] },
        'Jharkhand': { lat: 23.3441, lng: 85.3096, avgAqi: 135, pm25: 92, no2: 58, o3: 78, type: 'state', majorCities: ['Ranchi'] },
        'Karnataka': { lat: 12.9716, lng: 77.5946, avgAqi: 95, pm25: 65, no2: 40, o3: 70, type: 'state', majorCities: ['Bangalore', 'Mysore'] },
        'Kerala': { lat: 10.8505, lng: 76.2711, avgAqi: 60, pm25: 38, no2: 22, o3: 42, type: 'state', majorCities: ['Thiruvananthapuram'] },
        'Madhya Pradesh': { lat: 23.2599, lng: 77.4126, avgAqi: 145, pm25: 98, no2: 62, o3: 82, type: 'state', majorCities: ['Bhopal'] },
        'Maharashtra': { lat: 19.7515, lng: 75.7139, avgAqi: 175, pm25: 120, no2: 65, o3: 85, type: 'state', majorCities: ['Mumbai', 'Pune', 'Nagpur'] },
        'Manipur': { lat: 24.6637, lng: 93.9063, avgAqi: 68, pm25: 40, no2: 26, o3: 46, type: 'state', majorCities: ['Imphal'] },
        'Meghalaya': { lat: 25.4670, lng: 91.3662, avgAqi: 72, pm25: 44, no2: 29, o3: 49, type: 'state', majorCities: ['Shillong'] },
        'Mizoram': { lat: 23.1645, lng: 92.8111, avgAqi: 65, pm25: 39, no2: 24, o3: 44, type: 'state', majorCities: ['Aizawl'] },
        'Nagaland': { lat: 25.6678, lng: 94.1063, avgAqi: 70, pm25: 42, no2: 27, o3: 47, type: 'state', majorCities: ['Kohima'] },
        'Odisha': { lat: 20.2961, lng: 85.8245, avgAqi: 105, pm25: 72, no2: 48, o3: 68, type: 'state', majorCities: ['Bhubaneswar'] },
        'Punjab': { lat: 31.1471, lng: 75.3412, avgAqi: 205, pm25: 142, no2: 85, o3: 108, type: 'state', majorCities: ['Amritsar'] },
        'Rajasthan': { lat: 27.0238, lng: 74.2179, avgAqi: 155, pm25: 102, no2: 62, o3: 92, type: 'state', majorCities: ['Jaipur', 'Jodhpur'] },
        'Sikkim': { lat: 27.5330, lng: 88.2627, avgAqi: 55, pm25: 35, no2: 20, o3: 38, type: 'state', majorCities: ['Gangtok'] },
        'Tamil Nadu': { lat: 11.1271, lng: 78.6569, avgAqi: 112, pm25: 78, no2: 52, o3: 88, type: 'state', majorCities: ['Chennai', 'Coimbatore'] },
        'Telangana': { lat: 17.4065, lng: 78.4767, avgAqi: 105, pm25: 72, no2: 48, o3: 82, type: 'state', majorCities: ['Hyderabad'] },
        'Tripura': { lat: 23.9408, lng: 91.9882, avgAqi: 80, pm25: 48, no2: 32, o3: 54, type: 'state', majorCities: ['Agartala'] },
        'Uttar Pradesh': { lat: 26.8504, lng: 80.9471, avgAqi: 195, pm25: 135, no2: 78, o3: 102, type: 'state', majorCities: ['Lucknow', 'Kanpur'] },
        'Uttarakhand': { lat: 30.3165, lng: 78.0322, avgAqi: 85, pm25: 55, no2: 36, o3: 58, type: 'state', majorCities: ['Dehradun'] },
        'West Bengal': { lat: 22.9868, lng: 87.8550, avgAqi: 165, pm25: 110, no2: 72, o3: 95, type: 'state', majorCities: ['Kolkata', 'Siliguri'] }
    };

    // 200+ Major Indian Cities
    const majorIndianCities = [
        // Haryana Cities (Requested)
        { name: 'Faridabad', state: 'Haryana', lat: 28.4089, lng: 77.3178, aqi: 245, pm25: 172, no2: 95, o3: 125 },
        { name: 'Gurugram', state: 'Haryana', lat: 28.4595, lng: 77.0266, aqi: 235, pm25: 165, no2: 92, o3: 122 },
        { name: 'Palwal', state: 'Haryana', lat: 28.1478, lng: 77.3275, aqi: 198, pm25: 138, no2: 78, o3: 105 },
        
        // Major Tier-1 Cities
        { name: 'New Delhi', state: 'Delhi', lat: 28.6139, lng: 77.2090, aqi: 285, pm25: 180, no2: 85, o3: 120 },
        { name: 'Mumbai', state: 'Maharashtra', lat: 19.0760, lng: 72.8777, aqi: 180, pm25: 120, no2: 65, o3: 85 },
        { name: 'Bangalore', state: 'Karnataka', lat: 12.9716, lng: 77.5946, aqi: 95, pm25: 65, no2: 40, o3: 70 },
        { name: 'Chennai', state: 'Tamil Nadu', lat: 13.0827, lng: 80.2707, aqi: 112, pm25: 78, no2: 52, o3: 88 },
        { name: 'Kolkata', state: 'West Bengal', lat: 22.5726, lng: 88.3639, aqi: 165, pm25: 110, no2: 72, o3: 95 },
        { name: 'Hyderabad', state: 'Telangana', lat: 17.3850, lng: 78.4867, aqi: 105, pm25: 72, no2: 48, o3: 82 },
        { name: 'Pune', state: 'Maharashtra', lat: 18.5204, lng: 73.8567, aqi: 88, pm25: 58, no2: 38, o3: 68 },
        { name: 'Ahmedabad', state: 'Gujarat', lat: 23.0225, lng: 72.5714, aqi: 210, pm25: 145, no2: 88, o3: 110 },
        { name: 'Lucknow', state: 'Uttar Pradesh', lat: 26.8467, lng: 80.9462, aqi: 195, pm25: 135, no2: 78, o3: 102 },
        { name: 'Jaipur', state: 'Rajasthan', lat: 26.9124, lng: 75.7873, aqi: 155, pm25: 102, no2: 62, o3: 92 },
        
        // More Haryana + NCR
        { name: 'Noida', state: 'Uttar Pradesh', lat: 28.5355, lng: 77.3910, aqi: 255, pm25: 180, no2: 98, o3: 130 },
        { name: 'Ghaziabad', state: 'Uttar Pradesh', lat: 28.6692, lng: 77.4538, aqi: 268, pm25: 188, no2: 102, o3: 135 },
        { name: 'Panipat', state: 'Haryana', lat: 29.3909, lng: 76.9677, aqi: 215, pm25: 150, no2: 85, o3: 112 },
        { name: 'Sonipat', state: 'Haryana', lat: 28.9903, lng: 77.0164, aqi: 232, pm25: 162, no2: 90, o3: 120 },
        
        // Additional Key Cities
        { name: 'Kanpur', state: 'Uttar Pradesh', lat: 26.4499, lng: 80.3319, aqi: 220, pm25: 155, no2: 92, o3: 118 },
        { name: 'Nagpur', state: 'Maharashtra', lat: 21.1458, lng: 79.0882, aqi: 92, pm25: 62, no2: 39, o3: 65 },
        { name: 'Indore', state: 'Madhya Pradesh', lat: 22.7196, lng: 75.8577, aqi: 125, pm25: 85, no2: 52, o3: 75 },
        { name: 'Thane', state: 'Maharashtra', lat: 19.2183, lng: 72.9781, aqi: 172, pm25: 115, no2: 63, o3: 83 },
        { name: 'Bhopal', state: 'Madhya Pradesh', lat: 23.2599, lng: 77.4126, aqi: 145, pm25: 98, no2: 62, o3: 82 },
        
        // 150+ more cities across all states
        ...Array.from({length: 150}, (_, i) => {
            const haryanaNcrCities = ['Ambala', 'Yamunanagar', 'Karnal', 'Kurukshetra', 'Hisar', 'Rohtak', 'Bhiwani', 'Rewari'];
            const states = Object.keys(states);
            const state = states[Math.floor(Math.random()*states.length)];
            const cities = haryanaNcrCities.concat(['Agra', 'Meerut', 'Varanasi', 'Allahabad', 'Moradabad']);
            return {
                name: cities[(i % cities.length)] || `City ${i+20}, ${state}`,
                state: state,
                lat: 8 + Math.random()*30,
                lng: 68 + Math.random()*30,
                aqi: Math.floor(50 + Math.random()*250),
                pm25: Math.floor(30 + Math.random()*180),
                no2: Math.floor(20 + Math.random()*100),
                o3: Math.floor(40 + Math.random()*90),
                trend: Array(6).fill().map(() => Math.floor(40 + Math.random()*260)),
                prediction: getAqiLabel(Math.floor(50 + Math.random()*250))
            };
        })
    ];

    return Object.entries(states).map(([stateName, stateData]) => ({
        name: stateName, type: 'state', lat: stateData.lat || 20.5937, lng: stateData.lng || 78.9629, 
        aqi: stateData.avgAqi, pm25: stateData.pm25, no2: stateData.no2, o3: stateData.o3,
        stateName, pollutionStatus: stateData.pollutionStatus, environment: stateData.environment, mausam: stateData.mausam
    })).concat(majorIndianCities);
}

function displaySearchResults(results) {
    const resultsDiv = document.getElementById('searchResults');
    if (results.length === 0) {
        resultsDiv.innerHTML = '<div class="no-results p-3 text-center">No cities found. Try "Delhi", "Mumbai", "Bihar", "Gurugram"</div>';
        resultsDiv.classList.remove('hidden');
        return;
    }

    resultsDiv.innerHTML = results.map((loc, index) => {
        const aqiColor = getAqiColor(loc.aqi);
        const pollutionStatus = loc.pollutionStatus || getPollutionStatus(loc.aqi);
        const environment = loc.environment || getEnvironmentQuality(loc.aqi);
        const mausam = loc.mausam || getCurrentMausam(loc.state || loc.stateName || loc.country);
        
        return `
        <div class="search-result-item google-style" onclick="selectSearchResultByIndex(${index})" data-index="${index}">
            <div class="search-left">
                <strong>${escapeHtml(loc.name)}</strong>
                <div class="search-subtitle">${escapeHtml(loc.state || loc.stateName || loc.country || 'India')}</div>
            </div>
            <div class="search-right">
                <div class="aqi-display" style="background: ${aqiColor}">
                    <div style="font-size: 1.4rem; font-weight: bold;">${loc.aqi}</div>
                    <div class="aqi-label">${getAqiLabel(loc.aqi)}</div>
                </div>
                <div class="pollutants small">
                    PM<sub>2.5</sub>: ${loc.pm25}µg<br>
                    NO<sub>2</sub>: ${loc.no2||'--'}ppb<br>
                    O<sub>3</sub>: ${loc.o3||'--'}ppb
                </div>
                <div class="status-badges">
                    <span class="pollution-badge">${pollutionStatus}</span>
                    <span class="env-badge">${environment}</span>
                    <span class="mausam-badge">${mausam}</span>
                </div>
            </div>
        </div>`;
    }).join('');

    gsap.from('.search-result-item', { 
        duration: 0.3, 
        y: 15, 
        opacity: 0, 
        stagger: 0.08, 
        ease: 'power2.out' 
    });

    resultsDiv.classList.remove('hidden');
}

function escapeHtml(text) {
    const map = {
        '&': '&amp;',
        '<': '<',
        '>': '>',
        '"': '"',
        "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, m => map[m]);
}

function selectSearchResult(loc) {
    // Hide search results
    document.getElementById('searchResults').classList.add('hidden');
    document.getElementById('searchInput').value = '';
    document.getElementById('clearSearch').style.display = 'none';
    
    // Show location details (same as map click)
    showFullLocationDetails(loc);
    
    // Pan map to location
    if (map && loc.lat && loc.lng) {
        map.flyTo([loc.lat, loc.lng], 10, { duration: 1.5 });
        console.log('Mapped to:', loc.name, loc.lat, loc.lng);
    }
}

function getPollutionStatus(aqi) {
    if (aqi <= 50) return 'Low';
    if (aqi <= 100) return 'Moderate';
    if (aqi <= 150) return 'High';
    if (aqi <= 200) return 'Very High';
    return 'Severe';
}

function getEnvironmentQuality(aqi) {
    if (aqi <= 50) return 'Excellent';
    if (aqi <= 100) return 'Good';
    if (aqi <= 150) return 'Fair';
    if (aqi <= 200) return 'Poor';
    return 'Very Poor';
}

function getCurrentMausam(state) {
    const mausamData = {
        'Delhi': '🌫️ Foggy, 25°C',
        'Haryana': '🌫️ Smoggy, 24°C', 
        'Uttar Pradesh': '🌫️ Hazy, 26°C',
        'Maharashtra': '🌤️ Partly Cloudy, 32°C',
        'Punjab': '🌫️ Foggy, 22°C',
        default: '☁️ Cloudy, 28°C'
    };
    return mausamData[state] || mausamData.default;
}



function clearSearchResults() {
    searchMarkersLayer.clearLayers();
}

// Particles.js
function initParticles() {
    particlesJS('particles-js', {
        particles: {
            number: { value: 80, density: { enable: true, value_area: 800 } },
            color: { value: ['#00d4ff', '#ff6b9d', '#ffd93d'] },
            shape: { type: 'circle' },
            opacity: { value: 0.5, random: true },
            size: { value: 3, random: true },
            move: { speed: 2, direction: 'none', random: true }
        },
        interactivity: {
            events: { onhover: { enable: true, mode: 'repulse' } }
        }
    });
}

// Theme Toggle
function initThemeToggle() {
    const toggle = document.querySelector('.theme-toggle');
    const icon = toggle.querySelector('.theme-icon');
    toggle.addEventListener('click', () => {
        document.body.classList.toggle('light');
        icon.textContent = document.body.classList.contains('light') ? '☀️' : '🌙';
    });
}

// World Map with Leaflet
function initMap() {
    map = L.map('worldMap').setView([20, 0], 2);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap'
    }).addTo(map);

    searchMarkersLayer = L.layerGroup().addTo(map);

    // Load India GeoJSON (public source for demo)
    fetch('https://raw.githubusercontent.com/nikhilnarayanan/india-geojson/master/dist/india.geojson')
        .then(response => response.json())
        .then(geojson => {
            indiaLayer = L.geoJSON(geojson, {
                style: {
                    color: '#ffd93d',
                    weight: 3,
                    fillOpacity: 0.05,
                    fillColor: '#ff6b9d'
                },
                onEachFeature: (feature, layer) => {
                    if (feature.properties && feature.properties.NAME_1) {
                        layer.bindPopup(`<b>${feature.properties.NAME_1}</b><br>State Average AQI: ${Math.floor(150 + Math.random()*100)}`);
                    }
                }
            }).addTo(map);
        })
        .catch(err => console.log('India GeoJSON load failed:', err));

    // Add India major cities (100+)
    addIndiaCities();

    // Existing global markers
    globalAqiData.locations.forEach(loc => {
        const aqiColor = getAqiColor(loc.aqi);
        L.circleMarker([loc.lat, loc.lng], {
            radius: 4 + (loc.aqi / 50),
            fillColor: aqiColor,
            color: '#fff',
            weight: 1,
            opacity: 1,
            fillOpacity: 0.8
        }).addTo(map)
        .bindPopup(`
            <b>${loc.name}</b><br>
            AQI: ${loc.aqi} <span class="aqi-${getAqiLabel(loc.aqi).toLowerCase()}">${getAqiLabel(loc.aqi)}</span><br>
            PM2.5: ${loc.pm25} µg/m³<br>
            Country: ${loc.country}<br>
            <button onclick="showLocationDetails('${loc.name}', ${loc.aqi}, ${loc.pm25}, ${loc.no2}, ${loc.o3}, '${loc.prediction}', ${JSON.stringify(loc.trend)})">Details</button>
        `);
    });

    initMapControls();

    // Legend click handler
    document.querySelectorAll('.legend-item').forEach(item => {
        item.addEventListener('click', () => {
            const level = item.textContent.split('(')[0].trim();
            filterMapByAqi(level);
        });
    });
}

function addIndiaCities() {
    // Comprehensive Indian States data
    const indiaStates = {
        'Delhi': { avgAqi: 285, pollutionStatus: 'Very High', environment: 'Poor', mausam: '☁️ Cloudy, 28°C', majorCities: ['New Delhi'] },
        'Maharashtra': { avgAqi: 175, pollutionStatus: 'High', environment: 'Unhealthy', mausam: '🌤️ Partly Cloudy, 32°C', majorCities: ['Mumbai', 'Pune'] },
        'Karnataka': { avgAqi: 95, pollutionStatus: 'Moderate', environment: 'Fair', mausam: '☀️ Sunny, 29°C', majorCities: ['Bangalore'] },
        'Tamil Nadu': { avgAqi: 112, pollutionStatus: 'Moderate-High', environment: 'Average', mausam: '🌤️ Sunny, 34°C', majorCities: ['Chennai'] },
        'West Bengal': { avgAqi: 165, pollutionStatus: 'High', environment: 'Poor', mausam: '🌧️ Rainy, 27°C', majorCities: ['Kolkata'] },
        'Telangana': { avgAqi: 105, pollutionStatus: 'Moderate', environment: 'Fair', mausam: '☁️ Hazy, 31°C', majorCities: ['Hyderabad'] },
        'Gujarat': { avgAqi: 210, pollutionStatus: 'Very High', environment: 'Very Poor', mausam: '🌤️ Dry, 36°C', majorCities: ['Ahmedabad'] },
        'Uttar Pradesh': { avgAqi: 195, pollutionStatus: 'High', environment: 'Poor', mausam: '🌫️ Foggy, 25°C', majorCities: ['Lucknow'] },
        'Rajasthan': { avgAqi: 155, pollutionStatus: 'High', environment: 'Unhealthy', mausam: '☀️ Hot, 38°C', majorCities: ['Jaipur'] },
        // Add all 28 states...
        'Andhra Pradesh': { avgAqi: 98, pollutionStatus: 'Moderate', environment: 'Fair', mausam: '🌤️ Warm, 33°C', majorCities: ['Visakhapatnam'] }
    };

    // 100+ Real Indian Cities + States avg markers
    const indiaCities = [
        { name: 'New Delhi', lat: 28.6139, lng: 77.2090, aqi: 285, pm25: 180, no2: 85, o3: 120, stateData: indiaStates['Delhi'], state: 'Delhi' },
        { name: 'Mumbai', lat: 19.0760, lng: 72.8777, aqi: 180, pm25: 120, no2: 65, o3: 85, stateData: indiaStates['Maharashtra'], state: 'Maharashtra' },
        { name: 'Bangalore', lat: 12.9716, lng: 77.5946, aqi: 95, pm25: 65, no2: 40, o3: 70, stateData: indiaStates['Karnataka'], state: 'Karnataka' },
        { name: 'Chennai', lat: 13.0827, lng: 80.2707, aqi: 112, pm25: 78, no2: 52, o3: 88, stateData: indiaStates['Tamil Nadu'], state: 'Tamil Nadu' },
        { name: 'Kolkata', lat: 22.5726, lng: 88.3639, aqi: 165, pm25: 110, no2: 72, o3: 95, stateData: indiaStates['West Bengal'], state: 'West Bengal' },
        { name: 'Hyderabad', lat: 17.3850, lng: 78.4867, aqi: 105, pm25: 72, no2: 48, o3: 82, stateData: indiaStates['Telangana'], state: 'Telangana' },
        { name: 'Pune', lat: 18.5204, lng: 73.8567, aqi: 88, pm25: 58, no2: 38, o3: 68, stateData: indiaStates['Maharashtra'], state: 'Maharashtra' },
        { name: 'Ahmedabad', lat: 23.0225, lng: 72.5714, aqi: 210, pm25: 145, no2: 88, o3: 110, stateData: indiaStates['Gujarat'], state: 'Gujarat' },
        { name: 'Lucknow', lat: 26.8467, lng: 80.9462, aqi: 195, pm25: 135, no2: 78, o3: 102, stateData: indiaStates['Uttar Pradesh'], state: 'Uttar Pradesh' },
        { name: 'Jaipur', lat: 26.9124, lng: 75.7873, aqi: 155, pm25: 102, no2: 62, o3: 92, stateData: indiaStates['Rajasthan'], state: 'Rajasthan' },
        // Add 90+ more cities...
        ...Array.from({length: 90}, (_, i) => {
            const states = Object.keys(indiaStates);
            const state = states[Math.floor(Math.random()*states.length)];
            return {
                name: `City ${i+11}, ${state}`,
                lat: 8 + Math.random()*30,
                lng: 68 + Math.random()*30,
                aqi: Math.floor(50 + Math.random()*250),
                pm25: Math.floor(30 + Math.random()*180),
                no2: Math.floor(20 + Math.random()*100),
                o3: Math.floor(40 + Math.random()*90),
                trend: Array(6).fill().map(() => Math.floor(40 + Math.random()*260)),
                prediction: getAqiLabel(Math.floor(50 + Math.random()*250)),
                stateData: indiaStates[state],
                state,
                country: 'India'
            };
        })
    ];

    indiaCitiesLayer = L.layerGroup().addTo(map);
    indiaCities.forEach(city => {
        const color = getAqiColor(city.aqi);
        L.circleMarker([city.lat, city.lng], {
            radius: 6 + (city.aqi / 60),
            fillColor: color,
            color: '#fff',
            weight: 2,
            opacity: 1,
            fillOpacity: 0.85
        }).addTo(indiaCitiesLayer).on('click', () => showFullLocationDetails(city))
        .bindPopup(city.name);
    });
    
    // Add State center markers
    Object.entries(indiaStates).forEach(([stateName, stateData]) => {
        // Approximate state centers (could be more accurate)
        const stateCenters = {
            'Delhi': [28.7, 77.1], 'Maharashtra': [19.4, 75.8], 'Karnataka': [13.8, 77.4],
            'Tamil Nadu': [12.9, 79.7], 'West Bengal': [23.3, 87.3], 'Telangana': [17.4, 79.7],
            'Gujarat': [22.9, 71.2], 'Uttar Pradesh': [26.8, 80.9], 'Rajasthan': [27.0, 74.2],
            'Andhra Pradesh': [15.9, 80.6]
        };
        const coords = stateCenters[stateName] || [20 + Math.random()*10, 75 + Math.random()*10];
        L.marker(coords, {
            icon: L.divIcon({
                className: 'state-marker',
                html: `<div style="background: ${getAqiColor(stateData.avgAqi)}; width: 20px; height: 20px; border-radius: 50%; border: 3px solid #ffd93d; box-shadow: 0 0 15px ${getAqiColor(stateData.avgAqi)};"></div>`,
                iconSize: [26, 26]
            })
        }).addTo(map).on('click', () => showFullStateDetails(stateName, stateData))
        .bindPopup(`<b>${stateName}</b><br>Avg AQI: ${stateData.avgAqi}`);
    });
}

function initMapControls() {
    document.getElementById('zoomIndia').addEventListener('click', zoomToIndia);
    document.getElementById('resetMap').addEventListener('click', () => {
        map.flyTo([20, 0], 2);
        gsap.to(indiaLayer ? indiaLayer : {}, {duration: 1, opacity: 0.05});
    });
}

function zoomToIndia() {
    map.flyTo([20.5937, 78.9629], 6);
    if (indiaLayer) {
        gsap.to(indiaLayer, {duration: 1.5, opacity: 1, scale: 1.1, ease: 'elastic.out'});
    }
    if (indiaCitiesLayer) {
        indiaCitiesLayer.eachLayer(marker => {
            gsap.fromTo(marker, 
                {scale: 0.5}, 
                {duration: 1, scale: 1, stagger: 0.05, ease: 'back.out(1.7)'}
            );
        });
    }
}

function getAqiColor(aqi) {
    if (aqi <= 50) return '#4caf50';
    if (aqi <= 100) return '#ffeb3b';
    if (aqi <= 150) return '#ff9800';
    if (aqi <= 200) return '#f44336';
    return '#9c27b0';
}

function filterMapByAqi(level) {
    // Implementation for filtering markers by AQI level
    console.log('Filtering map by:', level);
}

// Show location details panel
function showFullLocationDetails(loc) {
    currentLocation = loc;
    document.getElementById('locationName').textContent = loc.name;
    document.getElementById('pm25Val').textContent = loc.aqi;
    document.getElementById('no2Val').textContent = loc.pm25;
    document.getElementById('o3Val').textContent = loc.no2 || 50;
    document.getElementById('extraVal').textContent = loc.o3 || 70;
    document.getElementById('prediction').textContent = loc.prediction;
    
    // State info if available
    if (loc.stateData) {
        document.getElementById('pollutionStatus').innerHTML = `<strong>Pollution:</strong> ${loc.stateData.pollutionStatus}`;
        document.getElementById('pollutionStatus').className = `pollution-${loc.stateData.pollutionStatus.toLowerCase().replace(' ', '-')}`;
        document.getElementById('environment').innerHTML = `<strong>Environment:</strong> ${loc.stateData.environment}`;
        document.getElementById('environment').className = `environment-${loc.stateData.environment.toLowerCase()}`;
        document.getElementById('mausam').innerHTML = `<strong>Mausam:</strong> ${loc.stateData.mausam}`;
    } else {
        document.getElementById('pollutionStatus').textContent = 'Pollution: High';
        document.getElementById('pollutionStatus').className = 'pollution-high';
        document.getElementById('environment').textContent = 'Environment: Poor';
        document.getElementById('environment').className = 'environment-poor';
        document.getElementById('mausam').textContent = 'Mausam: Cloudy, 28°C ☁️';
    }
    
    const panel = document.getElementById('locationPanel');
    panel.classList.remove('hidden');
    panel.classList.add('show');
    
    updateLocationGauge(loc.aqi);
    updateLocationTrend(loc.trend);
    
    gsap.from('.location-panel', { duration: 0.5, scale: 0.8, opacity: 0, ease: 'back.out(1.7)' });
}

function showFullStateDetails(stateName, stateData) {
    document.getElementById('locationName').textContent = stateName;
    document.getElementById('pm25Val').textContent = stateData.avgAqi;
    document.getElementById('no2Val').textContent = Math.floor(stateData.avgAqi * 0.4);
    document.getElementById('o3Val').textContent = Math.floor(stateData.avgAqi * 0.35);
    document.getElementById('extraVal').textContent = Math.floor(stateData.avgAqi * 0.3);
    document.getElementById('prediction').textContent = getAqiLabel(stateData.avgAqi);
    
    document.getElementById('pollutionStatus').innerHTML = `<strong>Pollution:</strong> ${stateData.pollutionStatus}`;
    document.getElementById('pollutionStatus').className = `pollution-${stateData.pollutionStatus.toLowerCase().replace(/ /g, '-')}`;
    document.getElementById('environment').innerHTML = `<strong>Environment:</strong> ${stateData.environment}`;
    document.getElementById('environment').className = `environment-${stateData.environment.toLowerCase()}`;
    document.getElementById('mausam').innerHTML = `<strong>Mausam:</strong> ${stateData.mausam}`;
    
    const panel = document.getElementById('locationPanel');
    panel.classList.remove('hidden');
    panel.classList.add('show');
    
    updateLocationGauge(stateData.avgAqi);
    updateLocationTrend(Array(6).fill(stateData.avgAqi).map((v, i) => v + (Math.random()-0.5)*20));
    
    gsap.from('.location-panel', { duration: 0.5, scale: 0.8, opacity: 0, ease: 'back.out(1.7)' });
}

// Update popup onclicks to use new function
// Markers already use showFullLocationDetails

// Charts initialization
let pm25Chart, no2Chart, sourcesChart, globalTrendsChart, predictionChart, globalAqiGauge, locationGauge, locationTrend;

function initCharts() {
    // Global AQI Gauge
    const globalCtx = document.getElementById('globalAqiGauge').getContext('2d');
    globalAqiGauge = new Chart(globalCtx, {
        type: 'doughnut',
        data: { datasets: [{ data: [globalAqiData.globalAvg, 300 - globalAqiData.globalAvg], backgroundColor: ['#4caf50', 'transparent'], borderWidth: 0 }] },
        options: { cutout: '80%', responsive: true, plugins: { legend: { display: false } } }
    });

    // PM2.5 Chart
    const pm25Ctx = document.getElementById('pm25Chart').getContext('2d');
    pm25Chart = new Chart(pm25Ctx, {
        type: 'line',
        data: {
            labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
            datasets: [{ label: 'PM2.5 (µg/m³)', data: [120, 150, 180, 200, 220, 250], borderColor: '#ff6b9d', tension: 0.4 }]
        },
        options: { responsive: true, scales: { y: { beginAtZero: true } } }
    });

    // NO2 Chart
    const no2Ctx = document.getElementById('no2Chart').getContext('2d');
    no2Chart = new Chart(no2Ctx, {
        type: 'bar',
        data: {
            labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
            datasets: [{ label: 'NO2 (ppb)', data: [45, 52, 48, 60, 55, 62], backgroundColor: '#00d4ff' }]
        },
        options: { responsive: true, scales: { y: { beginAtZero: true } } }
    });

    // Sources Pie Chart
    const sourcesCtx = document.getElementById('sourcesChart').getContext('2d');
    sourcesChart = new Chart(sourcesCtx, {
        type: 'pie',
        data: {
            labels: ['Vehicles', 'Industry', 'Construction', 'Agriculture'],
            datasets: [{ data: [40, 30, 20, 10], backgroundColor: ['#ff6b9d', '#ffd93d', '#00d4ff', '#4caf50'] }]
        },
        options: { responsive: true }
    });

    // Global Trends
    const trendsCtx = document.getElementById('globalTrendsChart').getContext('2d');
    globalTrendsChart = new Chart(trendsCtx, {
        type: 'line',
        data: {
            labels: ['2020', '2021', '2022', '2023', '2024'],
            datasets: [{ label: 'Global AQI', data: [110, 125, 135, 140, 142], borderColor: '#ffd93d', tension: 0.4 }]
        },
        options: { responsive: true }
    });

    // Predictions
    const predCtx = document.getElementById('predictionChart').getContext('2d');
    predictionChart = new Chart(predCtx, {
        type: 'line',
        data: {
            labels: ['Now', '6h', '12h', '24h', '48h'],
            datasets: [{ label: 'Predicted AQI', data: [142, 148, 155, 162, 158], borderColor: '#ff6b9d', tension: 0.4 }]
        },
        options: { responsive: true }
    });
}

function updateLocationGauge(aqi) {
    const ctx = document.getElementById('locationGauge').getContext('2d');
    if (locationGauge) locationGauge.destroy();
    locationGauge = new Chart(ctx, {
        type: 'doughnut',
        data: { datasets: [{ data: [aqi, 300 - aqi], backgroundColor: [getAqiColor(aqi), 'transparent'], borderWidth: 0 }] },
        options: { cutout: '70%', responsive: true, plugins: { legend: { display: false } } }
    });
}

function updateLocationTrend(trend) {
    const ctx = document.getElementById('locationTrend').getContext('2d');
    if (locationTrend) locationTrend.destroy();
    locationTrend = new Chart(ctx, {
        type: 'line',
        data: {
            labels: ['Day1', 'Day2', 'Day3', 'Day4', 'Day5', 'Today'],
            datasets: [{ label: 'AQI Trend', data: trend, borderColor: '#00d4ff', tension: 0.4 }]
        },
        options: { responsive: true, scales: { y: { beginAtZero: true } } }
    });
}

function updateTopCities() {
    const polluted = globalAqiData.locations.slice(0, 10).sort((a, b) => b.aqi - a.aqi);
    const list = document.getElementById('topCities');
    list.innerHTML = polluted.map(city => `<li>${city.name} - AQI ${city.aqi}</li>`).join('');
}

// Close panel
document.addEventListener('click', (e) => {
    if (!e.target.closest('.location-panel') && !e.target.closest('#worldMap')) {
        const panel = document.getElementById('locationPanel');
        if (panel.classList.contains('show')) {
            panel.classList.remove('show');
            setTimeout(() => panel.classList.add('hidden'), 500);
        }
    }
});

// Enhanced scroll animations with IntersectionObserver for better performance
const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            gsap.timeline()
                .to(entry.target, { duration: 0.8, y: 0, opacity: 1, ease: 'power3.out' })
                .to(entry.target, { duration: 0.5, scale: 1.05, rotationY: 10, ease: 'elastic.out(1, 0.5)' }, '-=0.4')
                .to(entry.target, { duration: 1, scale: 1, rotationY: 0, ease: 'back.out(1.7)' });
            observer.unobserve(entry.target);
        }
    });
}, { threshold: 0.1 });

document.querySelectorAll('.card, .map-section').forEach(el => {
    el.style.opacity = '0';
    el.style.transform = 'translateY(50px)';
    observer.observe(el);
});

// Enhanced particles interactivity
gsap.to('#particles-js', {
    scale: 1.1,
    duration: 20,
    repeat: -1,
    yoyo: true,
    ease: 'none'
});

// Hero particles sparkle on load
gsap.timeline()
    .from('.hero-title', { duration: 1.2, scale: 0.8, y: 50, rotationX: -20, ease: 'back.out(1.7)' })
    .to('.hero-subtitle', { duration: 0.8, x: 0, opacity: 1, ease: 'power2.out' }, '-=0.6')
    .to('.global-aqi', { duration: 1, scale: 1.1, ease: 'elastic.out' }, '-=0.4')
    // Animate floating sidebar cards
    .to('.floating-card', { 
        duration: 1.5, 
        x: 0, 
        opacity: 1, 
        rotationY: 0,
        stagger: 0.3,
        ease: 'back.out(1.7)' 
    }, '-=1.2');

// Search bar enhanced animation
document.getElementById('searchInput').addEventListener('focus', () => {
    gsap.timeline()
        .to('.search-container', { duration: 0.3, scale: 1.05, ease: 'back.out' })
        .to('.search-container', { duration: 2, scale: 1, ease: 'none', repeat: -1, yoyo: true });
});

// Smooth scrolling for nav links
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
        e.preventDefault();
        document.querySelector(this.getAttribute('href')).scrollIntoView({ behavior: 'smooth' });
    });
});