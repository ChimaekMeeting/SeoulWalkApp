import Config from 'react-native-config';

export const env = {
  MAPBOX_PUBLIC_ACCESS_TOKEN: Config.MAPBOX_PUBLIC_ACCESS_TOKEN || '',
  API_BASE_URL: Config.API_BASE_URL || 'http://localhost:8000',
};
