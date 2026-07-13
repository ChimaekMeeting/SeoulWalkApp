/* 날씨 스키마 */
export interface WeatherInfo {
  precipitation_type: string | null; // 강수형태 (없음/비/비·눈/눈/빗방울 등)
  humidity: string | null; // 습도 (%)
  precipitation_1h: string | null; // 1시간 강수량 (mm)
  temperature: string | null; // 기온 (℃)
  wind_speed: string | null; // 풍속 (m/s)
}

/* 대기질 스키마 */
export interface AirQualityInfo {
  air_quality_index: string | null; // 통합대기환경지수
  so2: string | null; // 이산화황 (ppm)
  co: string | null; // 일산화탄소 (ppm)
  pm10: string | null; // 미세먼지 (㎍/㎥)
  pm25: string | null; // 초미세먼지 (㎍/㎥)
  no2: string | null; // 이산화질소 (ppm)
  o3: string | null; // 오존 (ppm)
}

/* 날씨, 대기질 관련 스키마 */
export interface EnvironmentInfo {
  weather: WeatherInfo;
  air: AirQualityInfo;
}
