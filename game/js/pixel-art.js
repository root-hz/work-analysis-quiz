/**
 * Pixel art assets — LPC / SNES RPG inspired (Zelda: ALttP, CrossCode style)
 */
import * as THREE from 'three';

export const PAL = {
  _: null,
  O: '#1a1c2c', // outline
  S1: '#ffe0bd', S2: '#f5c898', S3: '#c88858', // skin
  H1: '#ffe566', H2: '#c8a020', H3: '#886010', // hair / gold
  A1: '#5b6ee1', A2: '#3a4fc0', A3: '#222c7a', A4: '#8b9cf0', // armor
  C1: '#e45050', C2: '#a82828', C3: '#ff8080', // cape
  W1: '#e8e8f0', W2: '#9898a8', W3: '#686878', // weapon
  G1: '#63c64d', G2: '#3a8c28', G3: '#206018', G4: '#98e878', // grass/slime
  R1: '#ff6622', R2: '#cc4010', R3: '#ffaa44', // lava/fire
  I1: '#88ccff', I2: '#4499dd', I3: '#2266aa', // ice
  P1: '#b066ff', P2: '#7030c0', P3: '#401080', // void boss
  D1: '#888890', D2: '#585860', D3: '#383840', // stone
  K1: '#322125', // shadow
  Y1: '#ffee55', Y2: '#ccaa22', // loot
  E1: '#ff2244', E2: '#aa0022', // enemy eyes
};

function hex(h) {
  const n = parseInt(h.slice(1), 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

function px(ctx, x, y, color, s = 1) {
  if (!color) return;
  ctx.fillStyle = color;
  ctx.fillRect(x * s, y * s, s, s);
}

function drawMap(ctx, rows, s, ox = 0, oy = 0) {
  rows.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      const c = PAL[row[x]] ?? (row[x] === '.' ? null : row[x]);
      if (c) px(ctx, ox + x, oy + y, c, s);
    }
  });
}

// ─── Knight hero (4 directions, walk frame 0/1) ───
const KNIGHT_FRONT = [
  '........OOOO........',
  '.......OHHHHO.......',
  '......OHHHHHHO......',
  '.....OHHHHHHHHO.....',
  '....OAHHHHHHHAO.....',
  '....OASSSSSSSAO.....',
  '....OASSSSSSSAO.....',
  '...OCAASAASSAOC...',
  '...OCAASSSSAAOC...',
  '..OCAAASSSSAAAOC..',
  '..OAAASSSSSSAAAO..',
  '..OAAAWWWWWWAAAO..',
  '..OAAAWWWWWWAAAO..',
  '...OAAWWWWWWAAO...',
  '...OAAWWWWWWAAO...',
  '....OAASAASSAO....',
  '....OAASAASSAO....',
  '.....OASAASSAO.....',
  '.....OASAASSAO.....',
  '......OASOOSAO......',
  '......OASOOSAO......',
  '.......OS..SO.......',
  '.......OS..SO.......',
  '........O..O........',
];

const KNIGHT_BACK = [
  '........OOOO........',
  '.......OHHHHO.......',
  '......OHHHHHHO......',
  '.....OHHHHHHHHO.....',
  '....OCCAAAAACCO.....',
  '....OCCAAAAACCO.....',
  '...OCCAAAAAAACCO...',
  '...OCCAAAAAAACCO...',
  '..OCCAAAAAAAAACCO..',
  '..OCCAAAAAAAAACCO..',
  '..OCCAAAAAAAAACCO..',
  '..OCCAAAAAAAAACCO..',
  '...OCCAAAAAAACCO...',
  '...OCCAAAAAAACCO...',
  '....OCAAAAAAACO....',
  '....OCAAAAAAACO....',
  '.....OCAASACO.....',
  '.....OCAASACO.....',
  '......OCAASACO......',
  '......OCAASACO......',
  '.......OSAASSO.......',
  '.......OSAASSO.......',
  '........OS..SO........',
  '........O....O........',
];

const KNIGHT_SIDE = [
  '........OOOO........',
  '.......OHHHHO.......',
  '......OHHHHHHO......',
  '.....OHHHHHHHHO.....',
  '....OAHSSSSSSO......',
  '....OAHSSSSSSO......',
  '...OCAHSSSSSSO......',
  '...OCAHSSSSSSO......',
  '..OCAAHSSSSSSO......',
  '..OCAAHSSSSSSO......',
  '..OCAAASSSSSSO......',
  '..OCAAAWWWWWWO......',
  '...OCAAWWWWWWWO.....',
  '...OCAAWWWWWWWO.....',
  '....OCAASSSSSO......',
  '....OCAASSSSSO......',
  '.....OCAASSSO.......',
  '.....OCAASSSO.......',
  '......OCAASSO.......',
  '......OCAASSO.......',
  '.......OCAASSO......',
  '.......OCAASSO......',
  '........OCAAO.......',
  '........OCAAO.......',
];

