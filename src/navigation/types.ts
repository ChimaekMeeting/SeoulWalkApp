import { CourseType } from '../data/chimeakData';

/* 화면 라우팅 정보 */
export type Route =
  | { name: 'home' }
  | { name: 'chat' }
  | { name: 'courses'; filter?: CourseType | 'all' } // 코스 목록
  | { name: 'course'; id: string } // 코스 상세 화면
  | { name: 'walk'; id: string } // 산책 진행 화면
  | { name: 'realWalk' } // prewalk 챗봇이 만든 실제 경로로 진행하는 산책 화면
  | { name: 'postwalk'; id: string } // 산책 종료 후 기록 화면
  | { name: 'record' }
  | { name: 'me' };

/* 하단 네비게이션 탭 이름 */
export type TabName = 'home' | 'courses' | 'record' | 'me';

/* 화면 이동 함수 타입 (탭 이름 또는 Route 객체를 받아 해당 화면으로 전환) */
export type Navigate = (route: Route | TabName) => void;
