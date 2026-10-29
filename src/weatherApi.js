const GEOCODING_URL = 'https://geocoding-api.open-meteo.com/v1/search'
const FORECAST_URL = 'https://api.open-meteo.com/v1/forecast'
const HISTORY_URL = 'https://historical-forecast-api.open-meteo.com/v1/forecast'

function weatherFromCode(code) {
  if (code === 0) return { main: 'Clear', description: 'clear sky' }
  if ([1, 2, 3].includes(code)) return { main: 'Clouds', description: ({ 1: 'mainly clear', 2: 'partly cloudy', 3: 'overcast' })[code] }
  if ([45, 48].includes(code)) return { main: 'Mist', description: 'fog' }
  if ([51, 53, 55, 56, 57].includes(code)) return { main: 'Drizzle', description: 'drizzle' }
  if ([61, 63, 65, 66, 67, 80, 81, 82].includes(code)) return { main: 'Rain', description: 'rain' }
  if ([71, 73, 75, 77, 85, 86].includes(code)) return { main: 'Snow', description: 'snow' }
  if ([95, 96, 99].includes(code)) return { main: 'Thunderstorm', description: 'thunderstorm' }
  return { main: 'Clouds', description: 'variable conditions' }
}

async function fetchJson(url, signal) {
  const response = await fetch(url, { signal })
  const data = await response.json()
  if (!response.ok || data.error) {
    throw new Error(data.reason || 'The weather service could not complete your request.')
  }
  return data
}

function shiftDate(date, days) {
  const shifted = new Date(`${date}T12:00:00Z`)
  shifted.setUTCDate(shifted.getUTCDate() + days)
  return shifted.toISOString().slice(0, 10)
}

function toDailyList(daily) {
  return daily.time.map((date, index) => ({
    dt_txt: `${date} 12:00:00`,
    main: {
      temp_min: daily.temperature_2m_min[index],
      temp_max: daily.temperature_2m_max[index],
    },
    weather: [weatherFromCode(daily.weather_code[index])],
  }))
}

export async function getWeather(city, signal) {
  const locationUrl = new URL(GEOCODING_URL)
  locationUrl.searchParams.set('name', city)
  locationUrl.searchParams.set('count', '1')
  locationUrl.searchParams.set('language', 'en')
  const locations = await fetchJson(locationUrl, signal)
  const location = locations.results?.[0]
  if (!location) throw new Error('We couldn’t find that city. Check the spelling and try again.')

  const forecastUrl = new URL(FORECAST_URL)
  forecastUrl.searchParams.set('latitude', location.latitude)
  forecastUrl.searchParams.set('longitude', location.longitude)
  forecastUrl.searchParams.set('current', 'temperature_2m,relative_humidity_2m,apparent_temperature,is_day,weather_code,wind_speed_10m,visibility')
  forecastUrl.searchParams.set('daily', 'weather_code,temperature_2m_max,temperature_2m_min,sunrise,sunset')
  forecastUrl.searchParams.set('timezone', 'auto')
  forecastUrl.searchParams.set('forecast_days', '5')
  const dataPromise = fetchJson(forecastUrl, signal)
  const data = await dataPromise

  const today = data.daily.time[0]
  const historyUrl = new URL(HISTORY_URL)
  historyUrl.searchParams.set('latitude', location.latitude)
  historyUrl.searchParams.set('longitude', location.longitude)
  historyUrl.searchParams.set('daily', 'weather_code,temperature_2m_max,temperature_2m_min')
  historyUrl.searchParams.set('timezone', 'auto')
  historyUrl.searchParams.set('start_date', shiftDate(today, -4))
  historyUrl.searchParams.set('end_date', shiftDate(today, -1))
  // Keep the current forecast usable even if historical data is temporarily unavailable.
  const historyPromise = fetchJson(historyUrl, signal).catch((error) => {
    if (error.name === 'AbortError') throw error
    return null
  })
  const historyData = await historyPromise

  const currentWeather = weatherFromCode(data.current.weather_code)
  const current = {
    name: location.name,
    sys: { country: location.country_code },
    time: data.current.time,
    is_day: data.current.is_day,
    weather: [currentWeather],
    main: {
      temp: data.current.temperature_2m,
      feels_like: data.current.apparent_temperature,
      humidity: data.current.relative_humidity_2m,
    },
    wind: { speed: data.current.wind_speed_10m },
    visibility: data.current.visibility,
  }

  return {
    current,
    forecast: { list: toDailyList(data.daily) },
    history: historyData ? toDailyList(historyData.daily) : [],
  }
}

export function groupForecastByDay(forecast) {
  return forecast.list.map((item) => ({
    date: item.dt_txt.slice(0, 10),
    min: item.main.temp_min,
    max: item.main.temp_max,
    weather: item.weather[0],
  }))
}
