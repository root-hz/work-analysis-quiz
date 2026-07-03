import * as THREE from 'three';

// ─── Zone themes (from GDD, 10 regions = 10 floors) ───
const ZONES = [
  { name: '腐化之域', floor: 1,  color: 0x2d5016, fog: 0x1a3010, accent: 0x4ade80 },
  { name: '熔岩裂隙', floor: 2,  color: 0x7c2d12, fog: 0x3d1508, accent: 0xf97316 },
  { name: '冰霜回廊', floor: 3,  color: 0x1e3a5f, fog: 0x0f1d30, accent: 0x60a5fa },
  { name: '暗影尖塔', floor: 4,  color: 0x312e81, fog: 0x1a1840, accent: 0xa78bfa },
  { name: '雷鸣穹顶', floor: 5,  color: 0x4c1d95, fog: 0x2a1050, accent: 0xfbbf24 },
  { name: '虚空裂隙', floor: 6,  color: 0x3b0764, fog: 0x1e0432, accent: 0xc084fc },
  { name: '圣光残垣', floor: 7,  color: 0x713f12, fog: 0x3a2009, accent: 0xfde047 },
  { name: '龙息巢穴', floor: 8,  color: 0x991b1b, fog: 0x4a0e0e, accent: 0xfca5a5 },
  { name: '时砂之阶', floor: 9,  color: 0x92400e, fog: 0x4a2007, accent: 0xfcd34d },
  { name: '终焉之门', floor: 10, color: 0x1f1f1f, fog: 0x0a0a0a, accent: 0xef4444 },
];

const TOTAL_FLOORS = 10;
const ARENA_SIZE = 28;

// ─── DOM refs ───
const canvas = document.getElementById('game-canvas');
const hud = document.getElementById('hud');
const controls = document.getElementById('controls');
const rotateHint = document.getElementById('rotate-hint');
const screenTitle = document.getElementById('screen-title');
const screenFloorClear = document.getElementById('screen-floor-clear');
const screenGameover = document.getElementById('screen-gameover');
const screenVictory = document.getElementById('screen-victory');

// ─── Three.js core ───
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(55, 1, 0.1, 200);

const clock = new THREE.Clock();
const raycaster = new THREE.Raycaster();
const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);

// ─── Game state ───
let gameState = 'title'; // title | playing | floor_clear | gameover | victory
let currentFloor = 1;
let enemies = [];
let pickups = [];
let particles = [];
let floorMeshes = [];
let bossActive = false;
let floorBlessing = null;
let attackCooldown = 0;
let dodgeCooldown = 0;
let dodgeTimer = 0;
let invincible = 0;
let pendingBlessing = false;
let floorCleared = false;

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

// ─── Input ───
const keys = {};
const joystick = { active: false, x: 0, y: 0, id: null, originX: 0, originY: 0 };
const joystickZone = document.getElementById('joystick-zone');
const joystickBase = document.getElementById('joystick-base');
const joystickStick = document.getElementById('joystick-stick');

// ─── Helpers ───
function $(id) { return document.getElementById(id); }

function log(msg) {
  const el = $('combat-log');
  const p = document.createElement('p');
  p.textContent = msg;
  el.prepend(p);
  while (el.children.length > 5) el.lastChild.remove();
}

function floatDamage(text, x, y, cls = 'enemy-hit') {
  const el = document.createElement('div');
  el.className = `damage-float ${cls}`;
  el.textContent = text;
  el.style.left = `${x}px`;
  el.style.top = `${y}px`;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 800);
}

function worldToScreen(pos) {
  const v = pos.clone();
  v.y += 2;
  v.project(camera);
  return {
    x: (v.x * 0.5 + 0.5) * window.innerWidth,
    y: (-v.y * 0.5 + 0.5) * window.innerHeight,
  };
}

function mobCount(floor) {
  return 2 + Math.floor(floor / 3);
}

function bossHp(floor) {
  if (floor >= TOTAL_FLOORS) return 15000;
  return 1000 + floor * 800;
}

