import { loadShippedContent } from './core/content/shipped.ts';
import { createGame } from './game/createGame.ts';
import { createJourneySimulation } from './game/world.ts';
import { createBrowserSaveStore } from './platform/save/browserSave.ts';
import './style.css';
import { patchDebug } from './ui/debugStore.ts';
import { mountUi } from './ui/mountUi.tsx';

const WORLD_SEED = 1;

async function main(): Promise<void> {
  const ui = document.querySelector('#ui');
  const gameRoot = document.querySelector('#game');
  if (!(ui instanceof HTMLElement) || !(gameRoot instanceof HTMLElement)) {
    throw new Error('The page is missing the game mount points.');
  }
  try {
    const content = loadShippedContent();
    const save = await createBrowserSaveStore();
    const simulation = createJourneySimulation(content, WORLD_SEED);
    mountUi(ui, {
      tickHz: content.progression.tickHz,
      rarities: content.rarity.tiers.map((tier) => tier.id),
      onGrantXp: () => console.log('[debug] grant xp'),
      onForceRarity: (rarity) => console.log('[debug] force rarity', rarity),
      onSpawnItem: (itemId) => console.log('[debug] spawn item', itemId),
      onTeleport: (target) => {
        try {
          if (target.kind === 'coordinates') {
            simulation.enqueue({
              type: 'teleport',
              zoneId: simulation.getState().zoneId,
              x: target.x,
              y: target.y,
            });
            return;
          }
          simulation.enqueue({
            type: 'teleport',
            zoneId: target.zoneId,
            spawnId: target.spawnId,
          });
        } catch (error) {
          console.error('[debug] teleport failed', error);
        }
      },
      onToggleCollision: (show) => patchDebug({ showCollision: show }),
      onResetSave: () => {
        void save.clear('slot-1').then(
          () => console.log('[debug] reset save', 'slot-1'),
          (error: unknown) => console.error('[debug] reset save failed', error),
        );
      },
    });
    createGame({
      parent: gameRoot,
      simulation,
      tickHz: content.progression.tickHz,
    });
  } catch (error) {
    console.error(error);
    const panel = document.createElement('div');
    panel.className = 'boot-error';
    const title = document.createElement('h1');
    title.textContent = 'The game failed to start';
    const detail = document.createElement('p');
    detail.textContent = error instanceof Error ? error.message : 'Unknown error.';
    panel.append(title, detail);
    ui.replaceChildren(panel);
  }
}

void main();
