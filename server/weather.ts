import { config } from './config.ts'
import type { Weather } from '../shared/types.ts'

// Open-Meteo: free, no API key. Cached for 20 minutes.
let cached: { at: number; value: Weather } | null = null

export async function getWeather(): Promise<Weather | null> {
  if (cached && Date.now() - cached.at < 20 * 60 * 1000) return cached.value
  try {
    const params = new URLSearchParams({
      latitude: String(config.latitude),
      longitude: String(config.longitude),
      current: 'temperature_2m,weather_code',
      daily: 'temperature_2m_max,temperature_2m_min',
      forecast_days: '1',
      timezone: config.timeZone,
    })
    const res = await fetch(`https://api.open-meteo.com/v1/forecast?${params}`)
    const json = (await res.json()) as { current: { temperature_2m: number; weather_code: number }; daily: { temperature_2m_max: number[]; temperature_2m_min: number[] } }
    const value = { temperature: json.current.temperature_2m, code: json.current.weather_code, high: json.daily.temperature_2m_max[0]!, low: json.daily.temperature_2m_min[0]! }
    cached = { at: Date.now(), value }
    return value
  } catch {
    return cached?.value ?? null
  }
}
