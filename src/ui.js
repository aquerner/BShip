import {
  BOARD_SIZE,
  CELL,
  SHIP_TYPES,
  alreadyShot,
  canPlace,
  coordLabel,
  coordsOf,
  createBoard,
  fire,
  indexOf,
  isSunk,
  placeShip,
  randomFleet,
  shipCells,
} from './game.js';
import { DIFFICULTIES, chooseShot } from './ai.js';

const el = (id) => document.getElementById(id);

const state = {
  phase: 'setup',
  orientation: 'horizontal',
  placedIndex: 0,
  playerBoard: createBoard(),
  enemyBoard: createBoard(),
  difficulty: 'hard',
  busy: false,
};

const dom = {
  setupPanel: el('setup-panel'),
  gamePanel: el('game-panel'),
  setupBoard: el('setup-board'),
  playerBoard: el('player-board'),
  enemyBoard: el('enemy-board'),
  fleetList: el('fleet-list'),
  enemyFleet: el('enemy-fleet'),
  playerFleet: el('player-fleet'),
  status: el('status'),
  log: el('log'),
  nextShipName: el('next-ship-name'),
  nextShipSize: el('next-ship-size'),
  orientationLabel: el('orientation-label'),
  setupHint: el('setup-hint'),
  startBtn: el('start-btn'),
  rotateBtn: el('rotate-btn'),
  randomBtn: el('random-btn'),
  resetBtn: el('reset-btn'),
  newGameBtn: el('newgame-btn'),
  overlay: el('gameover'),
  overlayTitle: el('gameover-title'),
  overlayText: el('gameover-text'),
  overlayBtn: el('overlay-btn'),
  difficulty: el('difficulty'),
  difficultyBlurb: el('difficulty-blurb'),
};

function initDifficulty() {
  DIFFICULTIES.forEach((level) => {
    const option = document.createElement('option');
    option.value = level.id;
    option.textContent = level.name;
    dom.difficulty.appendChild(option);
  });
  dom.difficulty.value = state.difficulty;
  showBlurb();
  dom.difficulty.addEventListener('change', () => {
    state.difficulty = dom.difficulty.value;
    showBlurb();
  });
}

function showBlurb() {
  const level = DIFFICULTIES.find((d) => d.id === state.difficulty);
  dom.difficultyBlurb.textContent = level ? level.blurb : '';
}

function buildGrid(container, onCell, onHover) {
  container.replaceChildren();
  const corner = document.createElement('div');
  corner.className = 'label';
  container.appendChild(corner);
  for (let c = 0; c < BOARD_SIZE; c += 1) {
    const label = document.createElement('div');
    label.className = 'label';
    label.textContent = String.fromCharCode(65 + c);
    container.appendChild(label);
  }
  for (let r = 0; r < BOARD_SIZE; r += 1) {
    const rowLabel = document.createElement('div');
    rowLabel.className = 'label';
    rowLabel.textContent = String(r + 1);
    container.appendChild(rowLabel);
    for (let c = 0; c < BOARD_SIZE; c += 1) {
      const index = indexOf(r, c);
      const cell = document.createElement('button');
      cell.type = 'button';
      cell.className = 'cell';
      cell.dataset.index = String(index);
      cell.setAttribute('aria-label', coordLabel(index));
      if (onCell) cell.addEventListener('click', () => onCell(index));
      if (onHover) {
        cell.addEventListener('mouseenter', () => onHover(index));
        cell.addEventListener('focus', () => onHover(index));
      }
      container.appendChild(cell);
    }
  }
}

function cellNode(container, index) {
  return container.querySelector(`.cell[data-index="${index}"]`);
}

/* ---------------------------------------------------------------- setup */

function nextShip() {
  return SHIP_TYPES[state.placedIndex] || null;
}