function mobHp(floor, isElite = false) {
  const base = 30 + floor * 25 + Math.random() * 20;
  return isElite ? base * 2.2 : base;
}

function mobAtk(floor) {
  return 8 + floor * 3 + Math.random() * 4;
}

function playerDamage(base = true) {
  const dmg = player.str * (base ? 1.8 : 3.5) - 2;
  const crit = Math.random() < 0.05 + player.luck * 0.005;
  const val = Math.max(1, Math.round(dmg * (crit ? 2 : 1)));
  return { val, crit };
}

function updateHud() {
  $('hp-fill').style.width = `${(player.hp / player.maxHp) * 100}%`;
  $('hp-text').textContent = `${Math.ceil(player.hp)} / ${player.maxHp}`;
  $('stat-lv').textContent = player.lv;
  $('stat-str').textContent = player.str;
  $('stat-spd').textContent = player.spd;
  $('stat-def').textContent = player.def;
  const zone = ZONES[Math.min(currentFloor - 1, ZONES.length - 1)];
  $('floor-badge').textContent = currentFloor >= TOTAL_FLOORS ? '塔顶' : `第 ${currentFloor} 层`;
  $('zone-name').textContent = zone.name;
  const alive = enemies.filter(e => e.alive).length;
  $('enemy-count').textContent = bossActive
    ? (alive ? '⚠ 层 Boss 来袭！' : 'Boss 已击败')
    : `剩余 ${alive} 只`;
  $('rage-fill').style.width = `${player.rage}%`;
  $('btn-skill').disabled = player.rage < 100;
}

// ─── Build player mesh (third-person visible character) ───
function createPlayerMesh() {
  const group = new THREE.Group();

  const bodyMat = new THREE.MeshStandardMaterial({ color: 0x6366f1, roughness: 0.6, metalness: 0.3 });
  const skinMat = new THREE.MeshStandardMaterial({ color: 0xfbbf9b, roughness: 0.8 });
  const capeMat = new THREE.MeshStandardMaterial({ color: 0xef4444, roughness: 0.7, side: THREE.DoubleSide });

  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.9, 0.45), bodyMat);
  torso.position.y = 1.1;
  torso.castShadow = true;
  group.add(torso);

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.32, 12, 12), skinMat);
  head.position.y = 1.85;
  head.castShadow = true;
  group.add(head);

  const helm = new THREE.Mesh(new THREE.ConeGeometry(0.35, 0.3, 6), new THREE.MeshStandardMaterial({ color: 0xffd700, metalness: 0.8, roughness: 0.2 }));
  helm.position.y = 2.15;
  helm.rotation.x = 0.1;
  group.add(helm);

  const cape = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 1.2), capeMat);
  cape.position.set(0, 1.2, 0.35);
  cape.rotation.x = 0.2;
  group.add(cape);

  const sword = new THREE.Mesh(new THREE.BoxGeometry(0.08, 1.1, 0.15), new THREE.MeshStandardMaterial({ color: 0xc0c0c0, metalness: 0.9, roughness: 0.1 }));
  sword.position.set(0.55, 1.2, 0);
  sword.rotation.z = -0.3;
  sword.name = 'sword';
  group.add(sword);

  const legGeo = new THREE.BoxGeometry(0.25, 0.6, 0.25);
  const legL = new THREE.Mesh(legGeo, bodyMat);
  legL.position.set(-0.2, 0.45, 0);
  legL.castShadow = true;
  group.add(legL);
  const legR = new THREE.Mesh(legGeo, bodyMat);
  legR.position.set(0.2, 0.45, 0);
  legR.castShadow = true;
  group.add(legR);

  group.traverse(c => { if (c.isMesh) c.castShadow = true; });
  return group;
}

