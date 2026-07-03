import * as THREE from 'three';

const ZONES = [
  { name: '腐化之域', ground: 0x3a5a2a, floor: 0x2a4a1a, accent: 0x5dba5d, sky: 0x1a3020 },
  { name: '熔岩裂隙', ground: 0x8b3a1a, floor: 0x5a2010, accent: 0xff6622, sky: 0x301008 },
  { name: '冰霜回廊', ground: 0x4a6a8a, floor: 0x3a5a7a, accent: 0x88ccff, sky: 0x1a2840 },
  { name: '暗影尖塔', ground: 0x3a2a5a, floor: 0x2a1a4a, accent: 0xaa77ff, sky: 0x150a28 },
  { name: '雷鸣穹顶', ground: 0x5a4a1a, floor: 0x4a3a0a, accent: 0xffdd44, sky: 0x282010 },
  { name: '虚空裂隙', ground: 0x4a1a6a, floor: 0x3a0a5a, accent: 0xcc66ff, sky: 0x180828 },
  { name: '圣光残垣', ground: 0x7a6a3a, floor: 0x5a4a2a, accent: 0xffee66, sky: 0x302818 },
  { name: '龙息巢穴', ground: 0x8a2a2a, floor: 0x6a1a1a, accent: 0xff8888, sky: 0x300808 },
  { name: '时砂之阶', ground: 0x8a7a4a, floor: 0x6a5a3a, accent: 0xffcc66, sky: 0x302818 },
  { name: '终焉之门', ground: 0x3a3a3a, floor: 0x2a2a2a, accent: 0xff4444, sky: 0x0a0a0a },
];

const TOTAL_FLOORS = 10;
const ARENA_SIZE = 24;
const PIXEL_SCALE = 3;

const canvas = document.getElementById('game-canvas');
const viewport = document.getElementById('game-viewport');
const hud = document.getElementById('hud');
const controls = document.getElementById('controls');
const screenTitle = document.getElementById('screen-title');
const screenFloorClear = document.getElementById('screen-floor-clear');
const screenGameover = document.getElementById('screen-gameover');
const screenVictory = document.getElementById('screen-victory');

const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
renderer.setPixelRatio(1);
renderer.shadowMap.enabled = false;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 120);
const clock = new THREE.Clock();

let gameState = 'title';
let currentFloor = 1;
let enemies = [];
let pickups = [];
let particles = [];
let floorMeshes = [];
let bossActive = false;
let attackCooldown = 0;
let dodgeCooldown = 0;
let dodgeTimer = 0;
let invincible = 0;
let floorCleared = false;
let walkAnim = 0;

const player = {
  hp: 100, maxHp: 100,
  lv: 1, exp: 0, expNext: 50,
  str: 10, spd: 10, def: 5, luck: 5,
  rage: 0,
  mesh: null,
  position: new THREE.Vector3(0, 0, 0),
  rotation: 0,
  velocity: new THREE.Vector3(),
};

const keys = {};
const joystick = { active: false, x: 0, y: 0, pointerId: null };
const joystickZone = document.getElementById('joystick-zone');
const joystickBase = document.getElementById('joystick-base');
const joystickStick = document.getElementById('joystick-stick');
let joyCenterX = 0;
let joyCenterY = 0;
const JOY_MAX = 52;

function $(id) { return document.getElementById(id); }

function pixelMat(color, emissive = 0) {
  return new THREE.MeshLambertMaterial({
    color,
    emissive: emissive || color,
    emissiveIntensity: emissive ? 0.15 : 0,
    flatShading: true,
  });
}

function makePixelTexture(c1, c2, size = 16) {
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const ctx = c.getContext('2d');
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      ctx.fillStyle = (x + y) % 2 === 0 ? `#${c1.toString(16).padStart(6, '0')}` : `#${c2.toString(16).padStart(6, '0')}`;
      ctx.fillRect(x, y, 1, 1);
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(8, 8);
  return tex;
}

