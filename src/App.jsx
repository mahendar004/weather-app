import { useEffect, useRef, useState } from 'react'
import { getWeather, groupForecastByDay } from './weatherApi.js'

const RECENTS_KEY = 'weatherly-recent-searches'
const CONDITIONS = {
  Clear: { icon: '☀️', tone: 'sunny' }, Clouds: { icon: '☁️', tone: 'cloudy' },
  Rain: { icon: '🌧️', tone: 'rainy' }, Drizzle: { icon: '🌦️', tone: 'rainy' },
  Thunderstorm: { icon: '⛈️', tone: 'rainy' }, Snow: { icon: '❄️', tone: 'snowy' },
  Mist: { icon: '🌫️', tone: 'cloudy' }, Smoke: { icon: '🌫️', tone: 'cloudy' },
  Haze: { icon: '🌫️', tone: 'cloudy' }, Dust: { icon: '🌫️', tone: 'cloudy' },
  Fog: { icon: '🌫️', tone: 'cloudy' }, Sand: { icon: '🌫️', tone: 'cloudy' },
  Ash: { icon: '🌫️', tone: 'cloudy' }, Squall: { icon: '💨', tone: 'cloudy' }, Tornado: { icon: '🌪️', tone: 'rainy' },
}

function conditionFor(main) {
  return CONDITIONS[main] || { icon: '🌤️', tone: 'sunny' }
}

function WeatherIcon({ main, className = '', night = false }) {
  const icon = night && main === 'Clear' ? '🌙' : conditionFor(main).icon
  return <span className={className} role="img" aria-label={`${night ? 'Nighttime ' : ''}${main}`}>{icon}</span>
}

function readRecents() {
  try { return JSON.parse(localStorage.getItem(RECENTS_KEY) || '[]') } catch { return [] }
}

function dayName(date, todayDate) {
  if (date === todayDate) return 'Today'
  return new Intl.DateTimeFormat(undefined, { weekday: 'short' }).format(new Date(`${date}T12:00:00`))
}