function createEnemyMesh(isBoss, color, scale = 1) {
  const group = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({
    color,
    roughness: 0.5,
    metalness: isBoss ? 0.6 : 0.2,
    emissive: isBoss ? new THREE.Color(color).multiplyScalar(0.15) : 0x000000,
  });

  if (isBoss) {
    const body = new THREE.Mesh(new THREE.CylinderGeometry(1.2 * scale, 1.5 * scale, 3 * scale, 8), mat);
    body.position.y = 1.5 * scale;
    body.castShadow = true;
    group.add(body);
    const horn = new THREE.Mesh(new THREE.ConeGeometry(0.4 * scale, 1.2 * scale, 6), mat);
    horn.position.set(0.6 * scale, 3.2 * scale, 0);
    group.add(horn);
    const horn2 = horn.clone();
    horn2.position.x = -0.6 * scale;
    group.add(horn2);
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.2 * scale, 8, 8), new THREE.MeshStandardMaterial({ color: 0xff0000, emissive: 0xff0000, emissiveIntensity: 2 }));
    eye.position.set(0.35 * scale, 2.2 * scale, 0.9 * scale);
    group.add(eye);
    const eye2 = eye.clone();
    eye2.position.x = -0.35 * scale;
    group.add(eye2);
  } else {
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.55 * scale, 10, 10), mat);
    body.position.y = 0.65 * scale;
    body.castShadow = true;
    group.add(body);
    const spike = new THREE.Mesh(new THREE.ConeGeometry(0.2 * scale, 0.6 * scale, 4), mat);
    spike.position.y = 1.2 * scale;
    group.add(spike);
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.1, 6, 6), new THREE.MeshStandardMaterial({ color: 0xffff00, emissive: 0xffff00, emissiveIntensity: 1.5 }));
    eye.position.set(0.2 * scale, 0.75 * scale, 0.4 * scale);
    group.add(eye);
  }

  // HP bar
  const barBg = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 0.12), new THREE.MeshBasicMaterial({ color: 0x333333 }));
  barBg.position.y = (isBoss ? 3.8 : 1.6) * scale;
  barBg.name = 'hpBarBg';
  group.add(barBg);
  const barFill = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 0.1), new THREE.MeshBasicMaterial({ color: 0xef4444 }));
  barFill.position.set(0, (isBoss ? 3.8 : 1.6) * scale, 0.01);
  barFill.name = 'hpBarFill';
  group.add(barFill);

  return group;
}

function spawnParticle(pos, color, count = 8) {
  for (let i = 0; i < count; i++) {
    const mesh = new THREE.Mesh(
      new THREE.SphereGeometry(0.08, 4, 4),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 1 })
    );
    mesh.position.copy(pos);
    mesh.position.y += 1;
    const vel = new THREE.Vector3(
      (Math.random() - 0.5) * 4,
      Math.random() * 3 + 1,
      (Math.random() - 0.5) * 4
    );
    particles.push({ mesh, vel, life: 0.6 + Math.random() * 0.4 });
    scene.add(mesh);
  }
}

