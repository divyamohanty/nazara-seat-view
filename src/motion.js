// Small vanilla ports of three ideas from motion-primitives (MIT, github.com/ibelick/motion-primitives):
// sliding-number, animated-background and progressive-blur. That kit is React + Tailwind;
// this app is plain JS, so the ideas are rebuilt here on CSS transitions.

const DIGITS = '0123456789';

/**
 * Sliding number: each digit is a 0-9 reel that rolls to its new value.
 * `text` may mix digits and other characters ("12.3", "52°").
 */
export function slideNumber(el, text) {
  text = String(text);
  const shape = text.replace(/\d/g, '0');
  if (el.dataset.shape !== shape) {
    el.dataset.shape = shape;
    el.textContent = '';
    for (const ch of text) {
      const cell = document.createElement('span');
      if (DIGITS.includes(ch)) {
        cell.className = 'dg';
        const reel = document.createElement('span');
        reel.className = 'reel';
        for (const d of DIGITS) reel.appendChild(Object.assign(document.createElement('span'), { textContent: d }));
        cell.appendChild(reel);
      } else {
        cell.textContent = ch;
      }
      el.appendChild(cell);
    }
    el.setAttribute('role', 'text');
  }
  el.setAttribute('aria-label', text);
  [...text].forEach((ch, i) => {
    const reel = el.children[i].firstElementChild;
    if (reel) reel.style.setProperty('--d', ch);
    else el.children[i].textContent = ch;
  });
}

/** Animated background: one highlight that glides to whichever child is active. */
export function glideTo(container, target) {
  const glide = container.querySelector(':scope > .glide');
  if (!glide) return;
  if (!target) {
    glide.style.opacity = 0;
    return;
  }
  const fresh = glide.style.opacity !== '1';
  if (fresh) glide.style.transition = 'none';
  glide.style.width = `${target.offsetWidth}px`;
  glide.style.height = `${target.offsetHeight}px`;
  glide.style.transform = `translate(${target.offsetLeft}px, ${target.offsetTop}px)`;
  glide.style.opacity = 1;
  if (fresh) {
    glide.getBoundingClientRect();
    glide.style.transition = '';
  }
}

/** Progressive blur: stacked layers, each blurring a little more than the last. */
export function progressiveBlur(el, layers = 5, step = 1.4) {
  const seg = 1 / (layers + 1);
  for (let i = 0; i < layers; i++) {
    const stops = [i, i + 1, i + 2, i + 3].map((n, k) => `rgba(0,0,0,${k === 1 || k === 2 ? 1 : 0}) ${n * seg * 100}%`);
    const mask = `linear-gradient(180deg, ${stops.join(', ')})`;
    const layer = document.createElement('div');
    layer.style.cssText = `position:absolute;inset:0;-webkit-mask-image:${mask};mask-image:${mask};-webkit-backdrop-filter:blur(${(i + 1) * step}px);backdrop-filter:blur(${(i + 1) * step}px)`;
    el.appendChild(layer);
  }
}
