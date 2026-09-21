import { client } from './client';

export interface WeatherInfo {
  precipitation_type?: string;
  humidity?: string;
  precipitation_1h?: string;
  temperature?: string;
  wind_speed?: string;
}

export interface AirInfo {
  air_quality_index?: string;
  pm10?: string;
  pm25?: string;
}

export interface EnvironmentInfo {
  weather_info: WeatherInfo | null;
  air_info: AirInfo | null;
}

export async function getEnvironmentInfo(lat: number, lon: number) {
  const { data } = await client.get<EnvironmentInfo>('/api/weather', {
    params: { lat, lon },
  });
  return data;
}
