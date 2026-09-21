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

  it('키보드가 열려도 OS 리사이즈가 이미 다 줄여줬으면(keyboardOverlap=0) 평소와 동일하게 계산한다', () => {
    expect(
      computeChatBottomLayout({
        bottomNavHeight: 60,
        bottomSafeArea: 24,
        chatInputHeight: 68,
        keyboardOverlap: 0,
        keyboardGap: 8,
      }),
    ).toEqual({
      chatInputBottom: 84,
      chatBottomInset: 152,
    });
  });

  it('OS 리사이즈가 못 채운 만큼(keyboardOverlap)만 안전영역·여백과 함께 보정한다', () => {
    expect(
      computeChatBottomLayout({
        bottomNavHeight: 60,
        bottomSafeArea: 47,
        chatInputHeight: 76,
        keyboardOverlap: 255,
        keyboardGap: 8,
      }),
    ).toEqual({
      chatInputBottom: 310,
      chatBottomInset: 386,
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
