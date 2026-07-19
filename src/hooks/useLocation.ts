import { useState, useEffect } from 'react';
import * as Location from 'expo-location';
import { env } from '../config/env';

export interface Coordinates {
  latitude: number;
  longitude: number;
}

// 서울 서비스 구역 밖에서 개발할 때, 실제 GPS 대신 .env의 EXPO_PUBLIC_DEBUG_FIXED_LOCATION으로 고정(개발 시)
const debugFixedCoords = ((): Coordinates | null => {
  if (!env.DEBUG_FIXED_LOCATION) return null;
  const [latitude, longitude] = env.DEBUG_FIXED_LOCATION.split(',').map(Number);
  if (Number.isNaN(latitude) || Number.isNaN(longitude)) return null;
  return { latitude, longitude };
})();

export const useLocation = () => {
  const [hasPermission, setHasPermission] = useState(false);
  const [coords, setCoords] = useState<Coordinates | null>(null);

  useEffect(() => {
    if (debugFixedCoords) {
      setHasPermission(true);
      setCoords(debugFixedCoords);
      return;
    }

    const requestLocationPermission = async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        console.log('Location permission denied');
        setHasPermission(false);
        return;
      }

      setHasPermission(true);

      const position = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      setCoords({
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
      });
    };

    requestLocationPermission();
  }, []);

  return { hasPermission, coords };
};
