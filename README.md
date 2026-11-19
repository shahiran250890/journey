# Browser MMORPG POC

Milestone 1 of a single-player, desktop-browser MMORPG proof of concept. You can walk a starter town, an overworld, and a short dungeon stub. The view is a fixed-angle isometric camera that follows the character. Trees, houses, and walls sort in front of or behind the character as you pass them. Combat, loot, quests, and classes are later milestones.

Requirements v0.2 are the source of the content. Where Muhammad approved different numbers for this milestone, the JSON uses those numbers.

## Stack

- Phaser 3 renders. It does not own rules.
- TypeScript in `strict` mode. The compiler is 6.0 because `typescript-eslint` does not yet accept TypeScript 7.
- Vite bundles the client. `base` defaults to `./`. Set `BASE_PATH` when the site is served from a subpath (`BASE_PATH=/journey/` for GitHub Pages).
- Preact draws UI over the canvas.
- Zod validates content JSON at load.
- Vitest, ESLint, and Prettier.

Desktop Chrome, Firefox, and Edge are the target browsers.

## Layout

```
content/                 JSON the game loads. Numbers live here, not in code.
content/maps/            Tiled isometric maps (.tmj), the tileset (.tsj), and tiles.
src/core/                Pure simulation. No Phaser, Preact, or browser IO.
src/platform/save/       IndexedDB adapter for the core save interface.
src/game/                Phaser scene, isometric projection, and map rendering.
src/ui/                  Preact debug overlay and the small store it reads.
scripts/generate-maps.mjs  Redraws the placeholder tiles and the three maps.
```

`src/core` is checked twice. ESLint rejects Phaser, Preact, React, and browser globals. `tsconfig.core.json` typechecks that folder with the DOM library removed, so a stray `window` or `indexedDB` fails `npm run typecheck`. A unit test scans the same files.

## How the loop is split

Input becomes a command: `move`, `attack`, `use-item`, or `teleport`. Nothing else writes world state. A fixed clock (`content/progression.json` → `tickHz`, 20) steps the simulation. The scene interpolates the player between the previous tick and the current one, and the camera follows that sprite with its own lerp. Attack and item commands are accepted and recorded; they do not fight anything yet.

WASD is eight-direction. The scene maps the keys into tile space (W is north, up the screen) and the simulation normalizes the vector, so a diagonal step is the same length as a cardinal one. Movement then slides a circle of radius `playerRadius` against the current zone's blockers and keeps it inside the map.

`SeededRng` is mulberry32. Same seed, same sequence, including after `getState()` / `fromState()`. Rarity rolls consume it. Movement does not.

## Content

Shipped JSON is validated by `src/core/content/schema.ts` on boot. A bad file stops the game and shows the error instead of a blank canvas.

| Rule              | Value                                                                    |
| ----------------- | ------------------------------------------------------------------------ |
| Starting stats    | STR AGI INT VIT DEX LUK, each 10                                         |
| Level-up          | +2 to every stat, plus 5 free points                                     |
| XP curve          | each level needs 20% more XP than the previous                           |
| Warrior           | STR 60 and VIT 40                                                        |
| Archer            | AGI 60 and DEX 40                                                        |
| Mage              | INT 60 and DEX 40                                                        |
| Rarity            | Common 55%, Rare 28%, Epic 12%, Legendary 4%, Mythical 0.9%, Unique 0.1% |
| Class Change item | Epic or higher, 5% boss drop, plus one from a one-time town quest        |
| Death             | respawn in town, no loss                                                 |
| Simulation        | 20 ticks per second                                                      |

Also recorded, because v0.2 states them: what each stat governs, two skills per class plus one extra from Legendary up, gear slots, two artifact examples (`+20% crit chance`, and heal-on-kill with no amount), the example kill/collect/dungeon quests, the special class quest, controls, the three zones, and the proposed save policy (3 slots, autosave every 30 seconds).

Signed-off skill names live in `content/classes.json`. Classless: Basic melee attack, Basic ranged attack, Basic magic attack, and Dodge. Warrior: Cleave (AoE) and Shield Bash (stun), plus Whirlwind from Legendary up. Archer: Multi-Shot and Roll Back (dodge + shot), plus Arrow Rain from Legendary up. Mage: Fireball and Frost Nova (slow), plus Meteor from Legendary up. Damage and cooldowns are not on those objects. `skillNumbers` is `unagreed` until those numbers are signed off.

Not in the JSON, because the requirements do not give a number: the absolute XP amount for level 1, stat multipliers, the heal-on-kill amount, monster combat stats, skill damage, skill cooldowns, and which keys skills use. `xpMultiplierForLevel` returns the relative cost. Level 1 is `1`, level 2 is `1.2`, level 3 is `1.44`.

## Save stub

`createSaveStore` is the interface Milestone 3 will fill in: load, save, clear, a version number, and a migration hook. The IndexedDB adapter (`mmorpg-poc` / object store `saves`) round-trips a version 1 placeholder. A version 0 record is migrated on load. Full character saves, slots, and autosave are not implemented.

