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
  // 커스텀 스타일(Mapbox Studio): 라벨 폰트를 Noto Sans로 통일한 버전
  styles: {
    overview: 'mapbox://styles/kuty2004/cmrw5cfv400a901rdhuuq2fo8',
    walk: 'mapbox://styles/kuty2004/cmrw5k2b400a501rja15rb3wx',
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
