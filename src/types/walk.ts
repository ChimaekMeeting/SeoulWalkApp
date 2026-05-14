import { Course } from '../data/chimeakData';

export interface WalkMapRendererProps {
  course: Course;
  progress: number; // 0.0 to 1.0
  isGameMode: boolean; // Determines if we show the game-like avatar overlay or standard map
}
