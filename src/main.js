import './style.css';
import { HALLS, buildHall, bestSeat } from './halls.js';
import { HallScene, scoreColor } from './scene.js';

const $ = (s) => document.querySelector(s);
const rupee = (n) => `₹${n.toLocaleString('en-IN')}`;

const state = { hall: null, seat: null, mode: 'hall', heat: false };
const scene = new HallScene($('#c'), { onPick: (seat) => choose(seat, true) });

// ---------- hall ----------

const hallSel = $('#hallSel');
HALLS.forEach((h, i) => hallSel.add(new Option(h.name, i)));
hallSel.addEventListener('change', () => openHall(+hallSel.value));

function openHall(i, intro = false) {
  const hall = (state.hall = buildHall(HALLS[i]));
  scene.load(hall);
  scene.setHeat(state.heat);
  const open = hall.seats.filter((s) => !s.sold).length;
  $('#blurb').textContent = `${hall.def.sub} · ${hall.seats.length} seats, ${open} open. ${hall.def.blurb}`;
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
  renderSeat();
  document.querySelectorAll('.s.on').forEach((b) => b.classList.remove('on'));
  const btn = document.querySelector(`.s[data-i="${seat.index}"]`);
  btn?.classList.add('on');
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
  $('#modeBtn').textContent = inSeat ? '‹ Whole hall' : `Sit in ${seat.id} ›`;
  $('#viewPill span').textContent = inSeat ? `View from ${seat.id}` : `${state.hall.def.name} · ${seat.id} selected`;
  $('#hint').textContent = inSeat ? 'Drag to look around' : 'Drag to orbit · tap a seat to sit in it';
}

function renderSeat() {
  const seat = state.seat;
  const m = seat.metrics;
  const v = $('#verdict');
  v.textContent = m.verdict;
  v.dataset.tone = m.tone;
  $('#seatName').textContent = `Row ${seat.row}, Seat ${seat.number}`;
  $('#seatClass').textContent = `${seat.sectionName} · ${rupee(seat.price)}`;
  $('#score').textContent = m.score;
  $('#score').style.color = scoreColor(m.score).getStyle();

  const off = Math.abs(m.offset);
  const side = off < 0.3 ? ['On centre', 'dead ahead'] : [`${off.toFixed(1)} m`, m.offset > 0 ? 'to the right' : 'to the left'];
  const tilt = Math.round(m.elevation);
  const neck = Math.abs(tilt) < 2 ? ['Level', 'eye line'] : [`${Math.abs(tilt)}°`, tilt > 0 ? 'looking up' : 'looking down'];
  const tiles = [
    [`${m.distance.toFixed(1)} m`, 'to screen'],
    [`${Math.round(m.fov)}°`, 'screen fills'],
    side,
    neck,
  ];
  $('#stats').innerHTML = tiles.map(([a, b]) => `<div class="tile"><b>${a}</b><span>${b}</span></div>`).join('');
  $('#bookBtn').textContent = `Book ${seat.id} · ${rupee(seat.price)}`;
}

// ---------- seat map ----------

function renderMap() {
  const hall = state.hall;
  const map = $('#map');
  let html = '<div class="scr"><span>Screen</span></div>';
  let section = -1;
  for (const row of hall.rows) {
    if (row.section !== section) {
      section = row.section;
      const s = hall.sections[section];
      html += `<div class="sec">${s.name} <b>${rupee(s.price)}</b></div>`;
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
      html += `<button type="button" class="${cls}" data-i="${seat.index}" aria-label="${label}"${seat.sold ? ' disabled' : ''}>${seat.number}</button>`;
    }
    html += `<span class="rl">${row.label}</span></div>`;
  }
  map.innerHTML = html;
  fitMap();
  paintMap();
}

// Size seats so the widest row fits the panel; below 12px it scrolls sideways instead.
function fitMap() {
  const hall = state.hall;
  if (!hall) return;
  const wrap = $('.map-wrap');
  const room = wrap.clientWidth - 22 - 36; // padding + row letters
  let size = 18;
  for (const row of hall.rows) {
    const units = row.seats.reduce((n, s) => n + (s.recliner ? 1.5 : 1), 0);
    const fixed = row.seats.length * 2 + row.aisles.length * 14;
    size = Math.min(size, Math.floor((room - fixed) / units));
  }
  $('#map').style.setProperty('--s', `${Math.max(12, size)}px`);
}
window.addEventListener('resize', fitMap);

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
    b.style.setProperty('--q', state.heat && !seat.sold ? scoreColor(seat.metrics.score).getStyle() : '');
    b.classList.toggle('heat', state.heat && !seat.sold);
  });
}

$('#map').addEventListener('click', (e) => {
  const b = e.target.closest('.s');
  if (b) choose(state.hall.seats[+b.dataset.i], true);
});

function renderBest() {
  const hall = state.hall;
  const picks = hall.sections
    .map((s, i) => ({ s, seat: bestSeat(hall, i) }))
    .filter((p) => p.seat);
  $('#best').innerHTML = picks
    .map(
      ({ s, seat }) =>
        `<button type="button" class="pick" data-i="${seat.index}">
           <span>${s.name} · ${rupee(s.price)}</span>
           <b>${seat.id}</b>
           <em style="color:${scoreColor(seat.metrics.score).getStyle()}">${seat.metrics.score} · ${seat.metrics.verdict}</em>
         </button>`
    )
    .join('');
}

$('#best').addEventListener('click', (e) => {
  const b = e.target.closest('.pick');
  if (b) choose(state.hall.seats[+b.dataset.i], true);
});

function renderLegend() {
  $('#legend').innerHTML = state.heat
    ? `<span><i class="grad"></i> poor → sweet spot</span><span><i class="k sold"></i> Sold</span><span><i class="k on"></i> Yours</span>`
    : `<span><i class="k"></i> Available</span><span><i class="k sold"></i> Sold</span><span><i class="k on"></i> Yours</span>`;
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
  t.textContent = `Prototype only. Nothing was booked or charged for ${state.seat.id}.`;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 2800);
});

// Deep link for sharing a view: ?hall=single&seat=K12&view=hall
const params = new URLSearchParams(location.search);
const startHall = Math.max(0, HALLS.findIndex((h) => h.id === params.get('hall')));
hallSel.value = startHall;
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
