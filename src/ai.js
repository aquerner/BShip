import { BOARD_SIZE, CELL, coordsOf, indexOf, isSunk, shipCells } from './game.js';

const HIT_BONUS = 40;

export const DIFFICULTIES = [
  { id: 'easy', name: 'Ensign', blurb: 'Fires at random.' },
  { id: 'normal', name: 'Captain', blurb: 'Searches, then hunts down wounded ships.' },
  { id: 'hard', name: 'Admiral', blurb: 'Scores every legal enemy position each turn.' },
];

export function chooseShot(board, { difficulty = 'hard', rng = Math.random } = {}) {
  if (difficulty === 'easy') {
    // Easy must not benefit from the no-touch deduction baked into the
    // knowledge grid — it only knows which cells it has already fired at.
    const unfired = [];
    for (let i = 0; i < BOARD_SIZE * BOARD_SIZE; i += 1) if (!board.shots.has(i)) unfired.push(i);
    return unfired.length === 0 ? -1 : unfired[Math.floor(rng() * unfired.length)];
  }

  const state = knowledgeGrid(board);
  const open = [];
  for (let i = 0; i < state.length; i += 1) if (state[i] === 'unknown') open.push(i);
  if (open.length === 0) {
    // Every remaining cell was ruled out by deduction; fall back to raw shots.
    for (let i = 0; i < BOARD_SIZE * BOARD_SIZE; i += 1) if (!board.shots.has(i)) return i;
    return -1;
  }

  if (difficulty === 'normal') return huntAndTarget(board, state, open, rng);
  return densityShot(board, state, rng);
}

/* --------------------------------------------------------------- hard AI */

/**
 * For every ship still afloat, enumerate every placement that fits the cells
 * we have not ruled out and score the cells it covers. Placements covering a
 * known-but-unsunk hit are weighted heavily, so "hunt" and "target" behaviour
 * falls out of one calculation instead of a mode flag.
 */
function densityShot(board, state, rng) {
  const remaining = board.ships.filter((ship) => !isSunk(ship)).map((ship) => ship.size);
  const scores = new Array(BOARD_SIZE * BOARD_SIZE).fill(0);

  for (const size of remaining) {
    for (let row = 0; row < BOARD_SIZE; row += 1) {
      for (let col = 0; col < BOARD_SIZE; col += 1) {
        for (const orientation of ['horizontal', 'vertical']) {
          const cells = shipCells(row, col, size, orientation);
          if (!cells) continue;
          if (cells.some((cell) => state[cell] === 'blocked')) continue;
          const liveHits = cells.filter((cell) => state[cell] === 'hit').length;
          const weight = liveHits > 0 ? HIT_BONUS * liveHits : 1;
          cells.forEach((cell) => {
            if (state[cell] === 'unknown') scores[cell] += weight;
          });
        }
      }
    }
  }

  return bestCell(state, scores, rng);
}

/* ------------------------------------------------------------- normal AI */

function huntAndTarget(board, state, open, rng) {
  const targets = new Set();
  for (let i = 0; i < state.length; i += 1) {
    if (state[i] !== 'hit') continue;
    const { row, col } = coordsOf(i);
    const line = [
      [row - 1, col],
      [row + 1, col],
      [row, col - 1],
      [row, col + 1],
    ];
    for (const [r, c] of line) {
      if (r < 0 || c < 0 || r >= BOARD_SIZE || c >= BOARD_SIZE) continue;
      const n = indexOf(r, c);
      if (state[n] === 'unknown') targets.add(n);
    }
  }
  if (targets.size > 0) {
    const list = [...targets];
    return list[Math.floor(rng() * list.length)];
  }
  // Nothing wounded: sweep on a parity grid, since the smallest ship is 2 long.
  const parity = open.filter((i) => {
    const { row, col } = coordsOf(i);
    return (row + col) % 2 === 0 && state[i] === 'unknown';
  });
  const pool = parity.length > 0 ? parity : open.filter((i) => state[i] === 'unknown');
  if (pool.length === 0) return open[Math.floor(rng() * open.length)];
  return pool[Math.floor(rng() * pool.length)];
}

/* ---------------------------------------------------------------- shared */

function bestCell(state, scores, rng) {
  let best = -1;
  let bestScore = -1;
  let ties = 0;
  for (let i = 0; i < scores.length; i += 1) {
    if (state[i] !== 'unknown') continue;
    if (scores[i] > bestScore) {
      bestScore = scores[i];
      best = i;
      ties = 1;
    } else if (scores[i] === bestScore) {
      // Reservoir sampling keeps every tied cell equally likely.
      ties += 1;
      if (rng() < 1 / ties) best = i;
    }
  }
  if (best === -1) {
    for (let i = 0; i < state.length; i += 1) if (state[i] === 'unknown') return i;
  }
  return best;
}

function knowledgeGrid(board) {
  const state = new Array(BOARD_SIZE * BOARD_SIZE).fill('unknown');
  for (const [index, mark] of board.shots) {
    if (mark === CELL.MISS || mark === CELL.SUNK) state[index] = 'blocked';
    else if (mark === CELL.HIT) state[index] = 'hit';
  }
  // Ships never touch, so anything adjacent to a sunk ship is open water.
  for (const [index, mark] of board.shots) {
    if (mark !== CELL.SUNK) continue;
    const { row, col } = coordsOf(index);
    for (let dr = -1; dr <= 1; dr += 1) {
      for (let dc = -1; dc <= 1; dc += 1) {
        const r = row + dr;
        const c = col + dc;
        if (r < 0 || c < 0 || r >= BOARD_SIZE || c >= BOARD_SIZE) continue;
        const n = indexOf(r, c);
        if (state[n] === 'unknown') state[n] = 'blocked';
      }
    }
  }
  return state;
}
