module.exports = {
  preset: '@react-native/jest-preset',
  resolver: 'react-native-worklets/jest/resolver',
  setupFiles: ['./node_modules/react-native-gesture-handler/jestSetup.js'],
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?|@react-navigation|@gorhom|react-native-reanimated|react-native-worklets|react-native-screens|react-native-gesture-handler|expo.*|@expo/.*)/)',
  ],
};
