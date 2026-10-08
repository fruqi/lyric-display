// Seconds per line for each speed slider step, slowest (left) to fastest (right)
const SPEEDS = [5, 4, 3, 2.5, 2, 1.5, 1.25, 1, 0.75, 0.5];
const DEFAULT_SPEED = 2;
const SPEED_KEY = 'lyric-display:speed';
// Load lyrics.txt by default; override with ?file=other.txt
const lyricsFile = new URLSearchParams(location.search).get('file') || 'lyrics.txt';

const ICON_PLAY = '<svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>Play';
const ICON_PAUSE = '<svg viewBox="0 0 24 24"><path d="M6 5h4v14H6zm8 0h4v14h-4z"/></svg>Pause';
const DURATION = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--dur')) || 550;

const $ = id => document.getElementById(id);
const stage = $('stage'), upNext = $('up-next'), bar = $('bar'), barFill = $('bar-fill');
const prevBtn = $('prev'), nextBtn = $('next'), playBtn = $('play');
const speedInput = $('speed'), speedValue = $('speed-value');

let lines = [];
let index = 0;
let timer = null;
let delayMs = DEFAULT_SPEED * 1000;

function makeSlot(i) {
  const slot = document.createElement('div');
  slot.className = 'slot';
  const num = document.createElement('span');
  num.className = 'num';
  num.textContent = String(i + 1).padStart(2, '0');
  const text = document.createElement('p');
  text.className = 'text';
  text.textContent = lines[i];
  slot.append(num, text);
  return slot;
}

// Crossfade: old line drifts out one way while the new one drifts in from the other
function showLine(direction) {
  const forward = direction >= 0;
  stage.querySelectorAll('.slot:not(.leaving)').forEach(old => {
    old.classList.add('leaving', forward ? 'exit-up' : 'exit-down');
    setTimeout(() => old.remove(), DURATION);
  });
  const slot = makeSlot(index);
  slot.classList.add(forward ? 'enter-from-below' : 'enter-from-above');
  stage.append(slot);
  slot.getBoundingClientRect(); // commit start state before transitioning
  slot.classList.remove('enter-from-below', 'enter-from-above');
}

function render() {
  playBtn.innerHTML = timer ? ICON_PAUSE : ICON_PLAY;
  playBtn.setAttribute('aria-label', timer ? 'Pause' : 'Play');
  document.body.classList.toggle('playing', !!timer);

  if (!lines.length) {
    [prevBtn, nextBtn, playBtn].forEach(b => b.disabled = true);
    $('progress-text').textContent = $('percent').textContent = upNext.textContent = '';
    barFill.style.width = '0';
    return;
  }
  const pct = Math.round(((index + 1) / lines.length) * 100);
  $('progress-text').innerHTML = `Line <strong>${index + 1}</strong> of ${lines.length}`;
  $('percent').textContent = `${pct}%`;
  barFill.style.width = `${pct}%`;
  bar.setAttribute('aria-valuemax', lines.length);
  bar.setAttribute('aria-valuenow', index + 1);
  upNext.innerHTML = '';
  if (lines[index + 1]) {
    upNext.innerHTML = '<b>Up next</b>';
    upNext.append(lines[index + 1]);
  }
  prevBtn.disabled = index === 0;
  nextBtn.disabled = index === lines.length - 1;
  playBtn.disabled = false;
}

function go(newIndex) {
  newIndex = Math.max(0, Math.min(lines.length - 1, newIndex));
  if (newIndex !== index) {
    const direction = newIndex - index;
    index = newIndex;
    showLine(direction);
  }
  render();
}

function stop() {
  clearInterval(timer);
  timer = null;
  render();
}

function startTimer() {
  clearInterval(timer);
  timer = setInterval(() => {
    go(index + 1);
    if (index === lines.length - 1) stop();
  }, delayMs);
}

function play() {
  // Restart from the top if we're already at the end
  if (index === lines.length - 1) go(0);
  startTimer();
  render();
}

function setSpeed(step) {
  const seconds = SPEEDS[step];
  delayMs = seconds * 1000;
  speedValue.textContent = `${seconds} s / line`;
  speedInput.setAttribute('aria-valuetext', `${seconds} seconds per line`);
  // Fill the track up to the thumb
  speedInput.style.setProperty('--fill', `${(step / (SPEEDS.length - 1)) * 100}%`);
  try { localStorage.setItem(SPEED_KEY, seconds); } catch {}
  // Apply immediately if playing
  if (timer) startTimer();
}

function nudgeSpeed(delta) {
  const step = Math.max(0, Math.min(SPEEDS.length - 1, Number(speedInput.value) + delta));
  speedInput.value = step;
  setSpeed(step);
}

function initSpeed() {
  let saved = DEFAULT_SPEED;
  try { saved = parseFloat(localStorage.getItem(SPEED_KEY)) || DEFAULT_SPEED; } catch {}
  let step = SPEEDS.indexOf(saved);
  if (step < 0) step = SPEEDS.indexOf(DEFAULT_SPEED);
  speedInput.max = SPEEDS.length - 1;
  speedInput.value = step;
  setSpeed(step);
  speedInput.addEventListener('input', () => setSpeed(Number(speedInput.value)));
  // Release focus after a mouse/touch drag so the arrow and space shortcuts keep working
  speedInput.addEventListener('pointerup', () => speedInput.blur());
}

prevBtn.addEventListener('click', () => { stop(); go(index - 1); });
nextBtn.addEventListener('click', () => { stop(); go(index + 1); });
playBtn.addEventListener('click', () => timer ? stop() : play());

bar.addEventListener('click', e => {
  if (!lines.length) return;
  const rect = bar.getBoundingClientRect();
  stop();
  go(Math.floor(((e.clientX - rect.left) / rect.width) * lines.length));
});

document.addEventListener('keydown', e => {
  // Let a focused slider or file input keep its own arrow/space keys
  if (e.target.tagName === 'INPUT') return;
  if (e.key === '+' || e.key === '=') return nudgeSpeed(1);
  if (e.key === '-') return nudgeSpeed(-1);
  if (e.key === 'ArrowRight' && !nextBtn.disabled) nextBtn.click();
  else if (e.key === 'ArrowLeft' && !prevBtn.disabled) prevBtn.click();
  else if (e.key === ' ' && !playBtn.disabled) { e.preventDefault(); playBtn.click(); }
});

function setLyrics(text, name) {
  lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  index = 0;
  $('title').textContent = name.split('/').pop().replace(/\.txt$/i, '').replace(/[_-]+/g, ' ');
  if (lines.length) showLine(1);
  else showMessage('This file has no lyrics.');
  stop();
}

function showMessage(msg) {
  stage.innerHTML = '';
  const slot = document.createElement('div');
  slot.className = 'slot';
  slot.innerHTML = '<span class="num"></span><p class="text"></p>';
  slot.querySelector('.text').textContent = msg;
  stage.append(slot);
}

// Fallback for when fetch fails (missing file, or page opened via file://)
$('file').addEventListener('change', async e => {
  const file = e.target.files[0];
  if (!file) return;
  setLyrics(await file.text(), file.name);
  $('loader').style.display = 'none';
});

fetch(lyricsFile)
  .then(r => { if (!r.ok) throw new Error(r.status); return r.text(); })
  .then(text => setLyrics(text, lyricsFile))
  .catch(() => {
    showMessage('No lyrics loaded.');
    $('filename').textContent = lyricsFile;
    $('loader').style.display = 'block';
    render();
  });

initSpeed();
