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
import { RouteDirectionFlow } from './RouteDirectionFlow';
import { useMapAppearance } from '../../hooks/useMapAppearance';

// dark-v11 스타일의 poi-label(가게 이름) 레이어는 라이트(streets-v12)와 비교해 두 가지가 다르다.
// 둘 다 실제 style.json을 내려받아 비교해서 확인한 값 — 배경·도로·물 등 나머지 다크 테마 자체는
// 그대로 두고 이 레이어(poi-label)만 골라서 streets-v12와 맞춘다.
//  1) 필터: filterrank <= step(zoom,0,16,1,17,2) + N — dark는 N=1이라 아주 중요한 장소만 통과하고,
//     streets는 N=3이라 훨씬 관대하다. 같은 줌에서 dark가 훨씬 적은 가게 이름만 보이던 원인.
//  2) 표시: dark는 iconImage가 빈 문자열(아이콘 없음) + 단색 회색 텍스트라 라벨이 있어도 눈에 잘
//     안 띈다. streets는 카테고리별 색 아이콘(maki 스프라이트) + 카테고리별 색 텍스트를 쓴다.
//     dark-v11 스프라이트에도 같은 maki 아이콘들이 들어있는 걸 확인했으므로(스프라이트 자체는
//     공유, 아이콘을 안 쓰기로 한 스타일 선택이었을 뿐) 그대로 가져다 써도 깨지지 않는다.
const POI_LABEL_FILTER: NonNullable<React.ComponentProps<typeof Mapbox.SymbolLayer>['filter']> = [
  '<=',
  ['get', 'filterrank'],
  ['+', ['step', ['zoom'], 0, 16, 1, 17, 2], 3],
];
// streets-v12의 poi-label iconImage/iconOpacity 그대로 — 라이트/다크 공통. textHalo(테두리)는
// 일부러 안 건드린다 — 원래 dark-v11 자체 halo(거의 배경색과 같은 진한 색)가 그대로 적용되어
// 글자에 흰 테두리가 지지 않는다(흰 테두리를 줬더니 오히려 거슬린다는 피드백).
const POI_LABEL_ICON_STYLE: React.ComponentProps<typeof Mapbox.SymbolLayer>['style'] = {
  iconImage: [
    'case',
    ['has', 'maki_beta'],
    ['coalesce', ['image', ['get', 'maki_beta']], ['image', ['get', 'maki']]],
    ['image', ['get', 'maki']],
  ],
  iconOpacity: [
    'step',
    ['zoom'],
    ['step', ['get', 'sizerank'], 0, 5, 1],
    17,
    ['step', ['get', 'sizerank'], 0, 13, 1],
  ],
};
// streets-v12의 poi-label textColor 원본(라이트 배경용으로 밝기가 맞춰진 값) 그대로.
const POI_LABEL_TEXT_COLOR_LIGHT: NonNullable<
  React.ComponentProps<typeof Mapbox.SymbolLayer>['style']
>['textColor'] = [
  'match',
  ['get', 'class'],
  'food_and_drink', 'hsl(40, 95%, 43%)',
  'park_like', 'hsl(110, 70%, 28%)',
  'education', 'hsl(30, 50%, 43%)',
  'medical', 'hsl(0, 70%, 58%)',
  'sport_and_leisure', 'hsl(190, 60%, 48%)',
  ['store_like', 'food_and_drink_stores'], 'hsl(210, 70%, 58%)',
  ['commercial_services', 'motorist', 'lodging'], 'hsl(260, 70%, 63%)',
  ['arts_and_entertainment', 'historic', 'landmark'], 'hsl(320, 70%, 63%)',
  'hsl(210, 20%, 46%)',
];
// 위 라이트 값과 같은 색상(hue)·채도를 유지하되 명도(L)를 10~15p 낮춘 다크 전용 버전 — 검정
// 배경 위에서 라이트용 밝은 채도가 너무 튀어 보인다는 피드백으로 톤을 가라앉혔다. 검정 배경에서도
// 읽히도록 최소 22% 밑으로는 내리지 않았다.
const POI_LABEL_TEXT_COLOR_DARK: NonNullable<
  React.ComponentProps<typeof Mapbox.SymbolLayer>['style']
