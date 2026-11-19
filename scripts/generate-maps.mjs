/**
 * Writes the Milestone 1 Tiled maps and the placeholder isometric tiles.
 * Run with `node scripts/generate-maps.mjs`. The committed .tmj/.tsj files
 * and PNGs are the assets the game loads; this script is how they are drawn.
 */
import { crc32, deflateSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const mapDir = path.join(root, 'content/maps');
const tileDir = path.join(mapDir, 'tiles');
const TILE_W = 64;
const TILE_H = 32;

const paint = {
  grass: [61, 138, 72, 255],
  grassDark: [42, 104, 54, 255],
  dirt: [186, 146, 88, 255],
  dirtDark: [146, 108, 62, 255],
  cobble: [142, 136, 124, 255],
  cobbleDark: [108, 102, 92, 255],
  water: [46, 112, 166, 255],
  waterDeep: [24, 72, 122, 255],
  waterLight: [132, 196, 220, 255],
  stone: [108, 104, 118, 255],
  stoneDark: [68, 64, 80, 255],
  mark: [168, 116, 62, 255],
  leaf: [48, 132, 62, 255],
  leafDark: [26, 88, 42, 255],
  leafLight: [118, 178, 78, 255],
  pine: [24, 92, 72, 255],
  pineDark: [14, 62, 50, 255],
  trunk: [112, 74, 42, 255],
  trunkDark: [74, 48, 28, 255],
  rock: [132, 130, 126, 255],
  rockDark: [84, 82, 80, 255],
  roofRed: [176, 74, 58, 255],
  roofBlue: [58, 92, 142, 255],
  roofBrown: [128, 82, 48, 255],
  wall: [222, 204, 168, 255],
  wallShade: [168, 140, 108, 255],
  cave: [78, 76, 82, 255],
  caveDark: [28, 26, 32, 255],
  robe: [46, 68, 148, 255],
  hero: [188, 86, 52, 255],
  heroDark: [122, 52, 36, 255],
  skin: [228, 184, 146, 255],
  gold: [236, 190, 72, 255],
  ink: [28, 24, 22, 255],
};

function createImage(width, height) {
  return {
    w: width,
    h: height,
    data: new Uint8Array(width * height * 4),
    set(x, y, color) {
      const px = Math.round(x);
      const py = Math.round(y);
      if (px < 0 || py < 0 || px >= width || py >= height) return;
      const index = (py * width + px) * 4;
      const srcA = color[3] / 255;
      if (srcA >= 1 || this.data[index + 3] === 0) {
        this.data[index] = color[0];
        this.data[index + 1] = color[1];
        this.data[index + 2] = color[2];
        this.data[index + 3] = color[3];
        return;
      }
      const dstA = this.data[index + 3] / 255;
      const outA = srcA + dstA * (1 - srcA);
      const mix = (src, dst) => Math.round((src * srcA + dst * dstA * (1 - srcA)) / outA);
      this.data[index] = mix(color[0], this.data[index]);
      this.data[index + 1] = mix(color[1], this.data[index + 1]);
      this.data[index + 2] = mix(color[2], this.data[index + 2]);
      this.data[index + 3] = Math.round(outA * 255);
    },
  };
}

function fillPolygon(img, points, color) {
  const minY = Math.max(0, Math.floor(Math.min(...points.map((point) => point.y))));
  const maxY = Math.min(img.h - 1, Math.ceil(Math.max(...points.map((point) => point.y))));
  for (let y = minY; y <= maxY; y += 1) {
    const xs = [];
    for (let index = 0; index < points.length; index += 1) {
      const start = points[index];
      const end = points[(index + 1) % points.length];
      if ((start.y <= y && end.y > y) || (end.y <= y && start.y > y)) {
        const t = (y - start.y) / (end.y - start.y);
        xs.push(start.x + (end.x - start.x) * t);
      }
    }
    xs.sort((a, b) => a - b);
    for (let index = 0; index + 1 < xs.length; index += 2) {
      const from = Math.max(0, Math.ceil(xs[index]));
      const to = Math.min(img.w - 1, Math.floor(xs[index + 1]));
      for (let x = from; x <= to; x += 1) img.set(x, y, color);
    }
  }
}

function fillEllipse(img, cx, cy, rx, ry, color) {
  const minY = Math.max(0, Math.floor(cy - ry));
  const maxY = Math.min(img.h - 1, Math.ceil(cy + ry));
  const minX = Math.max(0, Math.floor(cx - rx));
  const maxX = Math.min(img.w - 1, Math.ceil(cx + rx));
  for (let y = minY; y <= maxY; y += 1) {
    for (let x = minX; x <= maxX; x += 1) {
      const dx = (x - cx) / rx;
      const dy = (y - cy) / ry;
      if (dx * dx + dy * dy <= 1) img.set(x, y, color);
    }
  }
}

function hash(x, y) {
  let n = Math.imul(x, 374761393) + Math.imul(y, 668265263);
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
}

function shade(color, amount) {
  return [
    clampChannel(color[0] + amount),
    clampChannel(color[1] + amount),
    clampChannel(color[2] + amount),
    color[3],
  ];
}

function clampChannel(value) {
  return Math.max(0, Math.min(255, Math.round(value)));
}

function fillDiamond(img, color, noise = 0) {
  const cx = (img.w - 1) / 2;
  const cy = (img.h - 1) / 2;
  const rx = (img.w - 1) / 2;
  const ry = (img.h - 1) / 2;
  for (let y = 0; y < img.h; y += 1) {
    for (let x = 0; x < img.w; x += 1) {
      const dx = Math.abs(x - cx) / rx;
      const dy = Math.abs(y - cy) / ry;
      const edge = dx + dy;
      if (edge <= 1) {
        const jitter = noise === 0 ? 0 : (hash(x, y) - 0.5) * noise;
        const tone = edge > 0.9 ? shade(color, -28) : shade(color, jitter);
        img.set(x, y, tone);
      }
    }
  }
}

function drawGround(color, noise) {
  const img = createImage(TILE_W, TILE_H);
  fillDiamond(img, color, noise);
  return { img, originX: 0.5, originY: 1 };
}

function drawTree(kind) {
  const img = createImage(108, 156);
  const footX = img.w / 2;
  const footY = img.h - 1;
  fillEllipse(img, footX, footY - 4, 22, 8, [0, 0, 0, 70]);
  const trunkTop = footY - 48;
  fillPolygon(
    img,
    [
      { x: footX - 7, y: footY - 2 },
      { x: footX + 8, y: footY - 2 },
      { x: footX + 6, y: trunkTop },
      { x: footX - 8, y: trunkTop },
    ],
    paint.trunk,
  );
  fillPolygon(
    img,
    [
      { x: footX - 8, y: footY - 2 },
      { x: footX - 1, y: footY - 2 },
      { x: footX - 2, y: trunkTop },
      { x: footX - 9, y: trunkTop },
    ],
    paint.trunkDark,
  );
  if (kind === 'pine') {
    fillPolygon(
      img,
      [
        { x: footX, y: 8 },
        { x: footX + 36, y: footY - 36 },
        { x: footX - 36, y: footY - 36 },
      ],
      paint.pineDark,
    );
    fillPolygon(
      img,
      [
        { x: footX, y: 18 },
        { x: footX + 28, y: footY - 46 },
        { x: footX - 22, y: footY - 46 },
      ],
      paint.pine,
    );
  } else {
    fillEllipse(img, footX - 4, footY - 78, 40, 30, paint.leafDark);
    fillEllipse(img, footX + 10, footY - 88, 32, 26, paint.leaf);
    fillEllipse(img, footX - 8, footY - 98, 22, 16, paint.leafLight);
  }
  return { img, originX: 0.5, originY: 1 };
}

function drawRock() {
  const img = createImage(72, 64);
  const footX = img.w / 2;
  const footY = img.h - 1;
  fillEllipse(img, footX, footY - 6, 24, 10, [0, 0, 0, 60]);
  fillEllipse(img, footX - 2, footY - 22, 26, 18, paint.rockDark);
  fillEllipse(img, footX + 6, footY - 28, 18, 14, paint.rock);
  fillEllipse(img, footX - 8, footY - 30, 10, 8, shade(paint.rock, 24));
  return { img, originX: 0.5, originY: 1 };
}

function drawBush() {
  const img = createImage(64, 48);
  const footX = img.w / 2;
  const footY = img.h - 1;
  fillEllipse(img, footX, footY - 4, 16, 6, [0, 0, 0, 50]);
  fillEllipse(img, footX, footY - 16, 24, 14, paint.leafDark);
  fillEllipse(img, footX + 6, footY - 20, 14, 10, paint.leaf);
  return { img, originX: 0.5, originY: 1 };
}

function drawWell() {
  const img = createImage(64, 72);
  const footX = img.w / 2;
  const footY = img.h - 1;
  fillEllipse(img, footX, footY - 6, 20, 8, [0, 0, 0, 60]);
  fillEllipse(img, footX, footY - 18, 22, 12, paint.stoneDark);
  fillEllipse(img, footX, footY - 24, 16, 8, paint.waterDeep);
  fillEllipse(img, footX, footY - 28, 18, 8, paint.stone);
  fillPolygon(
    img,
    [
      { x: footX - 4, y: footY - 30 },
      { x: footX + 4, y: footY - 30 },
      { x: footX + 10, y: 10 },
      { x: footX + 2, y: 8 },
    ],
    paint.trunk,
  );
  fillPolygon(
    img,
    [
      { x: footX - 16, y: 16 },
      { x: footX + 18, y: 12 },
      { x: footX + 16, y: 18 },
      { x: footX - 14, y: 22 },
    ],
    paint.trunkDark,
  );
  return { img, originX: 0.5, originY: 1 };
}

function drawPerson(robe, dark, quest) {
  const img = createImage(48, 86);
  const footX = img.w / 2;
  const footY = img.h - 1;
  fillEllipse(img, footX, footY - 3, 12, 5, [0, 0, 0, 70]);
  fillPolygon(
    img,
    [
      { x: footX - 10, y: footY - 4 },
      { x: footX + 10, y: footY - 4 },
      { x: footX + 7, y: footY - 36 },
      { x: footX - 8, y: footY - 40 },
    ],
    robe,
  );
  fillPolygon(
    img,
    [
      { x: footX - 10, y: footY - 4 },
      { x: footX - 1, y: footY - 4 },
      { x: footX - 2, y: footY - 38 },
      { x: footX - 8, y: footY - 40 },
    ],
    dark,
  );
  fillEllipse(img, footX, footY - 48, 8, 8, paint.skin);
  fillEllipse(img, footX, footY - 52, 8, 5, paint.ink);
  if (quest) {
    fillPolygon(
      img,
      [
        { x: footX, y: 4 },
        { x: footX + 7, y: 16 },
        { x: footX, y: 28 },
        { x: footX - 7, y: 16 },
      ],
      paint.gold,
    );
    img.set(footX, 14, paint.ink);
    img.set(footX, 15, paint.ink);
    img.set(footX, 16, paint.ink);
    img.set(footX, 19, paint.ink);
  }
  return { img, originX: 0.5, originY: 1 };
}

function drawBuilding(tilesWide, tilesHigh, rise, roof, wall) {
  const pad = 16;
  const southX = pad + (tilesWide * TILE_W) / 2;
  const southY = pad + (tilesWide + tilesHigh) * (TILE_H / 2) + rise;
  const width = Math.ceil(southX + (tilesHigh * TILE_W) / 2 + pad);
  const height = Math.ceil(southY + 2);
  const img = createImage(width, height);
  const corner = (alongX, alongY, lift) => ({
    x: southX + (alongX - alongY) * (TILE_W / 2),
    y: southY + (alongX + alongY) * (TILE_H / 2) - lift,
  });
  const south = corner(0, 0, 0);
  const east = corner(0, -tilesHigh, 0);
  const west = corner(-tilesWide, 0, 0);
  const north = corner(-tilesWide, -tilesHigh, 0);
  const top = (point) => ({ x: point.x, y: point.y - rise });
  fillPolygon(img, [south, east, top(east), top(south)], shade(wall, 8));
  fillPolygon(img, [south, west, top(west), top(south)], shade(wall, -36));
  const center = {
    x: (top(north).x + top(south).x) / 2,
    y: (top(north).y + top(south).y) / 2,
  };
  const roofPoints = [top(north), top(east), top(south), top(west)].map((point) => ({
    x: center.x + (point.x - center.x) * 1.14,
    y: center.y + (point.y - center.y) * 1.14 - 6,
  }));
  fillPolygon(img, roofPoints, roof);
  fillPolygon(img, [roofPoints[0], roofPoints[1], center], shade(roof, 18));
  const door = [
    { x: south.x + (east.x - south.x) * 0.35, y: south.y + (east.y - south.y) * 0.35 },
    { x: south.x + (east.x - south.x) * 0.62, y: south.y + (east.y - south.y) * 0.62 },
  ];
  fillPolygon(
    img,
    [
      door[0],
      door[1],
      { x: door[1].x, y: door[1].y - rise * 0.55 },
      { x: door[0].x, y: door[0].y - rise * 0.62 },
    ],
    paint.caveDark,
  );
  return {
    img,
    originX: (southX + 0.5) / width,
    originY: (southY + 1) / height,
  };
}

function drawCave() {
  const img = createImage(150, 168);
  const footX = img.w / 2;
  const footY = img.h - 1;
  fillEllipse(img, footX, footY - 8, 48, 16, [0, 0, 0, 70]);
  fillEllipse(img, footX, footY - 62, 62, 48, paint.cave);
  fillEllipse(img, footX - 16, footY - 78, 36, 30, shade(paint.cave, 16));
  fillEllipse(img, footX + 8, footY - 34, 22, 26, paint.caveDark);
  fillEllipse(img, footX + 8, footY - 30, 14, 16, [12, 10, 16, 255]);
  fillPolygon(
    img,
    [
      { x: footX - 28, y: footY - 18 },
      { x: footX + 36, y: footY - 28 },
      { x: footX + 30, y: footY - 16 },
      { x: footX - 22, y: footY - 8 },
    ],
    paint.rockDark,
  );
  return { img, originX: 0.5, originY: 1 };
}

function encodePng(img) {
  const raw = Buffer.alloc((img.w * 4 + 1) * img.h);
  for (let y = 0; y < img.h; y += 1) {
    const row = y * (img.w * 4 + 1);
    raw[row] = 0;
    for (let x = 0; x < img.w; x += 1) {
      const source = (y * img.w + x) * 4;
      const dest = row + 1 + x * 4;
      raw[dest] = img.data[source];
      raw[dest + 1] = img.data[source + 1];
      raw[dest + 2] = img.data[source + 2];
      raw[dest + 3] = img.data[source + 3];
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(img.w, 0);
  ihdr.writeUInt32BE(img.h, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  return Buffer.concat([
    signature,
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const body = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body) >>> 0, 0);
  return Buffer.concat([length, body, crc]);
}

mkdirSync(tileDir, { recursive: true });

const drawn = [];
function addTile(name, art) {
  const id = drawn.length;
  writeFileSync(path.join(tileDir, `${name}.png`), encodePng(art.img));
  drawn.push({
    id,
    image: `tiles/${name}.png`,
    imagewidth: art.img.w,
    imageheight: art.img.h,
    properties: [
      { name: 'originX', type: 'float', value: Number(art.originX.toFixed(6)) },
      { name: 'originY', type: 'float', value: Number(art.originY.toFixed(6)) },
    ],
  });
  return id;
}

const id = {
  grass: addTile('grass', drawGround(paint.grass, 18)),
  grassAlt: addTile('grass-alt', drawGround(shade(paint.grass, -12), 18)),
  path: addTile('path', drawGround(paint.dirt, 14)),
  water: addTile('water', drawGround(paint.water, 10)),
  cobble: addTile('cobble', drawGround(paint.cobble, 12)),
  stone: addTile('stone', drawGround(paint.stone, 10)),
  spawn: addTile('spawn-mark', drawGround(shade(paint.grass, -8), 8)),
  tree: addTile('tree', drawTree('round')),
  pine: addTile('pine', drawTree('pine')),
  rock: addTile('rock', drawRock()),
  bush: addTile('bush', drawBush()),
  houseRed: addTile('house-red', drawBuilding(3, 2, 54, paint.roofRed, paint.wall)),
  houseBlue: addTile('house-blue', drawBuilding(2, 2, 50, paint.roofBlue, paint.wall)),
  houseBrown: addTile('house-brown', drawBuilding(3, 2, 54, paint.roofBrown, paint.wall)),
  cave: addTile('cave', drawCave()),
  npc: addTile('npc', drawPerson(paint.robe, shade(paint.robe, -30), true)),
  wall: addTile('wall', drawBuilding(1, 1, 46, paint.stone, paint.stoneDark)),
  pillar: addTile('pillar', drawBuilding(1, 1, 70, paint.stone, shade(paint.stone, -10))),
  sealed: addTile('sealed', drawBuilding(2, 1, 58, paint.roofBrown, paint.stoneDark)),
  well: addTile('well', drawWell()),
};
writeFileSync(
  path.join(tileDir, 'hero.png'),
  encodePng(drawPerson(paint.hero, paint.heroDark, false).img),
);

const tileset = {
  columns: 0,
  margin: 0,
  name: 'journey-iso',
  spacing: 0,
  tilecount: drawn.length,
  tileheight: 32,
  tilewidth: 64,
  type: 'tileset',
  tiles: drawn,
};
writeFileSync(path.join(mapDir, 'journey-iso.tsj'), `${JSON.stringify(tileset, null, 2)}\n`);

function blank(width, height, fill) {
  return Array.from({ length: height }, () => Array.from({ length: width }, () => fill));
}

function inMap(grid, x, y) {
  return y >= 0 && x >= 0 && y < grid.length && x < grid[0].length;
}

function tileToPixel(x, y, rows) {
  const originX = (rows * TILE_W) / 2;
  return {
    x: originX + (x - y) * (TILE_W / 2),
    y: (x + y) * (TILE_H / 2),
  };
}

let objectId = 1;
function polygonObject(name, typeName, points, rows, properties) {
  const pixels = points.map((point) => tileToPixel(point.x, point.y, rows));
  const origin = pixels[0];
  return {
    height: 0,
    id: objectId++,
    name,
    polygon: pixels.map((point) => ({ x: point.x - origin.x, y: point.y - origin.y })),
    properties,
    rotation: 0,
    type: typeName,
    visible: true,
    width: 0,
    x: origin.x,
    y: origin.y,
  };
}

function pointObject(name, typeName, x, y, rows, properties = []) {
  const pixel = tileToPixel(x, y, rows);
  return {
    height: 0,
    id: objectId++,
    name,
    point: true,
    properties,
    rotation: 0,
    type: typeName,
    visible: true,
    width: 0,
    x: pixel.x,
    y: pixel.y,
  };
}

function rectPoints(minX, minY, maxX, maxY) {
  return [
    { x: minX, y: minY },
    { x: maxX, y: minY },
    { x: maxX, y: maxY },
    { x: minX, y: maxY },
  ];
}

function circlePoints(cx, cy, radius, steps = 16) {
  const points = [];
  for (let index = 0; index < steps; index += 1) {
    const angle = (index / steps) * Math.PI * 2;
    points.push({ x: cx + Math.cos(angle) * radius, y: cy + Math.sin(angle) * radius });
  }
  return points;
}

function layerData(grid, lookup) {
  const height = grid.length;
  const width = grid[0].length;
  const data = [];
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const name = grid[y][x];
      data.push(name ? lookup(name) + 1 : 0);
    }
  }
  return { width, height, data };
}

function tileLayer(name, grid, lookup, extra = {}) {
  const { width, height, data } = layerData(grid, lookup);
  return {
    data,
    height,
    id: extra.id,
    name,
    opacity: 1,
    type: 'tilelayer',
    visible: extra.visible !== false,
    width,
    x: 0,
    y: 0,
    ...(extra.properties ? { properties: extra.properties } : {}),
  };
}

function buildMap(zoneId, ground, props, blocked, objects, extraProperties = []) {
  const height = ground.length;
  const width = ground[0].length;
  const collision = blank(width, height, null);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (blocked[y][x]) collision[y][x] = 'grass';
    }
  }
  objectId = 1;
  return {
    compressionlevel: -1,
    height,
    infinite: false,
    layers: [
      tileLayer('ground', ground, (name) => id[name], { id: 1 }),
      tileLayer('props', props, (name) => id[name], { id: 2 }),
      tileLayer('collision', collision, (name) => id[name], {
        id: 3,
        visible: false,
        properties: [{ name: 'blocks', type: 'bool', value: true }],
      }),
      ...objects(height),
    ],
    nextlayerid: 8,
    nextobjectid: objectId,
    orientation: 'isometric',
    properties: [{ name: 'zoneId', type: 'string', value: zoneId }, ...extraProperties],
    renderorder: 'right-down',
    tiledversion: '1.11.2',
    tileheight: TILE_H,
    tilesets: [{ firstgid: 1, source: 'journey-iso.tsj' }],
    tilewidth: TILE_W,
    type: 'map',
    version: '1.10',
    width,
  };
}