const SLIME = [
  '......OOOO......',
  '....OOGGGGGO....',
  '...OGGGGGGGGO...',
  '..OGGGGGGGGGGO..',
  '.OGGGGGGGGGGGGO.',
  '.OGGEOOOGGGEOOGO.',
  '.OGGEOOOGGGEOOGO.',
  '.OGGGGGGGGGGGGO.',
  '.OGGGGGGGGGGGGO.',
  '..OGGGGGGGGGGO..',
  '...OGGGGGGGGO...',
  '....OOOGGGOOO....',
  '......OOOO......',
];

const SLIME_ELITE = [
  '......OOOO......',
  '....OOYYYYO....',
  '...OYYYYYYYYO...',
  '..OYYYYYYYYYYO..',
  '.OYYYYYYYYYYYYO.',
  '.OYYEOOOYYEOOYO.',
  '.OYYEOOOYYEOOYO.',
  '.OYYYYYYYYYYYYO.',
  '.OYYYYYYYYYYYYO.',
  '..OYYYYYYYYYYO..',
  '...OYYYYYYYYO...',
  '....OOOYYOOO....',
  '......OOOO......',
];

const BOSS = [
  '............OOOOOOOO............',
  '..........OOPPPPPPOO..........',
  '........OOPPPPPPPPPOO........',
  '.......OOPPEOOOOPPEOOPO.......',
  '......OOPPEOOOOPPEOOPPO......',
  '.....OOPPPPPPPPPPPPPPPO.....',
  '....OOPPPPPPPPPPPPPPPPPO....',
  '...OOPPHHHHHHHHHHHHHHHPPO...',
  '..OOPPHHHHHHHHHHHHHHHHHPPO..',
  '..OOPPHHHHHHHHHHHHHHHHHPPO..',
  '.OOPPPHHHHHHHHHHHHHHHHPPPO.',
  '.OOPPPHHHHHHHHHHHHHHHHPPPO.',
  'OOPPPPPHHHHHHHHHHHHHHPPPPPO',
  'OOPPPPPHHHHHHHHHHHHHHPPPPPO',
  'OOPPPPPPPPPPPPPPPPPPPPPPPPO',
  'OOPPPPPPPPPPPPPPPPPPPPPPPPO',
  '.OOPPPPPPPPPPPPPPPPPPPPPPO.',
  '.OOPPPPPPPPPPPPPPPPPPPPPPO.',
  '..OOPPPPPPPPPPPPPPPPPPPPO..',
  '..OOPPPPPPPPPPPPPPPPPPPPO..',
  '...OOPPPPPPPPPPPPPPPPPPO...',
  '...OOPPPPPPPPPPPPPPPPPPO...',
  '....OOPPPPO....OOPPPPO....',
  '....OOPPPPO....OOPPPPO....',
  '.....OOPPO......OOPPO.....',
  '.....OOPPO......OOPPO.....',
  '......OOO........OOO......',
];

const BOSS_FINAL = [
  '............OOOOOOOOOOOO............',
  '..........OOEEREEEEEOOOO..........',
  '........OOEERRRRRRREEOOOO........',
  '.......OOEERREOOOERREEOOOO.......',
  '......OOEERREOOOERREEOOOOO......',
  '.....OOEERRRRRRRRRRREEOOOOO.....',
  '....OOEERRRRRRRRRRRRREEOOOOO....',
  '...OOEERRHHHHHHHHHHRRREEOOOO...',
  '..OOEERRHHHHHHHHHHHHRRREEOOOO..',
  '..OOEERRHHHHHHHHHHHHRRREEOOOO..',
  '.OOEERRRHHHHHHHHHHHHRRREEOOOO.',
  '.OOEERRRHHHHHHHHHHHHRRREEOOOO.',
  'OOEERRRRHHHHHHHHHHHHRRRRREEOOOO',
  'OOEERRRRHHHHHHHHHHHHRRRRREEOOOO',
  'OOEERRRRRRRRRRRRRRRRRRRRREEOOOO',
  'OOEERRRRRRRRRRRRRRRRRRRRREEOOOO',
  '.OOEERRRRRRRRRRRRRRRRRRRREEOOO.',
  '.OOEERRRRRRRRRRRRRRRRRRRREEOOO.',
  '..OOEERRRRRRRRRRRRRRRRRREEOO..',
  '..OOEERRRRRRRRRRRRRRRRRREEOO..',
  '...OOEERRRRO....OOERRRREEOO...',
  '...OOEERRRRO....OOERRRREEOO...',
  '....OOEERRO......OOEERREOO....',
  '....OOEERRO......OOEERREOO....',
  '.....OOERO........OOEREOO.....',
  '.....OOERO........OOEREOO.....',
  '......OOO..........OOOOO......',
];

