import './style.css';
import { HALLS, buildHall, bestSeat } from './halls.js';
import { HallScene, scoreColor } from './scene.js';
import { slideNumber, glideTo, progressiveBlur } from './motion.js';

const $ = (s) => document.querySelector(s);
const rupee = (n) => `₹${n.toLocaleString('en-IN')}`;

const state = { hall: null, hallIndex: 0, seat: null, mode: 'hall', heat: false };
const scene = new HallScene($('#c'), { onPick: (seat) => choose(seat, true) });

// ---------- hall ----------

const tabs = $('#halls');
HALLS.forEach((h, i) => {
  const b = document.createElement('button');
  b.type = 'button';
  b.role = 'tab';
  b.dataset.i = i;
  b.textContent = h.tab;
  tabs.appendChild(b);
});
tabs.addEventListener('click', (e) => {
  const b = e.target.closest('button');
  if (b && +b.dataset.i !== state.hallIndex) openHall(+b.dataset.i);
});

function openHall(i, intro = false) {
  state.hallIndex = i;
  const hall = (state.hall = buildHall(HALLS[i]));
  scene.load(hall);
  scene.setHeat(state.heat);
  tabs.querySelectorAll('button').forEach((b) => b.setAttribute('aria-selected', +b.dataset.i === i));
  glideTo(tabs, tabs.querySelector(`button[data-i="${i}"]`));
  const open = hall.seats.filter((s) => !s.sold).length;
  $('#blurb').textContent = `${hall.def.name}: ${hall.def.sub}. ${hall.seats.length} seats, ${open} still open. ${hall.def.blurb}`;
  renderMap();
  renderBest();
  renderLegend();
  state.mode = 'hall';
  choose(bestSeat(hall), false);
  // Let people see the room first, then drop them into the best seat.
  if (intro) setTimeout(() => state.mode === 'hall' && setMode('seat'), 1100);
  else setMode('seat');
}

// ---------- seat ----------

function choose(seat, sit) {
  if (!seat || seat.sold) return;
  state.seat = seat;
  scene.select(seat);
  renderTicket();
  document.querySelectorAll('.s.on').forEach((b) => b.classList.remove('on'));
  document.querySelector(`.s[data-i="${seat.index}"]`)?.classList.add('on');
  revealSeat();
  if (sit || state.mode === 'seat') setMode('seat');
  else renderChrome();
}

function setMode(mode) {
  state.mode = mode;
  if (mode === 'seat') scene.sit();
  else scene.overview();
  renderChrome();
}

function renderChrome() {
  const seat = state.seat;
  const inSeat = state.mode === 'seat';
  $('#modeBtn').textContent = inSeat ? 'See the whole hall' : `Sit in ${seat.id}`;
  $('#viewPill span').textContent = inSeat ? `View from ${seat.id}` : `${seat.id} selected`;
  $('#hint').textContent = inSeat ? 'Drag to look around' : 'Drag to turn the hall. Tap a seat to sit in it.';
}

function renderTicket() {
  const seat = state.seat;
  const m = seat.metrics;
  const ticket = $('#ticket');
  ticket.dataset.c = seat.section;
  ticket.dataset.tone = m.tone;
  $('#tClass').textContent = seat.sectionName;
  $('#tPrice').textContent = rupee(seat.price);
  $('#tRow').textContent = seat.row;
  slideNumber($('#tNum'), seat.number);
  $('#tWhere').textContent = `Row ${seat.row}, seat ${seat.number}. ${state.hall.def.name}.`;
  slideNumber($('#score'), m.score);

  // The verdict lands like a rubber stamp each time the seat changes.
  const stamp = $('#verdict');
  stamp.textContent = m.verdict;
  stamp.classList.remove('hit');
  stamp.getBoundingClientRect();
  stamp.classList.add('hit');

  const off = Math.abs(m.offset);
  const tilt = Math.round(m.elevation);
  const facts = [
    [m.distance.toFixed(1), ' m', 'from the screen'],
    [Math.round(m.fov), '°', 'of your view'],
    off < 0.3 ? [null, 'Centre', 'of the row'] : [off.toFixed(1), ' m', m.offset > 0 ? 'right of centre' : 'left of centre'],
    Math.abs(tilt) < 2 ? [null, 'Level', 'with the screen'] : [Math.abs(tilt), '°', tilt > 0 ? 'looking up' : 'looking down'],
  ];
  const dl = $('#stats');
  if (!dl.children.length) dl.innerHTML = facts.map(() => '<div><dt><span class="n"></span><span class="u"></span></dt><dd></dd></div>').join('');
  facts.forEach(([num, unit, label], i) => {
    const row = dl.children[i];
    const n = row.querySelector('.n');
    if (num === null) {
      n.textContent = '';
      delete n.dataset.shape;
    } else slideNumber(n, num);
    row.querySelector('.u').textContent = unit;
    row.querySelector('dd').textContent = label;
  });

  $('#bookBtn').textContent = `Book ${seat.id} for ${rupee(seat.price)}`;
}