function stampBuilding(props, blocked, col, row, wide, high, tileName) {
  for (let y = row; y < row + high; y += 1) {
    for (let x = col; x < col + wide; x += 1) {
      props[y][x] = null;
      blocked[y][x] = true;
    }
  }
  props[row + high - 1][col + wide - 1] = tileName;
}

function town() {
  const width = 26;
  const height = 22;
  const ground = blank(width, height, 'grass');
  const props = blank(width, height, null);
  const blocked = blank(width, height, false);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (hash(x + 3, y + 9) > 0.55) ground[y][x] = 'grassAlt';
      const border = x <= 1 || y <= 1 || x >= width - 2 || y >= height - 2;
      if (border) {
        props[y][x] = hash(x, y) > 0.45 ? 'pine' : 'tree';
        blocked[y][x] = true;
      }
    }
  }
  for (let y = 14; y <= 16; y += 1) {
    for (let x = width - 4; x < width; x += 1) {
      props[y][x] = null;
      blocked[y][x] = false;
      ground[y][x] = 'path';
    }
  }
  for (let y = 7; y <= 12; y += 1) {
    for (let x = 7; x <= 14; x += 1) ground[y][x] = 'cobble';
  }
  for (let x = 12; x < width - 1; x += 1) {
    ground[15][x] = 'path';
    props[15][x] = null;
    blocked[15][x] = false;
  }
  stampBuilding(props, blocked, 3, 3, 3, 2, 'houseRed');
  stampBuilding(props, blocked, 8, 3, 2, 2, 'houseBlue');
  stampBuilding(props, blocked, 15, 3, 3, 2, 'houseBrown');
  const blocking = [
    [11, 9, 'npc'],
    [8, 10, 'well'],
    [8, 16, 'tree'],
    [5, 12, 'tree'],
    [18, 11, 'pine'],
    [4, 8, 'rock'],
    [20, 18, 'rock'],
    [16, 17, 'bush'],
  ];
  for (const [x, y, name] of blocking) {
    props[y][x] = name;
    blocked[y][x] = true;
  }
  const map = buildMap('town', ground, props, blocked, (rows) => [
    {
      draworder: 'topdown',
      id: 4,
      name: 'triggers',
      objects: [
        polygonObject('to-overworld', 'zone-exit', rectPoints(22.2, 14, 26, 17), rows, [
          { name: 'targetZone', type: 'string', value: 'overworld' },
          { name: 'targetSpawn', type: 'string', value: 'from-town' },
        ]),
      ],
      opacity: 1,
      type: 'objectgroup',
      visible: true,
      x: 0,
      y: 0,
    },
    {
      draworder: 'topdown',
      id: 5,
      name: 'spawns',
      objects: [
        pointObject('default', 'spawn', 12.5, 10.5, rows),
        pointObject('from-overworld', 'spawn', 18.5, 15.5, rows),
      ],
      opacity: 1,
      type: 'objectgroup',
      visible: true,
      x: 0,
      y: 0,
    },
    {
      draworder: 'topdown',
      id: 6,
      name: 'markers',
      objects: [pointObject('town-quest-npc', 'quest-npc', 11.5, 9.5, rows)],
      opacity: 1,
      type: 'objectgroup',
      visible: true,
      x: 0,
      y: 0,
    },
  ]);
  writeFileSync(path.join(mapDir, 'town.tmj'), `${JSON.stringify(map, null, 2)}\n`);
}

