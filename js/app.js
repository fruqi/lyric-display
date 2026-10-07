const DELAY_MS = 2000;
// Load lyrics.txt by default; override with ?file=other.txt
const lyricsFile = new URLSearchParams(location.search).get('file') || 'lyrics.txt';

const ICON_PLAY = '<svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>Play';
const ICON_PAUSE = '<svg viewBox="0 0 24 24"><path d="M6 5h4v14H6zm8 0h4v14h-4z"/></svg>Pause';
const DURATION = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--dur')) || 550;

const $ = id => document.getElementById(id);
const stage = $('stage'), upNext = $('up-next'), bar = $('bar'), barFill = $('bar-fill');
const prevBtn = $('prev'), nextBtn = $('next'), playBtn = $('play');

let lines = [];
let index = 0;
let timer = null;

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

function play() {
  // Restart from the top if we're already at the end
  if (index === lines.length - 1) go(0);
  timer = setInterval(() => {
    go(index + 1);
    if (index === lines.length - 1) stop();
  }, DELAY_MS);
  render();
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
  if (e.key === 'ArrowRight' && !nextBtn.disabled) nextBtn.click();
  else if (e.key === 'ArrowLeft' && !prevBtn.disabled) prevBtn.click();
  else if (e.key === ' ' && !playBtn.disabled) { e.preventDefault(); playBtn.click(); }
});

function setLyrics(text, name) {
  lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  index = 0;
  $('title').textContent = name.split('/').pop().replace(/\.txt$/i, '').replace(/[_-]+/g, ' ');
  if (lines.length) showLine(1);
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
