# Browser MMORPG POC

Milestone 0 of a single-player, desktop-browser MMORPG proof of concept. The playable slice is a placeholder isometric field: colored diamond tiles, a player marker, and a camera that lerps after the marker. WASD walks. Game systems (combat, loot, quests, classes, real maps) are later milestones. This milestone puts the foundation in place so those systems can be added without rewriting the loop.

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
src/core/                Pure simulation. No Phaser, Preact, or browser IO.
src/platform/save/       IndexedDB adapter for the core save interface.
src/game/                Phaser scene and isometric projection.
src/ui/                  Preact debug overlay and the small store it reads.
```

`src/core` is checked twice. ESLint rejects Phaser, Preact, React, and browser globals. `tsconfig.core.json` typechecks that folder with the DOM library removed, so a stray `window` or `indexedDB` fails `npm run typecheck`. A unit test scans the same files.

## How the loop is split

Input becomes a command: `move`, `attack`, or `use-item`. Nothing else writes world state. A fixed clock (`content/progression.json` → `tickHz`, 20) steps the simulation. The scene interpolates the player between the previous tick and the current one, and the camera follows that sprite with its own lerp. Attack and item commands are accepted and recorded; they do not fight anything yet.

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

## Debug panel

The panel is not in the DOM during normal play. Press `` ` `` (backtick) to toggle it. `?debug=1` opens it on load. It shows FPS, the simulation tick, and the configured tick rate, plus stub controls for grant XP, force rarity, spawn item, teleport, and reset save. The stubs log to the console. Reset save also clears slot `slot-1` through the save interface.

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

Unit tests cover the seeded RNG, the fixed-tick clock, command-driven simulation and interpolation, the shipped content schema (including rejection of the old +10-all rule, the old class thresholds, and skill names that were not signed off), rarity tickets, the migration hook, and an IndexedDB round-trip through `fake-indexeddb`. Projection math and the `?debug=1` rule are tested too.
