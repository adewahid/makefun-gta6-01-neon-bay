// input.js — keyboard state for Neon Bay. Tracks held keys and one-shot
// presses (edge-triggered actions like enter car, punch, pause).
export function createInput() {
  const held = new Set();
  const pressed = new Set();

  function onKeyDown(event) {
    const key = event.key.toLowerCase();
    if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '].includes(key)) {
      event.preventDefault();
    }
    if (!held.has(key)) pressed.add(key);
    held.add(key);
  }

  function onKeyUp(event) {
    held.delete(event.key.toLowerCase());
  }

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('blur', () => held.clear());

  return {
    isDown(...keys) {
      return keys.some((k) => held.has(k));
    },
    // true only on the frame the key went down
    wasPressed(...keys) {
      return keys.some((k) => pressed.has(k));
    },
    endFrame() {
      pressed.clear();
    },
    // synthetic press used by the screenshot driver
    inject(key) {
      pressed.add(key.toLowerCase());
      held.add(key.toLowerCase());
    },
    release(key) {
      held.delete(key.toLowerCase());
    },
  };
}
