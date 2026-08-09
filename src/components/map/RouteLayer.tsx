import React from 'react';
import Mapbox from '@rnmapbox/maps';

interface RouteLayerProps {
  data: any;
  dashed?: boolean;
  color?: string;
  /**
   * ShapeSource/Layer id 접두어. 한 지도에 RouteLayer를 두 번 이상 그릴 때(예: 이미 걸은
   * 구간/남은 구간을 다른 색으로 표시) id가 겹치면 안 되므로 인스턴스마다 다르게 넘겨야 한다.
   */
  id?: string;
}

export const RouteLayer = ({ data, dashed = false, color = '#4A90E2', id = 'route' }: RouteLayerProps) => {
  return (
    <Mapbox.ShapeSource id={`${id}-source`} shape={data}>
      {/* Background shadow for route */}
      <Mapbox.LineLayer
        id={`${id}-line-bg`}
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
        id={`${id}-line`}
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