export default function App() {
  const [query, setQuery] = useState('')
  const [weather, setWeather] = useState(null)
  const [selectedDate, setSelectedDate] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [recents, setRecents] = useState(readRecents)
  const abortRef = useRef(null)
  const requestIdRef = useRef(0)
  const timelineRef = useRef(null)

  useEffect(() => {
    localStorage.setItem(RECENTS_KEY, JSON.stringify(recents))
  }, [recents])

  useEffect(() => () => abortRef.current?.abort(), [])

  useEffect(() => {
    if (!weather || !timelineRef.current) return
    const todayCard = timelineRef.current.querySelector('[data-today="true"]')
    if (todayCard) timelineRef.current.scrollLeft = todayCard.offsetLeft
  }, [weather])

  async function searchCity(city) {
    const trimmed = city.trim()
    if (!trimmed) {
      setError('Enter a city name to see its weather.')
      return
    }

    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller
    const requestId = ++requestIdRef.current
    setLoading(true)
    setError('')

    try {
      const result = await getWeather(trimmed, controller.signal)
      if (requestId !== requestIdRef.current) return
      setWeather(result)
      setQuery(result.current.name)
      setSelectedDate(result.current.time.slice(0, 10))
      const place = { name: result.current.name, country: result.current.sys.country }
      setRecents((previous) => [place, ...previous.filter((item) => item.name.toLowerCase() !== place.name.toLowerCase() || item.country !== place.country)].slice(0, 5))
    } catch (err) {
      if (err.name !== 'AbortError' && requestId === requestIdRef.current) setError(err.message || 'Something went wrong. Please try again.')
    } finally {
      if (requestId === requestIdRef.current) setLoading(false)
    }
  }

  const current = weather?.current
  const main = current?.weather?.[0]?.main || ''
  const isNight = Boolean(current && current.is_day === 0)
  const tone = isNight ? 'night' : conditionFor(main).tone
  const forecastDays = weather ? groupForecastByDay(weather.forecast) : []
  const historyDays = weather ? groupForecastByDay({ list: weather.history }).map((day) => ({ ...day, isPast: true })) : []
  const todayDate = current?.time?.slice(0, 10)
  const selectedDay = [...historyDays, ...forecastDays].find((day) => day.date === selectedDate)
  const showCurrentWeather = !selectedDay || selectedDay.date === todayDate
  const currentTime = current?.time?.slice(-5) || ''
  const formatLongDate = (date) => new Intl.DateTimeFormat(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }).format(new Date(`${date}T12:00:00`))
  const currentDate = todayDate ? formatLongDate(todayDate) : ''

  function renderTimelineCard(day) {
    const isToday = day.date === todayDate
    const isSelected = day.date === selectedDate
    return <button className={`forecast-card ${isToday ? 'forecast-today' : ''} ${isSelected && !isToday ? 'forecast-selected' : ''} ${day.isPast ? 'history-card' : ''}`} data-today={isToday ? 'true' : undefined} aria-pressed={isSelected} type="button" key={day.date} onClick={() => setSelectedDate(day.date)}>
      <span className="forecast-day">{dayName(day.date, todayDate)}</span>
      <span className="forecast-date">{new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(new Date(`${day.date}T12:00:00`))}</span>
      <WeatherIcon className="forecast-icon" main={day.weather.main} />
      <span className="forecast-condition">{day.weather.main}</span>
      <span className="forecast-temps"><strong>{Math.round(day.max)}°</strong><span>{Math.round(day.min)}°</span></span>
    </button>
  }

  return (
    <main className={`min-h-screen weather-bg ${current ? `weather-${tone} has-weather` : ''}`}>
      <div className="mx-auto max-w-6xl px-5 py-7 sm:px-8 sm:py-10">
        <header className="mb-10 flex items-center justify-between">
          <a className="brand" href="#top" aria-label="Weatherly home"><span className="brand-mark">W</span> weatherly<span className="brand-dot">.</span></a>
          <span className="hidden text-sm text-slate-500 sm:block">A little clarity for your day</span>
        </header>

        <section className={`search-hero mx-auto max-w-3xl text-center ${current ? 'search-hero-compact' : ''}`} id="top">
          <p className="eyebrow">YOUR LOCAL FORECAST</p>
          <h1 className="mt-3 text-4xl font-semibold tracking-tight text-slate-900 sm:text-5xl">{current ? 'Your forecast, at a glance.' : 'Weather, made simple.'}</h1>
          <p className="mx-auto mt-3 max-w-xl text-base leading-7 text-slate-600">Find the forecast for wherever you’re headed.</p>

          <form className="search-form mt-8" onSubmit={(event) => { event.preventDefault(); searchCity(query) }}>
            <label className="sr-only" htmlFor="city-search">Search by city</label>
            <span className="search-icon" aria-hidden="true">⌕</span>
            <input id="city-search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search a city…" autoComplete="off" />
            <button className="search-button" type="submit" disabled={loading}>
              {loading ? <><span className="spinner" aria-hidden="true" /> Searching</> : 'Search'}
            </button>
          </form>

          {recents.length > 0 && <div className="mt-4 flex flex-wrap items-center justify-center gap-2" aria-label="Recent searches">
            <span className="mr-1 text-xs font-semibold uppercase tracking-wider text-slate-400">Recent</span>
            {recents.map((place) => <button className="recent-chip" key={`${place.name}-${place.country}`} onClick={() => { setQuery(place.name); searchCity(place.name) }}>{place.name}<span>{place.country}</span></button>)}
            <button className="clear-recent" onClick={() => setRecents([])}>Clear</button>
          </div>}
        </section>

        {error && <div className="error-banner mx-auto mt-7 max-w-3xl" role="alert"><span aria-hidden="true">!</span>{error}</div>}

        {loading && <section className="loading-card mx-auto mt-10 max-w-4xl" aria-live="polite"><span className="spinner spinner-large" /><div><strong>Finding your forecast</strong><p>Checking conditions for {query.trim()}…</p></div></section>}

        {!loading && current && <div className="mx-auto mt-10 max-w-4xl" aria-live="polite">
          <section className="current-card">
            {showCurrentWeather ? <>
              <div className="current-topline"><div><p className="eyebrow">CURRENT WEATHER</p><h2>{current.name}<span className="country-code">{current.sys.country}</span></h2><p className="current-date">{currentDate}</p><p className="local-time">Local time · {currentTime}</p></div><div className="weather-emoji" aria-hidden="true"><WeatherIcon main={main} night={isNight} /></div></div>
              <div className="current-main"><div className="temperature">{Math.round(current.main.temp)}<span>°</span></div><div className="condition-copy"><p>{current.weather[0].description}</p><span>Feels like {Math.round(current.main.feels_like)}°</span></div></div>
              <div className="metrics-grid"><div className="metric"><span className="metric-icon" aria-hidden="true">◉</span><div><span className="metric-label">Humidity</span><strong>{current.main.humidity}<small>%</small></strong></div></div><div className="metric"><span className="metric-icon" aria-hidden="true">↗</span><div><span className="metric-label">Wind speed</span><strong>{current.wind.speed}<small> km/h</small></strong></div></div><div className="metric"><span className="metric-icon" aria-hidden="true">⌁</span><div><span className="metric-label">Visibility</span><strong>{current.visibility != null ? (current.visibility / 1000).toFixed(1) : '—'}<small> km</small></strong></div></div></div>
            </> : <>
              <div className="current-topline"><div><p className="eyebrow">{selectedDay.isPast ? 'PAST WEATHER ESTIMATE' : 'DAILY FORECAST'}</p><h2>{current.name}<span className="country-code">{current.sys.country}</span></h2><p className="current-date">{formatLongDate(selectedDay.date)}</p></div><div className="weather-emoji"><WeatherIcon main={selectedDay.weather.main} /></div></div>
              <div className="current-main"><div className="temperature">{Math.round(selectedDay.max)}<span>°</span></div><div className="condition-copy"><p>{selectedDay.weather.description}</p><span>Daily high · low {Math.round(selectedDay.min)}°</span></div></div>
              <div className="metrics-grid daily-range-grid"><div className="metric"><span className="metric-icon" aria-hidden="true">↑</span><div><span className="metric-label">Daily high</span><strong>{Math.round(selectedDay.max)}<small>°C</small></strong></div></div><div className="metric"><span className="metric-icon" aria-hidden="true">↓</span><div><span className="metric-label">Daily low</span><strong>{Math.round(selectedDay.min)}<small>°C</small></strong></div></div><div className="metric"><span className="metric-icon" aria-hidden="true">◷</span><div><span className="metric-label">Selected day</span><strong>{selectedDay.isPast ? 'Past' : 'Forecast'}</strong></div></div></div>
            </>}
          </section>

          <section className="forecast-section timeline-section"><div className="section-heading"><div><p className="eyebrow">PAST + UPCOMING</p><h2>Weather timeline</h2><p className="history-note">Select a day to see its details above · scroll left for past days</p></div><span className="unit-label">← Past&nbsp; · &nbsp;°C · km/h&nbsp; · &nbsp;Future →</span></div><div className="forecast-grid timeline-grid" ref={timelineRef} aria-label="Past four days, today, and the next four-day forecast">{historyDays.map(renderTimelineCard)}{forecastDays.map(renderTimelineCard)}</div>{historyDays.length === 0 && <p className="history-unavailable">Recent history is temporarily unavailable. The forecast is still available in this timeline.</p>}</section>
          <p className="attribution">Weather data by <a href="https://open-meteo.com/" target="_blank" rel="noreferrer">Open-Meteo</a></p>
        </div>}

        {!loading && !current && <section className="empty-state mx-auto mt-12 max-w-3xl"><div className="empty-sun" aria-hidden="true">☀</div><h2>{error ? 'Let’s try another search.' : 'A fresh forecast is one search away.'}</h2><p>{error ? 'Search for a city to get the latest conditions.' : 'Enter a city above to see current conditions and the five-day outlook.'}</p><div className="empty-details"><span>✦ Live conditions</span><span>✦ Five-day outlook</span><span>✦ Your recent places</span></div></section>}

        <footer className="page-footer">Made for curious minds <span>·</span> Weatherly</footer>
      </div>
    </main>
  )
}
