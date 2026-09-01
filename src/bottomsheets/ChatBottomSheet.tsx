import React, {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
} from 'react';
import { Dimensions } from 'react-native';
import { AppBottomSheet, AppBottomSheetHandle } from '../components/AppBottomSheet';
import {
  SHEET_TOP_UP,
  computeChatSheetDownHeight,
  computeChatSheetHalfHeight,
} from './chatSheetGeometry';

const { height: SCREEN_H } = Dimensions.get('window');

const CHAT_SHEET_INDEX = {
  DOWN: 0,
  HALF: 1,
  UP: 2,
} as const;

export type ChatBottomSheetHandle = {
  collapse: () => void;
  expand: () => void;
  snapToHalf: () => void;
};

type Props = {
  children: React.ReactNode;
  /** ChatConversation이 onPreviewHeightChange로 올려주는, 말풍선 미리보기 묶음의 실측 높이. */
  previewHeight: number;
  /** ChatInput 등 화면 하단에 떠 있는 요소가 차지하는 높이 — 중간 스냅 위치 계산에 반영한다. */
  bottomReservedHeight: number;
  onChangeIndex?: (index: number) => void;
};

// 홈 화면 채팅용 바텀시트 — AppBottomSheet(범용 컴포넌트)에 채팅 전용 스냅포인트 계산을 얹은 것.
// 이 앱에 바텀시트 쓰는 곳이 지금은 여기 하나뿐이라, 나중에 다른 시트가 추가되면 이 폴더에
// 그 시트 전용 설정을 같은 패턴으로 추가하면 된다.
export const ChatBottomSheet = forwardRef<ChatBottomSheetHandle, Props>(function ChatBottomSheet(
  { children, previewHeight, bottomReservedHeight, onChangeIndex },
  ref,
) {
  const sheetRef = useRef<AppBottomSheetHandle>(null);
  const currentIndexRef = useRef<number>(CHAT_SHEET_INDEX.HALF);

  // chatSheetGeometry.ts의 공용 함수로 계산 — HomeScreen이 AppMapView의 카메라 bottomPadding에도
  // 똑같은 값을 써야 해서(지도 위 GPS 점이 시트에 안 가리게) 두 곳이 같은 로직을 공유한다.
  const halfHeight = computeChatSheetHalfHeight({
    screenHeight: SCREEN_H,
    bottomReservedHeight,
    previewHeight,
  });

  const downHeight = computeChatSheetDownHeight(SCREEN_H);

  const snapPoints = useMemo(
    () => [downHeight, halfHeight, SCREEN_H - SHEET_TOP_UP],
    [downHeight, halfHeight],
  );

  // 말풍선 실측치가 갱신되며 half 위치(snapPoints[1])가 바뀌었는데, 마침 시트가
  // half 스냅에 머물러 있었다면 새 위치로 다시 스냅한다.
  useEffect(() => {
    if (currentIndexRef.current === CHAT_SHEET_INDEX.HALF) {
      sheetRef.current?.snapToIndex(CHAT_SHEET_INDEX.HALF);
    }
  }, [snapPoints]);

  // currentIndexRef는 원래 gorhom의 onChange(애니메이션 실제 완료 시점 근처에 호출)로만 갱신됐는데,
  // expand()를 부른 직후 애니메이션이 끝나기 전에 previewHeight 등이 바뀌어 snapPoints가
  // 재계산되면, 그 순간엔 아직 currentIndexRef가 이전 값(HALF)이라 위 재스냅 effect가 다시
  // half로 되돌려버리는 경합이 있었다. 그래서 imperative 호출 시점에 바로(동기적으로) 갱신한다.
  useImperativeHandle(
    ref,
    () => ({
      collapse: () => {
        currentIndexRef.current = CHAT_SHEET_INDEX.DOWN;
        sheetRef.current?.snapToIndex(CHAT_SHEET_INDEX.DOWN);
      },
      expand: () => {
        currentIndexRef.current = CHAT_SHEET_INDEX.UP;
        sheetRef.current?.snapToIndex(CHAT_SHEET_INDEX.UP);
      },
      snapToHalf: () => {
        currentIndexRef.current = CHAT_SHEET_INDEX.HALF;
        sheetRef.current?.snapToIndex(CHAT_SHEET_INDEX.HALF);
      },
    }),
    [],
  );

  const handleChange = useCallback(
    (index: number) => {
      currentIndexRef.current = index;
      onChangeIndex?.(index);
    },
    [onChangeIndex],
  );

  return (
    <AppBottomSheet
      ref={sheetRef}
      index={CHAT_SHEET_INDEX.HALF}
      snapPoints={snapPoints}
      onChange={handleChange}
    >
      {children}
    </AppBottomSheet>
  );
});