// ─── Floor building ───
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
  scene.background = new THREE.Color(zone.fog);
  scene.fog = new THREE.Fog(zone.fog, 20, 70);

  // Ground
  const ground = new THREE.Mesh(
    new THREE.CylinderGeometry(ARENA_SIZE, ARENA_SIZE + 2, 0.5, 32),
    new THREE.MeshStandardMaterial({ color: zone.color, roughness: 0.9 })
  );
  ground.position.y = -0.25;
  ground.receiveShadow = true;
  scene.add(ground);
  floorMeshes.push(ground);

  // Ring wall
  const wallMat = new THREE.MeshStandardMaterial({ color: zone.color, roughness: 0.8, transparent: true, opacity: 0.6 });
  for (let i = 0; i < 12; i++) {
    const angle = (i / 12) * Math.PI * 2;
    const pillar = new THREE.Mesh(new THREE.BoxGeometry(1.5, 4, 1.5), wallMat);
    pillar.position.set(Math.cos(angle) * (ARENA_SIZE - 1), 2, Math.sin(angle) * (ARENA_SIZE - 1));
    pillar.castShadow = true;
    scene.add(pillar);
    floorMeshes.push(pillar);
  }

  // Stairs marker (next floor)
  const stairMat = new THREE.MeshStandardMaterial({ color: zone.accent, emissive: zone.accent, emissiveIntensity: 0.3 });
  const stairs = new THREE.Mesh(new THREE.BoxGeometry(3, 0.3, 3), stairMat);
  stairs.position.set(0, 0.15, -ARENA_SIZE + 4);
  stairs.name = 'stairs';
  stairs.visible = false;
  scene.add(stairs);
  floorMeshes.push(stairs);

  // Lights
  if (!scene.userData.lit) {
    scene.add(new THREE.AmbientLight(0xffffff, 0.4));
    const sun = new THREE.DirectionalLight(0xffffff, 1.1);
    sun.position.set(15, 30, 10);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    sun.shadow.camera.near = 1;
    sun.shadow.camera.far = 80;
    sun.shadow.camera.left = -30;
    sun.shadow.camera.right = 30;
    sun.shadow.camera.top = 30;
    sun.shadow.camera.bottom = -30;
    scene.add(sun);
    scene.userData.lit = true;
  }

  // Decorative crystals
  for (let i = 0; i < 6; i++) {
    const c = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.5 + Math.random() * 0.5),
      new THREE.MeshStandardMaterial({ color: zone.accent, emissive: zone.accent, emissiveIntensity: 0.5, transparent: true, opacity: 0.8 })
    );
    const a = Math.random() * Math.PI * 2;
    const r = 8 + Math.random() * 10;
    c.position.set(Math.cos(a) * r, 0.5, Math.sin(a) * r);
    scene.add(c);
    floorMeshes.push(c);
  }

  spawnMobs(floor);
  player.position.set(0, 0, ARENA_SIZE - 6);
  if (player.mesh) {
    player.mesh.position.copy(player.position);
    player.mesh.rotation.y = player.rotation;
  }
}

function spawnMobs(floor) {
  const zone = ZONES[Math.min(floor - 1, ZONES.length - 1)];
  const count = mobCount(floor);
  for (let i = 0; i < count; i++) {
    const isElite = Math.random() < 0.15;
    const angle = Math.random() * Math.PI * 2;
    const r = 4 + Math.random() * (ARENA_SIZE - 8);
    const mesh = createEnemyMesh(false, isElite ? 0xffd700 : zone.accent, isElite ? 1.3 : 1);
    mesh.position.set(Math.cos(angle) * r, 0, Math.sin(angle) * r);
    scene.add(mesh);
    enemies.push({
      mesh,
      alive: true,
      isBoss: false,
      isElite,
      hp: mobHp(floor, isElite),
      maxHp: mobHp(floor, isElite),
      atk: mobAtk(floor),
      atkCd: 0,
      speed: 2.5 + floor * 0.15,
    });
  }
  log(`进入${zone.name}，遭遇 ${count} 只小怪兽！`);
}

function spawnBoss(floor) {
  bossActive = true;
  const zone = ZONES[Math.min(floor - 1, ZONES.length - 1)];
  const isFinal = floor >= TOTAL_FLOORS;
  const scale = isFinal ? 2 : 1.4;
  const mesh = createEnemyMesh(true, isFinal ? 0xff0000 : zone.accent, scale);
  mesh.position.set(0, 0, -5);
  scene.add(mesh);
  const hp = bossHp(floor);
  enemies.push({
    mesh,
    alive: true,
    isBoss: true,
    isFinal,
    hp,
    maxHp: hp,
    atk: 12 + floor * 5,
    atkCd: 0,
    speed: 2 + floor * 0.1,
    phase: 1,
    summonCd: 3,
  });
  log(isFinal ? '⚠ 塔顶守护者降临！' : `⚠ 第 ${floor} 层 Boss 现身！`);
  updateHud();
}

function updateEnemyHpBar(enemy) {
  const fill = enemy.mesh.getObjectByName('hpBarFill');
  if (fill) {
    const ratio = enemy.hp / enemy.maxHp;
    fill.scale.x = Math.max(0.01, ratio);
    fill.position.x = -(1.2 * (1 - ratio)) / 2;
  }
}

