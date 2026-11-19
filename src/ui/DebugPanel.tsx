import { useEffect, useState } from 'preact/hooks';
import { getDebugState, patchDebug, subscribeDebug, type DebugState } from './debugStore.ts';

export interface DebugActions {
  tickHz: number;
  rarities: readonly string[];
  onGrantXp: () => void;
  onForceRarity: (rarity: string) => void;
  onSpawnItem: (itemId: string) => void;
  onTeleport: (x: number, y: number) => void;
  onResetSave: () => void;
}

export function DebugRoot(props: DebugActions) {
  const [debug, setDebug] = useState<DebugState>(getDebugState());
  useEffect(() => subscribeDebug(() => setDebug({ ...getDebugState() })), []);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.code !== 'Backquote' || event.repeat) return;
      const target = event.target;
      if (
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement
      ) {
        return;
      }
      event.preventDefault();
      patchDebug({ visible: !getDebugState().visible });
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  if (!debug.visible) return null;
  return <DebugPanel {...props} fps={debug.fps} tick={debug.tick} />;
}

function DebugPanel(props: DebugActions & { fps: number; tick: number }) {
  const [rarity, setRarity] = useState(props.rarities[0] ?? 'common');
  const [itemId, setItemId] = useState('');
  const [x, setX] = useState('0');
  const [y, setY] = useState('0');

  return (
    <aside className="debug-panel" role="region" aria-label="Developer debug panel">
      <header className="debug-heading">
        <p className="debug-kicker">Developer</p>
        <h1>Debug</h1>
        <p className="debug-note">Hidden unless you press ` or open with ?debug=1.</p>
      </header>
      <dl className="debug-stats">
        <div>
          <dt>FPS</dt>
          <dd>{props.fps}</dd>
        </div>
        <div>
          <dt>Tick</dt>
          <dd>{props.tick}</dd>
        </div>
        <div>
          <dt>Sim</dt>
          <dd>{props.tickHz} Hz</dd>
        </div>
      </dl>
      <div className="debug-actions">
        <button type="button" onClick={props.onGrantXp}>
          Grant XP
        </button>
        <label>
          Force rarity
          <span className="debug-row">
            <select value={rarity} onChange={(event) => setRarity(event.currentTarget.value)}>
              {props.rarities.map((tier) => (
                <option key={tier} value={tier}>
                  {tier}
                </option>
              ))}
            </select>
            <button type="button" onClick={() => props.onForceRarity(rarity)}>
              Force
            </button>
          </span>
        </label>
        <label>
          Spawn item
          <span className="debug-row">
            <input
              value={itemId}
              placeholder="item id"
              onInput={(event) => setItemId(event.currentTarget.value)}
            />
            <button
              type="button"
              onClick={() => {
                const id = itemId.trim();
                if (id === '') {
                  console.log('[debug] spawn item ignored, id is empty');
                  return;
                }
                props.onSpawnItem(id);
              }}
            >
              Spawn
            </button>
          </span>
        </label>
        <label>
          Teleport
          <span className="debug-row">
            <input
              inputMode="decimal"
              aria-label="Teleport X"
              value={x}
              onInput={(event) => setX(event.currentTarget.value)}
            />
            <input
              inputMode="decimal"
              aria-label="Teleport Y"
              value={y}
              onInput={(event) => setY(event.currentTarget.value)}
            />
            <button
              type="button"
              onClick={() => {
                const parsedX = Number(x);
                const parsedY = Number(y);
                if (!Number.isFinite(parsedX) || !Number.isFinite(parsedY)) {
                  console.log('[debug] teleport ignored, coordinates must be numbers');
                  return;
                }
                props.onTeleport(parsedX, parsedY);
              }}
            >
              Go
            </button>
          </span>
        </label>
        <button type="button" onClick={props.onResetSave}>
          Reset save
        </button>
      </div>
    </aside>
  );
}
