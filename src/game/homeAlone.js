export const SAVE_KEY = 'kevin-404-v1';
export const TRAPS = [
  { name: 'Micro machines', room: 'The hallway', detail: 'A tiny obstacle. A very big fall.', cost: 12, rate: 1, icon: '▰' },
  { name: 'Paint cans', room: 'The staircase', detail: 'Gravity does the heavy lifting.', cost: 65, rate: 5, icon: '▥' },
  { name: 'Party decoys', room: 'The living room', detail: 'Keep the lights on. Nobody suspects a thing.', cost: 280, rate: 18, icon: '♟' },
  { name: 'Zipline escape', room: 'The attic', detail: 'An exit strategy with excellent mileage.', cost: 1100, rate: 65, icon: '↗' },
];
export const freshGame = (wins = 0, now = Date.now()) => ({ supplies: 0, earned: 0, traps: [0, 0, 0, 0], wins, savedAt: now, raidAt: now + 30000 });
export const multiplier = g => 1 + g.wins * 0.25;
export const rate = g => g.traps.reduce((sum, n, i) => sum + n * TRAPS[i].rate, 0) * multiplier(g);
export const cost = (g, i) => Math.ceil(TRAPS[i].cost * 1.18 ** g.traps[i]);
export const target = g => 4040 * (1 + g.wins * 0.5);
export const complete = g => g.earned >= target(g);
export const grant = (g, amount) => ({ ...g, supplies: g.supplies + amount, earned: g.earned + amount });
export function advance(g, now = Date.now()) {
  const seconds = Math.min(14400, Math.max(0, (now - g.savedAt) / 1000));
  return { ...grant(g, rate(g) * seconds), savedAt: now };
}
export function buy(g, i) {
  if (!TRAPS[i] || g.supplies < cost(g, i) || g.traps[i] >= 100) return g;
  return { ...g, supplies: g.supplies - cost(g, i), traps: g.traps.map((n, j) => n + (i === j ? 1 : 0)) };
}
export function loadGame(storage, now = Date.now()) {
  try {
    const g = JSON.parse(storage.getItem(SAVE_KEY));
    if (!g || !['supplies', 'earned', 'wins', 'savedAt', 'raidAt'].every(k => Number.isFinite(g[k]) && g[k] >= 0) || !Number.isInteger(g.wins) || g.wins > 1000 || !Array.isArray(g.traps) || g.traps.length !== 4 || !g.traps.every(n => Number.isInteger(n) && n >= 0 && n <= 100)) return freshGame(0, now);
    return advance(g, now);
  } catch { return freshGame(0, now); }
}
