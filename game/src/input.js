// Keyboard + mouse state, kept as a plain object the game reads each frame.
export function createInput(canvas) {
  const keys = new Set();
  const pressed = new Set(); // edge-triggered keys, cleared each frame
  const mouse = { x: 0, y: 0, down: false, clicked: false };
  const anyKey = { value: false };

  function code(e) { return e.code; }

  window.addEventListener('keydown', (e) => {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'Tab'].includes(e.code)) e.preventDefault();
    if (!keys.has(e.code)) pressed.add(e.code);
    keys.add(e.code);
    anyKey.value = true;
  }, { passive: false });
  window.addEventListener('keyup', (e) => keys.delete(e.code));
  window.addEventListener('blur', () => { keys.clear(); mouse.down = false; });

  canvas.addEventListener('pointermove', (e) => {
    const r = canvas.getBoundingClientRect();
    mouse.x = e.clientX - r.left;
    mouse.y = e.clientY - r.top;
  });
  canvas.addEventListener('pointerdown', (e) => {
    const r = canvas.getBoundingClientRect();
    mouse.x = e.clientX - r.left;
    mouse.y = e.clientY - r.top;
    mouse.down = true;
    mouse.clicked = true;
    anyKey.value = true;
  });
  window.addEventListener('pointerup', () => { mouse.down = false; });

  return {
    keys, pressed, mouse, anyKey,
    down(...codes) { return codes.some((c) => keys.has(c)); },
    hit(...codes) { return codes.some((c) => pressed.has(c)); },
    endFrame() { pressed.clear(); mouse.clicked = false; anyKey.value = false; },
  };
}
