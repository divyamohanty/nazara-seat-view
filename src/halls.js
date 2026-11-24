// Hall definitions + layout generator + view-quality maths.
//
// Coordinates (metres): the screen sits on the z = 0 plane, centred on x = 0.
// The audience sits at +z looking towards -z. y is up.
//
// These three halls are illustrative layouts modelled on common Indian formats.
// They are NOT measurements of any real cinema. Swap in surveyed numbers to make
// a hall accurate (see README).

const EYE_HEIGHT = 1.15; // seated eye height above the row's floor
const AISLE = 1.0; // aisle width between seat blocks

export const HALLS = [
  {
    id: 'multiplex',
    name: 'City multiplex',
    tab: 'Multiplex',
    sub: 'Screen 3, 2K laser projection',
    blurb: 'The standard mall multiplex screen: stadium seating, recliners in the last rows.',
    screen: { width: 12, height: 5.0, bottom: 1.8 },
    idealFov: [38, 58],
    firstRowZ: 5.2,
    sections: [
      { name: 'Classic', price: 180, rows: 3, pitch: 1.0, rise: 0.16, seatWidth: 0.54, blocks: [4, 10, 4] },
      { name: 'Prime', price: 260, rows: 7, pitch: 1.1, rise: 0.36, seatWidth: 0.56, blocks: [4, 10, 4], gapBefore: 0.5 },
      { name: 'Recliner', price: 520, rows: 2, pitch: 1.8, rise: 0.5, seatWidth: 0.8, blocks: [2, 6, 2], gapBefore: 0.4, recliner: true },
    ],
  },
  {
    id: 'single',
    name: 'Single screen',
    tab: 'Single screen',
    sub: '70mm, stalls and a balcony',
    blurb: 'The classic big-town talkies: a long, gently sloped stalls floor and a raised balcony.',
    screen: { width: 18, height: 7.6, bottom: 2.4 },
    idealFov: [32, 50],
    firstRowZ: 8,
    sections: [
      { name: 'Front Stalls', price: 80, rows: 6, pitch: 0.95, rise: 0.06, seatWidth: 0.52, blocks: [8, 14, 8] },
      { name: 'Rear Stalls', price: 110, rows: 9, pitch: 0.95, rise: 0.12, seatWidth: 0.52, blocks: [8, 14, 8], gapBefore: 0.6 },
      { name: 'Balcony', price: 160, rows: 7, pitch: 1.0, rise: 0.42, seatWidth: 0.54, blocks: [8, 14, 8], gapBefore: -2.0, lift: 3.4 },
    ],
  },
  {
    id: 'large',
    name: 'Large format',
    tab: 'Large format',
    sub: 'Giant screen, 4K dual laser',
    blurb: 'A wall-to-wall tall screen with a steep rake. Built to fill your vision, so sitting further back helps.',
    screen: { width: 22, height: 11.6, bottom: 1.2 },
    idealFov: [55, 78],
    firstRowZ: 9,
    sections: [
      { name: 'Front', price: 380, rows: 3, pitch: 1.2, rise: 0.5, seatWidth: 0.58, blocks: [5, 16, 5] },
      { name: 'Prime', price: 520, rows: 6, pitch: 1.2, rise: 0.58, seatWidth: 0.58, blocks: [5, 16, 5] },
      { name: 'Premium', price: 750, rows: 3, pitch: 1.3, rise: 0.62, seatWidth: 0.64, blocks: [4, 14, 4], gapBefore: 0.3 },
    ],
  },
];

// Row letters the way most halls print them: no I or O (they look like 1 and 0).
const LETTERS = 'ABCDEFGHJKLMNPQRSTUVWXYZ'.split('');

function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hash(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) h = Math.imul(h ^ str.charCodeAt(i), 16777619);
  return h >>> 0;
}

const deg = (r) => (r * 180) / Math.PI;
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

