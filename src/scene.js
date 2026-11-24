import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const SEAT_BASE_WIDTH = 0.58;
const COLORS = {
  seat: new THREE.Color('#8f1626'),
  recliner: new THREE.Color('#6d1838'),
  sold: new THREE.Color('#2b2530'),
  selected: new THREE.Color('#3fe08f'),
};

const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const rad = (d) => (d * Math.PI) / 180;
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

function seatGeometry() {
  const cushion = new RoundedBoxGeometry(0.5, 0.13, 0.48, 3, 0.05);
  cushion.translate(0, 0.42, -0.02);
  const back = new RoundedBoxGeometry(0.5, 0.66, 0.12, 3, 0.05);
  back.rotateX(0.14);
  back.translate(0, 0.76, 0.27);
  const armL = new RoundedBoxGeometry(0.06, 0.24, 0.42, 2, 0.02);
  armL.translate(-0.275, 0.5, 0);
  const armR = armL.clone();
  armR.translate(0.55, 0, 0);
  const base = new THREE.BoxGeometry(0.4, 0.36, 0.3).toNonIndexed();
  base.translate(0, 0.18, 0.05);
  return mergeGeometries([cushion, back, armL, armR, base]);
}

/** An original placeholder "film frame" so the screen is not blank. */
function filmFrame(aspect) {
  const w = 1280;
  const h = Math.round(w / aspect);
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const g = c.getContext('2d');

  const sky = g.createLinearGradient(0, 0, 0, h);
  sky.addColorStop(0, '#1d2b53');
  sky.addColorStop(0.45, '#c2577a');
  sky.addColorStop(0.72, '#ffb36b');
  sky.addColorStop(1, '#ffe2a8');
  g.fillStyle = sky;
  g.fillRect(0, 0, w, h);

  const sx = w * 0.62;
  const sy = h * 0.6;
  const glow = g.createRadialGradient(sx, sy, 0, sx, sy, h * 0.55);
  glow.addColorStop(0, 'rgba(255,244,214,0.95)');
  glow.addColorStop(0.18, 'rgba(255,214,150,0.55)');
  glow.addColorStop(1, 'rgba(255,190,120,0)');
  g.fillStyle = glow;
  g.fillRect(0, 0, w, h);
  g.fillStyle = '#fff6df';
  g.beginPath();
  g.arc(sx, sy, h * 0.085, 0, Math.PI * 2);
  g.fill();

  const ridges = [
    { base: 0.66, amp: 0.07, f: 1.3, color: '#8a4a72' },
    { base: 0.74, amp: 0.06, f: 2.1, color: '#5d3460' },
    { base: 0.83, amp: 0.05, f: 3.2, color: '#38214a' },
    { base: 0.92, amp: 0.035, f: 4.6, color: '#1a1230' },
  ];
  ridges.forEach((r, i) => {
    g.fillStyle = r.color;
    g.beginPath();
    g.moveTo(0, h);
    for (let x = 0; x <= w; x += 8) {
      const t = x / w;
      const y =
        r.base -
        r.amp * (0.6 * Math.sin(t * Math.PI * 2 * r.f + i * 1.7) + 0.4 * Math.sin(t * Math.PI * 2 * r.f * 2.3 + i));
      g.lineTo(x, y * h);
    }
    g.lineTo(w, h);
    g.closePath();
    g.fill();
  });

  // A lone banyan-ish tree for scale.
  g.fillStyle = '#120c22';
  const tx = w * 0.27;
  const ty = h * 0.86;
  g.fillRect(tx - 3, ty - h * 0.1, 6, h * 0.1);
  g.beginPath();
  g.ellipse(tx, ty - h * 0.115, h * 0.075, h * 0.045, 0, 0, Math.PI * 2);
  g.fill();

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

export class HallScene {
  constructor(canvas, { onPick } = {}) {
    this.canvas = canvas;
    this.onPick = onPick;
    this.mode = 'hall';
    this.heat = false;
    this.selected = null;
    this.tween = null;
    this.look = { yaw: 0, pitch: 0, yawOff: 0, pitchOff: 0 };

    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.15;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color('#050407');
    this.camera = new THREE.PerspectiveCamera(50, 1, 0.05, 400);
    this.camera.rotation.order = 'YXZ';

    this.controls = new OrbitControls(this.camera, canvas);
    this.controls.enableDamping = true;
    this.controls.enablePan = false;
    this.controls.maxPolarAngle = 1.48;
    this.controls.addEventListener('end', () => {
      if (this.mode === 'hall' && !this.tween) this.hallPos.copy(this.camera.position);
    });

    this.hallPos = new THREE.Vector3();
    this.hallTarget = new THREE.Vector3();
    this.video = null;
    this.videoReady = false;
    this._probe = document.createElement('canvas').getContext('2d', { willReadFrequently: true });
    this._probe.canvas.width = this._probe.canvas.height = 8;
    this._probeAt = 0;
    this._glowColor = new THREE.Color('#ffd2a6');
    this._glowLevel = 1.5;
    this.raycaster = new THREE.Raycaster();
    this.group = null;

    this._bindPointer();
    new ResizeObserver(() => this.resize()).observe(canvas.parentElement);
    this.resize();
    this._last = performance.now();
    const loop = (t) => {
      this._tick(t);
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }

  // ---------- building ----------

  load(hall) {
    if (this.group) {
      this.scene.remove(this.group);
      this.group.traverse((o) => {
        o.geometry?.dispose();
        if (o.material) {
          o.material.map?.dispose();
          o.material.dispose();
        }
      });
    }
    this.hall = hall;
    this.selected = null;
    this.tween = null;
    const { def, rows, seats, bounds } = hall;
    const g = (this.group = new THREE.Group());
    this.scene.add(g);

    // Room shell. BackSide means walls nearest the camera vanish in hall view.
    const shell = new THREE.Mesh(
      new THREE.BoxGeometry(bounds.width, bounds.height, bounds.depth + 0.6),
      new THREE.MeshStandardMaterial({ color: '#2b2233', roughness: 1, side: THREE.BackSide })
    );
    shell.position.set(0, bounds.height / 2, bounds.depth / 2 - 0.3);
    g.add(shell);

    // Screen + black masking.
    const { width: W, height: H, bottom: B } = def.screen;
    const screen = new THREE.Mesh(
      new THREE.PlaneGeometry(W, H),
      new THREE.MeshBasicMaterial({
        map: this.videoReady ? this._videoTexture(W / H) : filmFrame(W / H),
        toneMapped: false,
      })
    );
    screen.position.set(0, B + H / 2, 0);
    g.add(screen);
    const mask = new THREE.Mesh(
      new THREE.PlaneGeometry(W + 0.5, H + 0.5),
      new THREE.MeshBasicMaterial({ color: '#000000' })
    );
    mask.position.set(0, B + H / 2, -0.04);
    g.add(mask);

    // Stepped floor / balcony slabs.
    const steps = rows.filter((r) => r.y - r.baseY > 0.02);
    const stepMesh = new THREE.InstancedMesh(
      new THREE.BoxGeometry(1, 1, 1),
      new THREE.MeshStandardMaterial({ color: '#1c1522', roughness: 0.95 }),
      Math.max(steps.length, 1)
    );
    stepMesh.count = steps.length;
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const p = new THREE.Vector3();
    const s = new THREE.Vector3();
    steps.forEach((r, i) => {
      const h = r.y - r.baseY;
      p.set(0, r.baseY + h / 2, r.z + r.pitch * 0.05);
      s.set(bounds.width - 0.02, h, r.pitch + 0.02);
      stepMesh.setMatrixAt(i, m.compose(p, q, s));
    });
    g.add(stepMesh);

    // Balcony parapet.
    rows.filter((r) => r.balconyFront).forEach((r) => {
      const wall = new THREE.Mesh(
        new THREE.BoxGeometry(bounds.width - 0.02, 1.2, 0.12),
        new THREE.MeshStandardMaterial({ color: '#241a2b', roughness: 0.9 })
      );
      wall.position.set(0, r.baseY + 0.6, r.z - r.pitch * 0.5);
      g.add(wall);
    });

    // Seats.
    const seatMesh = new THREE.InstancedMesh(
      seatGeometry(),
      new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.82 }),
      seats.length
    );
    seats.forEach((seat, i) => {
      p.set(seat.x, seat.y, seat.z);
      s.set((seat.width - 0.03) / SEAT_BASE_WIDTH, seat.recliner ? 1.08 : 1, seat.recliner ? 1.35 : 1);
      seatMesh.setMatrixAt(i, m.compose(p, q, s));
    });
    this.seatMesh = seatMesh;
    g.add(seatMesh);
    this._paint();

    // Aisle step lights.
    const lights = [];
    rows.forEach((r) => {
      const edges = [-r.width / 2 - 0.12, r.width / 2 + 0.12];
      r.aisles.forEach((a) => edges.push(a - 0.42, a + 0.42));
      edges.forEach((x) => lights.push([x, r.y + 0.015, r.z - r.pitch * 0.3]));
    });
    const lightMesh = new THREE.InstancedMesh(
      new THREE.BoxGeometry(0.07, 0.02, 0.16),
      new THREE.MeshBasicMaterial({ color: '#ffb469' }),
      lights.length
    );
    s.set(1, 1, 1);
    lights.forEach((l, i) => lightMesh.setMatrixAt(i, m.compose(p.set(...l), q, s)));
    g.add(lightMesh);

    // Selected-seat marker for hall view.
    const beam = new THREE.Mesh(
      new THREE.CylinderGeometry(0.035, 0.035, 2.6, 12),
      new THREE.MeshBasicMaterial({ color: '#3fe08f', transparent: true, opacity: 0.55 })
    );
    beam.visible = false;
    this.beam = beam;
    g.add(beam);

    // Lighting: screen glow from the front, soft house fill from behind.
    // House lights come up in hall view and dim once you sit down (see _tick).
    this.ambient = new THREE.AmbientLight('#cdbcdc', 0.55);
    g.add(this.ambient);
    const glow = new THREE.DirectionalLight('#ffd2a6', 1.5);
    glow.position.set(0, B + H / 2, -1);
    glow.target.position.set(0, bounds.topY * 0.5, bounds.depth);
    g.add(glow, glow.target);
    this.glow = glow;
    this.screen = screen;
    const fill = new THREE.DirectionalLight('#c9b6ff', 0.9);
    fill.position.set(bounds.width * 0.4, bounds.height + 6, bounds.depth + 8);
    fill.target.position.set(0, 0, bounds.depth * 0.4);
    g.add(fill, fill.target);
    this.fill = fill;
    this.house = 1;

    // Default hall-view camera.
    this.hallTarget.set(0, bounds.topY * 0.4 + 1, bounds.depth * 0.48);
    this.controls.target.copy(this.hallTarget);
    this._frameHall();
    this.controls.minDistance = 4;
    this.controls.maxDistance = this.hallPos.distanceTo(this.hallTarget) * 1.6;
    this.mode = 'hall';
    this.controls.enabled = true;
    this.camera.position.copy(this.hallPos);
    this.camera.fov = 50;
    this.camera.updateProjectionMatrix();
    this.camera.lookAt(this.hallTarget);
  }

  _frameHall() {
    const { bounds, def } = this.hall;
    const radius = 0.5 * Math.hypot(bounds.width, bounds.depth, def.screen.bottom + def.screen.height);
    const v = rad(50);
    const h = 2 * Math.atan(Math.tan(v / 2) * this.camera.aspect);
    const portrait = this.camera.aspect < 1;
    const dist = (radius / Math.sin(Math.min(v, h) / 2)) * (portrait ? 0.7 : 0.66);
    const dir = new THREE.Vector3(portrait ? 0.16 : 0.34, 0.55, 0.8).normalize();
    this.hallPos.copy(this.hallTarget).addScaledVector(dir, dist);
  }

  _paint() {
    const c = new THREE.Color();
    this.hall.seats.forEach((seat, i) => {
      if (this.selected === seat) c.copy(COLORS.selected);
      else if (seat.sold) c.copy(COLORS.sold);
      else if (this.heat) c.copy(scoreColor(seat.metrics.score));
      else c.copy(seat.recliner ? COLORS.recliner : COLORS.seat);
      this.seatMesh.setColorAt(i, c);
    });
    this.seatMesh.instanceColor.needsUpdate = true;
  }

  // ---------- film ----------

  /** Play a video file on the cinema screen. Falls back to the painted frame if it cannot load. */
  setFilm(src, startAt = 0) {
    this.video?.pause();
    const v = document.createElement('video');
    v.src = src;
    v.loop = false; // looped by hand so it can skip opening title cards
    v.muted = this.video ? this.video.muted : true;
    v.playsInline = true;
    v.preload = 'auto';
    this.video = v;
    this.videoReady = false;
    v.addEventListener('ended', () => {
      v.currentTime = startAt;
      v.play().catch(() => {});
    });
    return new Promise((resolve) => {
      v.addEventListener('loadeddata', () => {
        if (this.video !== v) return;
        if (startAt) v.currentTime = startAt;
        this.videoReady = true;
        v.play().catch(() => {});
        if (this.screen) {
          const { width: W, height: H } = this.hall.def.screen;
          this.screen.material.map?.dispose();
          this.screen.material.map = this._videoTexture(W / H);
          this.screen.material.needsUpdate = true;
        }
        resolve(true);
      }, { once: true });
      v.addEventListener('error', () => resolve(false), { once: true });
    });
  }

  setMuted(muted) {
    if (!this.video) return;
    this.video.muted = muted;
    if (this.video.paused) this.video.play().catch(() => {});
  }

  // Crop the film to fill the screen shape, like a projectionist would.
  _videoTexture(aspect) {
    const v = this.video;
    const t = new THREE.VideoTexture(v);
    t.colorSpace = THREE.SRGBColorSpace;
    const va = v.videoWidth / v.videoHeight || aspect;
    if (va > aspect) {
      t.repeat.set(aspect / va, 1);
      t.offset.set((1 - aspect / va) / 2, 0);
    } else {
      t.repeat.set(1, va / aspect);
      t.offset.set(0, (1 - va / aspect) / 2);
    }
    return t;
  }

  // The light the screen throws on the room follows what is playing.
  _sampleGlow(now) {
    if (!this.videoReady || now - this._probeAt < 110) return;
    this._probeAt = now;
    try {
      this._probe.drawImage(this.video, 0, 0, 8, 8);
      const d = this._probe.getImageData(0, 0, 8, 8).data;
      let r = 0, g = 0, b = 0;
      for (let i = 0; i < d.length; i += 4) { r += d[i]; g += d[i + 1]; b += d[i + 2]; }
      const n = d.length / 4 * 255;
      r /= n; g /= n; b /= n;
      const luma = 0.2126 * r + 0.7152 * g + 0.0722 * b;
      const peak = Math.max(r, g, b, 0.001);
      this._glowColor.setRGB(0.35 + 0.65 * r / peak, 0.35 + 0.65 * g / peak, 0.35 + 0.65 * b / peak);
      this._glowLevel = 0.6 + 3.0 * Math.sqrt(luma);
    } catch { /* frame not readable yet */ }
  }

  // ---------- public controls ----------

  setHeat(on) {
    this.heat = on;
    this._paint();
  }

  select(seat) {
    this.selected = seat;
    this._paint();
    this.beam.position.set(seat.x, seat.y + 2.4, seat.z + 0.1);
    this.beam.visible = this.mode === 'hall';
  }

  /** Move the camera into the selected seat. */
  sit(instant = false) {
    const seat = this.selected;
    if (!seat) return;
    const { def } = this.hall;
    const eye = new THREE.Vector3(...seat.eye);
    const d = new THREE.Vector3(0, def.screen.bottom + def.screen.height / 2, 0).sub(eye);
    this.look.yaw = Math.atan2(-d.x, -d.z);
    this.look.pitch = Math.atan2(d.y, Math.hypot(d.x, d.z));
    this.look.yawOff = 0;
    this.look.pitchOff = 0;
    this.mode = 'seat';
    this.controls.enabled = false;
    this.beam.visible = false;
    const quat = new THREE.Quaternion().setFromEuler(new THREE.Euler(this.look.pitch, this.look.yaw, 0, 'YXZ'));
    this._fly(eye, quat, this._seatFov(), instant ? 0 : 1300);
  }

  /** Pull back out to the whole-hall view. */
  overview(instant = false) {
    this.mode = 'hall';
    if (this.selected) this.beam.visible = true;
    const quat = new THREE.Quaternion().setFromRotationMatrix(
      new THREE.Matrix4().lookAt(this.hallPos, this.hallTarget, new THREE.Vector3(0, 1, 0))
    );
    this._fly(this.hallPos.clone(), quat, 50, instant ? 0 : 1200, () => {
      this.controls.enabled = true;
      this.controls.update();
    });
  }

  resize() {
    const r = this.canvas.parentElement.getBoundingClientRect();
    if (!r.width || !r.height) return;
    this.renderer.setSize(r.width, r.height, false);
    this.camera.aspect = r.width / r.height;
    if (this.mode === 'seat' && !this.tween) this.camera.fov = this._seatFov();
    this.camera.updateProjectionMatrix();
  }

  // ---------- internals ----------

  // Hold roughly an 84° horizontal view so portrait phones are not tunnel vision.
  _seatFov() {
    const v = 2 * Math.atan(Math.tan(rad(42)) / this.camera.aspect);
    return clamp((v * 180) / Math.PI, 45, 100);
  }

  _fly(pos, quat, fov, ms, done) {
    if (!ms) {
      this.tween = null;
      this.camera.position.copy(pos);
      this.camera.quaternion.copy(quat);
      this.camera.fov = fov;
      this.camera.updateProjectionMatrix();
      done?.();
      return;
    }
    this.tween = {
      t: 0, ms, done,
      p0: this.camera.position.clone(), q0: this.camera.quaternion.clone(), f0: this.camera.fov,
      p1: pos, q1: quat, f1: fov,
    };
  }

  _tick(now) {
    const dt = Math.min(now - this._last, 100);
    this._last = now;
    const tw = this.tween;
    if (tw) {
      tw.t = Math.min(1, tw.t + dt / tw.ms);
      const k = ease(tw.t);
      this.camera.position.lerpVectors(tw.p0, tw.p1, k);
      this.camera.quaternion.slerpQuaternions(tw.q0, tw.q1, k);
      this.camera.fov = tw.f0 + (tw.f1 - tw.f0) * k;
      this.camera.updateProjectionMatrix();
      if (tw.t >= 1) {
        this.tween = null;
        tw.done?.();
      }
    } else if (this.mode === 'hall') {
      this.controls.update();
    } else {
      this.camera.rotation.set(this.look.pitch + this.look.pitchOff, this.look.yaw + this.look.yawOff, 0, 'YXZ');
    }
    if (!this.hall) return;
    this._sampleGlow(now);
    this.glow.color.lerp(this._glowColor, Math.min(1, dt / 180));
    this.glow.intensity += (this._glowLevel - this.glow.intensity) * Math.min(1, dt / 180);
    const want = this.mode === 'hall' ? 1 : 0;
    this.house += (want - this.house) * Math.min(1, dt / 350);
    this.ambient.intensity = 0.5 + 1.1 * this.house;
    this.fill.intensity = 0.7 + 1.5 * this.house;
    this.renderer.render(this.scene, this.camera);
  }

  _bindPointer() {
    const el = this.canvas;
    let down = null;
    el.addEventListener('pointerdown', (e) => {
      down = { x: e.clientX, y: e.clientY, lx: e.clientX, ly: e.clientY, moved: 0 };
    });
    el.addEventListener('pointermove', (e) => {
      if (!down) return;
      const dx = e.clientX - down.lx;
      const dy = e.clientY - down.ly;
      down.lx = e.clientX;
      down.ly = e.clientY;
      down.moved += Math.abs(dx) + Math.abs(dy);
      if (this.mode === 'seat' && !this.tween) {
        this.look.yawOff = clamp(this.look.yawOff + dx * 0.004, -1.9, 1.9);
        const total = clamp(this.look.pitch + this.look.pitchOff + dy * 0.004, -0.9, 0.9);
        this.look.pitchOff = total - this.look.pitch;
      }
    });
    const up = (e) => {
      if (down && down.moved < 6 && this.mode === 'hall' && !this.tween) this._pick(e);
      down = null;
    };
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', () => (down = null));
  }

  _pick(e) {
    const r = this.canvas.getBoundingClientRect();
    const ndc = new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    this.raycaster.setFromCamera(ndc, this.camera);
    const hit = this.raycaster.intersectObject(this.seatMesh)[0];
    if (!hit) return;
    const seat = this.hall.seats[hit.instanceId];
    if (seat && !seat.sold) this.onPick?.(seat);
  }
}

/** Red → amber → green by view score. Shared with the 2D map. */
export function scoreColor(score) {
  const t = clamp(score / 100, 0, 1);
  return new THREE.Color().setHSL((Math.pow(t, 1.6) * 135) / 360, 0.72, 0.46);
}
