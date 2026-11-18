// Keyboard + mouse input, cheat-code buffer.
export const keys = {};
export const mouse = { x: 0, y: 0, lmb: false, rmb: false, ndcX: 0, ndcY: 0 };
let cheatBuf = '';
const CHEATS = ['HESOYAM', 'RIPAZHA', 'BAGUVIX'];
const cheatHandlers = {};

export function onCheat(code, fn) { cheatHandlers[code] = fn; }

export function initInput(canvas) {
  window.addEventListener('keydown', e => {
    if (e.repeat) { if (e.code === 'Tab') e.preventDefault(); return; }
    keys[e.code] = true;
    if (['Tab', 'Space', 'AltLeft', 'AltRight'].includes(e.code)) e.preventDefault();
    // cheat buffer (letters only)
    if (/^[a-zA-Z]$/.test(e.key)) {
      cheatBuf = (cheatBuf + e.key.toUpperCase()).slice(-10);
      for (const c of CHEATS) {
        if (cheatBuf.endsWith(c) && cheatHandlers[c]) { cheatHandlers[c](); cheatBuf = ''; }
      }
    }
  });
  window.addEventListener('keyup', e => { keys[e.code] = false; });
  window.addEventListener('blur', () => { for (const k in keys) keys[k] = false; mouse.lmb = mouse.rmb = false; });
  canvas.addEventListener('mousemove', e => {
    mouse.x = e.clientX; mouse.y = e.clientY;
    mouse.ndcX = (e.clientX / window.innerWidth) * 2 - 1;
    mouse.ndcY = -(e.clientY / window.innerHeight) * 2 + 1;
  });
  canvas.addEventListener('mousedown', e => {
    if (e.button === 0) mouse.lmb = true;
    if (e.button === 2) mouse.rmb = true;
  });
  window.addEventListener('mouseup', e => {
    if (e.button === 0) mouse.lmb = false;
    if (e.button === 2) mouse.rmb = false;
  });
  canvas.addEventListener('contextmenu', e => e.preventDefault());
}

export const down = code => !!keys[code];
export const driveInput = () => ({
  throttle: (down('KeyW') || down('ArrowUp') ? 1 : 0) - (down('KeyS') || down('ArrowDown') ? 1 : 0),
  steer: (down('KeyA') || down('ArrowLeft') ? 1 : 0) - (down('KeyD') || down('ArrowRight') ? 1 : 0),
  handbrake: down('Space'),
});