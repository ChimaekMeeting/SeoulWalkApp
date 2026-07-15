import React, { useMemo } from 'react';
import { StyleProp, View, ViewStyle } from 'react-native';
import Mapbox from '@rnmapbox/maps';
import { LocationInfo, WalkRouteResponse } from '../../types/prewalk';
import { mapConfig } from '../../config/mapConfig';
import { locationInfoToMapboxPosition, routeCoordinatesToLineString } from '../../utils/geo';
import { RouteLayer } from './RouteLayer';

interface AppMapViewCommonProps {
  /** backend LocationInfo 그대로. lat/lon이 없으면 mapConfig.defaultCenter로 폴백된다. */
  currentLocation?: LocationInfo | null;
  style?: StyleProp<ViewStyle>;
}

interface OverviewMapViewProps extends AppMapViewCommonProps {
  mode: 'overview';
  /** 코스를 선택했을 때만 전달. state.route_result.coordinates를 그대로 넘기면 된다. */
  previewRoute?: WalkRouteResponse['coordinates'];
}

interface WalkMapViewProps extends AppMapViewCommonProps {
  mode: 'walk';
  /** state.route_result.coordinates를 그대로 넘기면 된다. */
  route: WalkRouteResponse['coordinates'];
  routeColor?: string;
}

export type AppMapViewProps = OverviewMapViewProps | WalkMapViewProps;

export function AppMapView(props: AppMapViewProps) {
  const isWalk = props.mode === 'walk';
  const { lat, lon } = props.currentLocation ?? {};
  // lat/lon 원시값에만 의존해 메모이즈: currentLocation 객체가 매 렌더 새로 생성되어도
  // 실제 좌표가 그대로면 같은 배열 참조를 유지해 overview 모드에서 사용자가 팬한 지도가
  // 다시 원위치로 스냅되지 않게 한다.
  const initialCenter = useMemo(
    () => locationInfoToMapboxPosition(props.currentLocation) ?? mapConfig.defaultCenter,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [lat, lon],
  );

  return (
    <View style={[{ flex: 1 }, props.style]}>
      <Mapbox.MapView
        style={{ flex: 1 }}
        styleURL={isWalk ? mapConfig.styles.walk : mapConfig.styles.overview}
        logoEnabled={false}
        attributionEnabled={false}
      >
        {isWalk ? (
          <Mapbox.Camera
            defaultSettings={{ centerCoordinate: initialCenter, zoomLevel: mapConfig.walkCamera.zoomLevel }}
            followUserLocation
            followUserMode={Mapbox.UserTrackingMode.FollowWithHeading}
            followZoomLevel={mapConfig.walkCamera.zoomLevel}
            followPitch={mapConfig.walkCamera.pitch}
            animationMode="flyTo"
          />
        ) : (
          <Mapbox.Camera
            centerCoordinate={initialCenter}
            zoomLevel={mapConfig.overviewCamera.zoomLevel}
            pitch={mapConfig.overviewCamera.pitch}
            animationMode="flyTo"
          />
        )}

        {isWalk && props.route.length > 0 && (
          <RouteLayer data={routeCoordinatesToLineString(props.route)} color={props.routeColor} />
        )}
        {!isWalk && props.previewRoute && props.previewRoute.length > 0 && (
          <RouteLayer data={routeCoordinatesToLineString(props.previewRoute)} dashed />
        )}

        <Mapbox.UserLocation visible animated showsUserHeadingIndicator={isWalk} />
      </Mapbox.MapView>
    </View>
  );
}
