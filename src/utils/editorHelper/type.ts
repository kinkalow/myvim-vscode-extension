export type VisualMode = 'char' | 'line' | 'block'
export type PatternMatch = { startLine: number; startCol: number; endLine: number, endCol: number, text: string };