function addVoxel(group, w, h, d, color, x, y, z) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), pixelMat(color));
  m.position.set(x, y + h / 2, z);
  group.add(m);
  return m;
}

function log(msg) {
  const el = $('combat-log');
  const p = document.createElement('p');
  p.textContent = msg;
  el.prepend(p);
  while (el.children.length > 4) el.lastChild.remove();
}

function floatDamage(text, x, y, cls = 'enemy-hit') {
  const el = document.createElement('div');
  el.className = `damage-float ${cls}`;
  el.textContent = text;
  el.style.left = `${x}px`;
  el.style.top = `${y}px`;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 700);
}

function getViewportRect() {
  return viewport.getBoundingClientRect();
}

function worldToScreen(pos) {
  const v = pos.clone();
  v.y += 1.5;
  v.project(camera);
  const rect = getViewportRect();
  return {
    x: rect.left + (v.x * 0.5 + 0.5) * rect.width,
    y: rect.top + (-v.y * 0.5 + 0.5) * rect.height,
  };
}

function mobCount(floor) { return 2 + Math.floor(floor / 3); }
function bossHp(floor) { return floor >= TOTAL_FLOORS ? 15000 : 1000 + floor * 800; }
function mobHp(floor, elite = false) {
  const b = 30 + floor * 25 + Math.random() * 20;
  return elite ? b * 2.2 : b;
}
function mobAtk(floor) { return 8 + floor * 3 + Math.random() * 4; }

function playerDamage(base = true) {
  const dmg = player.str * (base ? 1.8 : 3.5) - 2;
  const crit = Math.random() < 0.05 + player.luck * 0.005;
  return { val: Math.max(1, Math.round(dmg * (crit ? 2 : 1))), crit };
}

function updateHud() {
  $('hp-fill').style.width = `${(player.hp / player.maxHp) * 100}%`;
  $('hp-text').textContent = `${Math.ceil(player.hp)}/${player.maxHp}`;
  $('stat-lv').textContent = player.lv;
  $('stat-str').textContent = player.str;
  $('stat-spd').textContent = player.spd;
  $('stat-def').textContent = player.def;
  const zone = ZONES[Math.min(currentFloor - 1, ZONES.length - 1)];
  $('floor-badge').textContent = currentFloor >= TOTAL_FLOORS ? 'TOP' : `F${currentFloor}`;
  $('zone-name').textContent = zone.name;
  const alive = enemies.filter(e => e.alive).length;
  $('enemy-count').textContent = bossActive
    ? (alive ? 'BOSS!' : 'CLEAR')
    : `x${alive}`;
  $('rage-fill').style.width = `${player.rage}%`;
  $('btn-skill').disabled = player.rage < 100;
}

function createPlayerMesh() {
  const g = new THREE.Group();
  addVoxel(g, 0.5, 0.5, 0.35, 0xf4a460, 0, 0.5, 0); // head
  addVoxel(g, 0.55, 0.55, 0.55, 0xf4a460, 0, 0.5, 0); // face detail
  addVoxel(g, 0.7, 0.2, 0.75, 0xffd700, 0, 1.05, 0); // helm
  addVoxel(g, 0.6, 0.7, 0.4, 0x4169e1, 0, 0.35, 0); // body
  addVoxel(g, 0.5, 0.6, 0.15, 0xc0392b, 0, 0.35, 0.28); // cape
  addVoxel(g, 0.22, 0.55, 0.22, 0x2c3e80, -0.18, 0, 0); // leg L
  addVoxel(g, 0.22, 0.55, 0.22, 0x2c3e80, 0.18, 0, 0); // leg R
  const sword = addVoxel(g, 0.1, 0.9, 0.12, 0xcccccc, 0.45, 0.45, 0);
  sword.name = 'sword';
  addVoxel(g, 0.18, 0.12, 0.25, 0x8b6914, 0.45, 0.06, 0); // hilt
  return g;
}

