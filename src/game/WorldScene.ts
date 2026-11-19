import Phaser from 'phaser';
import { FixedTickClock } from '../core/clock.ts';
import { Simulation } from '../core/simulation.ts';
import { shapeOutline } from '../core/world/collision.ts';
import { parseTileset } from '../core/world/tiled.ts';
import type { TilesetTile, ZoneMap } from '../core/world/types.ts';
import { getDebugState, patchDebug } from '../ui/debugStore.ts';
import { footDepth, isoMapSize, isoProject, type IsoMetrics } from './iso.ts';
import { tileUrl } from './tileImages.ts';
import tilesetJson from '../../content/maps/journey-iso.tsj';

const tileset = parseTileset(tilesetJson);
const artById = new Map<number, TilesetTile>(tileset.tiles.map((tile) => [tile.id, tile]));

const ZONE_CAPTION: Record<string, string> = {
  town: 'Starter town · WASD to walk · ` for debug',
  overworld: 'Overworld · WASD to walk · ` for debug',
  dungeon: 'Dungeon stub · the north door continues in Milestone 5 · ` for debug',
};

interface MoveKeys {
  up: Phaser.Input.Keyboard.Key;
  down: Phaser.Input.Keyboard.Key;
  left: Phaser.Input.Keyboard.Key;
  right: Phaser.Input.Keyboard.Key;
}

export class WorldScene extends Phaser.Scene {
  private sim: Simulation | null = null;
  private clock: FixedTickClock | null = null;
  private player: Phaser.GameObjects.Sprite | null = null;
  private keys: MoveKeys | null = null;
  private scenery: Phaser.GameObjects.Sprite[] = [];
  private collision: Phaser.GameObjects.Graphics | null = null;
  private shownZone = '';
  private collisionShown = false;
  private metrics: IsoMetrics = { tileWidth: 64, tileHeight: 32, columns: 1, rows: 1 };
  private rendered = { x: Number.NaN, y: Number.NaN };

  constructor() {
    super('world');
  }

  preload(): void {
    for (const tile of tileset.tiles) {
      const fileName = tile.image.split('/').pop();
      if (!fileName) throw new Error(`tile ${tile.id} has no image`);
      this.load.image(`tile-${tile.id}`, tileUrl(fileName));
    }
    this.load.image('hero', tileUrl('hero.png'));
  }

  init(): void {
    const simulation = this.game.registry.get('simulation');
    const tickHz = this.game.registry.get('tickHz');
    if (!(simulation instanceof Simulation)) throw new Error('missing simulation');
    if (typeof tickHz !== 'number') throw new Error('missing tick rate');
    this.sim = simulation;
    this.clock = new FixedTickClock(tickHz);
  }

