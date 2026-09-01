/* 화면 라우팅 정보 (MainRouter 내부 상태) */
export type Route =
  | { name: 'home' }
  | { name: 'realWalk' } // prewalk 챗봇이 만든 실제 경로로 진행하는 산책 화면
  | { name: 'record' }
  | { name: 'me' };

/* 하단 네비게이션 탭 이름 */
export type TabName = 'home' | 'record' | 'me';