function carvePath(ground, props, blocked, points) {
  const height = ground.length;
  const width = ground[0].length;
  const cells = [];
  for (let index = 0; index < points.length - 1; index += 1) {
    const [x0, y0] = points[index];
    const [x1, y1] = points[index + 1];
    let x = Math.round(x0);
    let y = Math.round(y0);
    const endX = Math.round(x1);
    const endY = Math.round(y1);
    const dx = Math.abs(endX - x);
    const dy = Math.abs(endY - y);
    const sx = x < endX ? 1 : -1;
    const sy = y < endY ? 1 : -1;
    let err = dx - dy;
    for (;;) {
      cells.push([x, y]);
      if (x === endX && y === endY) break;
      const doubled = 2 * err;
      if (doubled > -dy) {
        err -= dy;
        x += sx;
      }
      if (doubled < dx) {
        err += dx;
        y += sy;
      }
    }
  }
  for (const [x, y] of cells) {
    for (let offsetY = -2; offsetY <= 2; offsetY += 1) {
      for (let offsetX = -2; offsetX <= 2; offsetX += 1) {
        const cx = x + offsetX;
        const cy = y + offsetY;
        if (cy < 0 || cx < 0 || cy >= height || cx >= width) continue;
        const distance = Math.max(Math.abs(offsetX), Math.abs(offsetY));
        props[cy][cx] = null;
        blocked[cy][cx] = false;
        if (distance <= 1 && ground[cy][cx] !== 'water') ground[cy][cx] = 'path';
      }
    }
  }
}

