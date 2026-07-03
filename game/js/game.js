import * as THREE from 'three';
import {
  PixelSprite, ZONE_VISUALS, makeZoneTileTexture, makeWallTexture,
  makeSkyGradient, createPropSprite, createPickupSprite, drawTitleHero,
} from './pixel-art.js';

const ZONES = [
  { name: '腐化之域' }, { name: '熔岩裂隙' }, { name: '冰霜回廊' }, { name: '暗影尖塔' },
  { name: '雷鸣穹顶' }, { name: '虚空裂隙' }, { name: '圣光残垣' }, { name: '龙息巢穴' },
  { name: '时砂之阶' }, { name: '终焉之门' },
].map((z, i) => ({ ...z, ...ZONE_VISUALS[i] }));

const TOTAL_FLOORS = 10;
const ARENA_SIZE = 24;
const PIXEL_SCALE = 2;

const canvas = document.getElementById('game-canvas');
const viewport = document.getElementById('game-viewport');
const hud = document.getElementById('hud');
const controls = document.getElementById('controls');
const screenTitle = document.getElementById('screen-title');
const screenFloorClear = document.getElementById('screen-floor-clear');
const screenGameover = document.getElementById('screen-gameover');
const screenVictory = document.getElementById('screen-victory');

const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: false, powerPreference: 'high-performance' });
renderer.setPixelRatio(1);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(48, 1, 0.1, 100);
const clock = new THREE.Clock();

let gameState = 'title';
let currentFloor = 1;
let enemies = [];
let pickups = [];
let particles = [];
let floorMeshes = [];
let propLights = [];
let bossActive = false;
let attackCooldown = 0;
let dodgeCooldown = 0;
let dodgeTimer = 0;
let invincible = 0;
let floorCleared = false;
let walkAnim = 0;
let skyMesh = null;

const player = {
  hp: 100, maxHp: 100,
  lv: 1, exp: 0, expNext: 50,
  str: 10, spd: 10, def: 5, luck: 5,
  rage: 0,
  sprite: null,
  position: new THREE.Vector3(0, 0, 0),
  rotation: 0,
  velocity: new THREE.Vector3(),
};

const keys = {};
const joystick = { active: false, x: 0, y: 0, pointerId: null };
const joystickZone = document.getElementById('joystick-zone');
const joystickBase = document.getElementById('joystick-base');
const joystickStick = document.getElementById('joystick-stick');
let joyCenterX = 0, joyCenterY = 0;
const JOY_MAX = 52;

function $(id) { return document.getElementById(id); }

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

function getViewportRect() { return viewport.getBoundingClientRect(); }

function worldToScreen(pos) {
  const v = pos.clone();
  v.y += 1.2;
  v.project(camera);
  const rect = getViewportRect();
  return {
    x: rect.left + (v.x * 0.5 + 0.5) * rect.width,
    y: rect.top + (-v.y * 0.5 + 0.5) * rect.height,
  };
}

function mobCount(f) { return 2 + Math.floor(f / 3); }
function bossHp(f) { return f >= TOTAL_FLOORS ? 15000 : 1000 + f * 800; }
function mobHp(f, elite = false) { const b = 30 + f * 25 + Math.random() * 20; return elite ? b * 2.2 : b; }
function mobAtk(f) { return 8 + f * 3 + Math.random() * 4; }

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
  $('enemy-count').textContent = bossActive ? (alive ? 'BOSS!' : 'CLEAR') : `x${alive}`;
  $('rage-fill').style.width = `${player.rage}%`;
  $('btn-skill').disabled = player.rage < 100;
}

function createPlayerSprite() {
  const ps = new PixelSprite(() => {}, 72, 80, 2.4, 2.7);
  ps.setKind('knight');
  return ps;
}

function createEnemySprite(isBoss, isFinal, elite) {
  if (isBoss) {
    const ps = new PixelSprite(() => {}, isFinal ? 128 : 96, isFinal ? 108 : 84, isFinal ? 5 : 3.8, isFinal ? 4.2 : 3.3);
    ps.setKind('boss', { isBoss: true, isFinal });
    return ps;
  }
  const ps = new PixelSprite(() => {}, 54, 48, elite ? 1.5 : 1.25, elite ? 1.35 : 1.15);
  ps.setKind('slime', { elite });
  return ps;
}

