import {
  SHEET_TOP_UP,
  computeChatBottomLayout,
  computeChatSheetDownHeight,
  computeChatSheetHalfHeight,
} from '../chatSheetGeometry';

describe('chat sheet geometry', () => {
  it('키보드 높이를 중복해서 더하지 않고 내비게이션·안전영역·입력창 실측값만 예약한다', () => {
    expect(
      computeChatBottomLayout({
        bottomNavHeight: 60,
        bottomSafeArea: 24,
        chatInputHeight: 68,
      }),
    ).toEqual({
      chatInputBottom: 84,
      chatBottomInset: 152,
    });
  });

  it('접힌 시트는 입력창과 손잡이만 예약하고 지도 위 브랜드 제목 공간은 더하지 않는다', () => {
    expect(computeChatSheetDownHeight({ bottomReservedHeight: 152 })).toBe(196);
  });

  it('키보드로 현재 레이아웃 높이가 줄면 시트 높이도 새 높이 안에서 다시 계산한다', () => {
    const common = {
      bottomReservedHeight: 168,
      previewHeight: 260,
    };
    const fullHeight = computeChatSheetHalfHeight({
      ...common,
      screenHeight: 1600,
    });
    const resizedHeight = computeChatSheetHalfHeight({
      ...common,
      screenHeight: 900,
    });

    expect(resizedHeight).toBeLessThan(fullHeight);
    expect(resizedHeight).toBeLessThanOrEqual(900 - SHEET_TOP_UP);
  });
});
