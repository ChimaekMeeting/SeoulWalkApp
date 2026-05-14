import React from 'react';
import Mapbox from '@rnmapbox/maps';

export const StaticPOILayer = ({ data }: { data: any }) => {
  return (
    <Mapbox.ShapeSource id="static-pois" shape={data}>
      <Mapbox.CircleLayer
        id="static-pois-circle"
        style={{
          circleRadius: 6,
          circleColor: [
            'match',
            ['get', 'type'],
            'bench', '#8B4513',
            'toilet', '#4169E1',
            'cctv', '#FF0000',
            '#808080'
          ],
          circleStrokeWidth: 1.5,
          circleStrokeColor: '#FFFFFF',
        }}
      />
    </Mapbox.ShapeSource>
  );
};
