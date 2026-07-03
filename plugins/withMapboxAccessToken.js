const { withStringsXml, AndroidConfig } = require('@expo/config-plugins');

// @rnmapbox/maps's own config plugin only wires up the build-time download
// token. The native SDK also needs the runtime public access token available
// from app startup via this exact resource name - otherwise MapView
// inflation can race ahead of the JS-side Mapbox.setAccessToken() call and
// crash with "no access token" (observed in this app pre-migration).
const withMapboxAccessToken = (config) => {
  return withStringsXml(config, (config) => {
    const token = process.env.EXPO_PUBLIC_MAPBOX_PUBLIC_ACCESS_TOKEN ?? '';
    config.modResults = AndroidConfig.Strings.setStringItem(
      [AndroidConfig.Resources.buildResourceItem({ name: 'mapbox_access_token', value: token })],
      config.modResults
    );
    return config;
  });
};

module.exports = withMapboxAccessToken;
