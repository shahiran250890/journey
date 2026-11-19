import { render } from 'preact';
import { DebugRoot, type DebugActions } from './DebugPanel.tsx';

export function mountUi(parent: HTMLElement, actions: DebugActions): void {
  render(<DebugRoot {...actions} />, parent);
}