function renderSetup() {
  const board = state.playerBoard;
  for (let i = 0; i < BOARD_SIZE * BOARD_SIZE; i += 1) {
    const node = cellNode(dom.setupBoard, i);
    node.className = `cell${board.occupied.has(i) ? ' ship' : ''}`;
  }

  dom.fleetList.replaceChildren();
  SHIP_TYPES.forEach((type, i) => {
    const li = document.createElement('li');
    const placed = board.ships.some((s) => s.id === type.id);
    li.className = placed ? 'placed' : i === state.placedIndex ? 'current' : '';
    li.innerHTML = `<span>${type.name}</span><span class="pips">${'■'.repeat(type.size)}</span>`;
    dom.fleetList.appendChild(li);
  });

  const ship = nextShip();
  if (ship) {
    dom.setupHint.classList.remove('done');
    dom.nextShipName.textContent = ship.name;
    dom.nextShipSize.textContent = String(ship.size);
    dom.orientationLabel.textContent = state.orientation;
  } else {
    dom.setupHint.classList.add('done');
    dom.setupHint.textContent = 'Fleet ready. Start the battle when you are.';
  }
  dom.startBtn.disabled = Boolean(ship);
}

function previewPlacement(index) {
  if (state.phase !== 'setup') return;
  dom.setupBoard.querySelectorAll('.preview, .invalid').forEach((n) => {
    n.classList.remove('preview', 'invalid');
  });
  const ship = nextShip();
  if (!ship) return;
  const { row, col } = coordsOf(index);
  const cells = shipCells(row, col, ship.size, state.orientation);
  const ok = canPlace(state.playerBoard, cells);
  (cells || [index]).forEach((cell) => {
    const node = cellNode(dom.setupBoard, cell);
    if (node) node.classList.add(ok ? 'preview' : 'invalid');
  });
}

function handlePlacement(index) {
  const ship = nextShip();
  if (!ship) return;
  const { row, col } = coordsOf(index);
  const cells = shipCells(row, col, ship.size, state.orientation);
  if (!canPlace(state.playerBoard, cells)) {
    flash(dom.setupHint);
    return;
  }
  placeShip(state.playerBoard, ship, cells);
  state.placedIndex += 1;
  renderSetup();
  previewPlacement(index);
}

function flash(node) {
  node.classList.remove('shake');
  void node.offsetWidth;
  node.classList.add('shake');
}

function resetFleet() {
  state.playerBoard = createBoard();
  state.placedIndex = 0;
  dom.setupHint.innerHTML =
    'Click a cell to place your <strong id="next-ship-name">Carrier</strong> ' +
    '(<span id="next-ship-size">5</span> cells, <span id="orientation-label">horizontal</span>).';
  dom.nextShipName = el('next-ship-name');
  dom.nextShipSize = el('next-ship-size');
  dom.orientationLabel = el('orientation-label');
  renderSetup();
}

/* ----------------------------------------------------------------- game */

function startGame() {
  if (state.placedIndex < SHIP_TYPES.length) return;
  randomFleet(state.enemyBoard);
  state.phase = 'player';
  state.busy = false;
  dom.log.replaceChildren();
  dom.setupPanel.classList.add('hidden');
  dom.gamePanel.classList.remove('hidden');
  buildGrid(dom.enemyBoard, playerFires, null);
  buildGrid(dom.playerBoard, null, null);
  renderBoards();
  setStatus('Your move — click the enemy waters.');
  const level = DIFFICULTIES.find((d) => d.id === state.difficulty);
  dom.difficulty.disabled = true;
  log(`Battle stations. Enemy fleet detected — opponent: ${level ? level.name : state.difficulty}.`);
}

function renderBoards() {
  for (let i = 0; i < BOARD_SIZE * BOARD_SIZE; i += 1) {
    const enemyMark = state.enemyBoard.shots.get(i);
    const enemyNode = cellNode(dom.enemyBoard, i);
    enemyNode.className = `cell${enemyMark ? ` ${enemyMark}` : ''}`;
    enemyNode.disabled = Boolean(enemyMark) || state.phase !== 'player';

    const playerNode = cellNode(dom.playerBoard, i);
    const playerMark = state.playerBoard.shots.get(i);
    const classes = ['cell'];
    if (state.playerBoard.occupied.has(i)) classes.push('ship');
    if (playerMark) classes.push(playerMark);
    playerNode.className = classes.join(' ');
    playerNode.disabled = true;
  }
  renderFleetStatus(dom.enemyFleet, state.enemyBoard, true);
  renderFleetStatus(dom.playerFleet, state.playerBoard, false);
}

function renderFleetStatus(list, board, hideNames) {
  list.replaceChildren();
  board.ships.forEach((ship) => {
    const li = document.createElement('li');
    const sunk = isSunk(ship);
    li.className = sunk ? 'sunk' : '';
    const name = hideNames && !sunk ? '???' : ship.name;
    li.innerHTML = `<span>${name}</span><span class="pips">${'■'.repeat(ship.size)}</span>`;
    list.appendChild(li);
  });
}

