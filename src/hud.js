// Rockstar HUD: rotating radar + GPS, stars, cash, wheels, subtitles, screen states.
import { S, WEAPONS, on, CHAR_COLORS } from './state.js';
import { down, mouse } from './input.js';
import { STATIONS, setRadio, setWheelOpen, sfx, radioPlaying } from './audio.js';
import { TILE, GRID, tileCenter, isRoadTile, LOC } from './world.js';

const $ = id => document.getElementById(id);
const el = {
  hud: $('hud'), radar: $('radar'), barH: $('bar-health'), barA: $('bar-armor'), barB: $('bar-ability'),
  healthBar: document.querySelector('.bar.health'),
  stars: $('wanted-stars'), cash: $('cash'), cashDelta: $('cash-delta'),
  weaponName: $('weapon-name'), ammo: $('ammo'), controlsHint: $('controls-hint'),
  notif: $('notifications'), radioPopup: $('radio-popup'), objective: $('objective'),
  subs: $('subtitles'), bigPrompt: $('big-prompt'),
  special: $('special-bar'), specialLabel: $('special-label'), specialFill: $('special-fill'),
  crosshair: $('crosshair'), wheelOverlay: $('wheel-overlay'), wheel: $('wheel'), wheelTitle: $('wheel-title'),
  phone: $('phone'), phoneBody: $('phone-body'),
  order: $('order-game'), orderItems: $('order-items'), orderQuote: $('order-quote'), orderCal: $('order-calories'),
  screen: $('screen-state'), banner: $('screen-banner'), screenSub: $('screen-sub'),
  medals: $('medal-list'), screenBtn: $('screen-btn'),
  vignette: $('vignette'), flash: $('flash'), damageFlash: $('damage-flash'),
  canvas: $('game-canvas'),
};
const rctx = el.radar.getContext('2d');

