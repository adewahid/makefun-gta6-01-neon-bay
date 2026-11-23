// Solmar Bay — save / load through localStorage. Autosaves after every
// mission, on busted/wasted, and when the player pauses; the title screen
// offers Continue when a save exists.
const KEY = 'solmar-bay-save-v1';

export function loadSave() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const s = JSON.parse(raw);
    if (!s || typeof s !== 'object') return null;
    return s;
  } catch (e) { return null; }
}

export function writeSave(S) {
  try {
    const data = {
      version: 1,
      savedAt: Date.now(),
      cash: S.player.cash,
      missionsDone: S.missions.done,
      packages: S.city.packages.filter((p) => p.taken).length,
      fares: S.stats.fares,
      kills: S.player.kills,
      timeMinutes: S.clock.minutes,
      px: S.player.x, py: S.player.y,
    };
    localStorage.setItem(KEY, JSON.stringify(data));
  } catch (e) { /* storage unavailable (private mode): play on without saving */ }
}

export function clearSave() {
  try { localStorage.removeItem(KEY); } catch (e) { /* ignore */ }
}