// ─── Combat ───
function dealDamageToEnemy(enemy, dmg, isCrit) {
  if (!enemy.alive) return;
  enemy.hp -= dmg;
  updateEnemyHpBar(enemy);
  spawnParticle(enemy.mesh.position, enemy.isBoss ? 0xff4500 : 0xffd700, isCrit ? 12 : 5);
  const scr = worldToScreen(enemy.mesh.position);
  floatDamage(isCrit ? `暴击! ${dmg}` : `${dmg}`, scr.x, scr.y, isCrit ? 'crit' : 'enemy-hit');

  if (enemy.hp <= 0) {
    enemy.alive = false;
    enemy.mesh.visible = false;
    player.rage = Math.min(100, player.rage + (enemy.isBoss ? 40 : 10));
    const expGain = enemy.isBoss ? 80 + currentFloor * 20 : 15 + currentFloor * 3;
    gainExp(expGain);

    if (!enemy.isBoss && Math.random() < 0.08 + player.luck * 0.005) {
      spawnPickup(enemy.mesh.position.clone());
    }

    if (enemy.isBoss) {
      onBossDefeated();
    } else {
      checkAllMobsDead();
    }
  }
  updateHud();
}

function checkAllMobsDead() {
  const mobsLeft = enemies.filter(e => e.alive && !e.isBoss).length;
  if (mobsLeft === 0 && !bossActive) {
    log('小怪清空！Boss 即将出现…');
    setTimeout(() => spawnBoss(currentFloor), 1200);
  }
}

function onBossDefeated() {
  if (floorCleared) return;
  floorCleared = true;

  const stairs = floorMeshes.find(m => m.name === 'stairs');
  if (stairs) stairs.visible = true;

  if (currentFloor >= TOTAL_FLOORS) {
    setTimeout(() => showVictory(), 1500);
    return;
  }

  pendingBlessing = currentFloor % 5 === 0;
  $('floor-clear-title').textContent = `第 ${currentFloor} 层 通关！`;
  $('floor-clear-reward').textContent = `获得经验 ${80 + currentFloor * 20} · 金币 +${50 + currentFloor * 10}`;

  const blessEl = $('blessing-choices');
  blessEl.innerHTML = '';
  if (pendingBlessing) {
    blessEl.classList.remove('hidden');
    const options = [
      { label: '🗡 力量 +3', apply: () => { player.str += 3; } },
      { label: '💨 速度 +3', apply: () => { player.spd += 3; } },
      { label: '❤ 恢复 30 HP', apply: () => { player.hp = Math.min(player.maxHp, player.hp + 30); } },
    ];
    options.forEach(opt => {
      const btn = document.createElement('button');
      btn.className = 'bless-btn';
      btn.textContent = opt.label;
      btn.onclick = () => { opt.apply(); floorBlessing = opt.label; updateHud(); };
      blessEl.appendChild(btn);
    });
  } else {
    blessEl.classList.add('hidden');
  }

  gameState = 'floor_clear';
  screenFloorClear.classList.remove('hidden');
}

function gainExp(amount) {
  player.exp += amount;
  while (player.exp >= player.expNext) {
    player.exp -= player.expNext;
    player.lv++;
    player.str += 1;
    player.spd += 1;
    player.def += 1;
    player.luck += 1;
    player.expNext = Math.floor(player.expNext * 1.3);
    log(`升级！Lv.${player.lv} 全属性 +1`);
  }
}

function spawnPickup(pos) {
  const mesh = new THREE.Mesh(
    new THREE.OctahedronGeometry(0.35),
    new THREE.MeshStandardMaterial({ color: 0x60a5fa, emissive: 0x3b82f6, emissiveIntensity: 0.8 })
  );
  mesh.position.copy(pos);
  mesh.position.y = 0.5;
  scene.add(mesh);
  pickups.push({ mesh, bob: Math.random() * Math.PI * 2 });
}

