import { useState, useEffect } from 'react';
import * as Location from 'expo-location';

export interface Coordinates {
  latitude: number;
  longitude: number;
}

export const useLocation = () => {
  const [hasPermission, setHasPermission] = useState(false);
  const [coords, setCoords] = useState<Coordinates | null>(null);

  useEffect(() => {
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