  create(): void {
    this.player = this.add.sprite(0, 0, 'hero');
    this.player.setOrigin(0.5, 1);
    this.player.setScale(1.25);
    this.collision = this.add.graphics();
    this.collision.setDepth(1_000_000);
    const camera = this.cameras.main;
    camera.startFollow(this.player, true, 0.1, 0.1);
    camera.setZoom(1.8);
    // Fixed angle: nothing in this scene calls setAngle or setRotation again.
    camera.setAngle(0);
    camera.roundPixels = true;
    const keyboard = this.input.keyboard;
    if (keyboard) {
      this.keys = {
        up: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.W),
        down: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.S),
        left: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.A),
        right: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.D),
      };
    }
    const zoneId = this.sim?.getState().zoneId ?? 'town';
    this.presentZone(zoneId);
    this.placePlayer(1, true);
  }

  override update(_time: number, delta: number): void {
    const sim = this.sim;
    const clock = this.clock;
    if (!sim || !clock || !this.player) return;
    const direction = this.readMove();
    sim.enqueue({ type: 'move', x: direction.x, y: direction.y });
    const { alpha } = clock.advance(delta, () => sim.tick());
    const state = sim.getState();
    const zoneChanged = state.zoneId !== this.shownZone;
    if (zoneChanged) this.presentZone(state.zoneId);
    const position = sim.interpolatePlayer(alpha);
    const jumped = Math.hypot(position.x - this.rendered.x, position.y - this.rendered.y) > 1.5;
    this.placePlayer(alpha, zoneChanged || jumped);
    const showCollision = getDebugState().showCollision;
    if (zoneChanged || showCollision !== this.collisionShown) {
      this.collisionShown = showCollision;
      this.drawCollision(sim.getMap(state.zoneId), showCollision);
    }
    if (getDebugState().visible) {
      patchDebug({
        fps: Math.round(this.game.loop.actualFps),
        tick: state.tick,
        zoneId: state.zoneId,
        x: state.player.x,
        y: state.player.y,
      });
    }
  }

  private presentZone(zoneId: string): void {
    const sim = this.sim;
    if (!sim) return;
    for (const sprite of this.scenery) sprite.destroy();
    this.scenery = [];
    const map = sim.getMap(zoneId);
    this.metrics = {
      tileWidth: map.tileWidth,
      tileHeight: map.tileHeight,
      columns: map.width,
      rows: map.height,
    };
    for (const tile of map.ground) this.scenery.push(this.addTile(tile.x, tile.y, tile.tileId, 0));
    for (const tile of map.props) {
      const depth = footDepth(tile.x + 1, tile.y + 1, map.tileHeight);
      this.scenery.push(this.addTile(tile.x, tile.y, tile.tileId, depth));
    }
    const size = isoMapSize(this.metrics);
    // A small margin keeps tall sprites from clipping. The scroll stays on the map.
    this.cameras.main.setBounds(-24, -96, size.width + 48, size.height + 140);
    this.shownZone = zoneId;
    this.collisionShown = false;
    const caption = document.querySelector('#caption');
    if (caption) caption.textContent = ZONE_CAPTION[zoneId] ?? zoneId;
  }

  private addTile(
    column: number,
    row: number,
    tileId: number,
    depth: number,
  ): Phaser.GameObjects.Sprite {
    const art = artById.get(tileId);
    if (!art) throw new Error(`missing art for tile ${tileId}`);
    const foot = isoProject(column + 1, row + 1, this.metrics);
    const sprite = this.add.sprite(foot.x, foot.y, `tile-${tileId}`);
    sprite.setOrigin(art.originX, art.originY);
    sprite.setDepth(depth);
    return sprite;
  }

  private placePlayer(alpha: number, snapCamera: boolean): void {
    const sim = this.sim;
    const player = this.player;
    if (!sim || !player) return;
    const world = sim.interpolatePlayer(alpha);
    const screen = isoProject(world.x, world.y, this.metrics);
    player.setPosition(screen.x, screen.y);
    player.setDepth(footDepth(world.x, world.y, this.metrics.tileHeight) + 0.5);
    this.rendered = world;
    this.cameras.main.setLerp(snapCamera ? 1 : 0.1, snapCamera ? 1 : 0.1);
    if (snapCamera) this.cameras.main.centerOn(screen.x, screen.y);
  }

  private drawCollision(map: ZoneMap, show: boolean): void {
    const graphics = this.collision;
    if (!graphics) return;
    graphics.clear();
    graphics.setVisible(show);
    if (!show) return;
    graphics.fillStyle(0xff5a3c, 0.22);
    graphics.lineStyle(2, 0xffd0c4, 0.95);
    for (const blocker of map.blockers) {
      const points = shapeOutline(blocker).map((point) =>
        isoProject(point.x, point.y, this.metrics),
      );
      const first = points[0];
      if (!first) continue;
      graphics.beginPath();
      graphics.moveTo(first.x, first.y);
      for (const point of points.slice(1)) graphics.lineTo(point.x, point.y);
      graphics.closePath();
      graphics.fillPath();
      graphics.strokePath();
    }
  }

  private readMove(): { x: number; y: number } {
    if (typingInDebugField()) return { x: 0, y: 0 };
    const keys = this.keys;
    if (!keys) return { x: 0, y: 0 };
    let x = 0;
    let y = 0;
    if (keys.up.isDown) {
      x -= 1;
      y -= 1;
    }
    if (keys.down.isDown) {
      x += 1;
      y += 1;
    }
    if (keys.left.isDown) {
      x -= 1;
      y += 1;
    }
    if (keys.right.isDown) {
      x += 1;
      y -= 1;
    }
    return { x, y };
  }
}

function typingInDebugField(): boolean {
  const target = document.activeElement;
  return (
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement
  );
}