function spawnPixelParticle(pos, color, count = 6) {
  for (let i = 0; i < count; i++) {
    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(0.18, 0.18),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 1, side: THREE.DoubleSide })
    );
    mesh.position.copy(pos);
    mesh.position.y += 0.8 + Math.random() * 0.5;
    mesh.rotation.set(Math.random(), Math.random(), Math.random());
    particles.push({
      mesh, vel: new THREE.Vector3((Math.random() - 0.5) * 4, Math.random() * 3 + 1.5, (Math.random() - 0.5) * 4),
      life: 0.45 + Math.random() * 0.25, spin: (Math.random() - 0.5) * 8,
    });
    scene.add(mesh);
  }
}

function clearFloor() {
  floorMeshes.forEach(m => scene.remove(m));
  propLights.forEach(l => scene.remove(l));
  floorMeshes = [];
  propLights = [];
  enemies.forEach(e => scene.remove(e.sprite.group));
  enemies = [];
  pickups.forEach(p => scene.remove(p.group));
  pickups = [];
  bossActive = false;
  floorCleared = false;
}

function updateSky(zone) {
  if (skyMesh) scene.remove(skyMesh);
  const tex = makeSkyGradient(zone);
  skyMesh = new THREE.Mesh(
    new THREE.SphereGeometry(55, 16, 12),
    new THREE.MeshBasicMaterial({ map: tex, side: THREE.BackSide, fog: false })
  );
  scene.add(skyMesh);
  floorMeshes.push(skyMesh);
  scene.background = new THREE.Color(zone.skyBot);
  scene.fog = new THREE.Fog(zone.skyBot, 22, 52);
}

function buildFloor(floor) {
  clearFloor();
  const zone = ZONES[Math.min(floor - 1, ZONES.length - 1)];
  updateSky(zone);

  const floorTex = makeZoneTileTexture(zone);
  const ground = new THREE.Mesh(
    new THREE.BoxGeometry(ARENA_SIZE * 2, 0.4, ARENA_SIZE * 2),
    new THREE.MeshLambertMaterial({ map: floorTex, flatShading: true })
  );
  ground.position.y = -0.2;
  ground.receiveShadow = true;
  scene.add(ground);
  floorMeshes.push(ground);

  // Decorative border path (darker ring)
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(ARENA_SIZE - 2.5, ARENA_SIZE - 0.5, 32),
    new THREE.MeshBasicMaterial({ color: 0x322125, transparent: true, opacity: 0.35, side: THREE.DoubleSide })
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.02;
  scene.add(ring);
  floorMeshes.push(ring);

  const wallTex = makeWallTexture(zone);
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2;
    const pillar = new THREE.Mesh(new THREE.BoxGeometry(1.4, 3.2, 1.4), new THREE.MeshLambertMaterial({ map: wallTex, flatShading: true }));
    pillar.position.set(Math.cos(a) * (ARENA_SIZE - 1.2), 1.6, Math.sin(a) * (ARENA_SIZE - 1.2));
    scene.add(pillar);
    floorMeshes.push(pillar);
    // cap
    const cap = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.3, 1.6), new THREE.MeshLambertMaterial({ color: 0x322125, flatShading: true }));
    cap.position.set(pillar.position.x, 3.35, pillar.position.z);
    scene.add(cap);
    floorMeshes.push(cap);
  }

  const stairMat = new THREE.MeshLambertMaterial({ color: 0xffee55, emissive: 0xffaa22, emissiveIntensity: 0.35, flatShading: true });
  const stairs = new THREE.Mesh(new THREE.BoxGeometry(2.8, 0.35, 2.8), stairMat);
  stairs.position.set(0, 0.18, -ARENA_SIZE + 3);
  stairs.name = 'stairs';
  stairs.visible = false;
  scene.add(stairs);
  floorMeshes.push(stairs);

  // Props
  const propTypes = zone.tileType === 'grass' ? ['tree', 'tree', 'crystal']
    : zone.tileType === 'lava' ? ['torch', 'torch', 'crystal']
    : ['crystal', 'torch', 'crystal'];
  for (let i = 0; i < 7; i++) {
    const type = propTypes[i % propTypes.length];
    const sp = createPropSprite(type, zone);
    const a = (i / 7) * Math.PI * 2 + 0.3;
    const r = 7 + (i % 3) * 3;
    sp.position.set(Math.cos(a) * r, 0, Math.sin(a) * r);
    scene.add(sp);
    floorMeshes.push(sp);
    if (type === 'torch') {
      const light = new THREE.PointLight(0xff8833, 0.8, 8);
      light.position.set(sp.position.x, 1.2, sp.position.z);
      scene.add(light);
      propLights.push(light);
    }
  }

  if (!scene.userData.lit) {
    scene.add(new THREE.HemisphereLight(zone.skyTop, zone.skyBot, 0.65));
    const sun = new THREE.DirectionalLight(0xffeedd, 0.55);
    sun.position.set(8, 18, 6);
    scene.add(sun);
    scene.userData.lit = true;
  }

  spawnMobs(floor);
  player.position.set(0, 0, ARENA_SIZE - 5);
  if (player.sprite) {
    player.sprite.group.position.copy(player.position);
    player.sprite.setDirection(player.rotation);
  }
}