function createEnemyMesh(isBoss, color, scale = 1) {
  const g = new THREE.Group();
  const s = scale;
  const dark = new THREE.Color(color).multiplyScalar(0.6).getHex();

  if (isBoss) {
    addVoxel(g, 2 * s, 1.5 * s, 1.5 * s, dark, 0, 0.75 * s, 0);
    addVoxel(g, 1.6 * s, 1.2 * s, 1.2 * s, color, 0, 1.8 * s, 0);
    addVoxel(g, 0.5 * s, 0.8 * s, 0.5 * s, color, -0.7 * s, 2.8 * s, 0);
    addVoxel(g, 0.5 * s, 0.8 * s, 0.5 * s, color, 0.7 * s, 2.8 * s, 0);
    addVoxel(g, 0.3 * s, 0.3 * s, 0.1 * s, 0xff0000, -0.35 * s, 2.1 * s, 0.55 * s);
    addVoxel(g, 0.3 * s, 0.3 * s, 0.1 * s, 0xff0000, 0.35 * s, 2.1 * s, 0.55 * s);
  } else {
    addVoxel(g, 0.9 * s, 0.5 * s, 0.9 * s, dark, 0, 0, 0);
    addVoxel(g, 0.7 * s, 0.6 * s, 0.7 * s, color, 0, 0.55 * s, 0);
    addVoxel(g, 0.15 * s, 0.15 * s, 0.05 * s, 0xffff00, -0.2 * s, 0.7 * s, 0.32 * s);
    addVoxel(g, 0.15 * s, 0.15 * s, 0.05 * s, 0xffff00, 0.2 * s, 0.7 * s, 0.32 * s);
  }

  const barY = (isBoss ? 3.6 : 1.4) * s;
  const barBg = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 0.14), new THREE.MeshBasicMaterial({ color: 0x222222 }));
  barBg.position.y = barY;
  barBg.name = 'hpBarBg';
  g.add(barBg);
  const barFill = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 0.1), new THREE.MeshBasicMaterial({ color: 0xff0044 }));
  barFill.position.set(0, barY, 0.01);
  barFill.name = 'hpBarFill';
  g.add(barFill);
  return g;
}

function spawnParticle(pos, color, count = 6) {
  for (let i = 0; i < count; i++) {
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(0.15, 0.15, 0.15),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 1 })
    );
    mesh.position.copy(pos);
    mesh.position.y += 0.8;
    particles.push({
      mesh,
      vel: new THREE.Vector3((Math.random() - 0.5) * 5, Math.random() * 4 + 1, (Math.random() - 0.5) * 5),
      life: 0.5 + Math.random() * 0.3,
    });
    scene.add(mesh);
  }
}

function clearFloor() {
  floorMeshes.forEach(m => scene.remove(m));
  floorMeshes = [];
  enemies.forEach(e => scene.remove(e.mesh));
  enemies = [];
  pickups.forEach(p => scene.remove(p.mesh));
  pickups = [];
  bossActive = false;
  floorCleared = false;
}

