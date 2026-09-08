# Debugging log — Battleship

Every defect found while building the game, how it was found, and how it was fixed. Commits are in `aquerner/BShip` on `main`.

## How the bugs were found

Two passes, deliberately different in kind:

1. **Headless self-play** (`tests/simulate.mjs`, `npm test`). The rules and AI modules have no DOM dependency, so a Node harness can play thousands of complete games and assert invariants after every shot: fleets are legal (five ships, straight, contiguous, non-overlapping, never touching even diagonally), neither side ever fires at the same cell twice, sunk ships are fully marked, and no game runs past its theoretical maximum length. This catches rule and state bugs cheaply — 6,000 games run in a couple of seconds.
2. **Browser testing** against a real HTTP server, covering placement, previews, combat sequencing, both game outcomes, reset behaviour, difficulty locking, console errors, and a 375×812 mobile viewport. This catches everything the harness structurally cannot see: CSS cascade, rendering, and timing.

The split mattered. The harness reported "all invariants held" on a build that was, in a browser, completely unplayable (bug 2 below).

---

## Bugs found and fixed

### 1. Test harness could not load the game modules
**Symptom:** `SyntaxError: Named export 'BOARD_SIZE' not found. The requested module '../src/game.js' is a CommonJS module.`
**Cause:** With no `package.json`, Node treats `.js` files as CommonJS, while the browser was loading the same files as ES modules via `<script type="module">`. The same source parsed two different ways.
**Fix:** Added a `package.json` with `"type": "module"`, so Node and the browser agree. No source changes.

### 2. Game-over dialog covered the board on page load — game unplayable
**Symptom:** A "Victory" dialog appeared over the empty placement board before a single click, and "Play again" did not dismiss it. Nothing on the page responded.
**Cause:** A CSS cascade conflict. `.hidden { display: none }` and `.overlay { display: flex }` have identical specificity, and `.overlay` came later in the stylesheet, so it won. The markup and JavaScript were correct — the element genuinely had `class="overlay hidden"` — but the browser computed `display: flex` anyway.
**Fix:** `.hidden { display: none !important }`. One of the few legitimate uses of `!important`: a utility class whose entire job is to beat whatever display rule the element it is applied to already has.
**Note:** This is exactly the class of bug the headless harness cannot reach, and the reason the browser pass exists.

### 3. Abandoning a game mid-turn leaked a shot into the next game
**Symptom:** Fire a shot, click "New game" during the 650 ms the AI spends "thinking", start a fresh battle — and your board already has a miss on it, with nothing in the battle log to explain it.
**Cause:** The AI turn was scheduled with `setTimeout` and nothing cancelled it. The callback fired after the reset and shot at the *new* player board, which by then was a different object in a different phase.
**Fix:** The pending timer is stored in `state.aiTimer`; `newGame()` clears it, and `enemyTurn()` also returns immediately unless the game is still in the `enemy` phase. Cancel *and* guard, because a timer can fire in the window before it is cleared. `newGame()` now also clears the battle log DOM immediately rather than at the next start.

### 4. Rotating a ship did not update the placement preview under the cursor
**Symptom:** Hover a cell, press `R` without moving the mouse — the hint said "vertical" but the preview vanished until the pointer moved to another cell.
**Cause:** The preview was drawn only from `mouseenter`/`focus` events, so a rotation with a stationary pointer re-rendered the grid and wiped the preview with nothing to redraw it.
**Fix:** The hovered cell is tracked in `state.hoverIndex` and the rotate handler re-runs the preview for it. Cleared on fleet reset so a stale index cannot redraw a preview for a ship that is already placed.

### 5. Hovering hid the legal/illegal placement colours
**Symptom:** Hovering an illegal position — a Carrier at J1, hanging off the right edge — showed the anchor cell grey instead of red, so the warning was invisible exactly where the player was looking.
**Cause:** Grid cells are `<button>` elements to get keyboard and screen-reader behaviour for free, so the generic `button:hover` background applied to them and overrode `.cell.preview` / `.cell.invalid`.
**Fix:** Scoped the generic rule to `button:not(.cell):hover`. Grid cells carry their own state colours; the deliberate enemy-cell hover highlight is a separate, more specific rule and still works.

### 6. "Easy" difficulty was secretly not easy
**Symptom:** The random-fire opponent won 87% of simulated games against a random opponent. It should sit near 50% — slightly under, since it moves second.
**Cause:** All three difficulties picked targets from one shared knowledge grid, which encodes the deduction that no cell adjacent to a sunk ship can contain another ship (ships never touch). Easy was inheriting free reasoning it was never meant to have.
**Fix:** Easy now selects only from cells it has not literally fired at. It dropped to 43%, which is the correct figure for a random second mover.
**Found by:** The harness's win-rate output, not by an assertion. Worth noting for the write-up: the bug was in the *statistics*, not in any single game — no amount of clicking would have surfaced it.

### 7. Status line still said "Your move" after the game ended
**Symptom:** After losing, the status line behind the Defeat dialog read "Your Battleship is lost. Your move." The board was correctly disabled and the log was correct, so the text was the only thing lying.
**Cause:** `endGame()` updated the dialog and the log but never overwrote the per-shot status line.
**Fix:** `endGame()` now sets a terminal status for both outcomes.

---

## Verification after fixes

- `npm test` — 6,000 games (2,000 per difficulty), all invariants held.
  - Ensign: wins 43% vs. a random opponent, ~92 shots to clear a board.
  - Captain: 100%, ~52 shots.
  - Admiral: 100%, ~39 shots — close to the practical optimum for this ruleset.
- Browser pass: fleet placement and rejection rules, previews and rotation, Random/Clear/Start, combat sequencing and rendering, repeat-shot prevention, hidden enemy ship names, a completed Victory (Ensign) and a completed Defeat (Admiral, 30 shots) with surviving enemy ships revealed, reset after both, difficulty locked during combat, no console errors, and a 375×812 mobile viewport with no horizontal overflow.

## What I would do next

Not bugs, but the things a real bug queue would show next: no persistence of a game across reload; no undo during placement; the AI's 650 ms delay is fixed rather than proportional to how much it "thought about"; and the accessibility story stops at focusable, labelled cells — there is no announcement of the AI's move for screen-reader users beyond the live-region log.