const TREE = [
  '........OOOO........',
  '......OOGGGGGO......',
  '....OOGGGGGGGGO....',
  '...OGGGGGGGGGGGGO...',
  '..OGGGGGGGGGGGGGGO..',
  '..OGGGGGGGGGGGGGGO..',
  '...OGGGGGGGGGGGGO...',
  '....OOGGGGGGGOOO....',
  '......OODDDDO......',
  '......OODDDDO......',
  '......OODDDDO......',
  '......OOODDDO......',
  '.......OODDDO.......',
  '.......OODDDO.......',
];

const TORCH = [
  '.....OO.....',
  '....ORRRR....',
  '...ORRRRRR...',
  '...ORRRRRR...',
  '....ORRRR....',
  '.....ORR.....',
  '.....ODD.....',
  '.....ODD.....',
  '.....ODD.....',
  '.....ODD.....',
  '....ODDDD....',
];

const CRYSTAL = [
  '.....OO.....',
  '....OIIIO....',
  '...OIIIIIO...',
  '...OIIIIIO...',
  '..OIIIIIIIO..',
  '..OIIIIIIIO..',
  '...OIIIIIO...',
  '....OIIIO....',
  '.....OOO.....',
];

const CHEST = [
  '....OOOO....',
  '...OYYYYO...',
  '...OYHHYO...',
  '...OYYYYO...',
  '...ODDDDDO...',
  '...ODDDDDO...',
  '...ODDDDDO...',
  '....OOOO....',
];

export function makeTextureFromDraw(w, h, drawFn) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  drawFn(ctx, w, h);
  return c;
}

export function canvasToTexture(canvas, repeatX = 1, repeatY = 1) {
  const tex = new THREE.CanvasTexture(canvas);
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeatX, repeatY);
  return tex;
}

export class PixelSprite {
  constructor(drawFn, pixelW, pixelH, worldW, worldH) {
    this.pixelW = pixelW;
    this.pixelH = pixelH;
    this.canvas = makeTextureFromDraw(pixelW, pixelH, drawFn);
    this.ctx = this.canvas.getContext('2d');
    this.ctx.imageSmoothingEnabled = false;
    this.tex = canvasToTexture(this.canvas);
    this.mat = new THREE.SpriteMaterial({ map: this.tex, transparent: true, depthWrite: false });
    this.sprite = new THREE.Sprite(this.mat);
    this.sprite.scale.set(worldW, worldH, 1);
    this.sprite.position.y = worldH * 0.45;

    this.shadow = new THREE.Mesh(
      new THREE.CircleGeometry(worldW * 0.28, 10),
      new THREE.MeshBasicMaterial({ color: 0x322125, transparent: true, opacity: 0.45 })
    );
    this.shadow.rotation.x = -Math.PI / 2;
    this.shadow.position.y = 0.03;

    this.group = new THREE.Group();
    this.group.add(this.shadow);
    this.group.add(this.sprite);
    this.dir = 0;
    this.frame = 0;
    this.kind = 'knight';
    this.scale = 1;
    this.elite = false;
    this.isBoss = false;
    this.isFinal = false;
  }

  setKind(kind, opts = {}) {
    this.kind = kind;
    this.scale = opts.scale ?? 1;
    this.elite = opts.elite ?? false;
    this.isBoss = opts.isBoss ?? false;
    this.isFinal = opts.isFinal ?? false;
    this.redraw();
  }

  setDirection(angle) {
    const deg = ((angle * 180 / Math.PI) + 360) % 360;
    let d;
    if (deg >= 315 || deg < 45) d = 0;
    else if (deg >= 45 && deg < 135) d = 3;
    else if (deg >= 135 && deg < 225) d = 2;
    else d = 1;
    if (d !== this.dir) { this.dir = d; this.redraw(); }
  }

  setWalkFrame(f) {
    const fr = Math.floor(f) % 2;
    if (fr !== this.frame) { this.frame = fr; this.redraw(); }
  }

  redraw() {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.pixelW, this.pixelH);
    const s = this.kind === 'boss' ? 2 : 3;
    let ox = 0, oy = 0;

