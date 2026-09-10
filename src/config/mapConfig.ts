export const mapConfig = {
  // [lng, lat] for Mapbox
  defaultCenter: [126.9780, 37.5665],
  defaultZoom: 14,
  minZoom: 10,
  maxZoom: 18,
  // Approximate bounding box for Seoul
  seoulBounds: {
    ne: [127.183, 37.715],
    sw: [126.764, 37.428],
  },
  // Mapbox 공식 스타일. 커스텀 스타일(계정 소유 폰트)은 다른 Mapbox 계정 토큰에서
  // 라벨이 안 뜨는 문제가 있어서(글꼴이 업로드한 계정에만 묶임) 뺐다 — 한글 라벨은
  // AppMapView의 localizeLabels={{ locale: 'ko' }}만으로 처리한다.
  //
  // 라이트/다크 스타일 URL. dark-v11이 아닌 다른 다크 스타일(navigation-night-v1 등)로 POI를
  // 더 보여주는 시도를 해봤는데 배색이 초록/검정으로 튀어서 되돌림 — dark-v11 고정.
  // (streets-v12는 상점 단위까지 라벨이 촘촘하고 dark-v11은 그보다 훨씬 옅다는 차이는 있지만,
  // 지금은 배색을 우선해 둘 다 동일한 light/dark 쌍을 그대로 쓴다.)
  styleUrls: {
    light: 'mapbox://styles/mapbox/streets-v12',
    dark: 'mapbox://styles/mapbox/dark-v11',
  },
  // 사용자가 마이페이지에서 아직 고르지 않았을 때의 기본값 — 홈은 밝게, 산책 중엔 눈부심을
  // 줄이려 어둡게(기존 고정 동작과 동일).
  defaultMapModes: {
    overview: 'light',
    walk: 'dark',
  } as const,
  overviewCamera: {
    zoomLevel: 14,
    pitch: 0,
  },
  walkCamera: {
    zoomLevel: 17,
    pitch: 60,
  },
};