function playerAttack(isUlt = false) {
  if (attackCooldown > 0 && !isUlt) return;
  attackCooldown = isUlt ? 0.8 : Math.max(0.25, 0.6 - player.spd * 0.02);

  const sword = player.mesh.getObjectByName('sword');
  if (sword) {
    sword.rotation.z = -1.2;
    setTimeout(() => { if (sword) sword.rotation.z = -0.3; }, 150);
  }

  const range = isUlt ? 6 : 2.8;
  const angle = player.rotation;
  const forward = new THREE.Vector3(Math.sin(angle), 0, Math.cos(angle));

  enemies.forEach(enemy => {
    if (!enemy.alive) return;
    const toEnemy = enemy.mesh.position.clone().sub(player.position);
    toEnemy.y = 0;
    const dist = toEnemy.length();
    if (dist > range) return;
    toEnemy.normalize();
    if (forward.dot(toEnemy) > (isUlt ? -0.2 : 0.3)) {
      const { val, crit } = playerDamage(!isUlt);
      const dmg = isUlt ? val * 3 : val;
      const bossBonus = enemy.isBoss ? 1.15 : 1;
      dealDamageToEnemy(enemy, Math.round(dmg * bossBonus), crit || isUlt);
    }
  });

  if (isUlt) {
    player.rage = 0;
    log('必杀技！');
    spawnParticle(player.position, 0xffd700, 20);
  }

  player.rage = Math.min(100, player.rage + 5);
  updateHud();
}

function playerDodge() {
  if (dodgeCooldown > 0) return;
  dodgeCooldown = Math.max(0.8, 1.5 - player.spd * 0.03);
  dodgeTimer = 0.25;
  invincible = 0.3;
  const forward = new THREE.Vector3(Math.sin(player.rotation), 0, Math.cos(player.rotation));
  player.velocity.copy(forward.multiplyScalar(12));
}

function damagePlayer(amount) {
  if (invincible > 0 || dodgeTimer > 0) return;
  const reduced = Math.max(1, amount - player.def * 0.5);
  player.hp -= reduced;
  player.rage = Math.min(100, player.rage + 8);
  invincible = 0.4;
  spawnParticle(player.position, 0xef4444, 6);
  const scr = worldToScreen(player.position);
  floatDamage(`-${Math.round(reduced)}`, scr.x, scr.y, 'player-hit');
  updateHud();

  if (player.hp <= 0) {
    player.hp = 0;
    showGameover();
  }
}

// ─── Game flow ───
function startGame() {
  currentFloor = 1;
  player.hp = 100;
  player.maxHp = 100;
  player.lv = 1;
  player.exp = 0;
  player.expNext = 50;
  player.str = 10;
  player.spd = 10;
  player.def = 5;
  player.luck = 5;
  player.rage = 0;
  floorBlessing = null;

  if (!player.mesh) {
    player.mesh = createPlayerMesh();
    scene.add(player.mesh);
  }

  screenTitle.classList.add('hidden');
  screenGameover.classList.add('hidden');
  screenVictory.classList.add('hidden');
  screenFloorClear.classList.add('hidden');
  hud.classList.remove('hidden');
  controls.classList.remove('hidden');
  $('rage-bar').classList.remove('hidden');

  gameState = 'playing';
  buildFloor(currentFloor);
  updateHud();
}

function nextFloor() {
  screenFloorClear.classList.add('hidden');
  currentFloor++;
  if (currentFloor > TOTAL_FLOORS) {
    showVictory();
    return;
  }
  gameState = 'playing';
  buildFloor(currentFloor);
  updateHud();
}

function restAtCamp() {
  player.hp = Math.min(player.maxHp, player.hp + 30);
  log('营地休整，恢复 30 HP');
  updateHud();
  nextFloor();
}

function showGameover() {
  gameState = 'gameover';
  $('gameover-floor').textContent = `最高到达：第 ${currentFloor} 层 · Lv.${player.lv}`;
  screenGameover.classList.remove('hidden');
}

function showVictory() {
  gameState = 'victory';
  hud.classList.add('hidden');
  controls.classList.add('hidden');
  screenVictory.classList.remove('hidden');
}

