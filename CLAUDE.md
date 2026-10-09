# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
python3 -m http.server 8000          # serve the app (fetch() fails under file://)
npm run lint                         # ESLint over js/ (run `npm install` once first)
.venv/bin/pytest                     # Playwright browser tests (headless Chromium)
.venv/bin/pytest tests/test_app.py::test_next_and_previous   # single test
.venv/bin/pytest --headed --slowmo 300                       # watch tests run
```

Test setup (one-time, Ubuntu/WSL): `python3 -m venv .venv && .venv/bin/pip install -r requirements-dev.txt && .venv/bin/playwright install chromium` (needs `python3.12-venv libnss3 libasound2t64` from apt). Tests start their own HTTP server, so there is no need to run one first.

## Architecture

A static web app with no build step and no runtime dependencies: `index.html` + `css/style.css` + a single classic script, `js/app.js` (no modules, so ESLint uses `sourceType: 'script'`).

- **State and rendering**: `app.js` keeps state in module-level variables (`lines`, `index`, `timer`, `delayMs`). All navigation goes through `go(i)` (which clamps and animates the line), and `render()` redraws everything else (buttons, progress, "Up next") from that state.
- **Lyrics source**: `?file=<path>` (default `lyrics.txt`) is fetched relative to the page. If the fetch fails, the `#loader` file picker appears. Lyrics are always inserted as text, never as HTML.

### Cross-file couplings to keep in sync

- **Transition timing**: JS reads `--dur` from `:root` in `style.css` to know when to remove outgoing `.slot`s. `prefers-reduced-motion` sets it to `1ms`.
- **Animation classes**: `showLine()` toggles `enter-from-below/above`, `exit-up/down` and `leaving` on `.slot`. Their styles live in `style.css`, and `body.playing` drives the vinyl/equalizer animations.
- **Speed slider**: the slider's index maps into `SPEEDS` in `app.js`, and `--fill` styles its track. `DEFAULT_SPEED` must be a value in `SPEEDS`. `tests/test_app.py` hardcodes slider steps (`DEFAULT_STEP = "4"`, `FASTEST_STEP = "9"`), so update those if `SPEEDS` changes.
- **Element IDs**: `app.js` and the tests both look up elements by their `index.html` IDs (`#stage`, `#progress-text`, `#loader`, …).

### Tests

`tests/conftest.py` serves the repo root on a free port as pytest-playwright's `base_url`. Tests load fixtures via `/?file=tests/fixtures/short.txt`. Playback tests call `page.clock.install()` before `goto` and advance the clock with fake time instead of waiting in real time. Outgoing lines linger during the crossfade, so tests select the current line with `.slot:not(.leaving) .text`. The `console_errors` fixture collects JS errors so a test can assert the page ran cleanly.
