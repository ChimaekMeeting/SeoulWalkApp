import React, { useMemo } from 'react';
import { StyleProp, View, ViewStyle } from 'react-native';
import Mapbox from '@rnmapbox/maps';
import { LocationInfo, WalkRouteResponse } from '../../types/prewalk';
import { mapConfig } from '../../config/mapConfig';
import {
  locationInfoToMapboxPosition,
  routeCoordinatesToLineString,
  sliceRouteAtDistanceKm,
} from '../../utils/geo';
import { RouteLayer } from './RouteLayer';
import { RouteEndpointMarkers } from './RouteEndpointMarkers';
import { RouteDirectionArrows } from './RouteDirectionArrows';

// 아직 안 걸은 구간(traveledKm 이후)을 지나온 구간과 다른 색으로 표시할 때 쓰는 "남은 길" 색.
// 순환 코스에서 어디까지 걸었고 어느 방향으로 진행 중인지 지도만 보고 알 수 있게 하기 위함.
// 지나온 구간은 원래 경로색(routeColor, 기본 파랑)을 그대로 쓰고, 남은 구간만 옅게 — 이 화면의
// 진행률 바(걸은 만큼 진하게 채워지고 track은 회색인 것)와 같은 방향으로 맞춘 것.
const UPCOMING_ROUTE_COLOR = '#B0B7C3';

interface AppMapViewCommonProps {
  /** backend LocationInfo 그대로. lat/lon이 없으면 mapConfig.defaultCenter로 폴백된다. */
  currentLocation?: LocationInfo | null;
  /** 모드 기본 줌 레벨(mapConfig.overviewCamera/walkCamera.zoomLevel) 대신 쓸 값. */
  zoomLevel?: number;
  /**
   * overview 모드에서 currentLocation 대신 카메라 중심으로 쓸 Mapbox [lng, lat] 좌표.
   * RouteMapView가 "경로 전체 보기"를 계산해서 넘기는 내부용 prop — 화면 코드에서 직접 쓰지 않는다.
   */
  centerOverride?: [number, number];
  /**
   * 지도 하단을 다른 UI(바텀시트 등)가 가릴 때, 그 높이(px)만큼 카메라 중심을 위로 밀어서
   * 가려지지 않은 영역 안에서 currentLocation이 보이게 한다. 기본 0.
   */
  bottomPadding?: number;
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
  /**
   * 지금까지 걸은 거리(km). 전달하면 경로 선을 이 지점 기준으로 지나온 구간(routeColor 그대로,
   * 진하게)/남은 구간(옅은 회색)으로 나눠 그리고, 출발·도착 마커도 함께 표시한다(순환 코스에서
   * 방향·진행 상황을 지도로 바로 알 수 있도록). 생략하면 기존처럼 경로 전체를 단일 색으로 그린다.
   */
  traveledKm?: number;
}

export type AppMapViewProps = OverviewMapViewProps | WalkMapViewProps;

export function AppMapView(props: AppMapViewProps) {
  const isWalk = props.mode === 'walk';
  const { lat, lon } = props.currentLocation ?? {};
  const [overrideLon, overrideLat] = props.centerOverride ?? [];
  // 원시값에만 의존해 메모이즈: currentLocation/centerOverride 객체가 매 렌더 새로 생성되어도
  // 실제 좌표가 그대로면 같은 배열 참조를 유지해 overview 모드에서 사용자가 팬한 지도가
  // 다시 원위치로 스냅되지 않게 한다.
  const initialCenter = useMemo(
    () => props.centerOverride ?? locationInfoToMapboxPosition(props.currentLocation) ?? mapConfig.defaultCenter,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [lat, lon, overrideLon, overrideLat],
  );

  const walkZoomLevel = props.zoomLevel ?? mapConfig.walkCamera.zoomLevel;
  const overviewZoomLevel = props.zoomLevel ?? mapConfig.overviewCamera.zoomLevel;
  // initialCenter와 마찬가지로 메모이즈 — 매 렌더 새 객체를 넘기면 flyTo 카메라가 불필요하게
  // 다시 애니메이션을 탈 위험이 있다(바로 위 initialCenter 메모이즈와 같은 이유).
  const bottomPadding = props.bottomPadding ?? 0;
  const cameraPadding = useMemo(
    () => ({ paddingLeft: 0, paddingRight: 0, paddingTop: 0, paddingBottom: bottomPadding }),
    [bottomPadding],
  );

  return (
    <View style={[{ flex: 1 }, props.style]}>
      <Mapbox.MapView
        style={{ flex: 1 }}
        styleURL={isWalk ? mapConfig.styles.walk : mapConfig.styles.overview}
        logoEnabled={false}
        attributionEnabled={false}
        localizeLabels={{ locale: 'ko' }}
      >
        {isWalk ? (
          <Mapbox.Camera
            defaultSettings={{ centerCoordinate: initialCenter, zoomLevel: walkZoomLevel }}
            followUserLocation
            followUserMode={Mapbox.UserTrackingMode.FollowWithHeading}
            followZoomLevel={walkZoomLevel}
            followPitch={mapConfig.walkCamera.pitch}
            animationMode="flyTo"
          />
        ) : (
          <Mapbox.Camera
            centerCoordinate={initialCenter}
            zoomLevel={overviewZoomLevel}
            pitch={mapConfig.overviewCamera.pitch}
            padding={cameraPadding}
            animationMode="flyTo"
          />
        )}

        {isWalk && props.route.length > 0 && (
          <>
            {props.traveledKm != null ? (
              <TraveledSplitRouteLayers
                route={props.route}
                traveledKm={props.traveledKm}
                traveledColor={props.routeColor}
              />
            ) : (
              <RouteLayer data={routeCoordinatesToLineString(props.route)} color={props.routeColor} />
            )}
            <RouteDirectionArrows route={props.route} />
            <RouteEndpointMarkers route={props.route} />
          </>
        )}
        {!isWalk && props.previewRoute && props.previewRoute.length > 0 && (
          <RouteLayer data={routeCoordinatesToLineString(props.previewRoute)} dashed />
        )}

        <Mapbox.UserLocation visible animated showsUserHeadingIndicator={isWalk} />
      </Mapbox.MapView>
    </View>
  );
}

/** route를 traveledKm 지점에서 잘라 지나온 구간/남은 구간을 다른 색 레이어 두 개로 그린다. */
function TraveledSplitRouteLayers({
  route,
  traveledKm,
  traveledColor,
}: {
  route: WalkRouteResponse['coordinates'];
  traveledKm: number;
  traveledColor?: string;
}) {
  const { before, after } = sliceRouteAtDistanceKm(route, traveledKm);
  return (
    <>
      {before.length > 1 && (
        <RouteLayer id="route-traveled" data={routeCoordinatesToLineString(before)} color={traveledColor} />
      )}
      {after.length > 1 && (
        <RouteLayer id="route-remaining" data={routeCoordinatesToLineString(after)} color={UPCOMING_ROUTE_COLOR} />
      )}
    </>
  );
}