function spawnMobs(floor) {
  const zone = ZONES[Math.min(floor - 1, ZONES.length - 1)];
  const count = mobCount(floor);
  for (let i = 0; i < count; i++) {
    const elite = Math.random() < 0.15;
    const a = Math.random() * Math.PI * 2;
    const r = 3 + Math.random() * (ARENA_SIZE - 7);
    const sprite = createEnemySprite(false, false, elite);
    sprite.group.position.set(Math.cos(a) * r, 0, Math.sin(a) * r);
    scene.add(sprite.group);
    const hp = mobHp(floor, elite);
    enemies.push({ sprite, alive: true, isBoss: false, isElite: elite, hp, maxHp: hp, atk: mobAtk(floor), atkCd: 0, speed: 2.8 + floor * 0.18 });
  }
  log(`${zone.name} · ${count}怪`);
}

function spawnBoss(floor) {
  bossActive = true;
  const isFinal = floor >= TOTAL_FLOORS;
  const sprite = createEnemySprite(true, isFinal, false);
  sprite.group.position.set(0, 0, -4);
  scene.add(sprite.group);
  const hp = bossHp(floor);
  enemies.push({ sprite, alive: true, isBoss: true, isFinal, hp, maxHp: hp, atk: 12 + floor * 5, atkCd: 0, speed: 2.2 + floor * 0.1, phase: 1, summonCd: 3 });
  log(isFinal ? '塔顶BOSS!' : `F${floor} BOSS!`);
  updateHud();
}

function updateHpBar(enemy) {
  // pixel sprites use floating HTML bar instead — draw under sprite via scale on shadow
  const ratio = enemy.hp / enemy.maxHp;
  enemy.sprite.shadow.scale.setScalar((enemy.isBoss ? 1.8 : 1) * (0.4 + ratio * 0.6));
  enemy.sprite.shadow.material.opacity = 0.25 + ratio * 0.25;
}

function dealDamageToEnemy(enemy, dmg, isCrit) {
  if (!enemy.alive) return;
  enemy.hp -= dmg;
  updateHpBar(enemy);
  spawnPixelParticle(enemy.sprite.group.position, isCrit ? 0xff6622 : 0xffee55, isCrit ? 10 : 5);
  enemy.sprite.sprite.position.y += 0.08;
  setTimeout(() => { if (enemy.sprite) enemy.sprite.sprite.position.y = enemy.sprite.sprite.scale.y * 0.45; }, 80);
  const scr = worldToScreen(enemy.sprite.group.position);
  floatDamage(isCrit ? `${dmg}!` : `${dmg}`, scr.x, scr.y, isCrit ? 'crit' : 'enemy-hit');

  if (enemy.hp <= 0) {
    enemy.alive = false;
    enemy.sprite.group.visible = false;
    player.rage = Math.min(100, player.rage + (enemy.isBoss ? 40 : 10));
    gainExp(enemy.isBoss ? 80 + currentFloor * 20 : 15 + currentFloor * 3);
    if (!enemy.isBoss && Math.random() < 0.08 + player.luck * 0.005) spawnPickup(enemy.sprite.group.position.clone());
    if (enemy.isBoss) onBossDefeated();
    else checkAllMobsDead();
  }
  updateHud();
}

