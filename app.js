
// === CONFIGURATION ===
const DEFAULT_LAT = 51.5074;  // London
const DEFAULT_LON = -0.1278;
const CACHE_NAME = 'weather-app-v2';
const DATA_CACHE_NAME = 'weather-data-cache-v1';

// === INIT APP ===
async function initApp() {
  initDarkMode();

  // DOM Elements
  const searchInput = document.getElementById('location-search');
  const searchBtn = document.getElementById('search-btn');

  // Last known location
  const lastLocStr = localStorage.getItem('lastWeatherLocation');
  const lastLoc = lastLocStr ? JSON.parse(lastLocStr) : null;

  const lat = lastLoc?.lat || DEFAULT_LAT;
  const lon = lastLoc?.lon || DEFAULT_LON;
  const city = lastLoc?.city || 'London';

  // Load initial weather
  fetchWeather(lat, lon, city);

  // Search button click
  searchBtn.addEventListener('click', handleSearch);
  searchInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') handleSearch();
  });

  // Request background sync if supported
  if ('PeriodicSyncManager' in window) {
    Notification.requestPermission().then(perm => {
      if (perm === 'granted') {
        registerPeriodicSync();
      }
    });
  }
}

// Handle search input
async function handleSearch() {
  const searchInput = document.getElementById('location-search');
  const city = searchInput.value.trim();

  if (!city) {
    alert("Please enter a city name");
    return;
  }

  try {
    const location = await geocodeCity(city);
    if (location) {
      fetchWeather(location.lat, location.lon, location.city);
      searchInput.value = ''; // Clear input
    } else {
      alert("City not found. Try again.");
    }
  } catch (err) {
    console.error(err);
    alert("Could not find location. Check your connection.");
  }
}

// Geocode city name to coordinates using Open-Meteo Geocoding API
async function geocodeCity(city) {
  try {
    const response = await fetch(
      `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1&language=en`
    );

    const data = await response.json();
    if (data.results && data.results.length > 0) {
      const result = data.results[0];
      return {
        lat: result.latitude,
        lon: result.longitude,
        city: result.name + (result.country ? ', ' + result.country : '')
      };
    }
    return null;
  } catch (err) {
    console.error('Geocoding failed:', err);
    return null;
  }
}

// Fetch weather data
async function fetchWeather(lat, lon, city) {
  const locationEl = document.getElementById('location');
  const tempEl = document.getElementById('temperature');
  const descEl = document.getElementById('description');
  const forecastEl = document.getElementById('forecast');

  locationEl.textContent = city;
  tempEl.textContent = 'Loading...';
  descEl.textContent = 'Fetching weather...';
  forecastEl.innerHTML = '';

  try {
    const response = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weather_code&daily=weather_code,temperature_2m_max,temperature_2m_min&timezone=auto&forecast_days=6`
    );

    if (!response.ok) throw new Error('Weather API error');

    const data = await response.json();
    updateUI(data, city);

    // Save last used location
    localStorage.setItem('lastWeatherLocation', JSON.stringify({ lat, lon, city }));

    // Cache data for offline use
    const cache = await caches.open(DATA_CACHE_NAME);
    const url = new URL(`weather?lat=${lat}&lon=${lon}`);
    await cache.put(url, new Response(JSON.stringify(data)));
  } catch (err) {
    console.error('Fetch error:', err);
    // Try to show cached data
    try {
      const cache = await caches.open(DATA_CACHE_NAME);
      const url = new URL(`weather?lat=${lat}&lon=${lon}`, location.href);
      const cached = await cache.match(url);
      if (cached) {
        const data = await cached.json();
        updateUI(data, city);
        descEl.textContent += ' (cached)';
      } else {
        descEl.textContent = 'No data available offline';
      }
    } catch (e) {
      descEl.textContent = 'Unable to load weather data';
    }
  }
}

// Update UI with weather data
function updateUI(data, city) {
  const current = data.current;
  const daily = data.daily;

  document.getElementById('location').textContent = city;
  document.getElementById('temperature').textContent = `${Math.round(current.temperature_2m)}°C`;
  document.getElementById('description').textContent = getWeatherDescription(current.weather_code);

  const forecastEl = document.getElementById('forecast');
  forecastEl.innerHTML = '';

  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  daily.time.forEach((dateStr, i) => {

    const date = new Date(dateStr);
    const dayName = i === 0 ? 'Today' : ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][date.getDay()];
    const high = Math.round(daily.temperature_2m_max[i]);
    const low = Math.round(daily.temperature_2m_min[i]);

    const dayCard = document.createElement('div');
    dayCard.className = 'day-card';
    dayCard.innerHTML = `
      <div class="day-name">${dayName}</div>
      <div class="high-temp">${high}°</div>
      <div class="low-temp">${low}°</div>
    `;
    forecastEl.appendChild(dayCard);
  });
}

// Simple weather code to description
function getWeatherDescription(code) {
  const map = {
    0: 'Clear sky',
    1: 'Mainly clear',
    2: 'Partly cloudy',
    3: 'Overcast',
    45: 'Fog',
    48: 'Depositing rime fog',
    51: 'Light drizzle',
    53: 'Moderate drizzle',
    55: 'Dense drizzle',
    61: 'Slight rain',
    63: 'Moderate rain',
    65: 'Heavy rain',
    71: 'Slight snow',
    73: 'Moderate snow',
    75: 'Heavy snow',
    77: 'Snow grains',
    80: 'Slight rain showers',
    81: 'Moderate rain showers',
    82: 'Violent rain showers',
    85: 'Slight snow showers',
    86: 'Heavy snow showers',
    95: 'Thunderstorm',
    96: 'Thunderstorm with slight hail',
    99: 'Thunderstorm with heavy hail'
  };
  return map[code] || 'Unknown';
}

// Initialize dark mode
function initDarkMode() {
  const toggle = document.getElementById('dark-mode-toggle');

  // Check system preference
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const savedTheme = localStorage.getItem('theme');
  const isDark = savedTheme ? savedTheme === 'dark' : prefersDark;

  if (isDark) {
    document.body.setAttribute('data-theme', 'dark');
  } else {
    document.body.removeAttribute('data-theme');
  }

  toggle.textContent = isDark ? '☀️' : '🌙';

  toggle.addEventListener('click', () => {
    const isDark = document.body.hasAttribute('data-theme');
    if (isDark) {
      document.body.removeAttribute('data-theme');
      localStorage.setItem('theme', 'light');
      toggle.textContent = '🌙';
    } else {
      document.body.setAttribute('data-theme', 'dark');
      localStorage.setItem('theme', 'dark');
      toggle.textContent = '☀️';
    }
  });
}

// Register periodic background sync
async function registerPeriodicSync() {
  try {
    const reg = await navigator.serviceWorker.ready;
    await reg.periodicSync.register('update-weather', {
      minInterval: 60 * 60 * 1000 // Every hour
    });
    console.log('Periodic sync registered');
  } catch (err) {
    console.error('Periodic sync failed:', err);
  }
}

// Load app on DOMContentLoaded
document.addEventListener('DOMContentLoaded', initApp);