// ---------- seat map ----------

function renderMap() {
  const hall = state.hall;
  let html = '<div class="scr"><span>Screen</span></div>';
  let section = -1;
  for (const row of hall.rows) {
    if (row.section !== section) {
      section = row.section;
      const s = hall.sections[section];
      html += `<div class="sec" data-c="${section}"><i></i>${s.name} <b>${rupee(s.price)}</b></div>`;
    }
    html += `<div class="row"><span class="rl">${row.label}</span>`;
    let block = 0;
    for (const seat of row.seats) {
      if (seat.block !== block) {
        block = seat.block;
        html += '<span class="gap"></span>';
      }
      const cls = `s${seat.sold ? ' sold' : ''}${seat.recliner ? ' wide' : ''}`;
      const label = `Row ${seat.row} seat ${seat.number}, ${seat.sectionName}, ${seat.sold ? 'sold' : rupee(seat.price)}`;
      html += `<button type="button" class="${cls}" data-c="${seat.section}" data-i="${seat.index}" aria-label="${label}"${seat.sold ? ' disabled' : ''}>${seat.number}</button>`;
    }
    html += `<span class="rl">${row.label}</span></div>`;
  }
  $('#map').innerHTML = html;
  fitMap();
  paintMap();
}

// Size seats so the widest row fits the panel; below 12px it scrolls sideways instead.
function fitMap() {
  const hall = state.hall;
  if (!hall) return;
  const room = $('.map-wrap').clientWidth - 22 - 36; // padding + row letters
  let size = 18;
  for (const row of hall.rows) {
    const units = row.seats.reduce((n, s) => n + (s.recliner ? 1.5 : 1), 0);
    const fixed = row.seats.length * 2 + row.aisles.length * 12;
    size = Math.min(size, Math.floor((room - fixed) / units));
  }
  $('#map').style.setProperty('--s', `${Math.max(12, size)}px`);
}

function revealSeat() {
  const wrap = $('.map-wrap');
  const btn = wrap.querySelector('.s.on');
  if (!btn || wrap.scrollWidth <= wrap.clientWidth) return;
  const b = btn.getBoundingClientRect();
  const w = wrap.getBoundingClientRect();
  wrap.scrollLeft += b.left + b.width / 2 - (w.left + w.width / 2);
}

function paintMap() {
  const seats = state.hall.seats;
  document.querySelectorAll('#map .s').forEach((b) => {
    const seat = seats[+b.dataset.i];
    const on = state.heat && !seat.sold;
    b.style.setProperty('--q', on ? scoreColor(seat.metrics.score).getStyle() : '');
    b.classList.toggle('heat', on);
  });
}

$('#map').addEventListener('click', (e) => {
  const b = e.target.closest('.s');
  if (b) choose(state.hall.seats[+b.dataset.i], true);
});

// ---------- best seat per class ----------

const best = $('#best');

function renderBest() {
  const hall = state.hall;
  best.querySelectorAll('.pick').forEach((n) => n.remove());
  glideTo(best, null);
  hall.sections.forEach((s, i) => {
    const seat = bestSeat(hall, i);
    if (!seat) return;
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'pick';
    b.dataset.i = seat.index;
    b.dataset.c = i;
    b.innerHTML = `<i></i><span class="pc">${s.name}<small>${rupee(s.price)}</small></span><b>${seat.id}</b><span class="pv" data-tone="${seat.metrics.tone}">${seat.metrics.score}<small>${seat.metrics.verdict}</small></span>`;
    best.appendChild(b);
  });
}

