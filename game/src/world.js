// The game's rules and state, with no drawing and no browser in it: the
// lantern keeper, the shadows that hunt them, waves, the boss, blessings,
// shards, power-ups, score and combo. step() advances one fixed step and
// returns what happened as bit flags, so the caller can react (sounds,
// screens) without the world knowing about screens or sound.
import { BLESSINGS, BULLET, COMBO, ENEMY, FIELD, PLAYER, SHARD, STEP, WAVE } from './config.js';

export const EVENT_HIT = 1;
export const EVENT_SHARD = 2;
export const EVENT_OVER = 4;
export const EVENT_WAVE_CLEAR = 8;
export const EVENT_BOSS = 16;
export const EVENT_WIN = 32;
export const EVENT_PICKUP = 64;
export const EVENT_KILL = 128;

function dist(ax, ay, bx, by) {
  return Math.hypot(ax - bx, ay - by);
}

export function createWorld(random) {
  const state = {
    player: null,
    enemies: [],
    bullets: [],
    shards: [],
    powerups: [],
    particles: [],
    floats: [],
    score: 0,
    wave: 0,
    kills: 0,
    combo: 0,
    comboTimer: 0,
    comboMult: 1,
    elapsed: 0,
    shake: 0,
    flash: 0,
    spawnQueue: 0,
    spawnTimer: 0,
    waveState: 'fight',
    offered: [],
    boss: null,
    won: false,
    over: false,
  };
  let nextId = 1;

  function makePlayer() {
    return {
      x: FIELD.width / 2,
      y: FIELD.height / 2 + 60,
      r: PLAYER.radius,
      hearts: PLAYER.maxHearts,
      maxHearts: PLAYER.maxHearts,
      speed: PLAYER.speed,
      fireTimer: 0,
      fireInterval: PLAYER.fireInterval,
      projectiles: 1,
      pierce: false,
      magnetRadius: SHARD.magnetBase,
      rapidTimer: 0,
      shield: false,
      invulnerable: 0,
      aimX: FIELD.width / 2,
      aimY: 0,
    };
  }

  function spawnBurst(x, y, color, count, speed) {
    for (let i = 0; i < count; i += 1) {
      const angle = random() * Math.PI * 2;
      const v = speed * (0.4 + random() * 0.8);
      state.particles.push({
        x, y,
        vx: Math.cos(angle) * v,
        vy: Math.sin(angle) * v,
        life: 0.45 + random() * 0.35,
        maxLife: 0.8,
        size: 2 + random() * 3,
        color,
      });
    }
  }

  function addFloat(x, y, text, color) {
    state.floats.push({ x, y, text, color, life: 0.9, maxLife: 0.9 });
  }

  function spawnEnemy(kind, x, y) {
    const def = ENEMY[kind];
    let px = x;
    let py = y;
    if (px === undefined) {
      const edge = Math.floor(random() * 4);
      if (edge === 0) { px = random() * FIELD.width; py = -30; }
      else if (edge === 1) { px = random() * FIELD.width; py = FIELD.height + 30; }
      else if (edge === 2) { px = -30; py = random() * FIELD.height; }
      else { px = FIELD.width + 30; py = random() * FIELD.height; }
    }
    const enemy = {
      id: nextId, kind,
      x: px, y: py,
      r: def.radius, hp: def.hp, maxHp: def.hp,
      speed: def.speed * (0.9 + random() * 0.2),
      score: def.score, color: def.color,
      phase: random() * Math.PI * 2,
      spawnTimer: 0, chargeTimer: 5, charging: 0,
    };
    nextId += 1;
    state.enemies.push(enemy);
    return enemy;
  }

  function pickKind() {
    const roll = random();
    if (state.wave < 2) return 'moth';
    if (state.wave < 3) return roll < 0.7 ? 'moth' : 'wisp';
    return roll < 0.55 ? 'moth' : roll < 0.8 ? 'wisp' : 'beetle';
  }

  function startWave(n) {
    state.wave = n;
    state.spawnQueue = 5 + 3 * n;
    state.spawnTimer = 0.8;
    state.waveState = 'fight';
    state.boss = null;
    if (WAVE.bossWaves.includes(n)) {
      state.boss = spawnEnemy('boss', FIELD.width / 2, -70);
    }
  }

  function dropShard(x, y) {
    state.shards.push({
      x: x + (random() - 0.5) * 20,
      y: y + (random() - 0.5) * 20,
      vx: (random() - 0.5) * 40,
      vy: (random() - 0.5) * 40,
      r: SHARD.radius,
      value: SHARD.value,
      life: 14,
    });
  }

  function dropPowerup(x, y) {
    const kinds = ['heart', 'rapid', 'shield'];
    const kind = kinds[Math.floor(random() * kinds.length)];
    state.powerups.push({ kind, x, y, r: 15, life: 12, bob: random() * Math.PI * 2 });
  }

  function killEnemy(enemy, index) {
    state.enemies.splice(index, 1);
    state.kills += 1;
    state.combo += 1;
    state.comboTimer = COMBO.window;
    state.comboMult = Math.min(COMBO.maxMult, 1 + Math.floor(state.combo / 4));
    const gained = enemy.score * state.comboMult;
    state.score += gained;
    addFloat(enemy.x, enemy.y - 10, `+${gained}`, '#f2c94c');
    spawnBurst(enemy.x, enemy.y, enemy.color, enemy.kind === 'boss' ? 40 : 12, 220);
    dropShard(enemy.x, enemy.y);
    if (enemy.kind === 'boss') {
      state.boss = null;
      state.shake = 12;
      for (let i = 0; i < 5; i += 1) dropShard(enemy.x, enemy.y);
      state.score += 100;
      addFloat(enemy.x, enemy.y - 40, 'BOSS DOWN +100', '#ffb347');
    } else if (random() < 0.08) {
      dropPowerup(enemy.x, enemy.y);
    }
  }

  function applyBlessing(id) {
    const p = state.player;
    if (id === 'rapid') p.fireInterval *= 0.65;
    else if (id === 'spread') p.projectiles = 3;
    else if (id === 'swift') p.speed *= 1.25;
    else if (id === 'glass') { p.maxHearts += 1; p.hearts = Math.min(p.maxHearts, p.hearts + 1); }
    else if (id === 'magnet') p.magnetRadius *= 2.4;
    else if (id === 'pierce') p.pierce = true;
    state.offered = [];
    state.waveState = 'fight';
    startWave(state.wave + 1);
  }

  function reset() {
    state.player = makePlayer();
    state.enemies = [];
    state.bullets = [];
    state.shards = [];
    state.powerups = [];
    state.particles = [];
    state.floats = [];
    state.score = 0;
    state.wave = 0;
    state.kills = 0;
    state.combo = 0;
    state.comboTimer = 0;
    state.comboMult = 1;
    state.elapsed = 0;
    state.shake = 0;
    state.flash = 0;
    state.offered = [];
    state.boss = null;
    state.won = false;
    state.over = false;
    startWave(1);
  }

  function fireBullet(aimX, aimY) {
    const p = state.player;
    const base = Math.atan2(aimY - p.y, aimX - p.x);
    const angles = p.projectiles === 3 ? [-0.16, 0, 0.16] : [0];
    for (const off of angles) {
      const a = base + off;
      state.bullets.push({
        x: p.x + Math.cos(a) * (p.r + 8),
        y: p.y + Math.sin(a) * (p.r + 8),
        vx: Math.cos(a) * PLAYER.bulletSpeed,
        vy: Math.sin(a) * PLAYER.bulletSpeed,
        r: BULLET.radius,
        life: BULLET.life,
        pierced: [],
      });
    }
  }

  function step(dt, input, harmless) {
    let events = 0;
    const p = state.player;
    state.elapsed += dt;
    if (state.shake > 0) state.shake = Math.max(0, state.shake - dt * 26);
    if (state.flash > 0) state.flash = Math.max(0, state.flash - dt * 2.2);
    if (state.comboTimer > 0) {
      state.comboTimer -= dt;
      if (state.comboTimer <= 0) {
        state.combo = 0;
        state.comboMult = 1;
      }
    }
    if (p.invulnerable > 0) p.invulnerable = Math.max(0, p.invulnerable - dt);
    if (p.rapidTimer > 0) p.rapidTimer = Math.max(0, p.rapidTimer - dt);

    if (harmless) {
      // Title backdrop: shadows drift through the market and nothing can hurt.
      if (state.enemies.length < 9 && random() < dt * 1.2) {
        const e = spawnEnemy(random() < 0.6 ? 'moth' : 'wisp');
        e.y = -30;
        e.x = random() * FIELD.width;
      }
      for (let i = state.enemies.length - 1; i >= 0; i -= 1) {
        const e = state.enemies[i];
        e.y += 46 * dt;
        e.x += Math.sin(state.elapsed * 2 + e.phase) * 24 * dt;
        if (e.y > FIELD.height + 40) state.enemies.splice(i, 1);
      }
      for (let i = state.particles.length - 1; i >= 0; i -= 1) {
        const pt = state.particles[i];
        pt.life -= dt;
        if (pt.life <= 0) state.particles.splice(i, 1);
      }
      if (random() < dt * 6) {
        state.particles.push({
          x: random() * FIELD.width, y: FIELD.height + 6,
          vx: (random() - 0.5) * 12, vy: -14 - random() * 20,
          life: 2.4, maxLife: 2.4, size: 2 + random() * 2, color: '#f2c94c',
        });
      }
      return events;
    }

    // --- player movement ---
    const len = Math.hypot(input.moveX, input.moveY) || 1;
    p.x = Math.min(FIELD.width - FIELD.margin, Math.max(FIELD.margin, p.x + (input.moveX / len) * p.speed * dt * (input.moveX || input.moveY ? 1 : 0)));
    p.y = Math.min(FIELD.height - FIELD.margin, Math.max(FIELD.margin, p.y + (input.moveY / len) * p.speed * dt * (input.moveX || input.moveY ? 1 : 0)));
    p.aimX = input.aimX;
    p.aimY = input.aimY;

    // --- shooting ---
    p.fireTimer -= dt;
    const interval = p.rapidTimer > 0 ? p.fireInterval * 0.6 : p.fireInterval;
    if (input.firing && p.fireTimer <= 0) {
      fireBullet(input.aimX, input.aimY);
      p.fireTimer = interval;
    }

    // --- spawning ---
    if (state.waveState === 'fight' && state.spawnQueue > 0) {
      state.spawnTimer -= dt;
      const intervalSpawn = Math.max(WAVE.minSpawnInterval, WAVE.spawnInterval * WAVE.intervalScale ** (state.wave - 1));
      if (state.spawnTimer <= 0 && state.enemies.length < 26) {
        spawnEnemy(pickKind());
        state.spawnQueue -= 1;
        state.spawnTimer = intervalSpawn;
      }
    }

    // --- enemies ---
    for (let i = state.enemies.length - 1; i >= 0; i -= 1) {
      const e = state.enemies[i];
      let dx = p.x - e.x;
      let dy = p.y - e.y;
      const d = Math.hypot(dx, dy) || 1;
      dx /= d;
      dy /= d;
      let speed = e.speed;
      if (e.kind === 'wisp') {
        const wob = Math.sin(state.elapsed * 4 + e.phase) * 0.7;
        dx += -dy * wob * 0.5;
        dy += dx * wob * 0.5;
        const l = Math.hypot(dx, dy) || 1;
        dx /= l;
        dy /= l;
      }
      if (e.kind === 'boss') {
        e.spawnTimer -= dt;
        if (e.spawnTimer <= 0 && state.enemies.length < 24) {
          spawnEnemy('moth', e.x - 40, e.y + 30);
          spawnEnemy('moth', e.x + 40, e.y + 30);
          e.spawnTimer = 3.5;
        }
        e.chargeTimer -= dt;
        if (e.chargeTimer <= 0 && e.charging <= 0) {
          e.charging = 0.9;
          e.chargeTimer = 7;
        }
        if (e.charging > 0) {
          e.charging -= dt;
          speed *= 2.6;
        }
      }
      e.x += dx * speed * dt;
      e.y += dy * speed * dt;

      // Touching the keeper hurts — unless shielded or briefly invulnerable.
      if (dist(e.x, e.y, p.x, p.y) < e.r + p.r - 4) {
        if (p.shield) {
          p.shield = false;
          spawnBurst(p.x, p.y, '#5eead4', 16, 260);
          addFloat(p.x, p.y - 26, 'SHIELD!', '#5eead4');
          state.enemies.splice(i, 1);
          spawnBurst(e.x, e.y, e.color, 10, 200);
          events |= EVENT_HIT;
          continue;
        }
        if (p.invulnerable === 0) {
          p.hearts -= 1;
          p.invulnerable = PLAYER.invulnerable;
          state.shake = 11;
          state.flash = 1;
          state.combo = 0;
          state.comboMult = 1;
          events |= EVENT_HIT;
          spawnBurst(p.x, p.y, '#e5534b', 18, 280);
          if (p.hearts <= 0) {
            state.over = true;
            events |= EVENT_OVER;
            return events;
          }
        }
      }
    }

    // --- bullets ---
    for (let i = state.bullets.length - 1; i >= 0; i -= 1) {
      const b = state.bullets[i];
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.life -= dt;
      if (b.life <= 0 || b.x < -20 || b.x > FIELD.width + 20 || b.y < -20 || b.y > FIELD.height + 20) {
        state.bullets.splice(i, 1);
        continue;
      }
      for (let j = state.enemies.length - 1; j >= 0; j -= 1) {
        const e = state.enemies[j];
        if (b.pierced.includes(e.id)) continue;
        if (dist(b.x, b.y, e.x, e.y) < b.r + e.r) {
          e.hp -= BULLET.damage;
          spawnBurst(b.x, b.y, '#f2c94c', 5, 160);
          if (e.hp <= 0) {
            const wasBoss = e.kind === 'boss';
            killEnemy(e, j);
            events |= EVENT_KILL;
            if (wasBoss) events |= EVENT_BOSS;
          }
          if (p.pierce) {
            b.pierced.push(e.id);
          } else {
            state.bullets.splice(i, 1);
            break;
          }
        }
      }
    }

    // --- shards ---
    for (let i = state.shards.length - 1; i >= 0; i -= 1) {
      const s = state.shards[i];
      s.life -= dt;
      if (s.life <= 0) {
        state.shards.splice(i, 1);
        continue;
      }
      const d = dist(s.x, s.y, p.x, p.y);
      if (d < p.magnetRadius) {
        s.x += ((p.x - s.x) / (d || 1)) * 340 * dt;
        s.y += ((p.y - s.y) / (d || 1)) * 340 * dt;
      } else {
        s.x += s.vx * dt;
        s.y += s.vy * dt;
        s.vx *= 0.98;
        s.vy *= 0.98;
      }
      if (d < p.r + s.r + 4) {
        state.score += s.value * state.comboMult;
        addFloat(s.x, s.y - 8, `+${s.value * state.comboMult}`, '#f2c94c');
        state.shards.splice(i, 1);
        events |= EVENT_SHARD;
      }
    }

    // --- power-ups ---
    for (let i = state.powerups.length - 1; i >= 0; i -= 1) {
      const u = state.powerups[i];
      u.life -= dt;
      u.bob += dt * 3;
      if (u.life <= 0) {
        state.powerups.splice(i, 1);
        continue;
      }
      if (dist(u.x, u.y, p.x, p.y) < p.r + u.r) {
        if (u.kind === 'heart') {
          p.hearts = Math.min(p.maxHearts, p.hearts + 1);
          addFloat(p.x, p.y - 26, '+1 HEART', '#ff8fa3');
        } else if (u.kind === 'rapid') {
          p.rapidTimer = 8;
          addFloat(p.x, p.y - 26, 'RAPID FIRE!', '#ffb347');
        } else {
          p.shield = true;
          addFloat(p.x, p.y - 26, 'SHIELD UP', '#5eead4');
        }
        state.powerups.splice(i, 1);
        events |= EVENT_PICKUP;
      }
    }

    // --- particles & floats ---
    for (let i = state.particles.length - 1; i >= 0; i -= 1) {
      const pt = state.particles[i];
      pt.x += pt.vx * dt;
      pt.y += pt.vy * dt;
      pt.vx *= 0.985;
      pt.vy *= 0.985;
      pt.life -= dt;
      if (pt.life <= 0) state.particles.splice(i, 1);
    }
    for (let i = state.floats.length - 1; i >= 0; i -= 1) {
      const f = state.floats[i];
      f.y -= 34 * dt;
      f.life -= dt;
      if (f.life <= 0) state.floats.splice(i, 1);
    }

    // --- wave clear / victory ---
    if (state.waveState === 'fight' && state.spawnQueue === 0 && state.enemies.length === 0) {
      if (state.wave >= WAVE.finalWave) {
        state.won = true;
        state.waveState = 'won';
        state.score += 500;
        events |= EVENT_WIN;
      } else {
        state.waveState = 'blessing';
        const pool = [...BLESSINGS];
        state.offered = [];
        for (let i = 0; i < 3; i += 1) {
          const at = Math.floor(random() * pool.length);
          state.offered.push(pool.splice(at, 1)[0]);
        }
        events |= EVENT_WAVE_CLEAR;
      }
    }
    return events;
  }

  reset();
  return { state, reset, step, startWave, applyBlessing };
}
