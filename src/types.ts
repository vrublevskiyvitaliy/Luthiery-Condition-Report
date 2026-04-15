export type AnnotationType = 'crack' | 'area' | 'text' | 'arrow';

export interface Point {
  x: number;
  y: number;
}

export interface BaseAnnotation {
  id: string;
  type: AnnotationType;
  color: string;
  number: number;
  notes?: string;
  view: 'front' | 'back' | 'ribs' | 'scroll';
  isCritical?: boolean;
  displayNumber?: number;
  repairHours?: number;
}

export interface CrackAnnotation extends BaseAnnotation {
  type: 'crack';
  points: number[];
  width: number;
}

export interface AreaAnnotation extends BaseAnnotation {
  type: 'area';
  points: number[];
  hatchPattern: 'none' | 'diagonal' | 'cross' | 'dots';
}

export interface TextAnnotation extends BaseAnnotation {
  type: 'text';
  x: number;
  y: number;
  text: string;
  width?: number;
  height?: number;
}

export interface ArrowAnnotation extends BaseAnnotation {
  type: 'arrow';
  points: number[]; // [x1, y1, x2, y2]
}

export type Annotation = CrackAnnotation | AreaAnnotation | TextAnnotation | ArrowAnnotation;

export interface ViolinState {
  annotations: Annotation[];
  nextNumber: number;
  instrumentName: string;
  luthierName: string;
}
