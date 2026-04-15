export const COLORS = [
  { name: 'Black', value: '#000000' },
  { name: 'Green', value: '#2E8B57' },
  { name: 'Red', value: '#B22222' },
  { name: 'Yellow', value: '#eab308' },
  { name: 'Blue', value: '#3b82f6' },
];

export const WIDTH_OPTIONS = [
  { id: 'thin', name: 'Thin', value: 1 },
  { id: 'medium', name: 'Medium', value: 3 },
  { id: 'thick', name: 'Thick', value: 6 },
];

export const HATCH_PATTERNS = [
  { id: 'none', name: 'Solid' },
  { id: 'diagonal', name: 'Diagonal' },
  { id: 'cross', name: 'Crosshatch' },
  { id: 'dots', name: 'Dots' },
];

export const VIEWS = [
  { id: 'front', name: 'Front' },
  { id: 'back', name: 'Back' },
  { id: 'ribs', name: 'Ribs' },
  { id: 'scroll', name: 'Scroll' },
] as const;

export const TOOL_TYPES = [
  { id: 'crack', name: 'Crack Line' },
  { id: 'area', name: 'Area Highlight' },
  { id: 'text', name: 'Text Note' },
  { id: 'arrow', name: 'Arrow' },
] as const;
