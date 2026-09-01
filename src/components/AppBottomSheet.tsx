import React, { forwardRef, useImperativeHandle, useMemo, useRef } from 'react';
import { StyleSheet } from 'react-native';
import BottomSheet, { BottomSheetProps } from '@gorhom/bottom-sheet';
import { colors, radii, shadows } from '../theme/tokens';

export type AppBottomSheetHandle = {
  snapToIndex: (index: number) => void;
};

type Props = BottomSheetProps;

// 화면 하단에 항상 떠 있는 시트(=닫히지 않고 접혔다 펼쳐지기만 함) 용 범용 래퍼.
// 완전히 dismiss되는 모달성 시트가 필요해지면 BottomSheetModal 기반의 별도 컴포넌트로 추가할 것 —
// 지금은 쓰는 곳이 하나(HomeScreen 홈 탭의 채팅 시트)뿐이라 여기서 미리 만들지 않는다.
export const AppBottomSheet = forwardRef<AppBottomSheetHandle, Props>(
  function AppBottomSheet(
    { children, style, backgroundStyle, handleIndicatorStyle, ...rest },
    ref,
  ) {
    const sheetRef = useRef<BottomSheet>(null);

    useImperativeHandle(
      ref,
      () => ({
        snapToIndex: index => sheetRef.current?.snapToIndex(index),
      }),
      [],
    );

    // gorhom의 BottomSheet는 React.memo로 감싸져 있어서, 매 렌더 새 배열을 만들어 넘기면
    // 그 memo가 무력화된다 — 실제로 바뀔 때만 새 배열이 되도록 각각 메모이즈한다.
    const mergedBackgroundStyle = useMemo(
      () => [styles.background, backgroundStyle],
      [backgroundStyle],
    );
    const mergedHandleIndicatorStyle = useMemo(
      () => [styles.handleIndicator, handleIndicatorStyle],
      [handleIndicatorStyle],
    );
    const mergedContainerStyle = useMemo(() => [styles.container, style], [style]);

    return (
      <BottomSheet
        ref={sheetRef}
        enableDynamicSizing={false}
        enablePanDownToClose={false}
        backgroundStyle={mergedBackgroundStyle}
        handleIndicatorStyle={mergedHandleIndicatorStyle}
        style={mergedContainerStyle}
        {...rest}
      >
        {children}
      </BottomSheet>
    );
  },
);

const styles = StyleSheet.create({
  container: {
    ...shadows.soft,
  },
  background: {
    backgroundColor: 'rgba(255,255,255,0.98)',
    borderTopLeftRadius: radii.xl,
    borderTopRightRadius: radii.xl,
  },
  handleIndicator: {
    backgroundColor: colors.line2,
    width: 38,
    height: 4,
  },
});
