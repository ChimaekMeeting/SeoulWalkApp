import React from 'react';
import Mapbox from '@rnmapbox/maps';

interface RouteLayerProps {
  data: any;
  dashed?: boolean;
  color?: string;
}

export const RouteLayer = ({ data, dashed = false, color = '#4A90E2' }: RouteLayerProps) => {
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
          ...(dashed ? { lineDasharray: [1, 1.5] } : {}),
        }}
      />
      {/* Main route line */}
      <Mapbox.LineLayer
        id="route-line"
        style={{
          lineColor: color,
          lineWidth: 5,
          lineJoin: 'round',
          lineCap: 'round',
          ...(dashed ? { lineDasharray: [1, 1.5] } : {}),
        }}
      />
    </Mapbox.ShapeSource>
  );
};