    if (this.kind === 'knight') {
      const map = this.dir === 2 ? KNIGHT_BACK : this.dir === 1 ? KNIGHT_SIDE : this.dir === 3 ? KNIGHT_SIDE : KNIGHT_FRONT;
      ox = Math.floor((this.pixelW - map[0].length * s) / 2);
      oy = this.pixelH - map.length * s - 4 + (this.frame ? 1 : 0);
      if (this.dir === 1) {
        ctx.save();
        ctx.translate(this.pixelW, 0);
        ctx.scale(-1, 1);
        drawMap(ctx, map, s, ox, oy);
        ctx.restore();
      } else drawMap(ctx, map, s, ox, oy);
    } else if (this.kind === 'slime') {
      const map = this.elite ? SLIME_ELITE : SLIME;
      ox = Math.floor((this.pixelW - map[0].length * s) / 2);
      oy = this.pixelH - map.length * s - 2 + Math.sin(this.frame * Math.PI) * 2;
      drawMap(ctx, map, s, ox, oy);
    } else if (this.kind === 'boss') {
      const map = this.isFinal ? BOSS_FINAL : BOSS;
      const bs = this.isFinal ? 2 : 2;
      ox = Math.floor((this.pixelW - map[0].length * bs) / 2);
      oy = Math.floor((this.pixelH - map.length * bs) / 2);
      drawMap(ctx, map, bs, ox, oy);
    }
    this.tex.needsUpdate = true;
  }
}

export function drawTileGrass(ctx, zone) {
  const pal = zone.tilePal;
  for (let y = 0; y < 16; y++) {
    for (let x = 0; x < 16; x++) {
      const v = (x + y) % 2;
      ctx.fillStyle = v ? pal.light : pal.base;
      ctx.fillRect(x, y, 1, 1);
    }
  }
  // flowers / detail
  const dots = [[3, 5, pal.flower], [11, 3, pal.flower], [8, 12, pal.accent], [13, 9, pal.flower]];
  dots.forEach(([dx, dy, col]) => { ctx.fillStyle = col; ctx.fillRect(dx, dy, 1, 1); ctx.fillRect(dx + 1, dy, 1, 1); });
  // top highlight edge
  ctx.fillStyle = pal.highlight;
  for (let x = 0; x < 16; x++) ctx.fillRect(x, 0, 1, 1);
}

export function drawTileStone(ctx, zone) {
  const p = zone.tilePal;
  ctx.fillStyle = p.base;
  ctx.fillRect(0, 0, 16, 16);
  for (let row = 0; row < 4; row++) {
    const off = row % 2 ? 0 : 4;
    for (let col = 0; col < 3; col++) {
      const bx = off + col * 6;
      const by = row * 4;
      ctx.fillStyle = p.light;
      ctx.fillRect(bx, by, 5, 3);
      ctx.fillStyle = p.dark;
      ctx.fillRect(bx, by + 3, 5, 1);
      ctx.fillRect(bx + 4, by, 1, 4);
    }
  }
}

export function drawTileLava(ctx) {
  ctx.fillStyle = '#281008';
  ctx.fillRect(0, 0, 16, 16);
  for (let i = 0; i < 8; i++) {
    const x = (i * 5 + 2) % 14;
    const y = (i * 3 + 1) % 12;
    ctx.fillStyle = i % 2 ? '#ff6622' : '#ffaa44';
    ctx.fillRect(x, y, 2, 1);
    ctx.fillRect(x + 1, y + 1, 1, 1);
  }
}

export function drawTileIce(ctx) {
  ctx.fillStyle = '#3a5a7a';
  ctx.fillRect(0, 0, 16, 16);
  ctx.fillStyle = '#88ccff';
  ctx.fillRect(0, 0, 16, 1);
  ctx.fillRect(0, 0, 1, 16);
  for (let i = 0; i < 6; i++) {
    ctx.fillStyle = i % 2 ? '#6699cc' : '#aaddff';
    ctx.fillRect(3 + i * 2, 4 + (i % 3) * 3, 2, 2);
  }
}

export function makeZoneTileTexture(zone) {
  const c = document.createElement('canvas');
  c.width = 16;
  c.height = 16;
  const ctx = c.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  const draw = zone.tileType === 'lava' ? drawTileLava
    : zone.tileType === 'ice' ? drawTileIce
    : zone.tileType === 'stone' ? () => drawTileStone(ctx, zone)
    : () => drawTileGrass(ctx, zone);
  draw();
  return canvasToTexture(c, 6, 6);
}