function setStatus(text) {
  dom.status.textContent = text;
}

function log(text, who = 'system') {
  const li = document.createElement('li');
  li.className = who;
  li.textContent = text;
  dom.log.prepend(li);
}

function playerFires(index) {
  if (state.phase !== 'player' || state.busy) return;
  if (alreadyShot(state.enemyBoard, index)) return;
  const result = fire(state.enemyBoard, index);
  const where = coordLabel(index);
  if (!result.hit) {
    log(`You fired at ${where} — miss.`, 'player');
    setStatus(`Miss at ${where}. Enemy is taking aim…`);
  } else if (result.sunk) {
    log(`You fired at ${where} — hit! You sank the enemy ${result.ship.name}.`, 'player');
    setStatus(`Enemy ${result.ship.name} destroyed.`);
  } else {
    log(`You fired at ${where} — hit!`, 'player');
    setStatus(`Hit at ${where}. Enemy is taking aim…`);
  }
  renderBoards();

  if (result.allSunk) {
    endGame(true);
    return;
  }

  state.phase = 'enemy';
  state.busy = true;
  renderBoards();
  window.setTimeout(enemyTurn, 650);
}

function enemyTurn() {
  const index = chooseShot(state.playerBoard, { difficulty: state.difficulty });
  if (index === -1) {
    state.phase = 'player';
    state.busy = false;
    renderBoards();
    return;
  }
  const result = fire(state.playerBoard, index);
  const where = coordLabel(index);
  if (!result.hit) {
    log(`Enemy fired at ${where} — miss.`, 'enemy');
    setStatus(`Enemy missed at ${where}. Your move.`);
  } else if (result.sunk) {
    log(`Enemy fired at ${where} — hit! Your ${result.ship.name} was sunk.`, 'enemy');
    setStatus(`Your ${result.ship.name} is lost. Your move.`);
  } else {
    log(`Enemy fired at ${where} — hit!`, 'enemy');
    setStatus(`Enemy hit your ship at ${where}. Your move.`);
  }

  if (result.allSunk) {
    renderBoards();
    endGame(false);
    return;
  }

  state.phase = 'player';
  state.busy = false;
  renderBoards();
}

function endGame(playerWon) {
  state.phase = 'over';
  state.busy = true;
  revealEnemyFleet();
  renderBoards();
  dom.overlayTitle.textContent = playerWon ? 'Victory' : 'Defeat';
  dom.overlayText.textContent = playerWon
    ? 'Every enemy ship is on the seabed. Well sailed.'
    : 'Your fleet has been destroyed. The machine wins this one.';
  dom.overlay.classList.remove('hidden');
  log(playerWon ? 'All enemy ships sunk. You win!' : 'All your ships sunk. The AI wins.');
}

function revealEnemyFleet() {
  state.enemyBoard.ships.forEach((ship) => {
    ship.cells.forEach((cell) => {
      if (!state.enemyBoard.shots.has(cell)) state.enemyBoard.shots.set(cell, CELL.SHIP);
    });
  });
}

function newGame() {
  state.phase = 'setup';
  state.orientation = 'horizontal';
  state.enemyBoard = createBoard();
  state.busy = false;
  dom.overlay.classList.add('hidden');
  dom.gamePanel.classList.add('hidden');
  dom.setupPanel.classList.remove('hidden');
  dom.difficulty.disabled = false;
  resetFleet();
}

/* ----------------------------------------------------------------- wire */

initDifficulty();
buildGrid(dom.setupBoard, handlePlacement, previewPlacement);
renderSetup();

dom.rotateBtn.addEventListener('click', () => {
  state.orientation = state.orientation === 'horizontal' ? 'vertical' : 'horizontal';
  renderSetup();
});
dom.randomBtn.addEventListener('click', () => {
  randomFleet(state.playerBoard);
  state.placedIndex = SHIP_TYPES.length;
  renderSetup();
});
dom.resetBtn.addEventListener('click', resetFleet);
dom.startBtn.addEventListener('click', startGame);
dom.newGameBtn.addEventListener('click', newGame);
dom.overlayBtn.addEventListener('click', newGame);

document.addEventListener('keydown', (event) => {
  if (event.key === 'r' || event.key === 'R') dom.rotateBtn.click();
});
