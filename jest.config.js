module.exports = {
  preset: '@react-native/jest-preset',
  resolver: 'react-native-worklets/jest/resolver',
  setupFiles: ['./node_modules/react-native-gesture-handler/jestSetup.js'],
  transformIgnorePatterns: [
    // @rnmapbox/maps는 ESM(export ...)으로 배포돼 있어 이 목록에 없으면 App.test.tsx가
    // "Unexpected token 'export'"로 깨진다 — Babel 변환 대상에 포함시킨다.
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?|@react-navigation|@gorhom|react-native-reanimated|react-native-worklets|react-native-screens|react-native-gesture-handler|@rnmapbox/maps|expo.*|@expo/.*)/)',
  ],
};
