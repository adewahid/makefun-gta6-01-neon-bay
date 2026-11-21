// save.js — autosave to localStorage after every mission and on pause.
// The save holds money, campaign progress, the player's spot and the time
// played, so Continue on the title screen drops the player back in.
const SAVE_KEY = 'neon-bay-save-v1';

export function writeSave(state) {
  try {
    const data = {
      money: state.money,
      moneyEarned: state.moneyEarned,
      jobsDone: state.jobsDone,
      missionIndex: state.missionIndex,
      x: state.player.x,
      y: state.player.y,
      wanted: state.wanted,
      timePlayed: state.timePlayed,
      savedAt: Date.now(),
    };
    localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    return true;
  } catch (err) {
    return false;
  }
}

export function readSave() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (typeof data.money !== 'number' || typeof data.missionIndex !== 'number') return null;
    return data;
  } catch (err) {
    return null;
  }
}

export function clearSave() {
  try {
    localStorage.removeItem(SAVE_KEY);
  } catch (err) {
    // storage unavailable; nothing to clear
  }
}
