import type { WeatherDay } from "@/lib/types";

/**
 * Fetch 14-day weather forecast from Open-Meteo API.
 * Free, no API key required.
 * Defaults to São Paulo coordinates if none provided.
 */
export async function fetchWeather(
  latitude = -23.5505,
  longitude = -46.6333
): Promise<WeatherDay[]> {
  try {
    const url = new URL("https://api.open-meteo.com/v1/forecast");
    url.searchParams.set("latitude", String(latitude));
    url.searchParams.set("longitude", String(longitude));
    url.searchParams.set("daily", "weather_code,temperature_2m_max");
    url.searchParams.set("timezone", "America/Sao_Paulo");
    url.searchParams.set("forecast_days", "14");

    const res = await fetch(url.toString(), { next: { revalidate: 3600 } }); // Cache 1h

    if (!res.ok) return [];

    const data = await res.json();

    if (!data.daily?.time) return [];

    const days: WeatherDay[] = data.daily.time.map(
      (date: string, i: number) => ({
        date,
        weatherCode: data.daily.weather_code[i],
        temperatureMax: Math.round(data.daily.temperature_2m_max[i]),
      })
    );

    return days;
  } catch (error) {
    console.error("Failed to fetch weather:", error);
    return [];
  }
}

/**
 * Map WMO weather codes to emoji icons.
 * See: https://open-meteo.com/en/docs#weathervariables
 */
export function getWeatherIcon(code: number): string {
  if (code === 0) return "☀️";               // Clear sky
  if (code <= 3) return "⛅";                // Partly cloudy
  if (code <= 49) return "☁️";               // Cloudy/Fog
  if (code <= 59) return "🌧️";              // Drizzle
  if (code <= 69) return "🌧️";              // Rain
  if (code <= 79) return "🌨️";              // Snow
  if (code <= 84) return "🌧️";              // Rain showers
  if (code <= 94) return "🌨️";              // Snow showers
  if (code <= 99) return "⛈️";              // Thunderstorm
  return "🌤️";
}

/**
 * Create a lookup map for quick date -> weather access.
 */
export function createWeatherMap(
  weatherDays: WeatherDay[]
): Map<string, WeatherDay> {
  const map = new Map<string, WeatherDay>();
  for (const day of weatherDays) {
    map.set(day.date, day);
  }
  return map;
}