function buildFloor(floor) {
  clearFloor();
  const zone = ZONES[Math.min(floor - 1, ZONES.length - 1)];
  scene.background = new THREE.Color(zone.sky);
  scene.fog = new THREE.Fog(zone.sky, 18, 55);

  const tex = makePixelTexture(zone.ground, zone.floor);
  const ground = new THREE.Mesh(
    new THREE.BoxGeometry(ARENA_SIZE * 2, 0.5, ARENA_SIZE * 2),
    new THREE.MeshLambertMaterial({ map: tex, flatShading: true })
  );
  ground.position.y = -0.25;
  scene.add(ground);
  floorMeshes.push(ground);

  const wallMat = pixelMat(zone.floor);
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const pillar = new THREE.Mesh(new THREE.BoxGeometry(1.2, 3, 1.2), wallMat);
    pillar.position.set(Math.cos(a) * (ARENA_SIZE - 1), 1.5, Math.sin(a) * (ARENA_SIZE - 1));
    scene.add(pillar);
    floorMeshes.push(pillar);
  }

  const stairs = new THREE.Mesh(new THREE.BoxGeometry(2.5, 0.4, 2.5), pixelMat(zone.accent, zone.accent));
  stairs.position.set(0, 0.2, -ARENA_SIZE + 3);
  stairs.name = 'stairs';
  stairs.visible = false;
  scene.add(stairs);
  floorMeshes.push(stairs);

  for (let i = 0; i < 5; i++) {
    const gem = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.6, 0.6), pixelMat(zone.accent, zone.accent));
    const a = Math.random() * Math.PI * 2;
    gem.position.set(Math.cos(a) * (6 + Math.random() * 8), 0.3, Math.sin(a) * (6 + Math.random() * 8));
    scene.add(gem);
    floorMeshes.push(gem);
  }

  if (!scene.userData.lit) {
    scene.add(new THREE.AmbientLight(0xffffff, 0.85));
    const sun = new THREE.DirectionalLight(0xffffff, 0.6);
    sun.position.set(10, 20, 8);
    scene.add(sun);
    scene.userData.lit = true;
  }

  spawnMobs(floor);
  player.position.set(0, 0, ARENA_SIZE - 5);
  if (player.mesh) {
    player.mesh.position.copy(player.position);
    player.mesh.rotation.y = player.rotation;
  }
}

function spawnMobs(floor) {
  const zone = ZONES[Math.min(floor - 1, ZONES.length - 1)];
  const count = mobCount(floor);
  for (let i = 0; i < count; i++) {
    const elite = Math.random() < 0.15;
    const a = Math.random() * Math.PI * 2;
    const r = 3 + Math.random() * (ARENA_SIZE - 7);
    const mesh = createEnemyMesh(false, elite ? 0xffd700 : zone.accent, elite ? 1.25 : 1);
    mesh.position.set(Math.cos(a) * r, 0, Math.sin(a) * r);
    scene.add(mesh);
    const hp = mobHp(floor, elite);
    enemies.push({ mesh, alive: true, isBoss: false, isElite: elite, hp, maxHp: hp, atk: mobAtk(floor), atkCd: 0, speed: 2.8 + floor * 0.18 });
  }
  log(`${zone.name} ${count}怪`);
}

function spawnBoss(floor) {
  bossActive = true;
  const zone = ZONES[Math.min(floor - 1, ZONES.length - 1)];
  const isFinal = floor >= TOTAL_FLOORS;
  const mesh = createEnemyMesh(true, isFinal ? 0xff0044 : zone.accent, isFinal ? 1.8 : 1.3);
  mesh.position.set(0, 0, -4);
  scene.add(mesh);
  const hp = bossHp(floor);
  enemies.push({ mesh, alive: true, isBoss: true, isFinal, hp, maxHp: hp, atk: 12 + floor * 5, atkCd: 0, speed: 2.2 + floor * 0.1, phase: 1, summonCd: 3 });
  log(isFinal ? '塔顶BOSS!' : `F${floor} BOSS!`);
  updateHud();
}

function updateEnemyHpBar(enemy) {
  const fill = enemy.mesh.getObjectByName('hpBarFill');
  if (fill) {
    const r = enemy.hp / enemy.maxHp;
    fill.scale.x = Math.max(0.01, r);
    fill.position.x = -(1.4 * (1 - r)) / 2;
  }
}

function dealDamageToEnemy(enemy, dmg, isCrit) {
  if (!enemy.alive) return;
  enemy.hp -= dmg;
  updateEnemyHpBar(enemy);
  spawnParticle(enemy.mesh.position, enemy.isBoss ? 0xff0044 : 0xffd700, isCrit ? 10 : 4);
  const scr = worldToScreen(enemy.mesh.position);
  floatDamage(isCrit ? `${dmg}!` : `${dmg}`, scr.x, scr.y, isCrit ? 'crit' : 'enemy-hit');

  if (enemy.hp <= 0) {
    enemy.alive = false;
    enemy.mesh.visible = false;
    player.rage = Math.min(100, player.rage + (enemy.isBoss ? 40 : 10));
    gainExp(enemy.isBoss ? 80 + currentFloor * 20 : 15 + currentFloor * 3);
    if (!enemy.isBoss && Math.random() < 0.08 + player.luck * 0.005) spawnPickup(enemy.mesh.position.clone());
    if (enemy.isBoss) onBossDefeated();
    else checkAllMobsDead();
  }
  updateHud();
}

