# Weatherly

A small React weather app with current conditions, a five-day outlook, and recent city searches. It uses Open-Meteo, so you do not need to create an account or configure an API key for local development.

## Run locally

1. Install Node.js (18 or newer).
2. Run `npm install`.
3. Run `npm run dev` and open the local URL printed by Vite.

Production build: `npm run build`. The app needs an internet connection to retrieve location and weather data. Open-Meteo's public API is intended for reasonable non-commercial use; see its [terms](https://open-meteo.com/en/terms) before using it commercially.

## How the data reaches the UI

`src/weatherApi.js` first searches the Open-Meteo Geocoding API for a city, then calls the Weather Forecast API with its coordinates. It also requests four earlier days from Open-Meteo's Historical Forecast API. Past data is archived model weather, not a direct reading from a nearby weather station. The forecast and history requests use the location's local timezone. The app checks HTTP status and API error responses; if history is unavailable, current conditions and the forecast still display. These APIs are keyless for this project.

| UI | Open-Meteo response fields |
| --- | --- |
| City and country | Geocoding `results[0].name`, `results[0].country_code` |
| Temperature and feels like | Current `temperature_2m`, `apparent_temperature` |
| Humidity | Current `relative_humidity_2m` |
| Wind speed | Current `wind_speed_10m` (km/h) |
| Condition and icon | Current/daily `weather_code`, translated from WMO codes |
| Local time and day/night | Current `time`, `is_day` |
| Forecast date and daily low/high | Daily `time`, `temperature_2m_min`, `temperature_2m_max` |
| Previous four days | Historical Forecast API daily `time`, `temperature_2m_min`, `temperature_2m_max`, and `weather_code` |

The current fields describe conditions at the latest reported time. Daily fields summarize forecast conditions for each date. The forecast cards use the API's daily high and low values directly.

## Concepts to explore

- **Fetch API, promises, and async/await:** `getWeather` in `src/weatherApi.js` uses Fetch to look up a place and then request its weather.
- **JSON and HTTP errors:** `fetchJson` parses each response, checks `response.ok`, and surfaces API errors.
- **React state and effects:** `src/App.jsx` stores search, loading, error, weather, and recent searches in state. `useEffect` persists recent searches and aborts an in-flight request when the component unmounts.
- **Stale requests:** `AbortController` cancels an older search, and a request ID ensures only the latest result updates the page.
- **Error handling:** Empty input, unknown cities, and network/API failures produce visible messages.

## API response challenge

The following is an **illustrative simplified example**, not a verbatim Open-Meteo response. Which fields would you connect to temperature, humidity, wind speed, current condition, and forecast high/low?

```json
{
  "current": {
    "temperature_2m": 18.4,
    "apparent_temperature": 17.8,
    "relative_humidity_2m": 62,
    "wind_speed_10m": 12.5,
    "weather_code": 2
  },
  "daily": {
    "time": ["2026-10-29"],
    "temperature_2m_max": [21.3],
    "temperature_2m_min": [16.2],
    "weather_code": [2]
  }
}
```

<details>
<summary>Answer key</summary>

- Temperature: `current.temperature_2m` (and `current.apparent_temperature` for feels-like).
- Humidity: `current.relative_humidity_2m`.
- Wind speed: `current.wind_speed_10m`.
- Current condition: `current.weather_code`, translated using WMO weather interpretation codes.
- Forecast: `daily.time` supplies dates; the matching entries in `daily.temperature_2m_max` and `daily.temperature_2m_min` supply highs and lows. `daily.weather_code` supplies each forecast condition.

</details>
