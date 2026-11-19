import { debugEnabledFromSearch } from './debugQuery.ts';

export interface DebugState {
  visible: boolean;
  fps: number;
  tick: number;
}

const listeners = new Set<() => void>();

let state: DebugState = {
  visible: debugEnabledFromSearch(window.location.search),
  fps: 0,
  tick: 0,
};

export function getDebugState(): DebugState {
  return state;
}

export function subscribeDebug(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function patchDebug(patch: Partial<DebugState>): void {
  state = { ...state, ...patch };
  for (const listener of listeners) listener();
}
