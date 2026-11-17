// The screenshot scenes behind ?shot=start|play|boss|end. Each one plays the
// real rules forward from a fresh world for a fixed number of steps, steered
// by a simple autopilot (flee the nearest shadow, chase the nearest shard,
// shoot the nearest shadow), so the frame is what a short game really looks
// like and the same seed always gives the same frame.
import { FIELD, STEP } from './config.js';
import { EVENT_OVER, EVENT_WAVE_CLEAR, EVENT_WIN } from './world.js';
import { SCREEN_OVER, SCREEN_PLAY, SCREEN_TITLE } from './render.js';

const START_SECONDS = 5;
const PLAY_SECONDS = 26;
const LIMIT_SECONDS = 900;
const SAMPLE = STEP;

/** Steer like a careful player: keep clear of shadows, chase shards, shoot. */
function autopilot(state) {
  const p = state.player;
  let enemy = null;
  let enemyDist = Infinity;
  for (const e of state.enemies) {
    const d = Math.hypot(e.x - p.x, e.y - p.y);
    if (d < enemyDist) {
      enemyDist = d;
      enemy = e;
    }
  }
  let shard = null;
  let shardDist = Infinity;
  for (const s of state.shards) {
    const d = Math.hypot(s.x - p.x, s.y - p.y);
    if (d < shardDist) {
      shardDist = d;
      shard = s;
    }
  }
  let mx = 0;
  let my = 0;
  if (enemy && enemyDist < 210) {
    const w = (210 - enemyDist) / 210;
    mx += ((p.x - enemy.x) / (enemyDist || 1)) * w;
    my += ((p.y - enemy.y) / (enemyDist || 1)) * w;
  }
  if (shard && shardDist < 320) {
    mx += ((shard.x - p.x) / (shardDist || 1)) * 0.6;
    my += ((shard.y - p.y) / (shardDist || 1)) * 0.6;
  }
  mx += ((FIELD.width / 2 - p.x) / FIELD.width) * 0.5;
  my += ((FIELD.height / 2 - p.y) / FIELD.height) * 0.5;
  const len = Math.hypot(mx, my) || 1;
  return {
    moveX: mx / len,
    moveY: my / len,
    aimX: enemy ? enemy.x : p.x,
    aimY: enemy ? enemy.y : p.y - 100,
    firing: enemy !== null && enemyDist < 640,
  };
}

/** During the boss scene, pull the fight down into the frame: hold near the
 * middle-bottom, keep a little distance from the boss, shoot it. */
function bossPilot(state) {
  const p = state.player;
  const boss = state.boss;
  let mx = (FIELD.width / 2 - p.x) / FIELD.width * 1.6;
  let my = (500 - p.y) / FIELD.height * 1.6;
  if (boss) {
    const d = Math.hypot(boss.x - p.x, boss.y - p.y);
    if (d < 150) {
      mx += ((p.x - boss.x) / (d || 1)) * 1.2;
      my += ((p.y - boss.y) / (d || 1)) * 1.2;
    }
  }
  for (const e of state.enemies) {
    if (e.kind === 'boss') continue;
    const d = Math.hypot(e.x - p.x, e.y - p.y);
    if (d < 150) {
      mx += ((p.x - e.x) / (d || 1)) * 0.8;
      my += ((p.y - e.y) / (d || 1)) * 0.8;
    }
  }
  const len = Math.hypot(mx, my) || 1;
  let target = boss;
  if (!target) {
    let best = Infinity;
    for (const e of state.enemies) {
      const d = Math.hypot(e.x - p.x, e.y - p.y);
      if (d < best) { best = d; target = e; }
    }
  }
  return {
    moveX: mx / len,
    moveY: my / len,
    aimX: target ? target.x : p.x,
    aimY: target ? target.y : p.y - 100,
    firing: target !== null && target !== undefined,
  };
}
function carelessPilot(state) {
  const p = state.player;
  return {
    moveX: (FIELD.width / 2 - p.x) / FIELD.width,
    moveY: (FIELD.height / 2 - p.y) / FIELD.height,
    aimX: p.x,
    aimY: p.y - 100,
    firing: false,
  };
}

function pickBlessing(state) {
  const offered = state.offered;
  if (offered.length === 0) return;
  const byId = (id) => offered.find((b) => b.id === id);
  const pick = byId('spread') ?? byId('rapid') ?? (state.player.hearts < state.player.maxHearts ? byId('glass') : null) ?? byId('swift') ?? offered[0];
  return pick.id;
}

function simulate(world, seconds, pilot) {
  const steps = Math.floor(seconds / SAMPLE);
  for (let i = 0; i < steps; i += 1) {
    const events = world.step(SAMPLE, pilot(world.state), false);
    if (events & EVENT_WAVE_CLEAR) {
      const id = pickBlessing(world.state);
      if (id) world.applyBlessing(id);
    }
    if (events & (EVENT_OVER | EVENT_WIN)) return events;
  }
  return 0;
}

/**
 * Set `world` to the named scene (start, play, boss or end; any other name is
 * start) and return the screen to draw over it and the best score to show.
 */
export function stageShot(name, world) {
  world.reset();
  if (name !== 'play' && name !== 'boss' && name !== 'end') {
    for (let i = 0; i < START_SECONDS / STEP; i += 1) {
      world.step(STEP, { moveX: 0, moveY: 0, aimX: FIELD.width / 2, aimY: 0, firing: false }, true);
    }
    world.state.shake = 0;
    world.state.flash = 0;
    return { screen: SCREEN_TITLE, best: 0 };
  }
  if (name === 'end') {
    // Play well for a while first, so the game-over screen carries a real
    // score — then stop shooting and let the shadows take the market.
    simulate(world, 20, autopilot);
    if (!world.state.over) simulate(world, LIMIT_SECONDS, carelessPilot);
    world.state.shake = 0;
    world.state.flash = 0;
    return { screen: SCREEN_OVER, best: world.state.score };
  }
  if (name === 'boss') {
    // Play forward until the wave-5 Raksasa Bayang is on the field.
    const steps = Math.floor(LIMIT_SECONDS / SAMPLE);
    for (let i = 0; i < steps; i += 1) {
      const events = world.step(SAMPLE, autopilot(world.state), false);
      if (events & EVENT_WAVE_CLEAR) {
        const id = pickBlessing(world.state);
        if (id) world.applyBlessing(id);
      }
      if (events & (EVENT_OVER | EVENT_WIN)) break;
      if (world.state.wave === 5 && world.state.boss && world.state.elapsed > 0) {
        // Let the boss fight develop mid-field so the frame shows it whole.
        simulate(world, 12, bossPilot);
        break;
      }
    }
    world.state.shake = 0;
    world.state.flash = 0;
    const over = world.state.over;
    return { screen: over ? SCREEN_OVER : SCREEN_PLAY, best: world.state.score };
  }
  simulate(world, PLAY_SECONDS, autopilot);
  world.state.shake = 0;
  world.state.flash = 0;
  const over = world.state.over;
  return { screen: over ? SCREEN_OVER : SCREEN_PLAY, best: world.state.score };
}