export const hud = {
  allies: [],
  wheelOpen: null, wheelSel: 0,
  subQueue: [],
  escaped: false,

  init() {
    on('say', ({ who, text, dur }) => this.addSub(who, text, dur));
    on('cash', n => this.cashPop(n));
    on('damage', () => {
      el.damageFlash.style.opacity = 0.8;
      setTimeout(() => el.damageFlash.style.opacity = 0, 120);
    });
    on('sparkle', () => this.notify('BAGUVIX: invincibility sparkles ✨', 'cheat'));
    window.addEventListener('gtv-skycam', e => {
      this.flash(3);
      this.notify(e.detail === 'iso' ? 'SKY-CAM: 2.5D ISOMETRIC (PLAN-B)' : 'SKY-CAM: 3D THIRD-PERSON');
    });
    window.addEventListener('gtv-enter-vehicle', e => {
      const v = e.detail;
      if (S.radio < 0) {
        S.radio = Math.floor(Math.random() * 3);
        setRadio(S.radio);
      }
      this.radioPop();
    });
    window.addEventListener('gtv-hoodfire', () => {
      this.notify('🔥 HOOD FIRE! 4 seconds to explosion — bail out (F) or respray!', 'cheat');
    });
    // build stars
    el.stars.innerHTML = '';
    for (let i = 0; i < 5; i++) {
      const s = document.createElement('span');
      s.className = 'star'; s.textContent = '★';
      el.stars.appendChild(s);
    }
  },

  show() { el.hud.classList.remove('hidden'); },
  hide() { el.hud.classList.add('hidden'); },

  notify(text, cls = '') {
    const d = document.createElement('div');
    d.className = 'notification ' + cls;
    d.textContent = text;
    el.notif.appendChild(d);
    setTimeout(() => d.remove(), 4200);
    while (el.notif.children.length > 4) el.notif.firstChild.remove();
  },

  cashPop(n) {
    el.cash.textContent = '$' + String(Math.floor(S.cash)).padStart(8, '0');
    if (!n) return;
    el.cashDelta.textContent = (n > 0 ? '+' : '-') + '$' + Math.abs(n).toLocaleString();
    el.cashDelta.className = n > 0 ? 'plus' : 'minus';
    clearTimeout(this._cashT);
    this._cashT = setTimeout(() => el.cashDelta.textContent = '', 2200);
  },

  addSub(who, text, dur = 3.2) {
    const d = document.createElement('div');
    d.className = 'subtitle';
    const color = CHAR_COLORS[who] || '#fff';
    d.innerHTML = `<span style="color:${color}">${who}:</span> <span style="color:#fff">${text}</span>`;
    el.subs.appendChild(d);
    while (el.subs.children.length > 3) el.subs.firstChild.remove();
    setTimeout(() => d.remove(), dur * 1000);
  },

  prompt(text) {
    if (!text) { el.bigPrompt.classList.add('hidden'); return; }
    el.bigPrompt.innerHTML = text;
    el.bigPrompt.classList.remove('hidden');
  },

  setObjective(text, target = null) {
    if (!text) { el.objective.classList.add('hidden'); S.objective = null; return; }
    el.objective.innerHTML = text;
    el.objective.classList.remove('hidden');
    S.objective = target;
  },

  specialBar(label, frac, cls = '') {
    if (label === null) { el.special.classList.add('hidden'); return; }
    el.special.classList.remove('hidden');
    el.special.className = cls;
    el.special.id = 'special-bar';
    el.specialLabel.textContent = label;
    el.specialFill.style.width = Math.max(0, Math.min(100, frac * 100)) + '%';
  },

  radioPop() {
    if (S.radio < 0) { el.radioPopup.classList.add('hidden'); return; }
    const st = STATIONS[S.radio];
    el.radioPopup.innerHTML = `<b>${st.freq}</b> — ${st.name}`;
    el.radioPopup.classList.remove('hidden');
    clearTimeout(this._radioT);
    this._radioT = setTimeout(() => el.radioPopup.classList.add('hidden'), 3500);
  },

  flash(times = 1) {
    let k = 0;
    const pulse = () => {
      el.flash.style.transition = 'none'; el.flash.style.opacity = 0.85;
      requestAnimationFrame(() => {
        el.flash.style.transition = 'opacity .18s'; el.flash.style.opacity = 0;
      });
      if (++k < times) setTimeout(pulse, 160);
    };
    pulse();
  },

  // ---------- wheels ----------
  openWheel(kind) {
    this.wheelOpen = kind;
    this.wheelSel = kind === 'weapon' ? S.weapon : S.radio + 1;
    el.canvas.classList.add('wheel-open');
    el.wheelOverlay.classList.remove('hidden');
    el.wheelTitle.textContent = kind === 'weapon' ? 'WEAPON WHEEL' : 'RADIO WHEEL';
    const items = kind === 'weapon'
      ? WEAPONS.map(w => w.name)
      : ['RADIO OFF', ...STATIONS.map(s => s.name)];
    el.wheel.innerHTML = '';
    this._wheelItems = items;
    items.forEach((name, i) => {
      const a = (i / items.length) * Math.PI * 2 - Math.PI / 2;
      const d = document.createElement('div');
      d.className = 'wheel-item';
      d.textContent = name;
      d.style.left = (170 + Math.cos(a) * 130) + 'px';
      d.style.top = (170 + Math.sin(a) * 130) + 'px';
      el.wheel.appendChild(d);
    });
    setWheelOpen(true);
    sfx.uiBeep();
  },

  closeWheel() {
    if (!this.wheelOpen) return;
    if (this.wheelOpen === 'weapon') {
      S.weapon = this.wheelSel;
      this.notify('Equipped: ' + WEAPONS[S.weapon].name);
    } else {
      S.radio = this.wheelSel - 1;
      setRadio(S.radio);
      this.radioPop();
    }
    this.wheelOpen = null;
    el.canvas.classList.remove('wheel-open');
    el.wheelOverlay.classList.add('hidden');
    setWheelOpen(false);
  },

  updateWheel() {
    const wantWeapon = down('Tab');
    const wantRadio = down('KeyR') && !this.wheelOpen;
    if (wantWeapon && this.wheelOpen !== 'weapon') { this.closeWheel(); this.openWheel('weapon'); }
    else if (wantRadio && !this.wheelOpen) this.openWheel('radio');
    if (this.wheelOpen === 'weapon' && !wantWeapon) this.closeWheel();
    if (this.wheelOpen === 'radio' && !down('KeyR')) this.closeWheel();
    if (this.wheelOpen) {
      // select by mouse angle around screen center
      const cx = window.innerWidth / 2, cy = window.innerHeight / 2;
      const dx = (window._mouseX || cx) - cx, dy = (window._mouseY || cy) - cy;
      if (Math.hypot(dx, dy) > 40) {
        let a = Math.atan2(dy, dx) + Math.PI / 2;
        while (a < 0) a += Math.PI * 2;
        const n = this._wheelItems.length;
        this.wheelSel = Math.round(a / (Math.PI * 2) * n) % n;
      }
      [...el.wheel.children].forEach((c, i) => c.classList.toggle('selected', i === this.wheelSel));
    }
  },

  // ---------- phone ----------
  showPhone(buttons) {
    el.phone.classList.remove('hidden');
    el.phoneBody.innerHTML = '';
    sfx.phoneRing();
    buttons.forEach(b => {
      const btn = document.createElement('button');
      btn.className = 'phone-btn ' + (b.cls || '');
      btn.textContent = b.label;
      btn.onclick = () => { this.hidePhone(); b.onClick(); };
      el.phoneBody.appendChild(btn);
    });
  },
  hidePhone() { el.phone.classList.add('hidden'); },

  // ---------- order minigame (ch3) ----------
  showOrder(items, quote, onDone) {
    el.order.classList.remove('hidden');
    el.orderQuote.textContent = quote;
    el.orderItems.innerHTML = '';
    let idx = 0, kcal = 0;
    const btns = items.map((it, i) => {
      const b = document.createElement('button');
      b.className = 'order-item' + (i === 0 ? ' next' : '');
      b.textContent = it.label;
      b.onclick = () => {
        if (i !== idx) return;
        b.classList.remove('next'); b.classList.add('done');
        kcal += it.kcal;
        el.orderCal.textContent = kcal.toLocaleString() + ' kcal';
        sfx.orderDone();
        idx++;
        if (btns[idx]) btns[idx].classList.add('next');
        else setTimeout(() => { el.order.classList.add('hidden'); onDone(kcal); }, 700);
      };
      el.orderItems.appendChild(b);
      return b;
    });
    el.orderCal.textContent = '0 kcal';
  },

  // ---------- screen states ----------
  wasted(cb, busted = false) {
    S.dead = true;
    S.timeScale = 0.2;
    el.canvas.classList.add('wasted');
    el.vignette.className = busted ? 'busted' : 'wasted';
    el.vignette.id = 'vignette';
    busted ? sfx.busted() : sfx.wasted();
    el.screen.classList.remove('hidden');
    el.banner.textContent = '';
    el.screenSub.textContent = '';
    el.medals.innerHTML = '';
    el.screenBtn.classList.add('hidden');
    setTimeout(() => {
      el.banner.textContent = busted ? 'BUSTED' : 'WASTED';
      el.banner.className = busted ? 'busted' : 'wasted';
    }, 800);
    setTimeout(() => {
      el.screen.classList.add('hidden');
      el.canvas.classList.remove('wasted');
      el.vignette.className = '';
      S.timeScale = 1;
      S.dead = false;
      cb();
    }, 3000);
  },

  passed({ sub = '', medals = [], cash = 0, respect = 0, btn = 'CONTINUE', cb }) {
    S.timeScale = 0.15;
    el.screen.classList.remove('hidden');
    el.banner.textContent = 'MISSION PASSED!';
    el.banner.className = 'passed';
    el.screenSub.innerHTML = `RESPECT +${respect}`;
    el.medals.innerHTML = '';
    el.screenBtn.classList.add('hidden');
    sfx.missionPassed();
    medals.forEach((m, i) => {
      setTimeout(() => {
        const d = document.createElement('div');
        d.className = 'medal'; d.textContent = m;
        el.medals.appendChild(d);
        sfx.uiBeep();
      }, 700 + i * 500);
    });
    // ticking cash
    if (cash > 0) {
      let shown = 0;
      const step = Math.max(100, Math.floor(cash / 40));
      const t = setInterval(() => {
        shown = Math.min(cash, shown + step);
        el.screenSub.innerHTML = `RESPECT +${respect} &nbsp;·&nbsp; <span style="color:#67e05a">$${shown.toLocaleString()}</span>`;
        if (shown >= cash) clearInterval(t);
      }, 50);
    }
    setTimeout(() => {
      el.screenBtn.textContent = btn;
      el.screenBtn.classList.remove('hidden');
      el.screenBtn.onclick = () => {
        el.screen.classList.add('hidden');
        S.timeScale = 1;
        if (cash) { S.cash += cash; this.cashPop(cash); }
        S.respect += respect;
        cb && cb();
      };
    }, 1600);
  },

  freezeFrame(text, cb) {
    el.canvas.classList.add('wasted');
    el.screen.classList.remove('hidden');
    el.banner.textContent = text;
    el.banner.className = 'wasted';
    el.banner.style.fontSize = '44px';
    el.screenSub.textContent = '';
    el.medals.innerHTML = '';
    el.screenBtn.classList.add('hidden');
    sfx.wasted();
    setTimeout(() => {
      el.banner.style.fontSize = '';
      el.screen.classList.add('hidden');
      el.canvas.classList.remove('wasted');
      cb();
    }, 3400);
  },

  // ---------- per-frame ----------
  update(dt, player, traffic) {
    // bars
    el.barH.style.width = S.health + '%';
    el.barA.style.width = S.armor + '%';
    el.barB.style.width = S.ability + '%';
    el.healthBar.classList.toggle('low', S.health < 25);
    // stars
    const stars = el.stars.children;
    for (let i = 0; i < 5; i++) {
      stars[i].className = 'star' + (i < S.wanted ? (traffic.escapeTimer > 0.5 ? ' lost' : ' active') : '');
    }
    // weapon
    const w = WEAPONS[S.weapon];
    el.weaponName.textContent = w.name;
    el.ammo.textContent = `${S.ammo[S.weapon].clip} / ${S.ammo[S.weapon].total}`;
    const v = player.vehicle;
    const showCross = !v || v.kind === 'tank';
    el.crosshair.classList.toggle('hidden', !showCross);
    if (showCross) { el.crosshair.style.left = mouse.x + 'px'; el.crosshair.style.top = mouse.y + 'px'; }
    el.crosshair.classList.toggle('aiming', player.aiming);
    const hint = !v
      ? 'LMB shoot at cursor · RMB aim · 1/2/3 or TAB weapon · F enter vehicle'
      : v.kind === 'tank'
        ? 'Mouse aim turret · LMB fire cannon · F exit'
        : 'LMB drive-by (shoots forward) · 1/2/3 weapon · SPACE handbrake/hop · F exit';
    if (el.controlsHint.textContent !== hint) el.controlsHint.textContent = hint;
    this.updateWheel();
    this.drawRadar(player, traffic);
  },

  drawRadar(player, traffic) {
    const W = 320, H = 180;
    const p = player.vehicle ? player.vehicle.pos : player.pos;
    const heading = player.vehicle ? player.vehicle.heading : player.heading;
    const rotate = S.cameraMode === '3d' && player.vehicle;
    const scale = 1.35; // px per meter
    rctx.save();
    rctx.fillStyle = '#101418';
    rctx.fillRect(0, 0, W, H);
    rctx.translate(W / 2, H / 2 + (rotate ? 30 : 0));
    if (rotate) rctx.rotate(heading - Math.PI);
    rctx.scale(scale, scale);
    rctx.translate(-p.x, -p.z);

    // roads & blocks near player
    const range = 130;
    const i0 = Math.max(0, Math.floor((p.x - range + 192) / TILE));
    const i1 = Math.min(GRID - 1, Math.ceil((p.x + range + 192) / TILE));
    const j0 = Math.max(0, Math.floor((p.z - range + 192) / TILE));
    const j1 = Math.min(GRID - 1, Math.ceil((p.z + range + 192) / TILE));
    for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) {
      const x = tileCenter(i) - TILE / 2, z = tileCenter(j) - TILE / 2;
      rctx.fillStyle = isRoadTile(i, j) ? '#3c424a' : '#1c222a';
      rctx.fillRect(x, z, TILE, TILE);
    }
    // train tracks
    rctx.fillStyle = '#5a5248';
    rctx.fillRect(-212, LOC.tracksZ - 4, 424, 8);

    // GPS route (yellow L-path) to objective
    if (S.objective) {
      rctx.strokeStyle = '#ffd24a'; rctx.lineWidth = 2.5 / scale;
      rctx.beginPath();
      rctx.moveTo(p.x, p.z);
      rctx.lineTo(S.objective.x, p.z);
      rctx.lineTo(S.objective.x, S.objective.z);
      rctx.stroke();
      rctx.fillStyle = '#ffd24a';
      rctx.fillRect(S.objective.x - 3, S.objective.z - 3, 6, 6);
    }
    // waypoint (purple)
    if (S.waypoint) {
      rctx.strokeStyle = '#b06aff'; rctx.lineWidth = 2 / scale;
      rctx.beginPath();
      rctx.moveTo(p.x, p.z);
      rctx.lineTo(S.waypoint.x, p.z);
      rctx.lineTo(S.waypoint.x, S.waypoint.z);
      rctx.stroke();
      rctx.fillStyle = '#b06aff';
      rctx.fillRect(S.waypoint.x - 2.5, S.waypoint.z - 2.5, 5, 5);
    }
    // police vision cones
    const t = Math.floor(performance.now() / 300) % 2;
    for (const c of traffic.cops) {
      if (c.dead) continue;
      rctx.fillStyle = t ? 'rgba(255,60,60,.3)' : 'rgba(80,120,255,.3)';
      rctx.beginPath();
      rctx.moveTo(c.pos.x, c.pos.z);
      const a = c.heading;
      rctx.lineTo(c.pos.x + Math.sin(a - 0.4) * 26, c.pos.z + Math.cos(a - 0.4) * 26);
      rctx.lineTo(c.pos.x + Math.sin(a + 0.4) * 26, c.pos.z + Math.cos(a + 0.4) * 26);
      rctx.fill();
      rctx.fillStyle = '#ff4444';
      rctx.fillRect(c.pos.x - 2, c.pos.z - 2, 4, 4);
    }
    for (const c of traffic.copPeds) {
      if (c.dead) continue;
      rctx.fillStyle = '#ff6666';
      rctx.fillRect(c.x - 1.5, c.z - 1.5, 3, 3);
    }
    // allies (blue)
    for (const a of this.allies) {
      rctx.fillStyle = '#4a9adf';
      rctx.fillRect(a.x - 2.5, a.z - 2.5, 5, 5);
    }
    // player arrow
    rctx.save();
    rctx.translate(p.x, p.z);
    if (!rotate) rctx.rotate(-heading);
    rctx.fillStyle = '#ffffff';
    rctx.beginPath();
    if (rotate) { rctx.moveTo(0, -5); rctx.lineTo(-3.4, 4); rctx.lineTo(3.4, 4); }
    else { rctx.moveTo(0, 5); rctx.lineTo(-3.4, -4); rctx.lineTo(3.4, -4); }
    rctx.closePath(); rctx.fill();
    rctx.restore();

    rctx.restore();
    // border tilt illusion in 3d driving
    el.radar.style.transform = rotate ? 'perspective(400px) rotateX(12deg)' : 'none';
  },
};

// track mouse for wheel selection
window.addEventListener('mousemove', e => { window._mouseX = e.clientX; window._mouseY = e.clientY; });

// minimap click → purple waypoint
el.radar.addEventListener('click', e => {
  const rect = el.radar.getBoundingClientRect();
  const p = window._gtvPlayer;
  if (!p) return;
  const pp = p.vehicle ? p.vehicle.pos : p.pos;
  const heading = p.vehicle ? p.vehicle.heading : p.heading;
  const rotate = S.cameraMode === '3d' && p.vehicle;
  const px = (e.clientX - rect.left) * (320 / rect.width) - 160;
  const py = (e.clientY - rect.top) * (180 / rect.height) - (90 + (rotate ? 30 : 0));
  const scale = 1.35;
  let x = px / scale, z = py / scale;
  if (rotate) {
    const th = heading - Math.PI;
    const c = Math.cos(th), s = Math.sin(th);
    const rx = x * c + z * s, rz = -x * s + z * c;
    x = rx; z = rz;
  }
  S.waypoint = { x: pp.x + x, z: pp.z + z };
  hud.notify('Waypoint set (purple route)');
});