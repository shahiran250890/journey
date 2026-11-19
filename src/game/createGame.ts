import Phaser from 'phaser';
import type { Simulation } from '../core/simulation.ts';
import { WorldScene } from './WorldScene.ts';

export function createGame(options: {
  parent: HTMLElement;
  simulation: Simulation;
  tickHz: number;
}): Phaser.Game {
  return new Phaser.Game({
    type: Phaser.AUTO,
    parent: options.parent,
    backgroundColor: '#1a2420',
    banner: false,
    scale: {
      mode: Phaser.Scale.RESIZE,
      width: options.parent.clientWidth,
      height: options.parent.clientHeight,
    },
    input: { keyboard: true },
    scene: [WorldScene],
    callbacks: {
      preBoot: (game) => {
        game.registry.set('simulation', options.simulation);
        game.registry.set('tickHz', options.tickHz);
      },
    },
  });
}
