import { loadShippedContent } from './core/content/shipped.ts';
import { createGame } from './game/createGame.ts';
import { placeholderSimulation } from './game/PlaceholderScene.ts';
import { createBrowserSaveStore } from './platform/save/browserSave.ts';
import './style.css';
import { mountUi } from './ui/mountUi.tsx';

const PLACEHOLDER_SEED = 1;

async function main(): Promise<void> {
  const ui = document.querySelector('#ui');
  const gameRoot = document.querySelector('#game');
  if (!(ui instanceof HTMLElement) || !(gameRoot instanceof HTMLElement)) {
    throw new Error('The page is missing the game mount points.');
  }
  try {
    const content = loadShippedContent();
    const save = await createBrowserSaveStore();
    const simulation = placeholderSimulation(PLACEHOLDER_SEED);
    mountUi(ui, {
      tickHz: content.progression.tickHz,
      rarities: content.rarity.tiers.map((tier) => tier.id),
      onGrantXp: () => console.log('[debug] grant xp'),
      onForceRarity: (rarity) => console.log('[debug] force rarity', rarity),
      onSpawnItem: (itemId) => console.log('[debug] spawn item', itemId),
      onTeleport: (x, y) => console.log('[debug] teleport', { x, y }),
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
