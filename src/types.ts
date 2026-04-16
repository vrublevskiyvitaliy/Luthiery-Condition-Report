export type AnnotationType = 'crack' | 'area' | 'text' | 'arrow';

export interface Point {
  x: number;
  y: number;
}

export type ViewType = 'front' | 'back' | 'ribs' | 'scroll';

export interface ViewDefinition {
  id: string;
  type: ViewType;
  isInternal: boolean;
  order: number;
  name?: string;
}

export interface BaseAnnotation {
  id: string;
  type: AnnotationType;
  color: string;
  number: number;
  notes?: string;
  view: string; // View ID
  isCritical?: boolean;
  displayNumber?: number;
  repairHours?: number;
  tension?: number; // 0 for straight lines, 1 for super smooth
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
  views: ViewDefinition[];
  nextNumber: number;
  instrumentName: string;
  luthierName: string;
}
