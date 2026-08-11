const VisualModes = ['char', 'line', 'block'] as const;
type VisualMode = (typeof VisualModes)[number];

class VisualModeManager {
  private lastVisualMode: VisualMode = 'char'; // QUESTION: nullにすべきか
  // このメソッドはvisualModeHelperから呼び出せる
  setLastMode(mode: VisualMode): void {
    this.lastVisualMode = mode;
  }
  // このメソッドはvisualModeHelperから呼び出せる
  getLastMode(): VisualMode {
    return this.lastVisualMode;
  }
}

export const visualModeManager = new VisualModeManager();
