import { PresetLevel } from './placement.types.js';

export interface CourseNode {
  index: number;
  type: 'flashcard' | 'quiz' | 'chest' | 'writing' | 'exam';
  title: string;
  label: string;
  action: string;
  icon: string;
  position: 'center' | 'left' | 'right';
  targetCount?: number;
}

export interface CourseUnit {
  id: string;
  unitNumber: number;
  title: string;
  subtitle: string;
  tag: string;
  colorTheme: 'green' | 'yellow' | 'blue' | 'purple' | 'red';
  passageId?: string;
  writingChunkId?: string;
  nodes: CourseNode[];
}

export interface Course {
  levelKey: PresetLevel;
  title: string;
  targetBand: string;
  description: string;
  vocabCount: number;
  vocabRange: [number, number];
  units: CourseUnit[];
}

export interface ActiveCourseProgress {
  course: Course;
  currentUnitId: string;
  unlockedNode: number;
  completedNodes: number[];
  userLevel: PresetLevel;
  targetBand: string;
}