function checkAllMobsDead() {
  if (enemies.filter(e => e.alive && !e.isBoss).length === 0 && !bossActive) {
    log('BOSS来咯');
    setTimeout(() => spawnBoss(currentFloor), 1000);
  }
}

function onBossDefeated() {
  if (floorCleared) return;
  floorCleared = true;
  const stairs = floorMeshes.find(m => m.name === 'stairs');
  if (stairs) stairs.visible = true;
  if (currentFloor >= TOTAL_FLOORS) { setTimeout(showVictory, 1200); return; }

  $('floor-clear-title').textContent = `F${currentFloor} CLEAR!`;
  $('floor-clear-reward').textContent = `EXP+${80 + currentFloor * 20} GOLD+${50 + currentFloor * 10}`;
  const blessEl = $('blessing-choices');
  blessEl.innerHTML = '';
  if (currentFloor % 5 === 0) {
    blessEl.classList.remove('hidden');
    [
      { label: 'ATK+3', fn: () => { player.str += 3; } },
      { label: 'SPD+3', fn: () => { player.spd += 3; } },
      { label: 'HP+30', fn: () => { player.hp = Math.min(player.maxHp, player.hp + 30); } },
    ].forEach(o => {
      const btn = document.createElement('button');
      btn.className = 'bless-btn';
      btn.textContent = o.label;
      btn.onclick = () => { o.fn(); updateHud(); };
      blessEl.appendChild(btn);
    });
  } else blessEl.classList.add('hidden');

  gameState = 'floor_clear';
  screenFloorClear.classList.remove('hidden');
}

function gainExp(n) {
  player.exp += n;
  while (player.exp >= player.expNext) {
    player.exp -= player.expNext;
    player.lv++;
    player.str++; player.spd++; player.def++; player.luck++;
    player.expNext = Math.floor(player.expNext * 1.3);
    log(`LV UP! ${player.lv}`);
  }
}

function spawnPickup(pos) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.4, 0.4), pixelMat(0x41a6f6, 0x41a6f6));
  mesh.position.copy(pos);
  mesh.position.y = 0.4;
  scene.add(mesh);
  pickups.push({ mesh, bob: Math.random() * 6.28 });
}

function playerAttack(isUlt = false) {
  if (attackCooldown > 0 && !isUlt) return;
  attackCooldown = isUlt ? 0.7 : Math.max(0.18, 0.45 - player.spd * 0.015);
  const sword = player.mesh?.getObjectByName('sword');
  if (sword) { sword.rotation.z = -1; setTimeout(() => { sword.rotation.z = 0; }, 120); }

  const range = isUlt ? 5.5 : 2.6;
  const fwd = new THREE.Vector3(Math.sin(player.rotation), 0, Math.cos(player.rotation));
  enemies.forEach(enemy => {
    if (!enemy.alive) return;
    const to = enemy.mesh.position.clone().sub(player.position);
    to.y = 0;
    const dist = to.length();
    if (dist > range) return;
    to.normalize();
    if (fwd.dot(to) > (isUlt ? -0.1 : 0.25)) {
      const { val, crit } = playerDamage(!isUlt);
      dealDamageToEnemy(enemy, Math.round((isUlt ? val * 3 : val) * (enemy.isBoss ? 1.15 : 1)), crit || isUlt);
    }
  });
  if (isUlt) { player.rage = 0; spawnParticle(player.position, 0xffd700, 16); log('必杀!'); }
  else player.rage = Math.min(100, player.rage + 5);
  updateHud();
}

function playerDodge() {
  if (dodgeCooldown > 0) return;
  dodgeCooldown = Math.max(0.6, 1.2 - player.spd * 0.025);
  dodgeTimer = 0.22;
  invincible = 0.28;
  const fwd = new THREE.Vector3(Math.sin(player.rotation), 0, Math.cos(player.rotation));
  player.velocity.copy(fwd.multiplyScalar(14));
}

