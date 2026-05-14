import { useState, useEffect } from 'react';
import { PermissionsAndroid, Platform } from 'react-native';

export const useLocation = () => {
  const [hasPermission, setHasPermission] = useState(false);

  useEffect(() => {
    const requestLocationPermission = async () => {
      if (Platform.OS === 'android') {
        try {
          const granted = await PermissionsAndroid.requestMultiple([
            PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
            PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION,
          ]);
          if (
            granted['android.permission.ACCESS_FINE_LOCATION'] === PermissionsAndroid.RESULTS.GRANTED ||
            granted['android.permission.ACCESS_COARSE_LOCATION'] === PermissionsAndroid.RESULTS.GRANTED
          ) {
            setHasPermission(true);
          } else {
            console.log('Location permission denied');
            setHasPermission(false);
          }
        } catch (err) {
          console.warn(err);
        }
      } else {
        // iOS will be handled later
        setHasPermission(true);
      }
    };

    requestLocationPermission();
  }, []);

  return { hasPermission };
};
