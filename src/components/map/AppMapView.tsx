import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { StyleProp, View, ViewStyle } from 'react-native';
import Mapbox from '@rnmapbox/maps';
import { LocationInfo, WalkRouteResponse } from '../../types/prewalk';
import { mapConfig } from '../../config/mapConfig';
import { debugLog } from '../../utils/logger';
import {
  locationInfoToMapboxPosition,
  routeCoordinatesToLineString,
  sliceRouteAtDistanceKm,
} from '../../utils/geo';
import { RouteLayer } from './RouteLayer';
import { RouteEndpointMarkers } from './RouteEndpointMarkers';
import { RouteDirectionArrows } from './RouteDirectionArrows';

// 아직 안 걸은 구간(routeProgressKm 이후)을 지나온 구간과 다른 색으로 표시할 때 쓰는 "남은 길" 색.
// 순환 코스에서 어디까지 걸었고 어느 방향으로 진행 중인지 지도만 보고 알 수 있게 하기 위함.
// 지나온 구간은 원래 경로색(routeColor, 기본 파랑)을 그대로 쓰고, 남은 구간만 옅게 — 이 화면의
// 진행률 바(걸은 만큼 진하게 채워지고 track은 회색인 것)와 같은 방향으로 맞춘 것.
const UPCOMING_ROUTE_COLOR = '#B0B7C3';

// walk 모드에서 사용자가 지도를 팬/줌한 뒤, 이 시간(ms) 동안 추가 조작이 없으면 현재 위치
// 자동 추적을 다시 켠다. (@rnmapbox는 제스처 후 네이티브 추적이 풀리므로 followUserLocation을
// false→true로 다시 토글해줘야 재개된다.)
const WALK_RECENTER_DELAY_MS = 5000;

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
   * 경로 시작점부터 현재까지의 진행 거리(km). 전달하면 경로 선을 이 지점 기준으로 지나온 구간
   * (routeColor 그대로, 진하게)/남은 구간(옅은 회색)으로 나눠 그리고, 출발·도착 마커도 함께
   * 표시한다(순환 코스에서 방향·진행 상황을 지도로 바로 알 수 있도록). 생략하면 경로 전체를 단일 색으로.
   */
  routeProgressKm?: number;
  /**
   * 개발용 — 도로 스냅 전 원본 경로를 빨간 점선으로 겹쳐 그린다. 스냅 결과(route)가 실제 도보로에
   * 제대로 붙었는지 눈으로 대조하기 위한 것. 프로덕션에서는 넘기지 않는다.
   */
  debugOverlayRoute?: WalkRouteResponse['coordinates'];
}

export type AppMapViewProps = OverviewMapViewProps | WalkMapViewProps;