export function makeWallTexture(zone) {
  const c = makeTextureFromDraw(16, 16, (ctx) => drawTileStone(ctx, zone));
  const tex = canvasToTexture(c, 1, 4);
  return tex;
}

export function makeSkyGradient(zone) {
  const c = document.createElement('canvas');
  c.width = 4;
  c.height = 64;
  const ctx = c.getContext('2d');
  const top = hex(zone.skyTop);
  const bot = hex(zone.skyBot);
  for (let y = 0; y < 64; y++) {
    const t = y / 63;
    const r = top.r + (bot.r - top.r) * t;
    const g = top.g + (bot.g - top.g) * t;
    const b = top.b + (bot.b - top.b) * t;
    ctx.fillStyle = `rgb(${r | 0},${g | 0},${b | 0})`;
    ctx.fillRect(0, y, 4, 1);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  return tex;
}

export function createPropSprite(type, zone) {
  const maps = { tree: TREE, torch: TORCH, crystal: CRYSTAL, chest: CHEST };
  const map = maps[type];
  const s = type === 'tree' ? 3 : 2;
  const canvas = makeTextureFromDraw(map[0].length * s + 4, map.length * s + 4, (ctx) => {
    drawMap(ctx, map, s, 2, 2);
  });
  const tex = canvasToTexture(canvas);
  const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false });
  const sp = new THREE.Sprite(mat);
  const wh = type === 'tree' ? [2.2, 3.2] : type === 'crystal' ? [0.9, 1.2] : [0.7, 1.1];
  sp.scale.set(wh[0], wh[1], 1);
  sp.position.y = wh[1] * 0.45;
  return sp;
}

export function createPickupSprite() {
  const canvas = makeTextureFromDraw(20, 20, (ctx) => {
    drawMap(ctx, CHEST, 2, 2, 2);
  });
  const tex = canvasToTexture(canvas);
  const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false });
  const sp = new THREE.Sprite(mat);
  sp.scale.set(0.8, 0.8, 1);
  sp.position.y = 0.5;
  return sp;
}

export const ZONE_VISUALS = [
  { tileType: 'grass', tilePal: { base: '#3a8c28', light: '#63c64d', dark: '#206018', highlight: '#98e878', flower: '#ffee55', accent: '#ff88aa' }, skyTop: '#4a90d9', skyBot: '#1a3020' },
  { tileType: 'lava', tilePal: { base: '#5a2010', light: '#8b3a1a', dark: '#301008' }, skyTop: '#ff6622', skyBot: '#301008' },
  { tileType: 'ice', tilePal: { base: '#3a5a7a', light: '#6699cc', dark: '#2266aa' }, skyTop: '#aaddff', skyBot: '#1a2840' },
  { tileType: 'stone', tilePal: { base: '#484860', light: '#686880', dark: '#282830' }, skyTop: '#6a5a9a', skyBot: '#150a28' },
  { tileType: 'stone', tilePal: { base: '#5a4a20', light: '#8a7a40', dark: '#3a3008' }, skyTop: '#8888cc', skyBot: '#282010' },
  { tileType: 'stone', tilePal: { base: '#4a1a6a', light: '#7030a0', dark: '#280840' }, skyTop: '#cc88ff', skyBot: '#180828' },
  { tileType: 'grass', tilePal: { base: '#7a6a3a', light: '#aa9a5a', dark: '#4a4020', highlight: '#ddcc88', flower: '#ffffff', accent: '#ffee88' }, skyTop: '#ffeeaa', skyBot: '#302818' },
  { tileType: 'lava', tilePal: { base: '#6a1a1a', light: '#aa3030', dark: '#400808' }, skyTop: '#ff8888', skyBot: '#300808' },
  { tileType: 'stone', tilePal: { base: '#8a7a4a', light: '#bbaa6a', dark: '#5a4a2a' }, skyTop: '#ffcc88', skyBot: '#302818' },
  { tileType: 'stone', tilePal: { base: '#3a3a3a', light: '#5a5a5a', dark: '#1a1a1a' }, skyTop: '#884444', skyBot: '#0a0a0a' },
];

export function drawTitleHero(ctx, w, h) {
  ctx.fillStyle = '#1a1c2c';
  ctx.fillRect(0, 0, w, h);
  // stars
  for (let i = 0; i < 40; i++) {
    ctx.fillStyle = i % 3 ? '#ffffff' : '#ffee88';
    ctx.fillRect((i * 17) % w, (i * 23) % h, 1, 1);
  }
  drawMap(ctx, KNIGHT_FRONT, 4, Math.floor(w / 2 - 40), Math.floor(h / 2 - 48));
}