/** What the screen looks like from an eye position. */
export function viewMetrics(def, eye) {
  const { width: W, height: H, bottom: B } = def.screen;
  const [x, y, z] = eye;
  const cy = B + H / 2;
  const ground = Math.hypot(x, z);

  const fov = deg(Math.atan2(W / 2 - x, z) - Math.atan2(-W / 2 - x, z)); // how wide the screen looks
  const elevation = deg(Math.atan2(cy - y, ground)); // + = looking up at screen centre
  const topAngle = deg(Math.atan2(B + H - y, ground));
  const offAxis = deg(Math.abs(Math.atan2(x, z))); // how far round to the side you are
  const distance = Math.hypot(x, z, cy - y);

  // Size is judged by distance alone (as if you sat on the centre line), so a
  // front-corner seat is not rewarded for the screen looking narrower from there.
  const size = deg(2 * Math.atan(W / 2 / ground));
  const [lo, hi] = def.idealFov;
  const pFov = size < lo ? (lo - size) * 2.2 : size > hi ? (size - hi) * 1.8 : 0;
  const pNeck = elevation > 10 ? (elevation - 10) * 2.6 : elevation < -6 ? (-6 - elevation) * 1.5 : 0;
  const pSide = offAxis > 5 ? (offAxis - 5) * 1.5 : 0;
  const score = Math.round(clamp(100 - pFov - pNeck - pSide, 0, 100));

  let verdict, tone;
  if (score >= 88) [verdict, tone] = ['Sweet spot', 'best'];
  else if (score >= 75) [verdict, tone] = ['Great view', 'great'];
  else if (score >= 60) [verdict, tone] = ['Good view', 'ok'];
  else {
    tone = 'poor';
    const worst = Math.max(pFov, pNeck, pSide);
    if (worst === pSide) verdict = 'Side angle';
    else if (worst === pNeck) verdict = elevation > 0 ? 'Neck-craner' : 'Steep look-down';
    else verdict = size > hi ? 'Too close' : 'Far from screen';
  }

  return { fov, elevation, topAngle, offAxis, distance, offset: x, score, verdict, tone };
}

/** Expand a hall definition into rows and seats with positions and metrics. */
export function buildHall(def) {
  const rand = mulberry32(hash(def.id));
  const totalRows = def.sections.reduce((n, s) => n + s.rows, 0);
  const rows = [];
  const seats = [];

  let z = def.firstRowZ;
  let y = 0;
  let baseY = 0; // underside of the structure the row stands on (0 = ground floor)
  let first = true;
  let rowIndex = 0;

  def.sections.forEach((s, si) => {
    for (let r = 0; r < s.rows; r++) {
      if (!first) {
        z += s.pitch + (r === 0 ? s.gapBefore || 0 : 0);
        y += s.rise + (r === 0 ? s.lift || 0 : 0);
      }
      if (r === 0 && s.lift) baseY = y - 0.45;
      first = false;

      // Row A is the back row, as in most Indian halls.
      const label = LETTERS[totalRows - 1 - rowIndex];
      const count = s.blocks.reduce((a, b) => a + b, 0);
      const width = count * s.seatWidth + (s.blocks.length - 1) * AISLE;
      const row = {
        label, section: si, index: rowIndex, z, y, baseY, pitch: s.pitch, width,
        seats: [], aisles: [], balconyFront: r === 0 && !!s.lift,
      };

      let x = -width / 2;
      let n = 0;
      s.blocks.forEach((block, bi) => {
        for (let k = 0; k < block; k++) {
          n++;
          const sx = x + s.seatWidth / 2;
          const eye = [sx, y + EYE_HEIGHT, z + 0.1];
          const seat = {
            id: `${label}${n}`, row: label, number: n, block: bi,
            x: sx, y, z, width: s.seatWidth, recliner: !!s.recliner,
            section: si, sectionName: s.name, price: s.price,
            sold: rand() < 0.2, eye, index: seats.length,
          };
          seat.metrics = viewMetrics(def, eye);
          row.seats.push(seat);
          seats.push(seat);
          x += s.seatWidth;
        }
        if (bi < s.blocks.length - 1) {
          row.aisles.push(x + AISLE / 2);
          x += AISLE;
        }
      });

      rows.push(row);
      rowIndex++;
    }
  });

  const maxRowWidth = Math.max(...rows.map((r) => r.width));
  const last = rows[rows.length - 1];
  const bounds = {
    width: Math.max(maxRowWidth + 2.4, def.screen.width + 2),
    depth: last.z + 2.6,
    height: Math.max(def.screen.bottom + def.screen.height + 1.2, last.y + 3.2),
    firstZ: rows[0].z,
    lastZ: last.z,
    topY: last.y,
  };

  return { def, rows, seats, bounds, sections: def.sections };
}

/** Best unsold seat overall, or within one section. */
export function bestSeat(hall, section = null) {
  let best = null;
  for (const s of hall.seats) {
    if (s.sold || (section !== null && s.section !== section)) continue;
    if (
      !best ||
      s.metrics.score > best.metrics.score ||
      (s.metrics.score === best.metrics.score && Math.abs(s.x) < Math.abs(best.x))
    ) best = s;
  }
  return best;
}