function damagePlayer(amount) {
  if (invincible > 0 || dodgeTimer > 0) return;
  const reduced = Math.max(1, amount - player.def * 0.5);
  player.hp -= reduced;
  player.rage = Math.min(100, player.rage + 8);
  invincible = 0.35;
  spawnParticle(player.position, 0xff0044, 5);
  const scr = worldToScreen(player.position);
  floatDamage(`-${Math.round(reduced)}`, scr.x, scr.y, 'player-hit');
  updateHud();
  if (player.hp <= 0) { player.hp = 0; showGameover(); }
}

function startGame() {
  currentFloor = 1;
  Object.assign(player, { hp: 100, maxHp: 100, lv: 1, exp: 0, expNext: 50, str: 10, spd: 10, def: 5, luck: 5, rage: 0 });
  if (!player.mesh) { player.mesh = createPlayerMesh(); scene.add(player.mesh); }
  screenTitle.classList.add('hidden');
  screenGameover.classList.add('hidden');
  screenVictory.classList.add('hidden');
  screenFloorClear.classList.add('hidden');
  hud.classList.remove('hidden');
  controls.classList.remove('hidden');
  gameState = 'playing';
  buildFloor(currentFloor);
  updateHud();
  updateJoyCenter();
}

function nextFloor() {
  screenFloorClear.classList.add('hidden');
  currentFloor++;
  if (currentFloor > TOTAL_FLOORS) { showVictory(); return; }
  gameState = 'playing';
  buildFloor(currentFloor);
  updateHud();
}

function restAtCamp() {
  player.hp = Math.min(player.maxHp, player.hp + 30);
  updateHud();
  nextFloor();
}

function showGameover() {
  gameState = 'gameover';
  $('gameover-floor').textContent = `F${currentFloor} Lv${player.lv}`;
  screenGameover.classList.remove('hidden');
}

function showVictory() {
  gameState = 'victory';
  hud.classList.add('hidden');
  controls.classList.add('hidden');
  screenVictory.classList.remove('hidden');
}

function getMoveInput() {
  let mx = 0, mz = 0;
  if (joystick.active) { mx = joystick.x; mz = joystick.y; }
  if (keys['KeyW'] || keys['ArrowUp']) mz -= 1;
  if (keys['KeyS'] || keys['ArrowDown']) mz += 1;
  if (keys['KeyA'] || keys['ArrowLeft']) mx -= 1;
  if (keys['KeyD'] || keys['ArrowRight']) mx += 1;
  return new THREE.Vector2(mx, mz);
}

function updatePlayer(dt) {
  if (gameState !== 'playing') return;
  attackCooldown = Math.max(0, attackCooldown - dt);
  dodgeCooldown = Math.max(0, dodgeCooldown - dt);
  dodgeTimer = Math.max(0, dodgeTimer - dt);
  invincible = Math.max(0, invincible - dt);

  const move = getMoveInput();
  const speed = 9 + player.spd * 0.2;

  if (move.lengthSq() > 0.01) {
    move.normalize();
    player.rotation = Math.atan2(move.x, move.y);
    player.velocity.x = move.x * speed;
    player.velocity.z = move.y * speed;
    walkAnim += dt * 12;
  } else if (dodgeTimer <= 0) {
    player.velocity.multiplyScalar(0.8);
  }

  player.position.x += player.velocity.x * dt;
  player.position.z += player.velocity.z * dt;
  const lim = ARENA_SIZE - 2;
  player.position.x = THREE.MathUtils.clamp(player.position.x, -lim, lim);
  player.position.z = THREE.MathUtils.clamp(player.position.z, -lim, lim);

  player.mesh.position.copy(player.position);
  player.mesh.rotation.y = player.rotation;
  if (player.mesh.children[4]) player.mesh.children[4].position.y = 0.35 + Math.sin(walkAnim) * 0.04;

  if (invincible > 0 && player.mesh) player.mesh.visible = Math.floor(invincible * 20) % 2 === 0;
  else if (player.mesh) player.mesh.visible = true;

  pickups.forEach((p, i) => {
    p.bob += dt * 4;
    p.mesh.position.y = 0.4 + Math.sin(p.bob) * 0.1;
    p.mesh.rotation.y += dt * 3;
    if (p.mesh.position.distanceTo(player.position) < 1.4) {
      const k = ['str', 'spd', 'def', 'luck'][Math.floor(Math.random() * 4)];
      player[k] += 2;
      player.hp = Math.min(player.maxHp, player.hp + 10);
      log('装备+');
      scene.remove(p.mesh);
      pickups.splice(i, 1);
      updateHud();
    }
  });
}

