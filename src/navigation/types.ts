/* 화면 라우팅 정보 */
export type Route =
  | { name: 'home' }
  | { name: 'chat' }
  | { name: 'walk'; id: string } // 산책 진행 화면
  | { name: 'realWalk' } // prewalk 챗봇이 만든 실제 경로로 진행하는 산책 화면
  | { name: 'postwalk'; id: string } // 산책 종료 후 기록 화면
  | { name: 'record' }
  | { name: 'me' };

/* 하단 네비게이션 탭 이름 */
export type TabName = 'home' | 'record' | 'me';
