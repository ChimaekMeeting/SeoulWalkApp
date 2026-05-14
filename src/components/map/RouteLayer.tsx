import React from 'react';
import Mapbox from '@rnmapbox/maps';

export const RouteLayer = ({ data }: { data: any }) => {
  return (
    <Mapbox.ShapeSource id="route-source" shape={data}>
      {/* Background shadow for route */}
      <Mapbox.LineLayer
        id="route-line-bg"
        style={{
          lineColor: '#FFFFFF',
          lineWidth: 8,
          lineJoin: 'round',
          lineCap: 'round',
        }}
      />
      {/* Main route line */}
      <Mapbox.LineLayer
        id="route-line"
        style={{
          lineColor: '#4A90E2',
          lineWidth: 5,
          lineJoin: 'round',
          lineCap: 'round',
        }}
      />
    </Mapbox.ShapeSource>
  );
};