function updateEnemies(dt) {
  if (gameState !== 'playing') return;
  enemies.forEach(enemy => {
    if (!enemy.alive) return;
    enemy.mesh.getObjectByName('hpBarBg')?.lookAt(camera.position);
    enemy.mesh.getObjectByName('hpBarFill')?.lookAt(camera.position);
    const to = player.position.clone().sub(enemy.mesh.position);
    to.y = 0;
    const dist = to.length();
    if (dist < 0.4) return;
    to.normalize();
    enemy.mesh.rotation.y = Math.atan2(to.x, to.z);
    if (dist > (enemy.isBoss ? 2.2 : 1.0)) enemy.mesh.position.add(to.multiplyScalar(enemy.speed * dt));

    enemy.atkCd -= dt;
    if (dist < (enemy.isBoss ? 3.2 : 1.6) && enemy.atkCd <= 0) {
      enemy.atkCd = enemy.isBoss ? 1.0 : 1.3 + Math.random() * 0.4;
      damagePlayer(enemy.atk * (enemy.isBoss ? 1.3 : 1));
      if (enemy.isBoss && !enemy.isFinal) {
        enemy.summonCd = (enemy.summonCd || 3) - dt;
        if (enemy.summonCd <= 0) {
          enemy.summonCd = 5;
          const mesh = createEnemyMesh(false, 0xff6622);
          mesh.position.copy(enemy.mesh.position);
          mesh.position.x += 1.5;
          scene.add(mesh);
          const hp = mobHp(currentFloor) * 0.5;
          enemies.push({ mesh, alive: true, isBoss: false, hp, maxHp: hp, atk: mobAtk(currentFloor) * 0.7, atkCd: 1, speed: 3.2 });
        }
      }
      if (enemy.isFinal) {
        const r = enemy.hp / enemy.maxHp;
        if (r < 0.3 && enemy.phase < 3) { enemy.phase = 3; enemy.atk *= 1.5; log('P3!'); }
        else if (r < 0.6 && enemy.phase < 2) { enemy.phase = 2; enemy.atk *= 1.3; log('P2!'); }
      }
    }
  });
  updateHud();
}

function updateParticles(dt) {
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.life -= dt;
    p.mesh.position.addScaledVector(p.vel, dt);
    p.vel.y -= 12 * dt;
    p.mesh.material.opacity = Math.max(0, p.life);
    if (p.life <= 0) { scene.remove(p.mesh); particles.splice(i, 1); }
  }
}

function updateCamera() {
  if (!player.mesh) return;
  const dist = 7.5;
  const height = 8;
  const off = new THREE.Vector3(-Math.sin(player.rotation) * dist, height, -Math.cos(player.rotation) * dist);
  const target = player.position.clone();
  target.y += 1.2;
  camera.position.lerp(target.clone().add(off), 0.1);
  camera.lookAt(target.x, target.y - 0.3, target.z);
}

function resize() {
  const w = viewport.clientWidth;
  const h = viewport.clientHeight;
  if (w === 0 || h === 0) return;
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.setSize(Math.floor(w / PIXEL_SCALE), Math.floor(h / PIXEL_SCALE), false);
  canvas.style.width = `${w}px`;
  canvas.style.height = `${h}px`;
}

