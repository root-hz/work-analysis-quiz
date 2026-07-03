(function () {
  'use strict';

  const WIN_DIST = 1000;
  const GRAVITY = 2200;
  const JUMP_V = -620;
  const GROUND_RATIO = 0.78;

  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;

  const hud = document.getElementById('hud');
  const controls = document.getElementById('controls');
  const screenTitle = document.getElementById('screen-title');
  const screenOver = document.getElementById('screen-over');
  const screenWin = document.getElementById('screen-win');
  const scoreEl = document.getElementById('score');
  const bestEl = document.getElementById('best');
  const overTitle = document.getElementById('over-title');
  const overScore = document.getElementById('over-score');

  let W = 0, H = 0, GY = 0, scale = 1;
  let state = 'title';
  let dist = 0, speed = 280, best = +localStorage.getItem('runner-best') || 0;
  let player, obstacles, clouds, tiles, animId, lastT;

  bestEl.textContent = `BEST ${best}m`;

  function resize() {
    const wrap = document.getElementById('game-wrap');
    const controlsH = controls.classList.contains('hidden') ? 0 : controls.offsetHeight;
    W = wrap.clientWidth;
    H = wrap.clientHeight - controlsH;
    canvas.width = Math.floor(W / 2);
    canvas.height = Math.floor(H / 2);
    scale = canvas.width / W;
    GY = canvas.height * GROUND_RATIO;
  }

  function reset() {
    dist = 0;
    speed = 280;
    player = { x: 48, y: 0, vy: 0, w: 22, h: 28, grounded: true, frame: 0 };
    obstacles = [];
    clouds = Array.from({ length: 6 }, (_, i) => ({
      x: i * 80 + Math.random() * 40,
      y: 20 + Math.random() * (GY * 0.35),
      s: 0.6 + Math.random() * 0.8,
    }));
    tiles = 0;
    spawnTimer = 0;
  }

  let spawnTimer = 0;

  function spawnObstacle() {
    const type = Math.random() < 0.65 ? 'rock' : 'bird';
    if (type === 'rock') {
      const h = 18 + Math.floor(Math.random() * 3) * 6;
      obstacles.push({ type: 'rock', x: canvas.width + 20, y: GY - h, w: 16 + Math.random() * 10, h });
    } else if (dist > 150) {
      obstacles.push({ type: 'bird', x: canvas.width + 20, y: GY - 52 - Math.random() * 20, w: 22, h: 14, flap: 0 });
    }
  }

  function jump() {
    if (state !== 'play' || !player.grounded) return;
    player.vy = JUMP_V;
    player.grounded = false;
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
    const { x, y, w, h, frame, grounded } = player;
    const py = GY - h - y;
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

  function aabb(ax, ay, aw, ah, bx, by, bw, bh) {
    return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
  }

  function update(dt) {
    if (state !== 'play') return;

    dist += speed * dt * 0.05;
    speed = Math.min(520, 280 + dist * 0.08);
    scoreEl.textContent = `${Math.floor(dist)}m`;

    player.vy += GRAVITY * dt;
    player.y -= player.vy * dt;
    if (player.y <= 0) {
      player.y = 0;
      player.vy = 0;
      player.grounded = true;
    }
    player.frame++;

    spawnTimer -= dt;
    const gap = Math.max(0.85, 1.6 - dist * 0.0008);
    if (spawnTimer <= 0) {
      spawnObstacle();
      spawnTimer = gap + Math.random() * 0.5;
    }

    const scroll = dist * 3;
    clouds.forEach(c => {
      c.x -= speed * dt * 0.025 * c.s;
      if (c.x < -40) { c.x = canvas.width + 20; c.y = 20 + Math.random() * (GY * 0.35); }
    });

    const px = player.x, py = GY - player.h - player.y, pw = player.w, ph = player.h;

    for (let i = obstacles.length - 1; i >= 0; i--) {
      const o = obstacles[i];
      o.x -= speed * dt;
      if (o.x + o.w < -10) { obstacles.splice(i, 1); continue; }

      const pad = 4;
      if (aabb(px + pad, py + pad, pw - pad * 2, ph - pad * 2, o.x, o.y, o.w, o.h)) {
        if (o.type === 'bird' && player.y < 35) continue;
        gameOver();
        return;
      }
    }

    if (dist >= WIN_DIST) win();
  }

  function draw(scroll) {
    drawSky();
    clouds.forEach(drawCloud);
    drawGround(scroll);
    obstacles.forEach(o => o.type === 'rock' ? drawRock(o) : drawBird(o));
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
    overTitle.textContent = d >= WIN_DIST * 0.8 ? '差一点!' : '撞到了!';
    overScore.textContent = `${d}m`;
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
    screenWin.classList.remove('hidden');
  }

  document.getElementById('btn-start').onclick = start;
  document.getElementById('btn-retry').onclick = start;
  document.getElementById('btn-win-retry').onclick = start;
  document.getElementById('btn-jump').addEventListener('touchstart', e => { e.preventDefault(); jump(); }, { passive: false });
  document.getElementById('btn-jump').addEventListener('mousedown', e => { e.preventDefault(); jump(); });
  document.addEventListener('keydown', e => {
    if (e.code === 'Space' || e.code === 'ArrowUp') { e.preventDefault(); jump(); }
  });

  window.addEventListener('resize', () => { if (state === 'play') resize(); });
  resize();
})();