## Maps

Three Tiled isometric maps, tile size 64×32:

| Zone      | File                         | What is there                                                                                                                                                         |
| --------- | ---------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Town      | `content/maps/town.tmj`      | Plaza, three houses, a quest NPC (the blue figure with a gold mark), trees you can walk behind, and an east gate.                                                     |
| Overworld | `content/maps/overworld.tmj` | Open ground, forest, rocks, a lake, a path from the town gate to a cave, and four marked camps: wolf, boar, bandit, slime. Monsters are not spawned yet.              |
| Dungeon   | `content/maps/dungeon.tmj`   | A stub room: stone floor, walls, pillars, and a sealed north door. The door is the rest of the dungeon. The boss is Milestone 5. The map property `status` is `stub`. |

`content/world.json` records the same three zones and points at these files. It also holds `moveSpeedPerTick` (0.15), `playerRadius` (0.28), and `transitionLockTicks` (15).

A tile layer named `collision` (or any tile layer with `blocks` true) blocks one rectangle per occupied cell. The overworld lake is a polygon on the `collision` object layer, so shape collision is in use as well as tiles. `triggers` are zone exits (`targetZone`, `targetSpawn`). `spawns` are named points. `markers` label the quest NPC, the monster camps, the cave mouth, and the sealed door. Object positions are Tiled's isometric pixels; the core converts them to tile space.

Walking into a trigger moves you to that spawn. The lock (15 ticks) stops the arrival spawn from immediately firing a return trigger. Spawns themselves sit outside their own triggers.

`node scripts/generate-maps.mjs` redraws the tiles and the maps. The committed files are what the game loads.

## Camera and depth

The camera is fixed-angle. It does not rotate or tilt. It lerps after the character and its scroll is limited to the map, with a margin so tall sprites at the edge are not cut off. A teleport or a zone change snaps the camera instead of sliding across the void.

Depth is the screen Y of a sprite's foot. Taller things (trees, houses, the character) use that foot, so walking north of a tree draws you behind the canopy and walking south draws you in front. Ground tiles stay at depth 0. The character's foot is their sim position. A prop's foot is the south corner of its tile, which is also where the image origin sits.

## Debug panel

The panel is not in the DOM during normal play. Press `` ` `` (backtick) to toggle it. `?debug=1` opens it on load. It shows FPS, the simulation tick, the configured tick rate, the current zone, and the character position. Teleport buttons go to town, the overworld, and the dungeon entrance (a spot in the overworld, in front of the cave). Coordinate teleport stays in the current zone. Show collision draws the blockers. Grant XP, force rarity, and spawn item still only log. Reset save clears slot `slot-1` through the save interface.

## Scripts

Requires Node.js 22 or newer.

```bash
npm install
npm run dev        # http://127.0.0.1:47321
npm run build      # writes dist/
npm run preview    # serves dist/ on the same port
npm test
npm run lint       # ESLint and Prettier
npm run typecheck
npm run check      # lint, typecheck, test, and build
```

`.npmrc` sets `legacy-peer-deps=true`. npm 10's installer crashes while walking Vitest's optional peer dependencies (`Cannot read properties of null (reading 'edgesOut')`). The flag is the workaround so `npm ci` works.

## Checks

`npm run check` is the gate: lint, both TypeScript projects (app and DOM-free core) plus the Vite config, unit tests, and the production build.

`.github/workflows/ci.yml` is the only GitHub Actions workflow, so the gate is not run twice. Pull requests run `npm ci` and `npm run check`. A push to `main` runs that same check with `BASE_PATH=/journey/`, then deploys `dist/`.

## GitHub Pages

The game is published at <https://shahiran250890.github.io/journey/>.

A push to `main` deploys the production build with the official Pages actions: `actions/configure-pages`, `actions/upload-pages-artifact`, and `actions/deploy-pages`. `configure-pages` is called with `enablement: true`. Turning Pages on needs repository administration, which the workflow token may not have. If the deploy does not enable the site, set **Settings → Pages → Build and deployment → Source** to **GitHub Actions**, then re-run the workflow.

`BASE_PATH=/journey/` is set for that production build so asset URLs match the project-site path. A local `npm run build` leaves `BASE_PATH` unset and keeps `base` at `./`. For any other subpath, build with `BASE_PATH=/that/subpath/ npm run build`.

`vercel.json` is still there for an optional Vercel deploy: Vite framework, `npm run build`, output `dist/`, and a rewrite to `index.html`.

## Tests

Unit tests cover the seeded RNG, the fixed-tick clock, command-driven simulation and interpolation, collision and sliding, Tiled map parsing, the shipped maps (including a scripted walk from town to the dungeon and back), the shipped content schema (including rejection of the old +10-all rule, the old class thresholds, and skill names that were not signed off), rarity tickets, the migration hook, and an IndexedDB round-trip through `fake-indexeddb`. Projection math, depth order, and the `?debug=1` rule are tested too.