best.addEventListener('click', (e) => {
  const b = e.target.closest('.pick');
  if (b) choose(state.hall.seats[+b.dataset.i], true);
});
best.addEventListener('pointerover', (e) => {
  const b = e.target.closest('.pick');
  if (b) glideTo(best, b);
});
best.addEventListener('focusin', (e) => glideTo(best, e.target.closest('.pick')));
best.addEventListener('pointerleave', () => glideTo(best, null));

function renderLegend() {
  const classes = state.hall.sections.map((s, i) => `<span><i class="k" data-c="${i}"></i>${s.name}</span>`).join('');
  $('#legend').innerHTML = state.heat
    ? `<span><i class="grad"></i>Poor view to sweet spot</span><span><i class="k sold"></i>Sold</span><span><i class="k on"></i>Yours</span>`
    : `${classes}<span><i class="k sold"></i>Sold</span><span><i class="k on"></i>Yours</span>`;
}

// ---------- controls ----------

$('#modeBtn').addEventListener('click', () => setMode(state.mode === 'seat' ? 'hall' : 'seat'));

$('#heatBtn').addEventListener('click', (e) => {
  state.heat = !state.heat;
  e.currentTarget.setAttribute('aria-pressed', state.heat);
  scene.setHeat(state.heat);
  paintMap();
  renderLegend();
});

let toastTimer;
$('#bookBtn').addEventListener('click', () => {
  const t = $('#toast');
  t.textContent = `This is a prototype. Nothing was booked or charged for ${state.seat.id}.`;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 2800);
});

progressiveBlur($('.pblur'), 4, 0.6);

window.addEventListener('resize', () => {
  fitMap();
  glideTo(tabs, tabs.querySelector('[aria-selected="true"]'));
});
document.fonts?.ready.then(() => glideTo(tabs, tabs.querySelector('[aria-selected="true"]')));

// ---------- film on the screen ----------

const DEFAULT_FILM = {
  src: `${import.meta.env.BASE_URL}media/sintel-trailer.mp4`,
  startAt: 12.5, // skip the black title cards
  credit: 'Now playing: the trailer for "Sintel", © Blender Foundation, durian.blender.org, CC BY 3.0.',
};

async function playFilm(src, credit, startAt = 0) {
  const ok = await scene.setFilm(src, startAt);
  $('#nowPlaying').textContent = ok ? credit : 'That file would not play here. Try an MP4.';
  return ok;
}

$('#soundBtn').addEventListener('click', (e) => {
  const on = e.currentTarget.getAttribute('aria-pressed') !== 'true';
  e.currentTarget.setAttribute('aria-pressed', on);
  e.currentTarget.textContent = on ? 'Sound on' : 'Sound off';
  scene.setMuted(!on);
});

let clipUrl;
$('#clipIn').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const url = URL.createObjectURL(file);
  if (await playFilm(url, `Now playing: ${file.name}, from your device. It is not uploaded anywhere.`)) {
    if (clipUrl) URL.revokeObjectURL(clipUrl);
    clipUrl = url;
  } else {
    URL.revokeObjectURL(url);
    playFilm(DEFAULT_FILM.src, DEFAULT_FILM.credit, DEFAULT_FILM.startAt);
  }
  e.target.value = '';
});

playFilm(DEFAULT_FILM.src, DEFAULT_FILM.credit, DEFAULT_FILM.startAt);

// Deep link for sharing a view: ?hall=single&seat=K12&view=hall
const params = new URLSearchParams(location.search);
const startHall = Math.max(0, HALLS.findIndex((h) => h.id === params.get('hall')));
openHall(startHall, !params.has('seat') && !params.has('view'));
if (params.get('heat') === '1') $('#heatBtn').click();
const wanted = state.hall.seats.find((s) => s.id === (params.get('seat') || '').toUpperCase() && !s.sold);
if (wanted) choose(wanted, false);
if (params.get('view') === 'hall') {
  state.mode = 'hall';
  scene.overview(true);
  renderChrome();
} else if (params.has('seat') || params.has('view')) {
  scene.sit(true);
}

window.__nazara = { state, scene };
