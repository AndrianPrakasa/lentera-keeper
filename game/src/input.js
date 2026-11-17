// Keyboard and pointer input. Held keys give a steering vector; one-shot
// presses (start or restart, pause, mute, blessing picks) are queued as bit
// flags and taken once by the loop, so a press between two frames is never
// lost and never counted twice. The mouse aims in playfield coordinates and
// holding it fires; a click also confirms panels and picks blessings.
import { FIELD } from './config.js';

export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_MUTE = 4;
export const ACTION_BLESS_1 = 8;
export const ACTION_BLESS_2 = 16;
export const ACTION_BLESS_3 = 32;

const UP = new Set(['ArrowUp', 'KeyW']);
const DOWN = new Set(['ArrowDown', 'KeyS']);
const LEFT = new Set(['ArrowLeft', 'KeyA']);
const RIGHT = new Set(['ArrowRight', 'KeyD']);
const CONFIRM = new Set(['Space', 'Enter']);
const PAUSE = new Set(['KeyP', 'Escape']);

export function createInput(target) {
  const held = new Set();
  let actions = 0;
  let aimX = FIELD.width / 2;
  let aimY = 0;
  let firing = false;
  let lastClick = null;

  function toField(clientX, clientY) {
    const rect = target.getBoundingClientRect();
    const scale = Math.min(rect.width / FIELD.width, rect.height / FIELD.height);
    const ox = (rect.width - FIELD.width * scale) / 2;
    const oy = (rect.height - FIELD.height * scale) / 2;
    return {
      x: Math.min(FIELD.width, Math.max(0, (clientX - rect.left - ox) / scale)),
      y: Math.min(FIELD.height, Math.max(0, (clientY - rect.top - oy) / scale)),
    };
  }

  window.addEventListener('keydown', (event) => {
    if (UP.has(event.code) || DOWN.has(event.code) || LEFT.has(event.code) || RIGHT.has(event.code)) {
      held.add(event.code);
      event.preventDefault();
    } else if (CONFIRM.has(event.code)) {
      if (!event.repeat) actions |= ACTION_CONFIRM;
      event.preventDefault();
    } else if (PAUSE.has(event.code)) {
      if (!event.repeat) actions |= ACTION_PAUSE;
    } else if (event.code === 'KeyM') {
      if (!event.repeat) actions |= ACTION_MUTE;
    } else if (event.code === 'Digit1') {
      if (!event.repeat) actions |= ACTION_BLESS_1;
    } else if (event.code === 'Digit2') {
      if (!event.repeat) actions |= ACTION_BLESS_2;
    } else if (event.code === 'Digit3') {
      if (!event.repeat) actions |= ACTION_BLESS_3;
    }
  });
  window.addEventListener('keyup', (event) => {
    held.delete(event.code);
  });
  window.addEventListener('blur', () => {
    held.clear();
    firing = false;
  });
  target.addEventListener('pointermove', (event) => {
    const p = toField(event.clientX, event.clientY);
    aimX = p.x;
    aimY = p.y;
  });
  target.addEventListener('pointerdown', (event) => {
    const p = toField(event.clientX, event.clientY);
    aimX = p.x;
    aimY = p.y;
    firing = true;
    lastClick = p;
    actions |= ACTION_CONFIRM;
  });
  target.addEventListener('pointerup', () => {
    firing = false;
  });
  target.addEventListener('pointerleave', () => {
    firing = false;
  });

  function has(...codes) {
    return codes.some((c) => held.has(c));
  }

  return {
    /** Normalised steering vector from WASD / arrows. */
    moveVector() {
      const x = (has('ArrowRight', 'KeyD') ? 1 : 0) - (has('ArrowLeft', 'KeyA') ? 1 : 0);
      const y = (has('ArrowDown', 'KeyS') ? 1 : 0) - (has('ArrowUp', 'KeyW') ? 1 : 0);
      return { x, y };
    },
    aim() {
      return { x: aimX, y: aimY };
    },
    isFiring() {
      return firing || held.has('Space');
    },
    /** The one-shot presses since the last call, as ACTION_* flags. */
    takeActions() {
      const taken = actions;
      actions = 0;
      return taken;
    },
    /** The last click's playfield position, if any since the last call. */
    takeClick() {
      const click = lastClick;
      lastClick = null;
      return click;
    },
  };
}
