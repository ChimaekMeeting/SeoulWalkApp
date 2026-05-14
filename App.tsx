import React from 'react';
import {SafeAreaProvider} from 'react-native-safe-area-context';
import Mapbox from '@rnmapbox/maps';
import {env} from './src/config/env';
import {HomeScreen} from './src/screens/HomeScreen';

Mapbox.setAccessToken(env.MAPBOX_PUBLIC_ACCESS_TOKEN);
function App() {
  return (
    <SafeAreaProvider>
      <HomeScreen />
    </SafeAreaProvider>
  );
}

export default App;
