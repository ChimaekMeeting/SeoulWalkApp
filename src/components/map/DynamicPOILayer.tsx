import React from 'react';
import Mapbox from '@rnmapbox/maps';

export const DynamicPOILayer = ({ data }: { data: any }) => {
  return (
    <Mapbox.ShapeSource id="dynamic-pois" shape={data}>
      <Mapbox.CircleLayer
        id="dynamic-pois-circle"
        style={{
          circleRadius: 8,
          circleColor: '#FF69B4',
          circleStrokeWidth: 2,
          circleStrokeColor: '#FFFFFF',
        }}
      />
      <Mapbox.SymbolLayer
        id="dynamic-pois-symbol"
        style={{
          textField: ['get', 'name'],
          textSize: 12,
          textOffset: [0, 1.5],
          textColor: '#333333',
          textHaloColor: '#FFFFFF',
          textHaloWidth: 2,
        }}
      />
    </Mapbox.ShapeSource>
  );
};
