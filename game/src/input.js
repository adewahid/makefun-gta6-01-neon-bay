// Solmar Bay — keyboard + mouse input. Tracks held keys, edge-triggered
// presses, and the mouse position in canvas coordinates.
export function createInput(canvas) {
  const keys = new Set();
  const pressed = new Set(); // edge-triggered, cleared each frame
  let mouseX = 640; let mouseY = 360;
  let mouseDown = false;
  let mouseClicked = false;

  const keymap = {
    KeyW: 'up', ArrowUp: 'up',
    KeyS: 'down', ArrowDown: 'down',
    KeyA: 'left', ArrowLeft: 'left',
    KeyD: 'right', ArrowRight: 'right',
    ShiftLeft: 'shift', ShiftRight: 'shift',
    KeyE: 'interact', KeyF: 'punch',
    KeyP: 'pause', Escape: 'pause',
    KeyM: 'mute', Enter: 'enter', Space: 'handbrake',
  };

  window.addEventListener('keydown', (e) => {
    const k = keymap[e.code];
    if (!k) return;
    if (['up', 'down', 'left', 'right', 'handbrake'].includes(k)) e.preventDefault();
    if (!keys.has(k)) pressed.add(k);
    keys.add(k);
  });
  window.addEventListener('keyup', (e) => {
    const k = keymap[e.code];
    if (k) keys.delete(k);
  });
  window.addEventListener('blur', () => keys.clear());

  canvas.addEventListener('mousemove', (e) => {
    const r = canvas.getBoundingClientRect();
    mouseX = ((e.clientX - r.left) / r.width) * canvas.width;
    mouseY = ((e.clientY - r.top) / r.height) * canvas.height;
  });
  canvas.addEventListener('mousedown', (e) => {
    if (e.button === 0) { mouseDown = true; mouseClicked = true; }
  });
  window.addEventListener('mouseup', (e) => {
    if (e.button === 0) mouseDown = false;
  });
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());

  return {
    get mouseX() { return mouseX; },
    get mouseY() { return mouseY; },
    get mouseDown() { return mouseDown; },
    get mouseClicked() { return mouseClicked; },
    held(k) { return keys.has(k); },
    // True only on the frame the key went down.
    wasPressed(k) { return pressed.has(k); },
    axisX() { return (keys.has('right') ? 1 : 0) - (keys.has('left') ? 1 : 0); },
    axisY() { return (keys.has('down') ? 1 : 0) - (keys.has('up') ? 1 : 0); },
    endFrame() { pressed.clear(); mouseClicked = false; },
  };
}
