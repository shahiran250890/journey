# Credits

## Tiles and character

Every image in `content/maps/tiles/` was drawn for this project as a clean isometric placeholder set. The files are dedicated to the public domain under [CC0 1.0 Universal](https://creativecommons.org/publicdomain/zero/1.0/).

Kenney's CC0 isometric packs (https://kenney.nl/assets, also CC0) were the preferred source. This set was drawn instead so that every sprite shares one foot point: the bottom center of a 64×32 diamond, or an explicit origin on the larger buildings. Depth sorting uses that foot. The tile ids in `content/maps/journey-iso.tsj` can be pointed at replacement art later without changing the maps, as long as the foot stays put.

Nothing in `content/maps/` was copied from a third-party pack.

## Maps

`content/maps/town.tmj`, `overworld.tmj`, and `dungeon.tmj` are Tiled JSON maps authored for this project. `scripts/generate-maps.mjs` redraws them and the tiles. The committed files are what the game loads.

## Software

Phaser, Vite, Preact, and Zod are project dependencies under their own licenses. See `package.json` and `package-lock.json`.
