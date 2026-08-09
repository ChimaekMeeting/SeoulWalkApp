// ChatBottomSheet의 스냅 위치 계산 로직. HomeScreen이 AppMapView의 카메라 bottomPadding에도
// "절반" 높이를 그대로 써야(지도 위 GPS 점이 시트에 안 가리게) 해서, 두 곳이 서로 다른 값을
// 계산하지 않도록 공용 함수로 뽑았다 — ChatBottomSheet도 이 파일의 상수/함수를 그대로 쓴다.
export const SHEET_TOP_UP = 40; // 위: 채팅 가득 (지도 거의 가려짐) — 화면 top 기준 오프셋
export const SHEET_TOP_DOWN_MAX = 550; // 아래로 접었을 때의 기본(최대) top 오프셋

/** "아래로 완전히 접기" 스냅에서 시트가 화면 하단부터 차지하는 높이(px). 대화 길이와 무관하게 고정. */
export function computeChatSheetDownHeight(screenHeight: number): number {
  return screenHeight - SHEET_TOP_DOWN_MAX;
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
  // 화면의 최소 절반은 항상 보이도록 하되(콘텐츠가 짧아도 시트가 너무 작게 뜨지 않게), 아래로
  // 완전히 접었을 때보다 작아지거나 위로 꽉 찬 상태보다 커지지는 않도록 양 끝을 클램프한다.
  return Math.min(
    screenHeight - SHEET_TOP_UP,
    Math.max(screenHeight - SHEET_TOP_DOWN_MAX, contentBasedHeight, screenHeight * 0.5),
  );
}