function checkAllMobsDead() {
  if (enemies.filter(e => e.alive && !e.isBoss).length === 0 && !bossActive) {
    log('BOSS来袭');
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
  $('floor-clear-reward').textContent = `EXP+${80 + currentFloor * 20}  GOLD+${50 + currentFloor * 10}`;
  const blessEl = $('blessing-choices');
  blessEl.innerHTML = '';
  if (currentFloor % 5 === 0) {
    blessEl.classList.remove('hidden');
    [
      { label: 'ATK +3', fn: () => { player.str += 3; } },
      { label: 'SPD +3', fn: () => { player.spd += 3; } },
      { label: 'HP +30', fn: () => { player.hp = Math.min(player.maxHp, player.hp + 30); } },
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
    player.lv++; player.str++; player.spd++; player.def++; player.luck++;
    player.expNext = Math.floor(player.expNext * 1.3);
    log(`LV UP ${player.lv}!`);
    spawnPixelParticle(player.position, 0xffee55, 12);
  }
}

function spawnPickup(pos) {
  const sp = createPickupSprite();
  const group = new THREE.Group();
  group.add(sp);
  group.position.copy(pos);
  group.position.y = 0;
  scene.add(group);
  pickups.push({ group, sp, bob: Math.random() * 6.28 });
}

function playerAttack(isUlt = false) {
  if (attackCooldown > 0 && !isUlt) return;
  attackCooldown = isUlt ? 0.7 : Math.max(0.18, 0.45 - player.spd * 0.015);
  player.sprite.sprite.position.x += 0.12;
  setTimeout(() => { player.sprite.sprite.position.x = 0; }, 100);

  const range = isUlt ? 5.5 : 2.6;
  const fwd = new THREE.Vector3(Math.sin(player.rotation), 0, Math.cos(player.rotation));
  enemies.forEach(enemy => {
    if (!enemy.alive) return;
    const to = enemy.sprite.group.position.clone().sub(player.position);
    to.y = 0;
    const dist = to.length();
    if (dist > range) return;
    to.normalize();
    if (fwd.dot(to) > (isUlt ? -0.1 : 0.25)) {
      const { val, crit } = playerDamage(!isUlt);
      dealDamageToEnemy(enemy, Math.round((isUlt ? val * 3 : val) * (enemy.isBoss ? 1.15 : 1)), crit || isUlt);
    }
  });
  if (isUlt) { player.rage = 0; spawnPixelParticle(player.position, 0xffee55, 18); log('必杀!'); }
  else player.rage = Math.min(100, player.rage + 5);
  updateHud();
}

function playerDodge() {
  if (dodgeCooldown > 0) return;
  dodgeCooldown = Math.max(0.6, 1.2 - player.spd * 0.025);
  dodgeTimer = 0.22;
  invincible = 0.28;
  player.velocity.copy(new THREE.Vector3(Math.sin(player.rotation), 0, Math.cos(player.rotation)).multiplyScalar(14));
}

function damagePlayer(amount) {
  if (invincible > 0 || dodgeTimer > 0) return;
  const reduced = Math.max(1, amount - player.def * 0.5);
  player.hp -= reduced;
  player.rage = Math.min(100, player.rage + 8);
  invincible = 0.35;
  spawnPixelParticle(player.position, 0xff2244, 5);
  const scr = worldToScreen(player.position);
  floatDamage(`-${Math.round(reduced)}`, scr.x, scr.y, 'player-hit');
  updateHud();
  if (player.hp <= 0) { player.hp = 0; showGameover(); }
}

function startGame() {
  currentFloor = 1;
  Object.assign(player, { hp: 100, maxHp: 100, lv: 1, exp: 0, expNext: 50, str: 10, spd: 10, def: 5, luck: 5, rage: 0 });
  if (!player.sprite) {
    player.sprite = createPlayerSprite();
    scene.add(player.sprite.group);
  }
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

function restAtCamp() { player.hp = Math.min(player.maxHp, player.hp + 30); updateHud(); nextFloor(); }

function showGameover() {
  gameState = 'gameover';
  $('gameover-floor').textContent = `F${currentFloor}  Lv${player.lv}`;
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
  const moving = move.lengthSq() > 0.01;

  if (moving) {
    move.normalize();
    player.rotation = Math.atan2(move.x, move.y);
    player.velocity.x = move.x * speed;
    player.velocity.z = move.y * speed;
    walkAnim += dt * 10;
    player.sprite.setDirection(player.rotation);
    player.sprite.setWalkFrame(walkAnim);
  } else if (dodgeTimer <= 0) {
    player.velocity.multiplyScalar(0.8);
  }

  player.position.x += player.velocity.x * dt;
  player.position.z += player.velocity.z * dt;
  const lim = ARENA_SIZE - 2;
  player.position.x = THREE.MathUtils.clamp(player.position.x, -lim, lim);
  player.position.z = THREE.MathUtils.clamp(player.position.z, -lim, lim);

  player.sprite.group.position.copy(player.position);
  player.sprite.group.visible = invincible <= 0 || Math.floor(invincible * 20) % 2 === 0;

  pickups.forEach((p, i) => {
    p.bob += dt * 4;
    p.sp.position.y = 0.45 + Math.sin(p.bob) * 0.12;
    if (p.group.position.distanceTo(player.position) < 1.4) {
      const k = ['str', 'spd', 'def', 'luck'][Math.floor(Math.random() * 4)];
      player[k] += 2;
      player.hp = Math.min(player.maxHp, player.hp + 10);
      log('宝箱+');
      scene.remove(p.group);
      pickups.splice(i, 1);
      updateHud();
    }
  });
}

function updateEnemies(dt) {
  if (gameState !== 'playing') return;
  enemies.forEach(enemy => {
    if (!enemy.alive) return;
    const pos = enemy.sprite.group.position;
    const to = player.position.clone().sub(pos);
    to.y = 0;
    const dist = to.length();
    if (dist < 0.4) return;
    to.normalize();
    enemy.sprite.setDirection(Math.atan2(-to.x, -to.z));
    if (dist > (enemy.isBoss ? 2.2 : 1.0)) pos.add(to.multiplyScalar(enemy.speed * dt));

    enemy.atkCd -= dt;
    if (dist < (enemy.isBoss ? 3.2 : 1.6) && enemy.atkCd <= 0) {
      enemy.atkCd = enemy.isBoss ? 1.0 : 1.3 + Math.random() * 0.4;
      damagePlayer(enemy.atk * (enemy.isBoss ? 1.3 : 1));
      if (enemy.isBoss && !enemy.isFinal) {
        enemy.summonCd = (enemy.summonCd || 3) - dt;
        if (enemy.summonCd <= 0) {
          enemy.summonCd = 5;
          const sp = createEnemySprite(false, false, false);
          sp.group.position.copy(pos);
          sp.group.position.x += 1.5;
          scene.add(sp.group);
          const hp = mobHp(currentFloor) * 0.5;
          enemies.push({ sprite: sp, alive: true, isBoss: false, hp, maxHp: hp, atk: mobAtk(currentFloor) * 0.7, atkCd: 1, speed: 3.2 });
        }
      }
      if (enemy.isFinal) {
        const r = enemy.hp / enemy.maxHp;
        if (r < 0.3 && enemy.phase < 3) { enemy.phase = 3; enemy.atk *= 1.5; log('P3!'); }
        else if (r < 0.6 && enemy.phase < 2) { enemy.phase = 2; enemy.atk *= 1.3; log('P2!'); }
      }
    }
    if (!enemy.isBoss) enemy.sprite.setWalkFrame(clock.elapsedTime * 4 + pos.x);
  });
  updateHud();
}

function updateParticles(dt) {
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.life -= dt;
    p.mesh.position.addScaledVector(p.vel, dt);
    p.vel.y -= 10 * dt;
    p.mesh.rotation.z += p.spin * dt;
    p.mesh.material.opacity = Math.max(0, p.life * 2);
    if (p.life <= 0) { scene.remove(p.mesh); particles.splice(i, 1); }
  }
}

function updateCamera() {
  if (!player.sprite) return;
  const dist = 8;
  const height = 9;
  const off = new THREE.Vector3(-Math.sin(player.rotation) * dist, height, -Math.cos(player.rotation) * dist);
  const target = player.position.clone();
  target.y += 1;
  camera.position.lerp(target.clone().add(off), 0.09);
  camera.lookAt(target.x, target.y - 0.2, target.z);
}

function resize() {
  const w = viewport.clientWidth;
  const h = viewport.clientHeight;
  if (!w || !h) return;
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
  joystick.active = false; joystick.x = 0; joystick.y = 0; joystick.pointerId = null;
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
    if (e.touches?.length) pt = Array.from(e.touches).find(t => t.identifier === joystick.pointerId) || e.touches[0];
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

function setupTitleArt() {
  const bg = document.getElementById('title-pixel-bg');
  if (!bg) return;
  const ctx = bg.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  drawTitleHero(ctx, bg.width, bg.height);
}

setupJoystick();
setupButtons();
setupTitleArt();
window.addEventListener('resize', () => { resize(); updateJoyCenter(); });
new ResizeObserver(() => { resize(); updateJoyCenter(); }).observe(viewport);
resize();
updateJoyCenter();
animate();

function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.05);
  // flicker torches
  propLights.forEach((l, i) => { l.intensity = 0.65 + Math.sin(clock.elapsedTime * 8 + i) * 0.2; });
  updatePlayer(dt);
  updateEnemies(dt);
  updateParticles(dt);
  updateCamera();
  renderer.render(scene, camera);
}
