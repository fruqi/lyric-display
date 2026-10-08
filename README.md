# Lyric Display

A small, dependency-free web app that shows song lyrics one line at a time, with manual navigation and an auto-play mode with adjustable speed.

## Features

- **One line at a time** with line numbers and an "Up next" preview of the following line
- **Previous / Next** buttons, disabled at the start and end of the song
- **Play / Pause** toggle that auto-advances (every 2 seconds by default) and stops on the last line (pressing Play at the end restarts from the top)
- **Speed slider** from 5 s to 0.5 s per line. Changes apply immediately, even mid-playback, and are remembered in your browser
- **Progress** shown as "Line 5 of 14", a percentage, and a clickable progress bar for jumping to any point
- **Smooth transitions**: lines crossfade with a slide and blur, direction-aware for forward and back
- **Music-themed design**: dark stage palette, a spinning vinyl and bouncing equalizer while playing
- **Responsive** layout for phones, tablets, desktops and short landscape screens
- **Accessible**: keyboard shortcuts, visible focus states, a live region for screen readers, and support for reduced motion

## Getting started

Browsers block `fetch()` on pages opened straight from disk (`file://`), so serve the folder over HTTP:

```bash
python3 -m http.server 8000
```

Then open:

| URL | Loads |
| --- | --- |
| `http://localhost:8000/` | `lyrics.txt` (the default, ships with Sonnet 18 as a placeholder: replace its contents with your own song) |
| `http://localhost:8000/?file=sonnet_18.txt` | any other text file in the folder |

If the file can't be loaded, the page shows a file picker so you can choose a lyrics file from your computer. The picker also works when `index.html` is opened directly from disk.

## Lyrics file format

Plain text, one lyric line per line. Blank lines are skipped and leading and trailing whitespace is trimmed. The title shown in the header comes from the file name (`sonnet_18.txt` shows as "Sonnet 18").

## Controls

| Action | Mouse / touch | Keyboard |
| --- | --- | --- |
| Previous line | **Previous** button | `←` |
| Next line | **Next** button | `→` |
| Play / Pause | **Play** button | `Space` |
| Jump to a line | Click the progress bar | — |
| Slower / faster | Drag the **Speed** slider | `-` / `+` |

Using Previous, Next or the progress bar during playback pauses it.

## Project structure

```
lyric-display/
├── index.html      # Page markup
├── css/
│   └── style.css   # Theme tokens, layout, transitions, responsive rules
├── js/
│   └── app.js      # Lyrics loading, navigation, playback and rendering
├── tests/
│   ├── conftest.py     # Starts a local server for the tests
│   ├── test_app.py     # Playwright browser tests
│   └── fixtures/       # Small lyrics files used by the tests
├── lyrics.txt      # Default lyrics (placeholder)
├── sonnet_18.txt   # Sample text
├── eslint.config.mjs  # Lint rules
├── package.json       # ESLint dev dependency
└── README.md
```

## Testing

The tests drive the real page in headless Chromium using [Playwright](https://playwright.dev/python/) and pytest. They use Playwright's fake clock, so the playback tests finish instantly. You don't need to start a server first, because the tests start their own.

One-time setup on Ubuntu/WSL:

```bash
sudo apt install -y python3.12-venv libnss3 libasound2t64
python3 -m venv .venv
.venv/bin/pip install -r requirements-dev.txt
.venv/bin/playwright install chromium
```

Run the tests:

```bash
.venv/bin/pytest
```

Add `--headed --slowmo 300` to watch the tests run in a visible browser.

### Linting

[ESLint](https://eslint.org/) checks `js/` for mistakes such as typos in variable names and unused code. It needs Node.js:

```bash
npm install
npm run lint
```

## Customization

- **Playback speeds**: edit the `SPEEDS` list (seconds per line, slowest first) and `DEFAULT_SPEED` at the top of `js/app.js`. `DEFAULT_SPEED` must be one of the values in `SPEEDS`.
- **Colors**: edit the custom properties in the `:root` block of `css/style.css`. `--accent` and `--accent-2` drive the gradients.
- **Transition speed**: change `--dur` in `css/style.css`. The script reads this value, so the CSS and JS timings stay in sync.
- **Fonts**: Fraunces (lyrics) and Inter (interface) load from Google Fonts in `index.html`. If they can't load, the page falls back to Georgia and the system sans-serif.
