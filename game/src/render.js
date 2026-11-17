// Drawing only: the world's state and the current screen in, pixels out. The
// 1280x720 playfield is scaled to fit the window and centred, the margin
// filled with the backdrop colour. All art is drawn with canvas primitives —
// no image files, no network — so the game runs offline from its own files.
import { FIELD, FONT, PALETTE } from './config.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_BLESSING = 'blessing';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_VICTORY = 'victory';
export const SCREEN_OVER = 'over';

/** Deterministic decor: the same stars and cobbles on every load. */
function decorRandom(seed) {
  let a = seed | 0;
  return function random() {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function createRenderer(canvas) {
  const context = canvas.getContext('2d');
  const view = { scale: 1, x: 0, y: 0 };
  let skyGradient = null;
  const stars = [];
  const cobbles = [];
  const lights = [];
  {
    const rnd = decorRandom(20261117);
    for (let i = 0; i < 90; i += 1) stars.push({ x: rnd() * FIELD.width, y: rnd() * 260, r: 0.6 + rnd() * 1.4, tw: rnd() * Math.PI * 2 });
    for (let i = 0; i < 130; i += 1) cobbles.push({ x: rnd() * FIELD.width, y: 60 + rnd() * (FIELD.height - 120), r: 1 + rnd() * 2.2 });
    for (let i = 0; i < 14; i += 1) lights.push({ x: 60 + i * 88, y: 44 + Math.sin(i * 1.3) * 10, color: ['#f2c94c', '#ff8fa3', '#5eead4', '#ffb347'][i % 4] });
  }

  function resize() {
    const ratio = window.devicePixelRatio || 1;
    const width = Math.round(window.innerWidth * ratio);
    const height = Math.round(window.innerHeight * ratio);
    canvas.width = width;
    canvas.height = height;
    view.scale = Math.min(width / FIELD.width, height / FIELD.height);
    view.x = (width - FIELD.width * view.scale) / 2;
    view.y = (height - FIELD.height * view.scale) / 2;
    skyGradient = context.createLinearGradient(0, 0, 0, FIELD.height);
    skyGradient.addColorStop(0, PALETTE.skyTop);
    skyGradient.addColorStop(1, PALETTE.skyBottom);
  }

  const fonts = new Map();
  function text(value, x, y, size, color, align) {
    if (!fonts.has(size)) fonts.set(size, `bold ${size}px ${FONT}`);
    context.font = fonts.get(size);
    context.fillStyle = color;
    context.textAlign = align ?? 'left';
    context.fillText(value, x, y);
  }
  function plainText(value, x, y, size, color, align) {
    if (!fonts.has(-size)) fonts.set(-size, `${size}px ${FONT}`);
    context.font = fonts.get(-size);
    context.fillStyle = color;
    context.textAlign = align ?? 'left';
    context.fillText(value, x, y);
  }

  function roundRect(x, y, w, h, r) {
    context.beginPath();
    if (context.roundRect) context.roundRect(x, y, w, h, r);
    else context.rect(x, y, w, h);
  }

  function drawBackground(elapsed) {
    context.fillStyle = skyGradient;
    context.fillRect(0, 0, FIELD.width, FIELD.height);
    for (const s of stars) {
      const a = 0.35 + 0.35 * Math.sin(elapsed * 1.4 + s.tw);
      context.globalAlpha = a;
      context.fillStyle = '#f4efe4';
      context.beginPath();
      context.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      context.fill();
    }
    context.globalAlpha = 1;
    context.fillStyle = PALETTE.ground;
    for (const c of cobbles) {
      context.globalAlpha = 0.16;
      context.beginPath();
      context.arc(c.x, c.y, c.r, 0, Math.PI * 2);
      context.fill();
    }
    context.globalAlpha = 1;
    // Market stalls: striped awnings along the top and bottom edges.
    for (const top of [true, false]) {
      const y = top ? 0 : FIELD.height - 42;
      for (let i = 0; i < 8; i += 1) {
        const x = i * 160;
        context.fillStyle = i % 2 === 0 ? PALETTE.stallRed : PALETTE.stallCream;
        context.fillRect(x, y, 80, 42);
        context.fillStyle = i % 2 === 0 ? PALETTE.stallTeal : PALETTE.stallCream;
        context.fillRect(x + 80, y, 80, 42);
      }
      context.fillStyle = 'rgba(10,18,32,0.55)';
      context.fillRect(0, top ? 42 : FIELD.height - 42, FIELD.width, top ? 0 : 0);
    }
    // String lights sagging under the top awning.
    context.strokeStyle = 'rgba(244,239,228,0.35)';
    context.lineWidth = 1.5;
    context.beginPath();
    context.moveTo(0, 52);
    for (let x = 0; x <= FIELD.width; x += 64) context.lineTo(x, 52 + Math.sin(x / 180) * 8);
    context.stroke();
    for (const l of lights) {
      const glow = 0.6 + 0.4 * Math.sin(elapsed * 2 + l.x);
      context.globalAlpha = glow;
      context.fillStyle = l.color;
      context.beginPath();
      context.arc(l.x, 56 + Math.sin(l.x / 180) * 8, 5, 0, Math.PI * 2);
      context.fill();
    }
    context.globalAlpha = 1;
  }

  function drawLanternGlow(p) {
    const g = context.createRadialGradient(p.x, p.y, 10, p.x, p.y, 190);
    g.addColorStop(0, 'rgba(255,179,71,0.28)');
    g.addColorStop(1, 'rgba(255,179,71,0)');
    context.fillStyle = g;
    context.beginPath();
    context.arc(p.x, p.y, 190, 0, Math.PI * 2);
    context.fill();
  }

  function drawPlayer(p, elapsed) {
    const blink = p.invulnerable > 0 && Math.floor(p.invulnerable * 10) % 2 === 0;
    if (blink) return;
    // Aim guide: a faint dotted line toward the mouse.
    const dx = p.aimX - p.x;
    const dy = p.aimY - p.y;
    const d = Math.hypot(dx, dy) || 1;
    context.strokeStyle = 'rgba(242,201,76,0.4)';
    context.lineWidth = 2;
    context.setLineDash([4, 10]);
    context.beginPath();
    context.moveTo(p.x + (dx / d) * (p.r + 6), p.y + (dy / d) * (p.r + 6));
    context.lineTo(p.x + (dx / d) * (p.r + 52), p.y + (dy / d) * (p.r + 52));
    context.stroke();
    context.setLineDash([]);
    drawLanternGlow(p);
    // Keeper: teal robe circle, gold lantern, warm face.
    context.fillStyle = PALETTE.teal;
    context.beginPath();
    context.arc(p.x, p.y, p.r, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = '#f4efe4';
    context.beginPath();
    context.arc(p.x, p.y - 3, 8, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = PALETTE.lantern;
    context.beginPath();
    context.arc(p.x + (dx / d) * 14, p.y + (dy / d) * 14, 7, 0, Math.PI * 2);
    context.fill();
    if (p.shield) {
      context.strokeStyle = '#5eead4';
      context.lineWidth = 3;
      context.beginPath();
      context.arc(p.x, p.y, p.r + 9 + Math.sin(elapsed * 5) * 2, 0, Math.PI * 2);
      context.stroke();
    }
    if (p.rapidTimer > 0) {
      context.fillStyle = '#ffb347';
      context.beginPath();
      context.arc(p.x - 14, p.y - 14, 4, 0, Math.PI * 2);
      context.fill();
    }
  }

  function drawEnemy(e, elapsed) {
    if (e.kind === 'moth') {
      const flap = Math.sin(elapsed * 12 + e.phase) * 0.5;
      context.fillStyle = e.color;
      context.save();
      context.translate(e.x, e.y);
      context.rotate(flap * 0.4);
      context.beginPath();
      context.ellipse(-9, -4, 11, 6, -0.5, 0, Math.PI * 2);
      context.ellipse(9, -4, 11, 6, 0.5, 0, Math.PI * 2);
      context.fill();
      context.restore();
      context.fillStyle = '#2b2350';
      context.beginPath();
      context.arc(e.x, e.y, 7, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = '#ff5d73';
      context.beginPath();
      context.arc(e.x - 3, e.y - 1, 1.8, 0, Math.PI * 2);
      context.arc(e.x + 3, e.y - 1, 1.8, 0, Math.PI * 2);
      context.fill();
    } else if (e.kind === 'wisp') {
      context.fillStyle = e.color;
      context.globalAlpha = 0.85;
      context.beginPath();
      context.arc(e.x, e.y, e.r, 0, Math.PI * 2);
      context.fill();
      context.globalAlpha = 1;
      context.fillStyle = '#0d1526';
      context.beginPath();
      context.arc(e.x - 4, e.y - 2, 3, 0, Math.PI * 2);
      context.arc(e.x + 4, e.y - 2, 3, 0, Math.PI * 2);
      context.fill();
      context.strokeStyle = e.color;
      context.lineWidth = 3;
      context.beginPath();
      context.moveTo(e.x - 8, e.y + 8);
      context.quadraticCurveTo(e.x, e.y + 20 + Math.sin(elapsed * 6 + e.phase) * 5, e.x + 8, e.y + 8);
      context.stroke();
    } else if (e.kind === 'beetle') {
      context.fillStyle = '#7a2e2e';
      context.beginPath();
      context.arc(e.x, e.y, e.r, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = e.color;
      context.beginPath();
      context.arc(e.x, e.y - 3, e.r - 5, 0, Math.PI);
      context.fill();
      context.strokeStyle = '#3d1515';
      context.lineWidth = 2;
      context.beginPath();
      context.moveTo(e.x, e.y - e.r);
      context.lineTo(e.x, e.y + 4);
      context.stroke();
      context.fillStyle = '#ffd166';
      context.beginPath();
      context.arc(e.x - 7, e.y + 2, 2.4, 0, Math.PI * 2);
      context.arc(e.x + 7, e.y + 2, 2.4, 0, Math.PI * 2);
      context.fill();
    } else {
      // Raksasa Bayang: a huge shadow with a crown of spikes and burning eyes.
      context.fillStyle = '#241d45';
      context.beginPath();
      context.arc(e.x, e.y, e.r, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = '#171233';
      for (let i = 0; i < 7; i += 1) {
        const a = -Math.PI / 2 + (i - 3) * 0.42;
        context.beginPath();
        context.moveTo(e.x + Math.cos(a - 0.14) * (e.r - 6), e.y + Math.sin(a - 0.14) * (e.r - 6));
        context.lineTo(e.x + Math.cos(a) * (e.r + 22), e.y + Math.sin(a) * (e.r + 22));
        context.lineTo(e.x + Math.cos(a + 0.14) * (e.r - 6), e.y + Math.sin(a + 0.14) * (e.r - 6));
        context.fill();
      }
      const pulse = 0.7 + 0.3 * Math.sin(elapsed * 3);
      context.fillStyle = `rgba(255,93,115,${pulse})`;
      context.beginPath();
      context.arc(e.x - 18, e.y - 8, 8, 0, Math.PI * 2);
      context.arc(e.x + 18, e.y - 8, 8, 0, Math.PI * 2);
      context.fill();
      // Boss health bar above the boss.
      const w = 110;
      context.fillStyle = 'rgba(10,18,32,0.8)';
      context.fillRect(e.x - w / 2, e.y - e.r - 22, w, 10);
      context.fillStyle = '#ff5d73';
      context.fillRect(e.x - w / 2, e.y - e.r - 22, w * Math.max(0, e.hp / e.maxHp), 10);
    }
    if (e.kind !== 'boss' && e.maxHp > 1) {
      const w = e.r * 2;
      context.fillStyle = 'rgba(10,18,32,0.7)';
      context.fillRect(e.x - w / 2, e.y - e.r - 9, w, 4);
      context.fillStyle = '#ff8fa3';
      context.fillRect(e.x - w / 2, e.y - e.r - 9, w * Math.max(0, e.hp / e.maxHp), 4);
    }
  }

  function drawHud(state, best) {
    context.textBaseline = 'top';
    text(`Score ${state.score}`, 24, 64, 26, PALETTE.text, 'left');
    text(`Wave ${state.wave}`, FIELD.width / 2, 64, 26, PALETTE.text, 'center');
    text(`Best ${Math.max(best, state.score)}`, FIELD.width - 24, 64, 26, PALETTE.text, 'right');
    // Hearts, top right under the best score.
    const p = state.player;
    for (let i = 0; i < p.maxHearts; i += 1) {
      const x = FIELD.width - 24 - i * 32;
      context.fillStyle = i < p.hearts ? '#ff5d73' : 'rgba(244,239,228,0.25)';
      context.font = '26px system-ui, sans-serif';
      context.textAlign = 'right';
      context.fillText('♥', x, 96);
    }
    if (state.comboMult > 1) {
      text(`Combo x${state.comboMult}`, 24, 100, 22, PALETTE.gold, 'left');
    }
    if (state.boss) {
      const w = 420;
      const x = (FIELD.width - w) / 2;
      context.fillStyle = 'rgba(10,18,32,0.8)';
      context.fillRect(x, 100, w, 14);
      context.fillStyle = '#ff5d73';
      context.fillRect(x, 100, w * Math.max(0, state.boss.hp / state.boss.maxHp), 14);
      plainText('RAKSASA BAYANG', FIELD.width / 2, 118, 15, '#ff8fa3', 'center');
    }
    context.textBaseline = 'alphabetic';
  }

  function drawPanel(title, lines, prompt, promptColor) {
    const width = 640;
    const lineH = 32;
    const height = 150 + lines.length * lineH + 74;
    const x = (FIELD.width - width) / 2;
    const y = (FIELD.height - height) / 2;
    context.fillStyle = 'rgba(8,12,24,0.62)';
    context.fillRect(0, 0, FIELD.width, FIELD.height);
    context.fillStyle = PALETTE.panel;
    roundRect(x, y, width, height, 16);
    context.fill();
    context.strokeStyle = PALETTE.panelEdge;
    context.lineWidth = 2;
    context.stroke();
    context.textBaseline = 'alphabetic';
    text(title, FIELD.width / 2, y + 72, 44, PALETTE.text, 'center');
    for (let i = 0; i < lines.length; i += 1) {
      plainText(lines[i], FIELD.width / 2, y + 122 + i * lineH, 20, PALETTE.muted, 'center');
    }
    text(prompt, FIELD.width / 2, y + height - 34, 22, promptColor ?? PALETTE.gold, 'center');
  }

  function drawBlessings(offered, best) {
    context.fillStyle = 'rgba(8,12,24,0.72)';
    context.fillRect(0, 0, FIELD.width, FIELD.height);
    text('Wave cleared!', FIELD.width / 2, 120, 44, PALETTE.text, 'center');
    plainText('Choose a blessing — click a card or press 1, 2 or 3.', FIELD.width / 2, 168, 20, PALETTE.muted, 'center');
    const cardW = 340;
    const cardH = 210;
    const gap = 28;
    const total = cardW * 3 + gap * 2;
    const startX = (FIELD.width - total) / 2;
    const y = 240;
    for (let i = 0; i < offered.length; i += 1) {
      const b = offered[i];
      const x = startX + i * (cardW + gap);
      context.fillStyle = PALETTE.panel;
      roundRect(x, y, cardW, cardH, 16);
      context.fill();
      context.strokeStyle = PALETTE.gold;
      context.lineWidth = 2;
      context.stroke();
      text(`${i + 1}`, x + 22, y + 44, 22, PALETTE.gold, 'left');
      text(b.name, x + cardW / 2, y + 96, 26, PALETTE.text, 'center');
      plainText(b.desc, x + cardW / 2, y + 140, 19, PALETTE.muted, 'center');
      plainText('click or press ' + (i + 1), x + cardW / 2, y + 178, 16, PALETTE.gold, 'center');
    }
    plainText(`Score ${best}  ·  next wave brings more shadows`, FIELD.width / 2, y + cardH + 48, 18, PALETTE.muted, 'center');
  }

  function draw(state, screen, best, ui) {
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.fillStyle = PALETTE.backdrop;
    context.fillRect(0, 0, canvas.width, canvas.height);
    const shakeX = state.shake > 0 ? (Math.random() - 0.5) * state.shake : 0;
    const shakeY = state.shake > 0 ? (Math.random() - 0.5) * state.shake : 0;
    context.setTransform(view.scale, 0, 0, view.scale, view.x + shakeX * view.scale, view.y + shakeY * view.scale);
    drawBackground(state.elapsed);
    for (const s of state.shards) {
      const pulse = 0.75 + 0.25 * Math.sin(state.elapsed * 6 + s.x);
      context.globalAlpha = pulse;
      context.fillStyle = PALETTE.gold;
      context.save();
      context.translate(s.x, s.y);
      context.rotate(Math.PI / 4);
      context.fillRect(-6, -6, 12, 12);
      context.restore();
    }
    context.globalAlpha = 1;
    for (const u of state.powerups) {
      const bob = Math.sin(u.bob) * 4;
      context.fillStyle = u.kind === 'heart' ? '#ff8fa3' : u.kind === 'rapid' ? '#ffb347' : '#5eead4';
      context.beginPath();
      context.arc(u.x, u.y + bob, u.r, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = '#0d1526';
      context.font = 'bold 16px system-ui, sans-serif';
      context.textAlign = 'center';
      context.fillText(u.kind === 'heart' ? '♥' : u.kind === 'rapid' ? '»' : '◈', u.x, u.y + bob + 6);
    }
    for (const e of state.enemies) drawEnemy(e, state.elapsed);
    for (const b of state.bullets) {
      context.fillStyle = '#ffe9a8';
      context.beginPath();
      context.arc(b.x, b.y, b.r, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = 'rgba(242,201,76,0.5)';
      context.beginPath();
      context.arc(b.x, b.y, b.r + 4, 0, Math.PI * 2);
      context.fill();
    }
    if (state.player) drawPlayer(state.player, state.elapsed);
    for (const pt of state.particles) {
      context.globalAlpha = Math.max(0, pt.life / pt.maxLife);
      context.fillStyle = pt.color;
      context.beginPath();
      context.arc(pt.x, pt.y, pt.size, 0, Math.PI * 2);
      context.fill();
    }
    context.globalAlpha = 1;
    context.textBaseline = 'alphabetic';
    for (const f of state.floats) {
      context.globalAlpha = Math.max(0, f.life / f.maxLife);
      plainText(f.text, f.x, f.y, 17, f.color, 'center');
    }
    context.globalAlpha = 1;

    if (screen === SCREEN_PLAY || screen === SCREEN_BLESSING || screen === SCREEN_PAUSED) {
      drawHud(state, best);
    }
    if (state.flash > 0) {
      context.fillStyle = `rgba(229,83,75,${state.flash * 0.22})`;
      context.fillRect(0, 0, FIELD.width, FIELD.height);
    }
    if (screen === SCREEN_TITLE) {
      drawPanel(
        'LENTERA KEEPER',
        [
          'Keep the night market lit. Shadows swarm in waves —',
          'blast them with lantern light, gather star shards,',
          'and choose a blessing between waves.',
          'Survive all 10 waves and fell the Raksasa Bayang.',
          'Move: WASD / arrows  ·  Aim: mouse  ·  Shoot: hold click or Space',
          'Pause: P  ·  Mute: M  ·  Blessings: click or press 1 / 2 / 3',
        ],
        best > 0 ? `Best ${best} — press Space or click to play` : 'Press Space or click to play',
      );
    } else if (screen === SCREEN_BLESSING) {
      drawBlessings(ui.offered, state.score);
    } else if (screen === SCREEN_PAUSED) {
      drawPanel('Paused', ['The shadows wait for you.'], 'Press P or click to keep playing');
    } else if (screen === SCREEN_VICTORY) {
      drawPanel(
        'THE MARKET SHINES!',
        [
          `You cleared all 10 waves. Final score ${state.score}.`,
          `Best ${Math.max(best, state.score)} — the lanterns stay lit tonight.`,
        ],
        'Press Space or click to play again',
      );
    } else if (screen === SCREEN_OVER) {
      drawPanel(
        'THE LIGHT GOES OUT',
        [
          `The shadows took the market. Score ${state.score}.`,
          `Best ${Math.max(best, state.score)} — wave ${state.wave} was one too many.`,
        ],
        'Press Space or click to try again',
      );
    }
    if (ui && ui.muted) {
      plainText('Muted (M)', FIELD.width - 24, FIELD.height - 18, 15, PALETTE.muted, 'right');
    }
  }

  resize();
  window.addEventListener('resize', resize);
  return { draw, resize };
}
