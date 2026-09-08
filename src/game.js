export const BOARD_SIZE = 10;

export const SHIP_TYPES = [
  { id: 'carrier', name: 'Carrier', size: 5 },
  { id: 'battleship', name: 'Battleship', size: 4 },
  { id: 'cruiser', name: 'Cruiser', size: 3 },
  { id: 'submarine', name: 'Submarine', size: 3 },
  { id: 'destroyer', name: 'Destroyer', size: 2 },
];

export const CELL = {
  EMPTY: 'empty',
  SHIP: 'ship',
  MISS: 'miss',
  HIT: 'hit',
  SUNK: 'sunk',
};

export function indexOf(row, col) {
  return row * BOARD_SIZE + col;
}

export function coordsOf(index) {
  return { row: Math.floor(index / BOARD_SIZE), col: index % BOARD_SIZE };
}

export function coordLabel(index) {
  const { row, col } = coordsOf(index);
  return `${String.fromCharCode(65 + col)}${row + 1}`;
}

export function shipCells(row, col, size, orientation) {
  const cells = [];
  for (let i = 0; i < size; i += 1) {
    const r = orientation === 'vertical' ? row + i : row;
    const c = orientation === 'horizontal' ? col + i : col;
    if (r >= BOARD_SIZE || c >= BOARD_SIZE || r < 0 || c < 0) return null;
    cells.push(indexOf(r, c));
  }
  return cells;
}

function neighbors(index) {
  const { row, col } = coordsOf(index);
  const result = [];
  for (let dr = -1; dr <= 1; dr += 1) {
    for (let dc = -1; dc <= 1; dc += 1) {
      const r = row + dr;
      const c = col + dc;
      if (r < 0 || c < 0 || r >= BOARD_SIZE || c >= BOARD_SIZE) continue;
      result.push(indexOf(r, c));
    }
  }
  return result;
}

export function createBoard() {
  return { ships: [], occupied: new Map(), shots: new Map() };
}

/** Ships may not touch, not even diagonally — the classic tournament rule. */
export function canPlace(board, cells) {
  if (!cells) return false;
  return cells.every((cell) => {
    if (board.occupied.has(cell)) return false;
    return neighbors(cell).every((n) => !board.occupied.has(n) || cells.includes(n));
  });
}

export function placeShip(board, type, cells) {
  const ship = { id: type.id, name: type.name, size: type.size, cells, hits: new Set() };
  board.ships.push(ship);
  cells.forEach((cell) => board.occupied.set(cell, ship));
  return ship;
}

export function removeShip(board, shipId) {
  const ship = board.ships.find((s) => s.id === shipId);
  if (!ship) return;
  board.ships = board.ships.filter((s) => s.id !== shipId);
  ship.cells.forEach((cell) => board.occupied.delete(cell));
}

export function randomFleet(board, rng = Math.random) {
  board.ships = [];
  board.occupied = new Map();
  for (const type of SHIP_TYPES) {
    let placed = false;
    for (let attempt = 0; attempt < 500 && !placed; attempt += 1) {
      const orientation = rng() < 0.5 ? 'horizontal' : 'vertical';
      const row = Math.floor(rng() * BOARD_SIZE);
      const col = Math.floor(rng() * BOARD_SIZE);
      const cells = shipCells(row, col, type.size, orientation);
      if (canPlace(board, cells)) {
        placeShip(board, type, cells);
        placed = true;
      }
    }
    if (!placed) return randomFleet(board, rng);
  }
  return board;
}

export function isSunk(ship) {
  return ship.hits.size === ship.size;
}

export function alreadyShot(board, index) {
  return board.shots.has(index);
}

export function fire(board, index) {
  if (board.shots.has(index)) return { repeat: true };
  const ship = board.occupied.get(index);
  if (!ship) {
    board.shots.set(index, CELL.MISS);
    return { hit: false, index };
  }
  ship.hits.add(index);
  board.shots.set(index, CELL.HIT);
  const sunk = isSunk(ship);
  if (sunk) ship.cells.forEach((cell) => board.shots.set(cell, CELL.SUNK));
  return { hit: true, index, ship, sunk, allSunk: board.ships.every(isSunk) };
}

export function remainingShips(board) {
  return board.ships.filter((ship) => !isSunk(ship));
}
