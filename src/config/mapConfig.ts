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
