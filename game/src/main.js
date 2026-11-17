// Boot and the one loop: input is read every frame, the world advances in
// fixed 1/60 s steps (several in a slow frame, none in a fast one), and the
// renderer paints what is there. The game moves between six screens: title,
// play, blessing, paused, victory and game over.
//
// ?seed=N fixes the spawn pattern. ?shot=start|play|boss|end (with &seed=N)
// stages that scene instead of running the loop, paints it twice and sets
// window.__shotReady for a screenshot.
import { BEST_KEY, STEP } from './config.js';
import { createRandom } from './random.js';
import { createAudio } from './audio.js';
import {
  createWorld,
  EVENT_BOSS,
  EVENT_HIT,
  EVENT_KILL,
  EVENT_OVER,
  EVENT_PICKUP,
  EVENT_SHARD,
  EVENT_WAVE_CLEAR,
  EVENT_WIN,
} from './world.js';
import {
  ACTION_BLESS_1,
  ACTION_BLESS_2,
  ACTION_BLESS_3,
  ACTION_CONFIRM,
  ACTION_MUTE,
  ACTION_PAUSE,
  createInput,
} from './input.js';
import {
  createRenderer,
  SCREEN_BLESSING,
  SCREEN_OVER,
  SCREEN_PAUSED,
  SCREEN_PLAY,
  SCREEN_TITLE,
  SCREEN_VICTORY,
} from './render.js';
import { stageShot } from './shots.js';

/** The longest frame the loop catches up on; a longer stall (a hidden tab) is dropped, not replayed. */
const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const world = createWorld(createRandom(seed));
const renderer = createRenderer(canvas);
const audio = createAudio();

function readBest() {
  try {
    return Number.parseInt(window.localStorage.getItem(BEST_KEY) ?? '0', 10) || 0;
  } catch {
    return 0;
  }
}

function saveBest(value) {
  try {
    window.localStorage.setItem(BEST_KEY, String(value));
  } catch {
    // Storage can be off (private windows): the best score then lasts this visit only.
  }
}

function runShot(name) {
  const scene = stageShot(name, world);
  let painted = 0;
  function paint() {
    renderer.draw(world.state, scene.screen, scene.best, { offered: world.state.offered, muted: false });
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas);
  let screen = SCREEN_TITLE;
  let best = readBest();
  let accumulator = 0;
  let last = performance.now();

  window.addEventListener('pointerdown', () => audio.unlock(), { once: true });
  window.addEventListener('keydown', () => audio.unlock(), { once: true });

  // Screen readers (and anyone watching the page's text) hear the screen changes and each hit.
  function announce(message) {
    status.textContent = message;
  }

  function startGame() {
    world.reset();
    accumulator = 0;
    screen = SCREEN_PLAY;
    audio.click();
    announce('Playing. 3 hearts. Wave 1.');
  }

  function endGame() {
    screen = SCREEN_OVER;
    if (world.state.score > best) {
      best = world.state.score;
      saveBest(best);
    }
    announce(`Game over. Score ${world.state.score}. Best ${best}.`);
  }

  function winGame() {
    screen = SCREEN_VICTORY;
    if (world.state.score > best) {
      best = world.state.score;
      saveBest(best);
    }
    announce(`Victory! Score ${world.state.score}. Best ${best}.`);
  }

  function pickBlessing(index) {
    const offered = world.state.offered;
    if (index < 0 || index >= offered.length) return;
    const blessing = offered[index];
    world.applyBlessing(blessing.id);
    screen = SCREEN_PLAY;
    audio.pickup();
    announce(`${blessing.name} chosen. Wave ${world.state.wave}.`);
  }

  function handleActions() {
    const actions = input.takeActions();
    if (actions & ACTION_MUTE) {
      audio.setMuted(!audio.isMuted());
      announce(audio.isMuted() ? 'Muted.' : 'Sound on.');
    }
    if (screen === SCREEN_BLESSING) {
      if (actions & ACTION_BLESS_1) pickBlessing(0);
      else if (actions & ACTION_BLESS_2) pickBlessing(1);
      else if (actions & ACTION_BLESS_3) pickBlessing(2);
      const click = input.takeClick();
      if (click) {
        const third = Math.floor((click.x / 1280) * 3);
        pickBlessing(Math.min(2, Math.max(0, third)));
      }
      return;
    }
    input.takeClick();
    if (actions & ACTION_CONFIRM && (screen === SCREEN_TITLE || screen === SCREEN_OVER || screen === SCREEN_VICTORY)) {
      startGame();
    } else if (actions & ACTION_PAUSE && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    } else if (actions & (ACTION_PAUSE | ACTION_CONFIRM) && screen === SCREEN_PAUSED) {
      screen = SCREEN_PLAY;
      announce('Playing.');
    }
  }

  function step() {
    if (screen === SCREEN_TITLE) {
      world.step(STEP, { moveX: 0, moveY: 0, aimX: 640, aimY: 0, firing: false }, true);
      return;
    }
    if (screen !== SCREEN_PLAY) return;
    const move = input.moveVector();
    const aim = input.aim();
    const events = world.step(
      STEP,
      { moveX: move.x, moveY: move.y, aimX: aim.x, aimY: aim.y, firing: input.isFiring() },
      false,
    );
    if (events & EVENT_KILL) audio.hit();
    if (events & EVENT_SHARD) audio.shard();
    if (events & EVENT_PICKUP) audio.pickup();
    if (events & EVENT_BOSS) audio.boss();
    if (events & EVENT_HIT) {
      audio.hurt();
      announce(world.state.player.hearts === 1 ? 'Hit. 1 heart left.' : `Hit. ${world.state.player.hearts} hearts left.`);
    }
    if (events & EVENT_WAVE_CLEAR) {
      audio.waveClear();
      screen = SCREEN_BLESSING;
      announce('Wave cleared. Choose a blessing.');
    } else if (events & EVENT_WIN) {
      audio.victory();
      winGame();
    } else if (events & EVENT_OVER) {
      audio.gameOver();
      endGame();
    }
  }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    handleActions();
    if (screen === SCREEN_TITLE || screen === SCREEN_PLAY) {
      while (accumulator >= STEP && (screen === SCREEN_TITLE || screen === SCREEN_PLAY)) {
        step();
        accumulator -= STEP;
      }
    } else {
      accumulator = 0;
    }
    renderer.draw(world.state, screen, best, { offered: world.state.offered, muted: audio.isMuted() });
  }

  // Leaving the tab pauses a running game rather than letting shadows swarm unseen.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    }
  });

  announce('Lentera Keeper. Press Space or click to start.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
