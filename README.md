# Battleship

A browser Battleship game against an AI opponent. Plain HTML, CSS and ES modules — no framework, no build step, no dependencies.

**Play:** https://bship-rmngbgpl.devinapps.com/

## How to play

1. Place your five ships on the left grid — click to drop, `R` (or the button) to rotate. `Random fleet` places them for you.
2. Pick an opponent: **Ensign** (random fire), **Captain** (search, then hunt wounded ships), **Admiral** (probability-density targeting).
3. Fire by clicking the enemy grid. Hits are orange, sunk ships red, misses show a dot. First fleet destroyed loses.

Ships follow the tournament rule that they may not touch, not even diagonally — for both sides.

## Running locally

```bash
git clone https://github.com/aquerner/BShip.git
cd BShip
npm run serve     # python3 -m http.server 8000
# open http://localhost:8000
```

ES modules require a real HTTP origin; opening `index.html` from the filesystem will not work.

## Tests

`tests/simulate.mjs` plays thousands of full games headlessly against the real game and AI modules, asserting the rules hold (legal fleets, no repeated shots, no runaway games, sunk ships fully marked) and reporting how efficiently each difficulty clears a board.

```bash
npm test
```

Typical output — the Admiral's ~39 shots to clear a 10x10 board is close to the practical optimum for this ruleset:

```
[easy]   wins vs random opponent: 43.0%   shots to clear: mean 92.5
[normal] wins vs random opponent: 100.0%  shots to clear: mean 52.2
[hard]   wins vs random opponent: 100.0%  shots to clear: mean 38.8
```

## Layout

| File | Purpose |
| --- | --- |
| `src/game.js` | Rules: board, placement legality, firing, sinking. No DOM. |
| `src/ai.js` | The three opponents, sharing one deduced knowledge grid. |
| `src/ui.js` | Rendering, input, turn sequencing. |
| `tests/simulate.mjs` | Headless self-play harness. |
| `BUGS.md` | Bugs found while building and how each was fixed. |
