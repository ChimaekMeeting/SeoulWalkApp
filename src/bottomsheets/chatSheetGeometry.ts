// ChatBottomSheet의 스냅 위치 계산 로직. HomeScreen이 AppMapView의 카메라 bottomPadding에도
// "절반" 높이를 그대로 써야(지도 위 GPS 점이 시트에 안 가리게) 해서, 두 곳이 서로 다른 값을
// 계산하지 않도록 공용 함수로 뽑았다 — ChatBottomSheet도 이 파일의 상수/함수를 그대로 쓴다.
export const SHEET_TOP_UP = 40; // 위: 채팅 가득 (지도 거의 가려짐) — 화면 top 기준 오프셋
// 손잡이(핸들) 자체가 차지하는 높이 — 기본 핸들(패딩 10 위아래 + 인디케이터 4px, AppBottomSheet
// 참고) 크기에 맞춘 값. "아래로 접기" 스냅에서 이만큼은 항상 더 보태 남긴다.
const HANDLE_HEIGHT = 44;

/**
 * 화면 하단에서 입력창까지 예약해야 하는 공간. `keyboardOverlap`은 "키보드 높이 중 OS 리사이즈가
 * 아직 못 줄여준 나머지"를 가리킨다(호출부에서 실측해서 넘긴다) — 안드로이드 windowSoftInputMode
 * ="resize"가 기종/버전마다 실제로 레이아웃을 줄여주는 정도가 달라서(edge-to-edge 등), 여기서
 * "키보드가 열렸다"는 사실만으로 고정값을 더하지 않고, 리사이즈가 못 채운 만큼만 보정한다.
 * 리사이즈가 완전히 되는 기기에서는 keyboardOverlap이 0에 가까워서 기존 로직과 동일하게 동작한다.
 */
export function computeChatBottomLayout({
  bottomNavHeight,
  bottomSafeArea,
  chatInputHeight,
  keyboardOverlap = 0,
  keyboardGap = 0,
}: {
  bottomNavHeight: number;
  bottomSafeArea: number;
  chatInputHeight: number;
  keyboardOverlap?: number;
  keyboardGap?: number;
}): { chatInputBottom: number; chatBottomInset: number } {
  const chatInputBottom =
    keyboardOverlap > 0
      ? keyboardOverlap + bottomSafeArea + keyboardGap
      : bottomNavHeight + bottomSafeArea;
  return {
    chatInputBottom,
    chatBottomInset: chatInputBottom + chatInputHeight,
  };
}

/**
 * "아래로 접기" 스냅에서 시트가 화면 하단부터 차지하는 높이(px). 화면 하단에 떠 있는 ChatInput
 * 바(bottomReservedHeight)보다 항상 손잡이가 위에 보이도록 그 예약 높이 위에 손잡이 높이를
 * 더한다. 브랜드 제목은 지도 오버레이에 있으므로 시트 안에 별도 헤더 공간을 예약하지 않는다.
 */
export function computeChatSheetDownHeight({
  bottomReservedHeight,
}: {
  bottomReservedHeight: number;
}): number {
  return bottomReservedHeight + HANDLE_HEIGHT;
}

/** "중간" 스냅에서 시트가 화면 하단부터 차지하는 높이(px). */
export function computeChatSheetHalfHeight({
  screenHeight,
  bottomReservedHeight,
  previewHeight,
}: {
  screenHeight: number;
  bottomReservedHeight: number;
  previewHeight: number;
}): number {
  const contentBasedHeight = bottomReservedHeight + previewHeight;
  // 화면의 최소 절반은 항상 보이도록 하되(콘텐츠가 짧아도 시트가 너무 작게 뜨지 않게), 완전히
  // 접었을 때보다 작아지거나 위로 꽉 찬 상태보다 커지지는 않도록 양 끝을 클램프한다.
  return Math.min(
    screenHeight - SHEET_TOP_UP,
    Math.max(
      computeChatSheetDownHeight({ bottomReservedHeight }),
      contentBasedHeight,
      screenHeight * 0.5,
    ),
  );
}
