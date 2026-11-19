# Browser MMORPG POC

Milestone 0 of a single-player, desktop-browser MMORPG proof of concept. The playable slice is a placeholder isometric field: colored diamond tiles, a player marker, and a camera that lerps after the marker. WASD walks. Game systems (combat, loot, quests, classes, real maps) are later milestones. This milestone puts the foundation in place so those systems can be added without rewriting the loop.

Requirements v0.2 are the source of the content. Where Muhammad approved different numbers for this milestone, the JSON uses those numbers.

## Stack

- Phaser 3 renders. It does not own rules.
- TypeScript in `strict` mode. The compiler is 6.0 because `typescript-eslint` does not yet accept TypeScript 7.
- Vite bundles the client. `base` defaults to `./`, so the production build works from a domain root or a subpath.
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

Also recorded, because v0.2 states them: what each stat governs, two skills per class plus one extra from Legendary up (names are not in the doc, so they are not invented), gear slots, two artifact examples (`+20% crit chance`, and heal-on-kill with no amount), the example kill/collect/dungeon quests, the special class quest, controls, the three zones, and the proposed save policy (3 slots, autosave every 30 seconds).

Not in the JSON, because the requirements do not give a number: the absolute XP amount for level 1, class skill names and stat multipliers, the heal-on-kill amount, monster combat stats, and which keys skills use. `xpMultiplierForLevel` returns the relative cost. Level 1 is `1`, level 2 is `1.2`, level 3 is `1.44`.

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

`.github/workflows/ci.yml` runs that same gate on GitHub Actions. This repository is hosted on Cursor Origin, and Origin does not run that workflow. Until a CI runner is attached, run `npm run check` locally.

## Preview and static hosting

Cursor Origin, as available from this environment, can host the git repository. It does not publish a static site or return a public preview URL for a Vite build. There is no Vercel, Netlify, or Cloudflare token here, and the owner does not want the project on GitHub, so a GitHub-connected host cannot be linked from this machine.

The production build is a static `dist/` folder:

- `vercel.json` sets the Vite framework, `npm run build`, and `dist`, and rewrites routes to `index.html`.
- Asset URLs are relative (`base: './'`). For a host that serves the game from a subpath, build with `BASE_PATH=/that/subpath/ npm run build`.

To get a public preview, connect a static host to the Origin repository or deploy `dist/` by hand. Vercel does not list Cursor Origin as a Git provider. Practical options:

1. From a machine logged into Vercel: `npx vercel` in this repo (the `vercel.json` is already in place), or import the project if Vercel gains an Origin integration.
2. Any other static host (Cloudflare Pages, Netlify, an S3 bucket) pointed at `dist/` after `npm run build`. Relative asset paths mean the files do not need to live at the domain root.

## Tests

Unit tests cover the seeded RNG, the fixed-tick clock, command-driven simulation and interpolation, the shipped content schema (including rejection of the old +10-all rule and the old class thresholds), rarity tickets, the migration hook, and an IndexedDB round-trip through `fake-indexeddb`. Projection math and the `?debug=1` rule are tested too.
