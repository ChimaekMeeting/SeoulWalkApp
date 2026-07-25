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
  styles: {
    overview: 'mapbox://styles/mapbox/streets-v12',
    walk: 'mapbox://styles/mapbox/dark-v11',
  },
  overviewCamera: {
    zoomLevel: 14,
    pitch: 0,
  },
  walkCamera: {
    zoomLevel: 17,
    pitch: 60,
  },
};
