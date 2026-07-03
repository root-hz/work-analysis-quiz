(function () {
  'use strict';

  const WIN_DIST = 1000;
  const GRAVITY = 2200;
  const JUMP_V = -620;
  const JUMP_V2 = -540;
  const SLIDE_DUR = 0.65;
  const STAND_H = 28;
  const SLIDE_H = 14;
  const GROUND_RATIO = 0.78;
  const COIN_VALUE = 10;
  const SPEED_MIN = 230;
  const SPEED_MAX = 460;
  const SPAWN_GAP_MAX = 1.55;
  const SPAWN_GAP_MIN = 0.82;

  /** 0→1 平滑插值，加速过程无突变 */
  function smoothstep(t) {
    t = Math.max(0, Math.min(1, t));
    return t * t * (3 - 2 * t);
  }

  /** 距离进度 → 当前速度（前段慢、中段渐快、末段才接近上限） */
  function calcSpeed(distance) {
    const progress = Math.min(1, distance / WIN_DIST);
    const eased = smoothstep(progress);
    return SPEED_MIN + (SPEED_MAX - SPEED_MIN) * eased;
  }

  /** 障碍生成间隔随速度同步拉长/缩短 */
  function calcSpawnGap(currentSpeed) {
    const ratio = (currentSpeed - SPEED_MIN) / (SPEED_MAX - SPEED_MIN);
    return SPAWN_GAP_MAX - ratio * (SPAWN_GAP_MAX - SPAWN_GAP_MIN);
  }

  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;

  const hud = document.getElementById('hud');
  const controls = document.getElementById('controls');
  const screenTitle = document.getElementById('screen-title');
  const screenOver = document.getElementById('screen-over');
  const screenWin = document.getElementById('screen-win');
  const scoreEl = document.getElementById('score');
  const coinsEl = document.getElementById('coins');
  const jumpsEl = document.getElementById('jumps');
  const bestEl = document.getElementById('best');
  const overTitle = document.getElementById('over-title');
  const overScore = document.getElementById('over-score');
  const overCoins = document.getElementById('over-coins');
  const winCoins = document.getElementById('win-coins');
  const btnSlide = document.getElementById('btn-slide');

  let W = 0, H = 0, GY = 0;
  let state = 'title';
  let dist = 0, speed = SPEED_MIN, coins = 0;
  let best = +localStorage.getItem('runner-best') || 0;
  let player, obstacles, coinItems, clouds, animId, lastT;
  let spawnTimer = 0, coinTimer = 0;

  bestEl.textContent = `BEST ${best}m`;

  function resize() {
    const wrap = document.getElementById('game-wrap');
    const controlsH = controls.classList.contains('hidden') ? 0 : controls.offsetHeight;
    W = wrap.clientWidth;
    H = wrap.clientHeight - controlsH;
    canvas.width = Math.floor(W / 2);
    canvas.height = Math.floor(H / 2);
    GY = canvas.height * GROUND_RATIO;
  }

  function reset() {
    dist = 0;
    speed = SPEED_MIN;
    coins = 0;
    player = {
      x: 48, y: 0, vy: 0, w: 22, h: STAND_H,
      grounded: true, sliding: false, slideT: 0,
      jumpsLeft: 2, frame: 0,
    };
    obstacles = [];
    coinItems = [];
    clouds = Array.from({ length: 6 }, (_, i) => ({
      x: i * 80 + Math.random() * 40,
      y: 20 + Math.random() * (GY * 0.35),
      s: 0.6 + Math.random() * 0.8,
    }));
    spawnTimer = 0.5;
    coinTimer = 0.3;
    updateHud();
  }

  function updateHud() {
    scoreEl.textContent = `${Math.floor(dist)}m`;
    coinsEl.textContent = String(coins);
    const dots = jumpsEl.querySelectorAll('i');
    dots[0].classList.toggle('on', player.jumpsLeft >= 1);
    dots[1].classList.toggle('on', player.jumpsLeft >= 2);
    btnSlide.disabled = !player.grounded || player.sliding;
  }

  function spawnObstacle() {
    const r = Math.random();
    if (r < 0.45) {
      const h = 18 + Math.floor(Math.random() * 3) * 6;
      obstacles.push({ type: 'rock', x: canvas.width + 20, y: GY - h, w: 16 + Math.random() * 10, h });
    } else if (r < 0.72 && dist > 120) {
      obstacles.push({ type: 'bird', x: canvas.width + 20, y: GY - 52 - Math.random() * 18, w: 22, h: 14, flap: 0 });
    } else if (dist > 180) {
      const barH = 8;
      obstacles.push({ type: 'beam', x: canvas.width + 20, y: GY - 34, w: 28 + Math.random() * 16, h: barH });
    } else {
      const h = 18 + Math.floor(Math.random() * 2) * 6;
      obstacles.push({ type: 'rock', x: canvas.width + 20, y: GY - h, w: 16, h });
    }
  }

  function spawnCoin() {
    const lane = Math.random();
    let y;
    if (lane < 0.35) y = 0;
    else if (lane < 0.7) y = 38 + Math.random() * 12;
    else y = 62 + Math.random() * 15;
    coinItems.push({
      x: canvas.width + 16,
      y,
      r: 7,
      spin: Math.random() * 6.28,
      bob: Math.random() * 6.28,
    });
  }

  function jump() {
    if (state !== 'play' || player.sliding) return;
    if (player.grounded) {
      player.vy = JUMP_V;
      player.grounded = false;
      player.jumpsLeft = 1;
    } else if (player.jumpsLeft > 0) {
      player.vy = JUMP_V2;
      player.jumpsLeft = 0;
    } else return;
    updateHud();
  }

  function slide() {
    if (state !== 'play' || !player.grounded || player.sliding) return;
    player.sliding = true;
    player.slideT = SLIDE_DUR;
    player.h = SLIDE_H;
    player.jumpsLeft = 0;
    updateHud();
  }

  function endSlide() {
    player.sliding = false;
    player.slideT = 0;
    player.h = STAND_H;
    player.jumpsLeft = 2;
    updateHud();
  }

  function playerHitbox() {
    const h = player.h;
    const py = GY - h - player.y;
    const pad = player.sliding ? 2 : 4;
    return { x: player.x + pad, y: py + pad, w: player.w - pad * 2, h: h - pad * 2 };
  }

  function popText(text, x, y) {
    const el = document.createElement('div');
    el.className = 'collect-pop';
    el.textContent = text;
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 600);
  }

  function drawSky() {
    const g = ctx.createLinearGradient(0, 0, 0, GY);
    g.addColorStop(0, '#5bc0eb');
    g.addColorStop(1, '#c8f0ff');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, canvas.width, GY);
  }

  function drawCloud(c) {
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    const u = 4 * c.s;
    ctx.fillRect(c.x, c.y, 10 * u, 4 * u);
    ctx.fillRect(c.x + 3 * u, c.y - 3 * u, 8 * u, 4 * u);
    ctx.fillRect(c.x + 8 * u, c.y, 8 * u, 3 * u);
  }

  function drawGround(scroll) {
    ctx.fillStyle = '#63c64d';
    ctx.fillRect(0, GY, canvas.width, canvas.height - GY);
    ctx.fillStyle = '#3a8c28';
    ctx.fillRect(0, GY, canvas.width, 6);
    const tw = 16;
    for (let x = -((scroll % tw) + tw); x < canvas.width + tw; x += tw) {
      ctx.fillStyle = (Math.floor((x + scroll) / tw) % 2) ? '#58b842' : '#4aa838';
      ctx.fillRect(x, GY + 6, tw, canvas.height - GY - 6);
    }
  }

  function drawPlayer() {
    const { x, y, w, h, frame, grounded, sliding } = player;
    const py = GY - h - y;

    if (sliding) {
      ctx.fillStyle = '#1a1c2c';
      ctx.fillRect(x - 1, py - 1, w + 2, h + 2);
      ctx.fillStyle = '#4169e1';
      ctx.fillRect(x, py + 4, w, h - 4);
      ctx.fillStyle = '#f5c898';
      ctx.fillRect(x + 10, py, 12, 10);
      ctx.fillStyle = '#ffd700';
      ctx.fillRect(x + 8, py - 2, 14, 4);
      ctx.fillStyle = '#e45050';
      ctx.fillRect(x + w - 4, py + 6, 8, 4);
      ctx.fillStyle = '#2c3e80';
      ctx.fillRect(x + 2, py + h - 6, w - 4, 6);
      return;
    }

    const leg = grounded ? (Math.floor(frame / 4) % 2 ? 2 : -2) : 0;
    ctx.fillStyle = '#1a1c2c';
    ctx.fillRect(x - 1, py - 1, w + 2, h + 2);
    ctx.fillStyle = '#4169e1';
    ctx.fillRect(x + 2, py + 8, w - 4, h - 10);
    ctx.fillStyle = '#f5c898';
    ctx.fillRect(x + 4, py, 14, 12);
    ctx.fillStyle = '#ffd700';
    ctx.fillRect(x + 3, py - 2, 16, 5);
    ctx.fillStyle = '#e45050';
    ctx.fillRect(x + w - 2, py + 10, 6, 3);
    ctx.fillStyle = '#2c3e80';
    ctx.fillRect(x + 3, py + h - 8 + leg, 6, 8);
    ctx.fillRect(x + w - 9, py + h - 8 - leg, 6, 8);
  }

  function drawRock(o) {
    ctx.fillStyle = '#1a1c2c';
    ctx.fillRect(o.x - 1, o.y - 1, o.w + 2, o.h + 2);
    ctx.fillStyle = '#686880';
    ctx.fillRect(o.x, o.y, o.w, o.h);
    ctx.fillStyle = '#9898a8';
    ctx.fillRect(o.x + 2, o.y + 2, o.w - 6, 4);
  }

  function drawBird(o) {
    o.flap += 0.15;
    const wing = Math.sin(o.flap) > 0 ? -4 : 4;
    ctx.fillStyle = '#1a1c2c';
    ctx.fillRect(o.x - 1, o.y - 1, o.w + 2, o.h + 2);
    ctx.fillStyle = '#ff6622';
    ctx.fillRect(o.x, o.y + 4, o.w, o.h - 4);
    ctx.fillRect(o.x + 4, o.y, 10, 8);
    ctx.fillStyle = '#ffaa44';
    ctx.fillRect(o.x + o.w - 4, o.y + wing + 4, 8, 3);
  }

  function drawBeam(o) {
    ctx.fillStyle = '#1a1c2c';
    ctx.fillRect(o.x - 1, o.y - 1, o.w + 2, o.h + 2);
    ctx.fillStyle = '#8b4513';
    ctx.fillRect(o.x, o.y, o.w, o.h);
    ctx.fillStyle = '#cd853f';
    ctx.fillRect(o.x, o.y, o.w, 3);
    ctx.fillStyle = '#5d275d';
    ctx.fillRect(o.x - 3, o.y - 2, 4, o.h + 4);
    ctx.fillRect(o.x + o.w - 1, o.y - 2, 4, o.h + 4);
  }

  function drawCoin(c) {
    c.spin += 0.12;
    c.bob += 0.08;
    const cy = GY - c.y - c.r + Math.sin(c.bob) * 2;
    const squash = 0.55 + Math.abs(Math.cos(c.spin)) * 0.45;
    const rw = c.r * 2 * squash;
    ctx.fillStyle = '#1a1c2c';
    ctx.beginPath();
    ctx.ellipse(c.x, cy, rw / 2 + 1, c.r + 1, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffd700';
    ctx.beginPath();
    ctx.ellipse(c.x, cy, rw / 2, c.r, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffee88';
    ctx.fillRect(c.x - 1, cy - 2, 2, 4);
  }

  function aabb(a, b) {
    return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
  }

  function checkObstacleHit(o, box) {
    if (o.type === 'bird') {
      if (player.sliding || player.y < 8) return false;
      return aabb(box, { x: o.x, y: o.y, w: o.w, h: o.h });
    }
    if (o.type === 'beam') {
      if (player.sliding) return false;
      return aabb(box, { x: o.x, y: o.y, w: o.w, h: o.h });
    }
    return aabb(box, { x: o.x, y: o.y, w: o.w, h: o.h });
  }

  function update(dt) {
    if (state !== 'play') return;

    dist += speed * dt * 0.05;
    speed = calcSpeed(dist);
    scoreEl.textContent = `${Math.floor(dist)}m`;

    if (player.sliding) {
      player.slideT -= dt;
      if (player.slideT <= 0) endSlide();
    } else {
      player.vy += GRAVITY * dt;
      player.y -= player.vy * dt;
      if (player.y <= 0) {
        player.y = 0;
        player.vy = 0;
        if (!player.grounded) {
          player.grounded = true;
          player.jumpsLeft = 2;
          updateHud();
        }
        player.grounded = true;
      } else {
        player.grounded = false;
      }
    }
    player.frame++;

    spawnTimer -= dt;
    if (spawnTimer <= 0) {
      spawnObstacle();
      spawnTimer = calcSpawnGap(speed) + Math.random() * 0.35;
    }

    coinTimer -= dt;
    if (coinTimer <= 0) {
      if (Math.random() < 0.72) spawnCoin();
      coinTimer = 0.35 + Math.random() * 0.35;
    }

    clouds.forEach(c => {
      c.x -= speed * dt * 0.025 * c.s;
      if (c.x < -40) { c.x = canvas.width + 20; c.y = 20 + Math.random() * (GY * 0.35); }
    });

    const box = playerHitbox();

    for (let i = coinItems.length - 1; i >= 0; i--) {
      const c = coinItems[i];
      c.x -= speed * dt;
      if (c.x < -20) { coinItems.splice(i, 1); continue; }
      const cy = GY - c.y - c.r;
      const dx = (player.x + player.w / 2) - c.x;
      const dy = (box.y + box.h / 2) - cy;
      if (dx * dx + dy * dy < (c.r + 14) ** 2) {
        coins++;
        dist += COIN_VALUE * 0.2;
        coinsEl.textContent = String(coins);
        const rect = canvas.getBoundingClientRect();
        const sx = rect.left + (c.x / canvas.width) * rect.width;
        const sy = rect.top + (cy / canvas.height) * rect.height;
        popText('+1', sx, sy);
        coinItems.splice(i, 1);
      }
    }

    for (let i = obstacles.length - 1; i >= 0; i--) {
      const o = obstacles[i];
      o.x -= speed * dt;
      if (o.x + (o.w || 30) < -10) { obstacles.splice(i, 1); continue; }
      if (checkObstacleHit(o, box)) {
        gameOver();
        return;
      }
    }

    updateHud();
    if (dist >= WIN_DIST) win();
  }

  function draw(scroll) {
    drawSky();
    clouds.forEach(drawCloud);
    drawGround(scroll);
    coinItems.forEach(drawCoin);
    obstacles.forEach(o => {
      if (o.type === 'rock') drawRock(o);
      else if (o.type === 'bird') drawBird(o);
      else drawBeam(o);
    });
    drawPlayer();

    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fillRect(0, 0, canvas.width, 18);
    ctx.fillStyle = '#fff';
    ctx.font = '8px "Press Start 2P"';
    ctx.fillText(`${Math.floor(dist)}/${WIN_DIST}m`, 6, 12);

    const prog = Math.min(1, dist / WIN_DIST);
    ctx.fillStyle = '#333';
    ctx.fillRect(6, canvas.height - 10, canvas.width - 12, 5);
    ctx.fillStyle = '#ffd700';
    ctx.fillRect(6, canvas.height - 10, (canvas.width - 12) * prog, 5);
  }

  function loop(t) {
    const dt = Math.min((t - (lastT || t)) / 1000, 0.05);
    lastT = t;
    update(dt);
    draw(dist * 3);
    animId = requestAnimationFrame(loop);
  }

  function start() {
    screenTitle.classList.add('hidden');
    screenOver.classList.add('hidden');
    screenWin.classList.add('hidden');
    hud.classList.remove('hidden');
    controls.classList.remove('hidden');
    resize();
    reset();
    state = 'play';
    lastT = 0;
    cancelAnimationFrame(animId);
    animId = requestAnimationFrame(loop);
  }

  function gameOver() {
    state = 'over';
    const d = Math.floor(dist);
    if (d > best) {
      best = d;
      localStorage.setItem('runner-best', best);
      bestEl.textContent = `BEST ${best}m`;
    }
    overTitle.textContent = d >= WIN_DIST * 0.85 ? '差一点!' : '撞到了!';
    overScore.textContent = `${d}m`;
    overCoins.textContent = `金币 x${coins}`;
    screenOver.classList.remove('hidden');
  }

  function win() {
    state = 'win';
    const d = Math.floor(dist);
    if (d > best) {
      best = d;
      localStorage.setItem('runner-best', best);
      bestEl.textContent = `BEST ${best}m`;
    }
    winCoins.textContent = `金币 x${coins} · ${d}m`;
    screenWin.classList.remove('hidden');
  }

  document.getElementById('btn-start').onclick = start;
  document.getElementById('btn-retry').onclick = start;
  document.getElementById('btn-win-retry').onclick = start;

  const bindBtn = (el, fn) => {
    el.addEventListener('touchstart', e => { e.preventDefault(); fn(); }, { passive: false });
    el.addEventListener('mousedown', e => { e.preventDefault(); fn(); });
  };
  bindBtn(document.getElementById('btn-jump'), jump);
  bindBtn(btnSlide, slide);

  document.addEventListener('keydown', e => {
    if (e.code === 'Space' || e.code === 'ArrowUp') { e.preventDefault(); jump(); }
    if (e.code === 'ArrowDown' || e.code === 'ShiftLeft') { e.preventDefault(); slide(); }
  });

  window.addEventListener('resize', () => { if (state === 'play') resize(); });
  resize();
})();