>['textColor'] = [
  'match',
  ['get', 'class'],
  'food_and_drink', 'hsl(40, 90%, 33%)',
  'park_like', 'hsl(110, 65%, 22%)',
  'education', 'hsl(30, 45%, 33%)',
  'medical', 'hsl(0, 60%, 42%)',
  'sport_and_leisure', 'hsl(190, 50%, 36%)',
  ['store_like', 'food_and_drink_stores'], 'hsl(210, 60%, 42%)',
  ['commercial_services', 'motorist', 'lodging'], 'hsl(260, 55%, 46%)',
  ['arts_and_entertainment', 'historic', 'landmark'], 'hsl(320, 55%, 46%)',
  'hsl(210, 15%, 38%)',
];

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
  /**
   * previewRoute 위에 출발/도착 마커(RouteEndpointMarkers)와 진행 방향을 흐르는 큰 화살표
   * (RouteDirectionFlow)로 겹쳐 그린다. 기본 꺼짐 — WalkPrepScreen이 켠다. ▶ 심볼이 선 방향에
   * 따라 위/아래로 애매해진다는 피드백에 따라, 출발점 부근을 천천히 오가는 화살표 하나 + 출발
   * 마커 조합으로 "여기서 이쪽" 을 보여준다.
   */
  showDirectionArrows?: boolean;
  /** previewRoute 선을 점선 대신 실선으로 그린다. 기본은 점선(기존 동작 유지). */
  previewRouteSolid?: boolean;
  /**
   * 값이 바뀔 때마다 현재 위치 추적을 다시 켠다 — 사용자가 팬해둔 상태를 풀고
   * followUserLocation을 잠깐 껐다 켜서 카메라를 현재 위치로 되돌린다. 산책을 마치고
   * 홈으로 돌아왔을 때·앱이 포그라운드로 복귀했을 때처럼 "지금 위치로 다시 맞춰라"를
   * 명시적으로 알리는 용도. 매 GPS 갱신마다 따라다니게 하려는 게 아니다.
   */
  recenterKey?: number;
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
  const { modes: mapAppearanceModes } = useMapAppearance();
  const activeMapMode = isWalk ? mapAppearanceModes.walk : mapAppearanceModes.overview;
  const poiLabelStyle = useMemo(
    () => ({
      ...POI_LABEL_ICON_STYLE,
      textColor: activeMapMode === 'dark' ? POI_LABEL_TEXT_COLOR_DARK : POI_LABEL_TEXT_COLOR_LIGHT,
    }),
    [activeMapMode],
  );
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
  // overview 추적 재개: recenterKey가 바뀌면(산책 종료 후 홈 복귀·앱 포그라운드 복귀 등
  // "지금 위치로 다시 맞춰라" 신호) 사용자가 팬해둔 상태를 풀고 followUserLocation을 잠깐 껐다
  // 켜서 카메라를 현재 위치로 되돌린다. 지도가 산책 중 display:none이었거나 이미
  // followUserLocation=true인 상태에선 @rnmapbox가 좌표만 바뀌어선 카메라를 안 옮기므로
  // (walk 모드 주석 참고) 이 토글이 필요하다. 매 GPS 갱신마다 따라다니게 하는 게 아니라,
  // 이 신호가 온 순간에만 재추적을 건다. 초기값 0에선 아무것도 하지 않는다.
  const recenterKey = props.mode === 'overview' ? props.recenterKey : undefined;
  const [overviewFollowPaused, setOverviewFollowPaused] = useState(false);
  useEffect(() => {
    if (isWalk || !recenterKey) return;
    setUserInteracted(false);
    setOverviewFollowPaused(true);
    const timer = setTimeout(() => setOverviewFollowPaused(false), 150);
    return () => clearTimeout(timer);
  }, [isWalk, recenterKey]);

  // 경로 미리보기(previewRoute)나 지정 중심(centerOverride)이 있으면 그게 우선이라 추적하지 않는다.
  const hasPreviewRoute =
    props.mode === 'overview' && !!props.previewRoute && props.previewRoute.length > 0;
  const overviewFollowsUser =
    !isWalk && !props.centerOverride && !hasPreviewRoute && !userInteracted && !overviewFollowPaused;

  return (
    <View style={[{ flex: 1 }, props.style]}>
      <Mapbox.MapView
        style={{ flex: 1 }}
        styleURL={mapConfig.styleUrls[activeMapMode]}
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
            // "flyTo"는 출발-가속-감속하는 관성 곡선이라 매 GPS 픽스(작은 이동량)마다 재생하면
            // 거의 움직이지 않다가 오차가 쌓여 화면 밖으로 나갈 때쯤에야 한 번에 따라잡는 것처럼
            // 보인다(실사용 피드백). "linearTo"는 등속으로 즉시 보간해 매 업데이트를 그대로
            // 반영하므로 GPS를 따라 카메라가 계속 움직이는 게 자연스럽게 보인다.
            animationMode="linearTo"
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

        {/* 다크 스타일의 가게 이름(POI) 밀도·눈에 띄는 정도를 라이트와 맞춘다 — 위 POI_LABEL_FILTER/
            POI_LABEL_STYLE 설명 참고. 지도 배경·도로 등 다크 테마 자체는 그대로다. */}
        <Mapbox.SymbolLayer id="poi-label" existing filter={POI_LABEL_FILTER} style={poiLabelStyle} />

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
          <>
            <RouteLayer
              data={routeCoordinatesToLineString(props.previewRoute)}
              dashed={!props.previewRouteSolid}
            />
            {props.showDirectionArrows && (
              <>
                {/* 흐르는 화살표만으론 어디가 출발인지 헷갈린다 — "출발"(순환) / "출발"·"도착"(편도) 마커를 같이. */}
                <RouteEndpointMarkers route={props.previewRoute} />
                <RouteDirectionFlow route={props.previewRoute} />
              </>
            )}
          </>
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