// ─── Update loop ───
function getMoveInput() {
  let mx = 0, mz = 0;
  if (joystick.active) {
    mx = joystick.x;
    mz = joystick.y;
  }
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
  const speed = 7 + player.spd * 0.15;

  if (move.lengthSq() > 0.01) {
    move.normalize();
    player.rotation = Math.atan2(move.x, move.y);
    player.velocity.x = move.x * speed;
    player.velocity.z = move.y * speed;
  } else if (dodgeTimer <= 0) {
    player.velocity.multiplyScalar(0.85);
  }

  player.position.x += player.velocity.x * dt;
  player.position.z += player.velocity.z * dt;

  const limit = ARENA_SIZE - 2;
  player.position.x = THREE.MathUtils.clamp(player.position.x, -limit, limit);
  player.position.z = THREE.MathUtils.clamp(player.position.z, -limit, limit);

  player.mesh.position.copy(player.position);
  player.mesh.rotation.y = player.rotation;

  // Pickups
  pickups.forEach((p, i) => {
    p.bob += dt * 3;
    p.mesh.position.y = 0.5 + Math.sin(p.bob) * 0.15;
    p.mesh.rotation.y += dt * 2;
    if (p.mesh.position.distanceTo(player.position) < 1.5) {
      const bonus = ['str', 'spd', 'def', 'luck'][Math.floor(Math.random() * 4)];
      player[bonus] += 2;
      player.hp = Math.min(player.maxHp, player.hp + 10);
      log(`获得装备！${bonus === 'str' ? '力量' : bonus === 'spd' ? '速度' : bonus === 'def' ? '防御' : '幸运'} +2`);
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

    const toPlayer = player.position.clone().sub(enemy.mesh.position);
    toPlayer.y = 0;
    const dist = toPlayer.length();
    if (dist < 0.5) return;

    toPlayer.normalize();
    enemy.mesh.lookAt(player.position.x, enemy.mesh.position.y, player.position.z);

    if (dist > (enemy.isBoss ? 2.5 : 1.2)) {
      enemy.mesh.position.add(toPlayer.multiplyScalar(enemy.speed * dt));
    }

    enemy.atkCd -= dt;
    const atkRange = enemy.isBoss ? 3.5 : 1.8;
    if (dist < atkRange && enemy.atkCd <= 0) {
      enemy.atkCd = enemy.isBoss ? 1.2 : 1.5 + Math.random() * 0.5;
      damagePlayer(enemy.atk * (enemy.isBoss ? 1.3 : 1));

      if (enemy.isBoss) {
        enemy.summonCd = (enemy.summonCd || 3) - dt;
        if (enemy.summonCd <= 0 && !enemy.isFinal) {
          enemy.summonCd = 5;
          log('Boss 召唤小喽啰！');
          const mesh = createEnemyMesh(false, 0xff6b6b);
          mesh.position.copy(enemy.mesh.position);
          mesh.position.x += 2;
          scene.add(mesh);
          enemies.push({
            mesh, alive: true, isBoss: false, hp: mobHp(currentFloor) * 0.5,
            maxHp: mobHp(currentFloor) * 0.5, atk: mobAtk(currentFloor) * 0.7,
            atkCd: 1, speed: 3,
          });
        }

        const ratio = enemy.hp / enemy.maxHp;
        if (enemy.isFinal) {
          if (ratio < 0.3 && enemy.phase < 3) { enemy.phase = 3; enemy.atk *= 1.5; log('塔顶 Boss 第三形态！'); }
          else if (ratio < 0.6 && enemy.phase < 2) { enemy.phase = 2; enemy.atk *= 1.3; log('塔顶 Boss 第二形态！'); }
        }
      }
    }
  });

  updateHud();
}

function updateParticles(dt) {
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.life -= dt;
    p.mesh.position.add(p.vel.clone().multiplyScalar(dt));
    p.vel.y -= 9.8 * dt;
    p.mesh.material.opacity = p.life;
    if (p.life <= 0) {
      scene.remove(p.mesh);
      particles.splice(i, 1);
    }
  }
}

