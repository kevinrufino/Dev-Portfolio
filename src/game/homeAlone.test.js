import {
  freshGame,
  grant,
  buy,
  cost,
  rate,
  advance,
  loadGame,
  target,
  complete,
} from './homeAlone';

test('buying a trap spends supplies without reducing family progress', () => {
  const g = buy(grant(freshGame(0, 0), 12), 0);
  expect(g.supplies).toBe(0);
  expect(g.earned).toBe(12);
  expect(rate(g)).toBe(1);
  expect(cost(g, 0)).toBe(15);
  expect(buy(g, 0)).toBe(g);
});
test('idle earnings use elapsed time and cap offline progress at four hours', () => {
  const g = buy(grant(freshGame(0, 1000), 12), 0);
  expect(advance(g, 6000).supplies).toBe(5);
  expect(advance(g, 1000 + 86400000).supplies).toBe(14400);
  expect(advance(g, 0).supplies).toBe(0);
});
test('replays increase production and journey target', () => {
  const g = buy(grant(freshGame(2, 0), 12), 0);
  expect(rate(g)).toBe(1.5);
  expect(target(g)).toBe(8080);
  expect(complete(grant(g, 8080))).toBe(true);
});
test('saves restore offline earnings and reject corrupt data', () => {
  const g = buy(grant(freshGame(0, 1000), 12), 0);
  expect(loadGame({ getItem: () => JSON.stringify(g) }, 6000).supplies).toBe(5);
  for (const bad of [
    '{',
    'null',
    JSON.stringify({ ...g, traps: [-1, 0, 0, 0] }),
    JSON.stringify({ ...g, supplies: '100' }),
  ]) {
    expect(loadGame({ getItem: () => bad }, 6000)).toEqual(freshGame(0, 6000));
  }
  expect(
    loadGame(
      {
        getItem: () => {
          throw Error('blocked');
        },
      },
      6000,
    ),
  ).toEqual(freshGame(0, 6000));
});
