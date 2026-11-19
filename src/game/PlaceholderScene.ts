import Phaser from 'phaser';
import { FixedTickClock } from '../core/clock.ts';
import { Simulation } from '../core/simulation.ts';
import { getDebugState, patchDebug } from '../ui/debugStore.ts';
import { isoMapSize, isoProject, type IsoMetrics } from './iso.ts';

export const PLACEHOLDER_MAP: IsoMetrics = {
  tileWidth: 88,
  tileHeight: 44,
  columns: 16,
  rows: 16,
};

const MOVE_SPEED_PER_TICK = 0.14;
const SPAWN = { x: 8, y: 8 };

export function placeholderSimulation(seed: number): Simulation {
  const margin = 0.45;
  return new Simulation({
    seed,
    moveSpeedPerTick: MOVE_SPEED_PER_TICK,
    spawn: SPAWN,
    bounds: {
      minX: margin,
      minY: margin,
      maxX: PLACEHOLDER_MAP.columns - margin,
      maxY: PLACEHOLDER_MAP.rows - margin,
    },
  });
}

interface MoveKeys {
  up: Phaser.Input.Keyboard.Key;
  down: Phaser.Input.Keyboard.Key;
  left: Phaser.Input.Keyboard.Key;
  right: Phaser.Input.Keyboard.Key;
}

export class PlaceholderScene extends Phaser.Scene {
  private sim: Simulation | null = null;
  private clock: FixedTickClock | null = null;
  private player: Phaser.GameObjects.Container | null = null;
  private keys: MoveKeys | null = null;

  constructor() {
    super('placeholder');
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
    this.drawGrid();
    this.player = this.createMarker();
    const size = isoMapSize(PLACEHOLDER_MAP);
    this.cameras.main.setBounds(0, 0, size.width, size.height);
    this.cameras.main.startFollow(this.player, true, 0.12, 0.12);
    this.cameras.main.setZoom(1.45);
    this.cameras.main.roundPixels = true;
    const keyboard = this.input.keyboard;
    if (keyboard) {
      this.keys = {
        up: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.W),
        down: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.S),
        left: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.A),
        right: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.D),
      };
    }
    this.placePlayer(1);
  }

  override update(_time: number, delta: number): void {
    const sim = this.sim;
    const clock = this.clock;
    const player = this.player;
    if (!sim || !clock || !player) return;
    const direction = this.readMove();
    sim.enqueue({ type: 'move', x: direction.x, y: direction.y });
    const { alpha } = clock.advance(delta, () => sim.tick());
    this.placePlayer(alpha);
    if (getDebugState().visible) {
      patchDebug({
        fps: Math.round(this.game.loop.actualFps),
        tick: sim.getState().tick,
      });
    }
  }

  private placePlayer(alpha: number): void {
    const sim = this.sim;
    const player = this.player;
    if (!sim || !player) return;
    const world = sim.interpolatePlayer(alpha);
    const screen = isoProject(world.x, world.y, PLACEHOLDER_MAP);
    player.setPosition(screen.x, screen.y);
  }

  private readMove(): { x: number; y: number } {
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

  private drawGrid(): void {
    const graphics = this.add.graphics();
    const { columns, rows, tileWidth, tileHeight } = PLACEHOLDER_MAP;
    const halfW = tileWidth / 2;
    const halfH = tileHeight / 2;
    for (let row = 0; row < rows; row += 1) {
      for (let column = 0; column < columns; column += 1) {
        const center = isoProject(column + 0.5, row + 0.5, PLACEHOLDER_MAP);
        graphics.fillStyle(tileColor(column, row), 1);
        graphics.lineStyle(1, 0x10140f, 0.45);
        graphics.beginPath();
        graphics.moveTo(center.x, center.y - halfH);
        graphics.lineTo(center.x + halfW, center.y);
        graphics.lineTo(center.x, center.y + halfH);
        graphics.lineTo(center.x - halfW, center.y);
        graphics.closePath();
        graphics.fillPath();
        graphics.strokePath();
      }
    }
  }

  private createMarker(): Phaser.GameObjects.Container {
    const marker = this.add.container(0, 0);
    const shadow = this.add.ellipse(0, 8, 36, 14, 0x0c100e, 0.4);
    const body = this.add.graphics();
    body.fillStyle(0xf2c14e, 1);
    body.lineStyle(2, 0x2c220f, 1);
    body.beginPath();
    body.moveTo(0, -26);
    body.lineTo(14, -8);
    body.lineTo(0, 12);
    body.lineTo(-14, -8);
    body.closePath();
    body.fillPath();
    body.strokePath();
    const gem = this.add.circle(0, -10, 3.5, 0xfff4cc, 1);
    marker.add([shadow, body, gem]);
    marker.setDepth(10);
    return marker;
  }
}

function tileColor(column: number, row: number): number {
  const { columns, rows } = PLACEHOLDER_MAP;
  const edge = column === 0 || row === 0 || column === columns - 1 || row === rows - 1;
  if (edge) return 0x1b4450;
  if (Math.abs(column - 8) <= 1 && Math.abs(row - 8) <= 1) {
    return (column + row) % 2 === 0 ? 0xc6b48a : 0xb5a37b;
  }
  if (column === 8 && row >= 2 && row <= 13) {
    return row % 2 === 0 ? 0x9b8558 : 0x8c774d;
  }
  if (column >= 3 && column <= 5 && row >= 3 && row <= 4) return 0x2a6274;
  return (column + row) % 2 === 0 ? 0x2f6b45 : 0x275c3b;
}
