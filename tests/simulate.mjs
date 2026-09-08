/**
 * Headless self-play harness. Runs the real game and AI modules thousands of
 * times to shake out rule violations, infinite loops and turn-order bugs that
 * are painful to find by clicking.
 *
 *   node tests/simulate.mjs [games]
 */
import {
  BOARD_SIZE,
  CELL,
  SHIP_TYPES,
  createBoard,
  fire,
  isSunk,
  randomFleet,
} from '../src/game.js';
import { DIFFICULTIES, chooseShot } from '../src/ai.js';

const GAMES = Number(process.argv[2] || 2000);
const CELLS = BOARD_SIZE * BOARD_SIZE;

let failures = 0;
function check(condition, message) {
  if (!condition) {
    failures += 1;
    console.error(`FAIL: ${message}`);
  }
}

function assertFleetLegal(board) {
  check(board.ships.length === SHIP_TYPES.length, 'fleet has all five ships');
  const seen = new Set();
  for (const ship of board.ships) {
    check(ship.cells.length === ship.size, `${ship.name} occupies ${ship.size} cells`);
    for (const cell of ship.cells) {
      check(cell >= 0 && cell < CELLS, 'cell within board');
      check(!seen.has(cell), 'ships do not overlap');
      seen.add(cell);
    }
    const rows = new Set(ship.cells.map((c) => Math.floor(c / BOARD_SIZE)));
    const cols = new Set(ship.cells.map((c) => c % BOARD_SIZE));
    check(rows.size === 1 || cols.size === 1, `${ship.name} is a straight line`);
    if (rows.size === 1) {
      const sorted = [...ship.cells].sort((a, b) => a - b);
      check(
        sorted.every((c, i) => i === 0 || c === sorted[i - 1] + 1),
        `${ship.name} is contiguous and does not wrap rows`,
      );
    }
  }
  // No two ships may touch, including diagonally.
  for (const cell of seen) {
    const row = Math.floor(cell / BOARD_SIZE);
    const col = cell % BOARD_SIZE;
    const owner = board.ships.find((s) => s.cells.includes(cell));
    for (let dr = -1; dr <= 1; dr += 1) {
      for (let dc = -1; dc <= 1; dc += 1) {
        const r = row + dr;
        const c = col + dc;
        if (r < 0 || c < 0 || r >= BOARD_SIZE || c >= BOARD_SIZE) continue;
        const n = r * BOARD_SIZE + c;
        if (!seen.has(n)) continue;
        const other = board.ships.find((s) => s.cells.includes(n));
        check(other === owner, 'ships never touch, not even diagonally');
      }
    }
  }
}

function randomShot(board) {
  const open = [];
  for (let i = 0; i < CELLS; i += 1) if (!board.shots.has(i)) open.push(i);
  return open[Math.floor(Math.random() * open.length)];
}

for (const level of DIFFICULTIES) runSuite(level.id);

console.log(failures === 0 ? '\nall invariants held' : `\n${failures} invariant failures`);
process.exit(failures === 0 ? 0 : 1);

function runSuite(difficulty) {
  const shotCounts = [];
  let aiWins = 0;

  for (let g = 0; g < GAMES; g += 1) {
    const ai = createBoard();
    const human = createBoard();
    randomFleet(ai);
    randomFleet(human);
    assertFleetLegal(ai);
    assertFleetLegal(human);

    let turn = 0;
    let aiShots = 0;
    let winner = null;

    while (!winner) {
      turn += 1;
      check(turn <= CELLS * 2 + 5, 'game terminates');
      if (turn > CELLS * 2 + 5) break;

      const humanTarget = randomShot(ai);
      const humanResult = fire(ai, humanTarget);
      check(!humanResult.repeat, 'human never fires twice at the same cell');
      if (humanResult.allSunk) {
        winner = 'human';
        break;
      }

      const aiTarget = chooseShot(human, { difficulty });
      check(aiTarget >= 0 && aiTarget < CELLS, 'AI picks a cell on the board');
      check(!human.shots.has(aiTarget), 'AI never repeats a shot');
      aiShots += 1;
      const aiResult = fire(human, aiTarget);
      check(!aiResult.repeat, 'AI shot was not a repeat');
      if (aiResult.allSunk) winner = 'ai';
    }

    // Sunk ships must be fully marked, and marks must agree with the ships.
    for (const board of [ai, human]) {
      for (const ship of board.ships) {
        if (!isSunk(ship)) continue;
        check(
          ship.cells.every((c) => board.shots.get(c) === CELL.SUNK),
          'sunk ship is fully marked as sunk',
        );
      }
    }

    if (winner === 'ai') aiWins += 1;
    shotCounts.push(aiShots);
  }

  shotCounts.sort((a, b) => a - b);
  const mean = shotCounts.reduce((a, b) => a + b, 0) / shotCounts.length;
  console.log(`\n[${difficulty}] ${GAMES} games`);
  console.log(`  wins vs random opponent: ${((aiWins / GAMES) * 100).toFixed(1)}%`);
  console.log(`  shots to clear a board:  mean ${mean.toFixed(1)}, median ${shotCounts[Math.floor(shotCounts.length / 2)]}, worst ${shotCounts[shotCounts.length - 1]}`);
}