function overworld() {
  const width = 40;
  const height = 34;
  const ground = blank(width, height, 'grass');
  const props = blank(width, height, null);
  const blocked = blank(width, height, false);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (hash(x, y) > 0.5) ground[y][x] = 'grassAlt';
      const north = 1 - y / height;
      const chance = 0.28 + north * 0.38;
      const roll = hash(x + 11, y + 5);
      if (roll < chance) {
        props[y][x] = roll < chance * 0.45 ? 'pine' : 'tree';
        blocked[y][x] = true;
      } else if (hash(x + 4, y + 8) > 0.965) {
        props[y][x] = 'rock';
        blocked[y][x] = true;
      } else if (hash(x + 2, y + 6) > 0.97) {
        props[y][x] = 'bush';
        blocked[y][x] = true;
      }
    }
  }
  const lake = { x: 27.5, y: 28.2, r: 3.7 };
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const dx = x + 0.5 - lake.x;
      const dy = y + 0.5 - lake.y;
      if (dx * dx + dy * dy <= lake.r * lake.r) {
        ground[y][x] = 'water';
        props[y][x] = null;
        blocked[y][x] = false;
      }
    }
  }
  const zones = [
    { name: 'wolves', monster: 'wolf', x: 4, y: 22, w: 6, h: 5 },
    { name: 'boars', monster: 'boar', x: 30, y: 18, w: 6, h: 5 },
    { name: 'bandits', monster: 'bandit', x: 8, y: 4, w: 6, h: 5 },
    { name: 'slimes', monster: 'slime', x: 16, y: 21, w: 5, h: 4 },
  ];
  for (const zone of zones) {
    for (let y = zone.y; y < zone.y + zone.h; y += 1) {
      for (let x = zone.x; x < zone.x + zone.w; x += 1) {
        if (ground[y][x] === 'water') continue;
        props[y][x] = null;
        blocked[y][x] = false;
        if (ground[y][x] !== 'path') ground[y][x] = 'spawn';
      }
    }
  }
  carvePath(ground, props, blocked, [
    [2, 17],
    [8, 17],
    [14, 15],
    [20, 13],
    [26, 12],
    [32, 10],
    [34, 8],
  ]);
  for (let y = 3; y <= 6; y += 1) {
    for (let x = 32; x <= 37; x += 1) {
      if (!inMap(ground, x, y)) continue;
      props[y][x] = x === 34 && y === 6 ? 'cave' : 'rock';
      blocked[y][x] = true;
      if (ground[y][x] === 'water') ground[y][x] = 'grassAlt';
    }
  }
  for (let x = 33; x <= 35; x += 1) {
    ground[7][x] = 'path';
    props[7][x] = null;
    blocked[7][x] = false;
  }
  const map = buildMap('overworld', ground, props, blocked, (rows) => [
    {
      draworder: 'topdown',
      id: 4,
      name: 'collision',
      objects: [
        polygonObject('lake', 'water', circlePoints(lake.x, lake.y, lake.r), rows, [
          { name: 'blocks', type: 'bool', value: true },
        ]),
      ],
      opacity: 1,
      type: 'objectgroup',
      visible: true,
      x: 0,
      y: 0,
    },
    {
      draworder: 'topdown',
      id: 5,
      name: 'triggers',
      objects: [
        polygonObject('to-town', 'zone-exit', rectPoints(0, 15.2, 2.4, 19), rows, [
          { name: 'targetZone', type: 'string', value: 'town' },
          { name: 'targetSpawn', type: 'string', value: 'from-overworld' },
        ]),
        polygonObject('to-dungeon', 'zone-exit', rectPoints(32.4, 7.45, 36.2, 9.4), rows, [
          { name: 'targetZone', type: 'string', value: 'dungeon' },
          { name: 'targetSpawn', type: 'string', value: 'default' },
        ]),
      ],
      opacity: 1,
      type: 'objectgroup',
      visible: true,
      x: 0,
      y: 0,
    },
    {
      draworder: 'topdown',
      id: 6,
      name: 'spawns',
      objects: [
        pointObject('default', 'spawn', 18.5, 14.5, rows),
        pointObject('from-town', 'spawn', 5.5, 17.5, rows),
        pointObject('from-dungeon', 'spawn', 30.5, 11.5, rows),
        pointObject('dungeon-entrance', 'spawn', 33.2, 10.6, rows),
      ],
      opacity: 1,
      type: 'objectgroup',
      visible: true,
      x: 0,
      y: 0,
    },
    {
      draworder: 'topdown',
      id: 7,
      name: 'markers',
      objects: [
        pointObject('dungeon-entrance', 'dungeon-entrance', 34.5, 6.8, rows),
        ...zones.map((zone) =>
          polygonObject(
            zone.name,
            'monster-spawn',
            rectPoints(zone.x, zone.y, zone.x + zone.w, zone.y + zone.h),
            rows,
            [{ name: 'monster', type: 'string', value: zone.monster }],
          ),
        ),
      ],
      opacity: 1,
      type: 'objectgroup',
      visible: true,
      x: 0,
      y: 0,
    },
  ]);
  writeFileSync(path.join(mapDir, 'overworld.tmj'), `${JSON.stringify(map, null, 2)}\n`);
}