export function AppMapView(props: AppMapViewProps) {
  const isWalk = props.mode === 'walk';
  const { lat, lon } = props.currentLocation ?? {};
  const walkZoomLevel = props.zoomLevel ?? mapConfig.walkCamera.zoomLevel;
  const overviewZoomLevel = props.zoomLevel ?? mapConfig.overviewCamera.zoomLevel;
  const bottomPadding = props.bottomPadding ?? 0;
  const cameraPadding = useMemo(
    () => ({ paddingLeft: 0, paddingRight: 0, paddingTop: 0, paddingBottom: bottomPadding }),
    [bottomPadding],
  );

  // walk 모드 카메라의 최초 중심(followUserLocation이 잡기 전 1프레임용).
  const walkInitialCenter = useMemo<number[]>(
    () => locationInfoToMapboxPosition(props.currentLocation) ?? mapConfig.defaultCenter,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [lat, lon],
  );

  // overview: 사용자가 지도를 직접 만지기 전까지는 followUserLocation으로 현재 위치를 따라간다.
  // 이건 파란 점(Mapbox.UserLocation)·walk 모드와 완전히 같은 네이티브 메커니즘이라, 선언적
  // centerCoordinate/명령형 setCamera가 씹히던 것과 달리 현재 위치로의 이동이 확실히 동작한다.
  // 사용자가 팬/줌하면(onCameraChanged의 isGestureActive) 추적을 끄고 그 시점을 존중한다.
  // centerOverride(경로 전체 보기)가 있으면 추적하지 않고 그 좌표를 선언적으로 쓴다.
  const [userInteracted, setUserInteracted] = useState(false);
  // walk 모드: 제스처마다 +1 (effect를 재실행시켜 재추적 타이머를 리셋). walkFollowSuspended가
  // true인 동안만 추적이 꺼진다 — 마지막 조작 후 WALK_RECENTER_DELAY_MS가 지나면 다시 켜진다.
  const [walkInteractionNonce, setWalkInteractionNonce] = useState(0);
  const [walkFollowSuspended, setWalkFollowSuspended] = useState(false);
  // @rnmapbox의 onCameraChanged는 카메라 프레임마다 호출되고, followUserLocation 토글이나
  // flyTo 같은 "프로그램적" 이동 중에도 isGestureActive=true로 보고한다. 그래서 콜백에서
  // 매 프레임 setState를 하면 → 카메라 prop이 바뀌고 → 콜백이 다시 발화하는 무한 렌더 루프가
  // 생긴다("Maximum update depth exceeded"). 아래 두 ref로 그 루프를 끊는다.
  //  - wasGestureActiveRef: 직전 프레임의 제스처 상태. 비활성→활성 "상승 엣지"에서만 반응한다.
  //  - suppressGestureUntilRef: 추적 재개 직후 flyTo가 만드는 제스처 오탐을 무시하는 시각(ms).
  const wasGestureActiveRef = useRef(false);
  const suppressGestureUntilRef = useRef(Date.now() + 2000);
  const handleCameraChanged = useCallback(
    (state: { gestures?: { isGestureActive?: boolean } }) => {
      const isGestureActive = !!state?.gestures?.isGestureActive;
      const wasGestureActive = wasGestureActiveRef.current;
      wasGestureActiveRef.current = isGestureActive;
      // 제스처 상승 엣지에서만 처리 — 프레임마다/프로그램적 이동 중엔 무시.
      if (!isGestureActive || wasGestureActive) return;
      if (Date.now() < suppressGestureUntilRef.current) return;
      if (isWalk) {
        setWalkInteractionNonce(n => n + 1);
        debugLog('Map', 'walk: user gesture → pause follow (auto-resume scheduled)');
      } else {
        setUserInteracted(true);
        debugLog('Map', 'user gesture → stop following user location');
      }
    },
    [isWalk],
  );

  useEffect(() => {
    if (!isWalk || walkInteractionNonce === 0) return;
    setWalkFollowSuspended(true);
    const timer = setTimeout(() => {
      // 재개로 인한 flyTo가 onCameraChanged를 제스처로 오탐하며 다시 추적을 끄지 않도록 가드.
      suppressGestureUntilRef.current = Date.now() + 1500;
      setWalkFollowSuspended(false);
    }, WALK_RECENTER_DELAY_MS);
    return () => clearTimeout(timer);
  }, [isWalk, walkInteractionNonce]);
  // 경로 미리보기(previewRoute)나 지정 중심(centerOverride)이 있으면 그게 우선이라 추적하지 않는다.
  const hasPreviewRoute =
    props.mode === 'overview' && !!props.previewRoute && props.previewRoute.length > 0;
  const overviewFollowsUser =
    !isWalk && !props.centerOverride && !hasPreviewRoute && !userInteracted;

  return (
    <View style={[{ flex: 1 }, props.style]}>
      <Mapbox.MapView
        style={{ flex: 1 }}
        styleURL={isWalk ? mapConfig.styles.walk : mapConfig.styles.overview}
        logoEnabled={false}
        attributionEnabled={false}
        localizeLabels={{ locale: 'ko' }}
        onCameraChanged={handleCameraChanged}
      >
        {isWalk ? (
          <Mapbox.Camera
            defaultSettings={{ centerCoordinate: walkInitialCenter, zoomLevel: walkZoomLevel }}
            followUserLocation={!walkFollowSuspended}
            followUserMode={Mapbox.UserTrackingMode.FollowWithHeading}
            followZoomLevel={walkZoomLevel}
            followPitch={mapConfig.walkCamera.pitch}
            animationMode="flyTo"
          />
        ) : (
          <Mapbox.Camera
            defaultSettings={{ centerCoordinate: mapConfig.defaultCenter, zoomLevel: overviewZoomLevel }}
            followUserLocation={overviewFollowsUser}
            followUserMode={Mapbox.UserTrackingMode.Follow}
            followZoomLevel={overviewZoomLevel}
            followPadding={cameraPadding}
            // centerOverride(경로 전체 보기 등)일 때만 중심·줌을 선언적으로 제어한다.
            // 그 외(자동 현재 위치 모드)엔 줌/중심을 강제하지 않는다 — 추적 중엔 followZoomLevel이,
            // 사용자가 팬/줌한 뒤엔 사용자가 맞춘 값이 유지돼야 하므로. padding만 항상 적용해
            // 바텀시트가 가리는 만큼 화면을 위로 민다.
            centerCoordinate={props.centerOverride}
            zoomLevel={props.centerOverride ? overviewZoomLevel : undefined}
            pitch={mapConfig.overviewCamera.pitch}
            padding={cameraPadding}
            animationMode="flyTo"
          />
        )}

        {isWalk && props.route.length > 0 && (
          <>
            {props.routeProgressKm != null ? (
              <TraveledSplitRouteLayers
                route={props.route}
                routeProgressKm={props.routeProgressKm}
                traveledColor={props.routeColor}
              />
            ) : (
              <RouteLayer data={routeCoordinatesToLineString(props.route)} color={props.routeColor} />
            )}
            <RouteDirectionArrows route={props.route} />
            <RouteEndpointMarkers route={props.route} />
            {props.debugOverlayRoute && props.debugOverlayRoute.length > 1 && (
              <RouteLayer
                id="route-debug-original"
                data={routeCoordinatesToLineString(props.debugOverlayRoute)}
                color="#FF3B30"
                dashed
              />
            )}
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

/** route를 routeProgressKm 지점에서 잘라 지나온 구간/남은 구간을 다른 색 레이어 두 개로 그린다. */
function TraveledSplitRouteLayers({
  route,
  routeProgressKm,
  traveledColor,
}: {
  route: WalkRouteResponse['coordinates'];
  routeProgressKm: number;
  traveledColor?: string;
}) {
  const { before, after } = sliceRouteAtDistanceKm(route, routeProgressKm);
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