function updateJoyCenter() {
  const rect = joystickBase.getBoundingClientRect();
  joyCenterX = rect.left + rect.width / 2;
  joyCenterY = rect.top + rect.height / 2;
}

function setJoystick(dx, dy) {
  const dist = Math.sqrt(dx * dx + dy * dy);
  if (dist > JOY_MAX) { dx = (dx / dist) * JOY_MAX; dy = (dy / dist) * JOY_MAX; }
  joystick.x = dx / JOY_MAX;
  joystick.y = dy / JOY_MAX;
  joystickStick.style.transform = `translate(${dx}px, ${dy}px)`;
}

function resetJoystick() {
  joystick.active = false;
  joystick.x = 0;
  joystick.y = 0;
  joystick.pointerId = null;
  joystickStick.style.transform = 'translate(0, 0)';
}

function setupJoystick() {
  function onStart(e) {
    if (gameState !== 'playing') return;
    e.preventDefault();
    updateJoyCenter();
    const pt = e.changedTouches ? e.changedTouches[0] : e;
    joystick.pointerId = pt.identifier ?? 1;
    joystick.active = true;
    setJoystick(pt.clientX - joyCenterX, pt.clientY - joyCenterY);
  }

  function onMove(e) {
    if (!joystick.active) return;
    e.preventDefault();
    let pt = e;
    if (e.changedTouches || e.touches) {
      const list = e.touches.length ? e.touches : e.changedTouches;
      pt = Array.from(list).find(t => t.identifier === joystick.pointerId) || list[0];
    }
    setJoystick(pt.clientX - joyCenterX, pt.clientY - joyCenterY);
  }

  function onEnd(e) {
    if (!joystick.active) return;
    if (e.changedTouches) {
      const ended = Array.from(e.changedTouches).some(t => t.identifier === joystick.pointerId);
      if (!ended && e.touches.length > 0) return;
    }
    resetJoystick();
  }

  joystickZone.addEventListener('touchstart', onStart, { passive: false });
  joystickZone.addEventListener('touchmove', onMove, { passive: false });
  joystickZone.addEventListener('touchend', onEnd);
  joystickZone.addEventListener('touchcancel', onEnd);
  joystickZone.addEventListener('mousedown', onStart);
  window.addEventListener('mousemove', onMove);
  window.addEventListener('mouseup', onEnd);
}

function setupButtons() {
  const bind = (el, fn) => {
    el.addEventListener('touchstart', e => { e.preventDefault(); fn(); }, { passive: false });
    el.addEventListener('click', e => { e.preventDefault(); fn(); });
  };
  $('btn-start').onclick = startGame;
  $('btn-retry').onclick = startGame;
  $('btn-victory-restart').onclick = () => {
    screenVictory.classList.add('hidden');
    hud.classList.remove('hidden');
    controls.classList.remove('hidden');
    startGame();
  };
  $('btn-next-floor').onclick = nextFloor;
  $('btn-rest').onclick = restAtCamp;
  bind($('btn-attack'), () => playerAttack(false));
  bind($('btn-skill'), () => { if (player.rage >= 100) playerAttack(true); });
  bind($('btn-dodge'), () => playerDodge());

  window.addEventListener('keydown', e => {
    keys[e.code] = true;
    if (e.code === 'Space') { playerAttack(false); e.preventDefault(); }
    if (e.code === 'ShiftLeft') playerDodge();
    if (e.code === 'KeyQ' && player.rage >= 100) playerAttack(true);
  });
  window.addEventListener('keyup', e => { keys[e.code] = false; });
}

setupJoystick();
setupButtons();
window.addEventListener('resize', () => { resize(); updateJoyCenter(); });
new ResizeObserver(() => { resize(); updateJoyCenter(); }).observe(viewport);
resize();
updateJoyCenter();
animate();

function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.05);
  updatePlayer(dt);
  updateEnemies(dt);
  updateParticles(dt);
  updateCamera();
  renderer.render(scene, camera);
}
