import React, { useMemo, useState } from 'react';
import { LayoutChangeEvent, Pressable, StyleSheet, Text, View } from 'react-native';
import { AppMapView, AppMapViewProps } from './AppMapView';
import { mapConfig } from '../../config/mapConfig';
import { centerOfBounds, computeRouteBounds, zoomLevelForBounds } from '../../utils/geo';

export type RouteMapViewProps = AppMapViewProps & {
  /**
   * overview 모드 전용: previewRoute 전체가 화면에 들어오도록
   * 카메라 중심/줌을 경로 bounding box에 맞춘다(6a/6d 코스 미리보기용).
   */
  fitRouteOnMount?: boolean;
  /** 줌 버튼을 하단에서 얼마나 띄울지(px). 화면 하단에 다른 버튼이 겹칠 때 조정. */
  zoomControlBottomOffset?: number;
  /** 줌 +/- 버튼 표시 여부. 완료 화면처럼 작은 요약 썸네일에는 끄는 걸 권장. */
  showZoomControls?: boolean;
};

/** AppMapView를 감싸 줌 버튼과 "경로 전체 보기"를 추가한 지도 컴포넌트. */
export function RouteMapView(props: RouteMapViewProps) {
  const {
    fitRouteOnMount,
    zoomControlBottomOffset = 16,
    showZoomControls = true,
    ...mapProps
  } = props;
  const defaultZoom =
    props.mode === 'walk' ? mapConfig.walkCamera.zoomLevel : mapConfig.overviewCamera.zoomLevel;
  const [layoutSize, setLayoutSize] = useState<{ width: number; height: number } | null>(null);
  const [manualZoom, setManualZoom] = useState<number | null>(null);

  const shouldFitRoute =
    fitRouteOnMount && props.mode === 'overview' && !!props.previewRoute && props.previewRoute.length > 0;

  const fitted = useMemo(() => {
    if (!shouldFitRoute || !layoutSize || props.mode !== 'overview' || !props.previewRoute) return null;
    const bounds = computeRouteBounds(props.previewRoute);
    if (!bounds) return null;
    return {
      center: centerOfBounds(bounds),
      zoom: zoomLevelForBounds(bounds, layoutSize.width, layoutSize.height),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shouldFitRoute, layoutSize, props.mode === 'overview' ? props.previewRoute : null]);

  // 수동으로 +/- 를 누르면 그 이후로는 fitted 값 대신 manualZoom을 우선한다.
  const zoomLevel = manualZoom ?? fitted?.zoom ?? defaultZoom;

  const handleLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setLayoutSize({ width, height });
  };

  const zoomIn = () => setManualZoom(Math.min(zoomLevel + 1, mapConfig.maxZoom));
  const zoomOut = () => setManualZoom(Math.max(zoomLevel - 1, mapConfig.minZoom));

  return (
    <View style={{ flex: 1 }} onLayout={handleLayout}>
      <AppMapView {...mapProps} zoomLevel={zoomLevel} centerOverride={fitted?.center} />
      {showZoomControls && (
        <View style={[styles.zoomControls, { bottom: zoomControlBottomOffset }]}>
          <Pressable style={styles.zoomButton} onPress={zoomIn}>
            <Text style={styles.zoomButtonText}>+</Text>
          </Pressable>
          <View style={styles.zoomDivider} />
          <Pressable style={styles.zoomButton} onPress={zoomOut}>
            <Text style={styles.zoomButtonText}>−</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  zoomControls: {
    position: 'absolute',
    right: 16,
    borderRadius: 12,
    backgroundColor: 'rgba(17,17,17,0.85)',
    overflow: 'hidden',
  },
  zoomButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  zoomButtonText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '700',
  },
  zoomDivider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
});