function dungeon() {
  const width = 18;
  const height = 14;
  const ground = blank(width, height, 'stone');
  const props = blank(width, height, null);
  const blocked = blank(width, height, false);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const edge = x === 0 || y === 0 || x === width - 1 || y === height - 1;
      const mouth = y >= height - 2 && x >= 7 && x <= 10;
      if (edge && !mouth) {
        props[y][x] = 'wall';
        blocked[y][x] = true;
      }
    }
  }
  stampBuilding(props, blocked, 7, 1, 2, 1, 'sealed');
  for (const [x, y] of [
    [4, 5],
    [13, 5],
    [4, 8],
    [13, 8],
  ]) {
    props[y][x] = 'pillar';
    blocked[y][x] = true;
  }
  const map = buildMap(
    'dungeon',
    ground,
    props,
    blocked,
    (rows) => [
      {
        draworder: 'topdown',
        id: 4,
        name: 'triggers',
        objects: [
          polygonObject('to-overworld', 'zone-exit', rectPoints(6.5, 11.3, 11.5, 14), rows, [
            { name: 'targetZone', type: 'string', value: 'overworld' },
            { name: 'targetSpawn', type: 'string', value: 'from-dungeon' },
          ]),
        ],
        opacity: 1,
        type: 'objectgroup',
        visible: true,
        x: 0,
        y: 0,
      },
      {
        draworder: 'topdown',
        id: 5,
        name: 'spawns',
        objects: [pointObject('default', 'spawn', 8.5, 8.5, rows)],
        opacity: 1,
        type: 'objectgroup',
        visible: true,
        x: 0,
        y: 0,
      },
      {
        draworder: 'topdown',
        id: 6,
        name: 'markers',
        objects: [
          pointObject('sealed-door', 'sealed-door', 8.5, 1.8, rows, [
            { name: 'continuesIn', type: 'string', value: 'M5' },
          ]),
        ],
        opacity: 1,
        type: 'objectgroup',
        visible: true,
        x: 0,
        y: 0,
      },
    ],
    [
      { name: 'status', type: 'string', value: 'stub' },
      { name: 'continuesIn', type: 'string', value: 'M5' },
    ],
  );
  writeFileSync(path.join(mapDir, 'dungeon.tmj'), `${JSON.stringify(map, null, 2)}\n`);
}

town();
overworld();
dungeon();
console.log(`wrote ${drawn.length} tiles and 3 maps`);