function updateCamera() {
  if (!player.mesh) return;
  const offset = new THREE.Vector3(
    -Math.sin(player.rotation) * 9,
    7,
    -Math.cos(player.rotation) * 9
  );
  const target = player.position.clone();
  target.y += 1.5;
  const desired = target.clone().add(offset);
  camera.position.lerp(desired, 0.08);
  camera.lookAt(target.x, target.y - 0.5, target.z);
}

function resize() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.setSize(w, h, false);

  if (window.innerWidth < window.innerHeight && window.innerWidth < 900) {
    rotateHint.classList.remove('hidden');
  } else {
    rotateHint.classList.add('hidden');
  }
}

function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.05);
  updatePlayer(dt);
  updateEnemies(dt);
  updateParticles(dt);
  updateCamera();
  renderer.render(scene, camera);
}

// ─── Input setup ───
function setupJoystick() {
  const maxDist = 40;

  function start(e) {
    if (gameState !== 'playing') return;
    e.preventDefault();
    const touch = e.touches ? e.touches[0] : e;
    joystick.id = touch.identifier ?? 'mouse';
    joystick.active = true;
    joystick.originX = touch.clientX;
    joystick.originY = touch.clientY;
    joystickBase.classList.add('active');
    joystickBase.style.left = `${touch.clientX - 55}px`;
    joystickBase.style.top = `${touch.clientY - 55}px`;
    joystickBase.style.bottom = 'auto';
    joystickStick.style.transform = 'translate(0, 0)';
  }

  function move(e) {
    if (!joystick.active) return;
    e.preventDefault();
    const touch = e.touches
      ? Array.from(e.touches).find(t => t.identifier === joystick.id) || e.touches[0]
      : e;
    let dx = touch.clientX - joystick.originX;
    let dy = touch.clientY - joystick.originY;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist > maxDist) { dx = (dx / dist) * maxDist; dy = (dy / dist) * maxDist; }
    joystick.x = dx / maxDist;
    joystick.y = dy / maxDist;
    joystickStick.style.transform = `translate(${dx}px, ${dy}px)`;
  }

  function end(e) {
    if (!joystick.active) return;
    joystick.active = false;
    joystick.x = 0;
    joystick.y = 0;
    joystick.id = null;
    joystickBase.classList.remove('active');
    joystickStick.style.transform = 'translate(0, 0)';
  }

  joystickZone.addEventListener('touchstart', start, { passive: false });
  joystickZone.addEventListener('touchmove', move, { passive: false });
  joystickZone.addEventListener('touchend', end);
  joystickZone.addEventListener('touchcancel', end);
  joystickZone.addEventListener('mousedown', start);
  window.addEventListener('mousemove', move);
  window.addEventListener('mouseup', end);
}

function setupButtons() {
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

  $('btn-attack').addEventListener('touchstart', e => { e.preventDefault(); playerAttack(false); });
  $('btn-attack').addEventListener('mousedown', e => { e.preventDefault(); playerAttack(false); });
  $('btn-skill').addEventListener('touchstart', e => { e.preventDefault(); if (player.rage >= 100) playerAttack(true); });
  $('btn-skill').addEventListener('mousedown', e => { e.preventDefault(); if (player.rage >= 100) playerAttack(true); });
  $('btn-dodge').addEventListener('touchstart', e => { e.preventDefault(); playerDodge(); });
  $('btn-dodge').addEventListener('mousedown', e => { e.preventDefault(); playerDodge(); });

  window.addEventListener('keydown', e => {
    keys[e.code] = true;
    if (e.code === 'Space') { playerAttack(false); e.preventDefault(); }
    if (e.code === 'ShiftLeft') playerDodge();
    if (e.code === 'KeyQ' && player.rage >= 100) playerAttack(true);
  });
  window.addEventListener('keyup', e => { keys[e.code] = false; });
}

// ─── Init ───
setupJoystick();
setupButtons();
window.addEventListener('resize', resize);
resize();
animate();
