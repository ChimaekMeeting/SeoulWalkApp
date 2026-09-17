/**
 * @format
 */

import { registerRootComponent } from 'expo';
import App from './App';
// TaskManager.defineTask는 반드시 앱 진입점에서 무조건 실행돼야 한다 — 화면(WalkInProgressScreen)이
// 마운트될 때만 이 모듈이 로드되면, 앱이 백그라운드에서 새로 기동될 때 태스크 정의가 없어 무시된다.
import './src/tasks/turnByTurnBackgroundTask';

registerRootComponent(App);
