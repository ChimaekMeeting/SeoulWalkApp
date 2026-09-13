// ChatBottomSheet의 스냅 위치 계산 로직. HomeScreen이 AppMapView의 카메라 bottomPadding에도
// "절반" 높이를 그대로 써야(지도 위 GPS 점이 시트에 안 가리게) 해서, 두 곳이 서로 다른 값을
// 계산하지 않도록 공용 함수로 뽑았다 — ChatBottomSheet도 이 파일의 상수/함수를 그대로 쓴다.
export const SHEET_TOP_UP = 40; // 위: 채팅 가득 (지도 거의 가려짐) — 화면 top 기준 오프셋
// 손잡이(핸들) 자체가 차지하는 높이 — 기본 핸들(패딩 10 위아래 + 인디케이터 4px, AppBottomSheet
// 참고) 크기에 맞춘 값. "아래로 접기" 스냅에서 이만큼은 항상 더 보태 남긴다.
const HANDLE_HEIGHT = 44;

/**
 * "아래로 접기" 스냅에서 시트가 화면 하단부터 차지하는 높이(px). 화면 하단에 떠 있는 ChatInput
 * 바(bottomReservedHeight)보다 항상 손잡이가 위에 보이도록 그 예약 높이 위에 손잡이 높이를
 * 더하고, 손잡이 바로 아래 "Roudi" 헤더(headerHeight)까지는 보이도록 그것도 더한다 — 그 아래
 * 대화 내용은 안 보여도 되고, 지도를 최대한 많이 남기는 게 우선이라 딱 거기까지만 더한다.
 */
export function computeChatSheetDownHeight({
  bottomReservedHeight,
  headerHeight,
}: {
  bottomReservedHeight: number;
  headerHeight: number;
}): number {
  return bottomReservedHeight + HANDLE_HEIGHT + headerHeight;
}

/** "중간" 스냅에서 시트가 화면 하단부터 차지하는 높이(px). */
export function computeChatSheetHalfHeight({
  screenHeight,
  bottomReservedHeight,
  headerHeight,
  previewHeight,
}: {
  screenHeight: number;
  bottomReservedHeight: number;
  headerHeight: number;
  previewHeight: number;
}): number {
  const contentBasedHeight = bottomReservedHeight + previewHeight;
  // 화면의 최소 절반은 항상 보이도록 하되(콘텐츠가 짧아도 시트가 너무 작게 뜨지 않게), 완전히
  // 접었을 때보다 작아지거나 위로 꽉 찬 상태보다 커지지는 않도록 양 끝을 클램프한다.
  return Math.min(
    screenHeight - SHEET_TOP_UP,
    Math.max(
      computeChatSheetDownHeight({ bottomReservedHeight, headerHeight }),
      contentBasedHeight,
      screenHeight * 0.5,
    ),
  );
}
