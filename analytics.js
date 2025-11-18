window.addEventListener('error', ev => {
  const el = document.getElementById('loadError');
  if (el) {
    el.textContent = `Error: ${ev.message}`;
    el.style.display = 'block';
  }
});
function aggregateBy(list, keyFn) {
  const m = {};
  for (const item of list) {
    const k = keyFn(item);
    if (!k) continue;
    m[k] = (m[k] || 0) + 1;
  }
  return m;
}

/* Return the top N entries from a {key:count} map, sorted by count
   descending. */
function topEntries(map, n = 10) {
  return Object.entries(map).sort((a, b) => b[1] - a[1]).slice(0, n);
}

/* Return a palette of colours for severity labels.  Colours are taken
   from CSS custom properties defined in crt.css so that the chart
   inherits the same neon palette used elsewhere on the page. */
function paletteForSeverities(labels) {
  const rootStyles = getComputedStyle(document.documentElement);
  const map = {
    Low: rootStyles.getPropertyValue('--sev-low').trim() || '#00e676',
    Medium: rootStyles.getPropertyValue('--sev-medium').trim() || '#eab308',
    High: rootStyles.getPropertyValue('--sev-high').trim() || '#f97316',
    Critical: rootStyles.getPropertyValue('--sev-critical').trim() || '#ef4444',
    Unknown: '#9ca3af'
  };
  return labels.map(l => map[l] || '#9ca3af');
}

/* Generate a distinct colour palette for ranking bars.  Colours are
   computed in HSL space to provide visual separation. */
function colors(n) {
  const arr = [];
  for (let i = 0; i < n; i++) {
    arr.push(`hsl(${Math.round((360 / n) * i)}, 70%, 55%)`);
  }
  return arr;
}

/* Render a ranked list (e.g. top CWEs) into a container.  Each
   entry displays a title, a horizontal bar scaled relative to the
   maximum count and a numeric count on the right.  The bar fill
   colours come from the provided palette array. */
function renderRankList(container, entries, palette) {
  container.innerHTML = '';
  if (!entries.length) {
    const p = document.createElement('p');
    p.textContent = 'No data available.';
    p.style.color = '#bfc3d0';
    container.appendChild(p);
    return;
  }
  const max = Math.max(...entries.map(([, v]) => v));
    entries.forEach(([name, count], i) => {
      const row = document.createElement('div');
      row.className = 'rank-row';
      const left = document.createElement('div');
      left.className = 'rank-left';
      const title = document.createElement('div');
      title.className = 'rank-title';
      title.textContent = name;
      const bar = document.createElement('div');
      bar.className = 'rank-bar';
      const fill = document.createElement('div');
      fill.className = 'rank-fill';
      // Use a uniform neon colour for all bars instead of multiple
      // hues.  This echoes simple CRT graphics where bars are drawn
      // with a single phosphorescent tone.  Retrieve the base green
      // colour from the CSS variables.
      const rootStyles = getComputedStyle(document.documentElement);
      const base = rootStyles.getPropertyValue('--green').trim() || '#00e676';
      fill.style.background = base;
      // Apply a neon glow to each bar for a phosphor bloom effect.
      fill.style.boxShadow = `0 0 6px ${base}, 0 0 12px ${base}`;
      // Compute width relative to the maximum count.  Start at 0 for
      // animation and expand on the next frame.
      const finalWidth = `${(count / max) * 100}%`;
      fill.style.width = '0%';
      bar.appendChild(fill);
      requestAnimationFrame(() => {
        fill.style.width = finalWidth;
      });
      left.appendChild(title);
      left.appendChild(bar);
      const right = document.createElement('div');
      right.className = 'rank-count';
      right.textContent = count;
      row.appendChild(left);
      row.appendChild(right);
      container.appendChild(row);
    });
}

/* Lighten an RGB hex colour by a given percentage.  The `amount` should
   be between 0 and 1 and represents the fraction of the way to white
   to move each channel. */
function lightenColor(hex, amount) {
  let c = hex.replace('#', '');
  if (c.length === 3) {
    c = c.split('').map(ch => ch + ch).join('');
  }
  let r = parseInt(c.substr(0, 2), 16);
  let g = parseInt(c.substr(2, 2), 16);
  let b = parseInt(c.substr(4, 2), 16);
  r = Math.min(255, Math.floor(r + (255 - r) * amount));
  g = Math.min(255, Math.floor(g + (255 - g) * amount));
  b = Math.min(255, Math.floor(b + (255 - b) * amount));
  return `#${[r, g, b].map(x => x.toString(16).padStart(2, '0')).join('')}`;
}

/* Darken an RGB hex colour by a given percentage.  The `amount` should
   be between 0 and 1 and represents the fraction of the way to black
   to move each channel. */
function darkenColor(hex, amount) {
  let c = hex.replace('#', '');
  if (c.length === 3) {
    c = c.split('').map(ch => ch + ch).join('');
  }
  let r = parseInt(c.substr(0, 2), 16);
  let g = parseInt(c.substr(2, 2), 16);
  let b = parseInt(c.substr(4, 2), 16);
  r = Math.max(0, Math.floor(r * (1 - amount)));
  g = Math.max(0, Math.floor(g * (1 - amount)));
  b = Math.max(0, Math.floor(b * (1 - amount)));
  return `#${[r, g, b]
    .map(x => x.toString(16).padStart(2, '0'))
    .join('')}`;
}

/* Convert a hex colour to an RGB object.  Accepts 3‑ or 6‑digit
   notation and returns an object with r, g, b channels in the
   range 0–255. */
function hexToRgb(hex) {
  let c = hex.replace('#', '').trim();
  if (c.length === 3) c = c.split('').map(ch => ch + ch).join('');
  const r = parseInt(c.substr(0, 2), 16);
  const g = parseInt(c.substr(2, 2), 16);
  const b = parseInt(c.substr(4, 2), 16);
  return { r, g, b };
}

/* Lighten a base RGB colour towards white by a given fraction.  The
   amount should be between 0 and 1 and determines how far to move
   each channel towards 255.  Returns a new RGB object. */
function lightenRgb(rgb, amount) {
  const r = Math.min(255, Math.floor(rgb.r + (255 - rgb.r) * amount));
  const g = Math.min(255, Math.floor(rgb.g + (255 - rgb.g) * amount));
  const b = Math.min(255, Math.floor(rgb.b + (255 - rgb.b) * amount));
  return { r, g, b };
}

/* Draw a 3D torus representing the severity distribution.  The torus
   is drawn onto a low‑resolution offscreen canvas and then scaled
   up via CSS.  The torus rotates around the Y axis with a fixed
   tilt around the X axis to reveal its thickness.  Colours are
   assigned based on the relative distribution of severities and
   modulated by a simple Lambertian lighting model to give depth. */
function drawSeverityTorus(canvas, segments, baseColors, rotY) {
  const ctx = canvas.getContext('2d');
  // Choose an internal resolution proportional to the canvas size.
  // Limit the maximum to keep the z‑buffer manageable.  A higher
  // resolution produces a smoother torus.  We base the resolution
  // on the element’s clientWidth so that the torus scales with
  // responsive layouts.
  const maxRes = 250;
  const res = Math.min(maxRes, Math.floor(canvas.clientWidth));
  canvas.width = res;
  canvas.height = res;
  const width = res;
  const height = res;
  const imgData = ctx.createImageData(width, height);
  const buf = imgData.data;
  const zbuf = new Float32Array(width * height);
  // Initialise zBuffer to a large negative number so any real
  // coordinate will be closer.  Using -Infinity can cause NaN
  // comparisons in some browsers, so pick a sufficiently low value.
  zbuf.fill(-1e9);
  // Precompute trigonometric values for rotation angles
  const rotX = Math.PI / 6; // 30° tilt around X axis
  const cosY = Math.cos(rotY);
  const sinY = Math.sin(rotY);
  const cosX = Math.cos(rotX);
  const sinX = Math.sin(rotX);
  // Torus geometry parameters.  The major radius (distance from
  // centre of torus to centre of tube) and minor radius (radius
  // of the tube itself) are relative to the canvas size.  Use
  // proportions that yield a pleasing ring with ample thickness.
  const R = 1.0;   // major radius in arbitrary units
  const r = 0.35;  // minor radius (thickness of the tube)
  // Map phi values to severity segments.  Build an array of
  // structures: { start: fraction, end: fraction, label: 'Low' }
  // where fraction is [0,1].  Use segments to select a base colour
  // for any phi.  The segments array is pre‑sorted by ascending
  // start fraction.
  // Convert base colours into RGB for efficiency.
  const baseRgb = {};
  Object.keys(baseColors).forEach(k => {
    baseRgb[k] = hexToRgb(baseColors[k]);
  });
  // Define light direction for shading.  This vector points
  // towards the viewer (positive Z) with a slight upward tilt to
  // emphasise the top of the donut.  It must be normalised.
  const light = { x: 0.0, y: 0.0, z: 1.0 };
  // Normalise light vector
  const mag = Math.hypot(light.x, light.y, light.z);
  light.x /= mag;
  light.y /= mag;
  light.z /= mag;
  // Iterate over torus surface.  nPhi controls the number of
  // subdivisions around the major radius (outer circumference) and
  // nTheta controls subdivisions around the minor radius (tube).  A
  // higher resolution yields smoother results but costs more CPU.
  // Determine the sampling resolution based on the canvas size.
  // More subdivisions around the major (phi) and minor (theta)
  // directions yield smoother surfaces but increase CPU cost.  Use
  // fractions of the resolution to scale with the canvas.
  // Increase sampling density for smoother surfaces.  Use more
  // subdivisions around the major and minor axes.  A denser grid
  // reduces gaps between plotted points and produces a more solid
  // appearance.  These factors (1.2 and 0.6) were chosen to
  // balance quality and performance.
  const nPhi = Math.floor(res * 1.2);
  const nTheta = Math.floor(res * 0.6);
  for (let i = 0; i < nPhi; i++) {
    const phi = (i / nPhi) * 2 * Math.PI;
    // Determine which severity segment this phi falls into.  Use
    // phi normalized to [0,1) and find the segment whose [start, end)
    // encompasses it.  Default to the last segment if none match.
    let segmentLabel = segments[segments.length - 1].label;
    const phiNorm = (phi / (2 * Math.PI)) % 1;
    for (const seg of segments) {
      if (phiNorm >= seg.start && phiNorm < seg.end) {
        segmentLabel = seg.label;
        break;
      }
    }
    const baseColor = baseRgb[segmentLabel] || baseRgb.Unknown;
    for (let j = 0; j < nTheta; j++) {
      const theta = (j / nTheta) * 2 * Math.PI;
      // Parametric coordinates of the torus before rotation
      const cosTheta = Math.cos(theta);
      const sinTheta = Math.sin(theta);
      const cosPhi = Math.cos(phi);
      const sinPhi = Math.sin(phi);
      // Coordinates of the torus surface point
      const x0 = (R + r * cosTheta) * cosPhi;
      const y0 = (R + r * cosTheta) * sinPhi;
      const z0 = r * sinTheta;
      // Rotate around Y then X
      let x1 = x0 * cosY + z0 * sinY;
      let z1 = z0 * cosY - x0 * sinY;
      let y1 = y0 * cosX - z1 * sinX;
      let z2 = z1 * cosX + y0 * sinX;
      // Project to 2D using a perspective transformation.  The
      // constants below set the camera distance ('viewer') and the
      // projection scale ('k') relative to the canvas size.  Adjust
      // these values to control how large the torus appears.  A
      // smaller viewer distance and larger k produce a larger
      // projected torus.
      const viewer = 4;
      const k = res * 1.0;
      const ooz = 1 / (viewer + z2);
      const px = Math.floor(width / 2 + x1 * k * ooz);
      const py = Math.floor(height / 2 - y1 * k * ooz);
      if (px < 0 || px >= width || py < 0 || py >= height) continue;
      // Compute surface normal for shading.  Before rotation, the
      // normal points outward from the torus: (cosTheta * cosPhi,
      // cosTheta * sinPhi, sinTheta).  Rotate this normal using
      // the same rotation matrices as the point.
      let nx0 = cosTheta * cosPhi;
      let ny0 = cosTheta * sinPhi;
      let nz0 = sinTheta;
      let nx1 = nx0 * cosY + nz0 * sinY;
      let nz1 = nz0 * cosY - nx0 * sinY;
      let ny1 = ny0 * cosX - nz1 * sinX;
      let nz2 = nz1 * cosX + ny0 * sinX;
      // Compute brightness as the dot product between the rotated
      // normal and the light direction.  Clamp to zero (no
      // negative lighting).  This implements a Lambertian model
      // where surfaces facing the light are brighter.
      let brightness = nx1 * light.x + ny1 * light.y + nz2 * light.z;
      if (brightness < 0) brightness = 0;
      // Plot the point into a small 2×2 block of pixels to reduce
      // sampling artefacts.  Extending the drawing across adjacent
      // pixels fills gaps and produces a continuous surface.  Use
      // zBuffer per pixel to handle occlusion correctly.
      for (let dx = 0; dx < 2; dx++) {
        for (let dy = 0; dy < 2; dy++) {
          const xPix = px + dx;
          const yPix = py + dy;
          if (xPix < 0 || xPix >= width || yPix < 0 || yPix >= height) continue;
          const idx = xPix + yPix * width;
          if (z2 > zbuf[idx]) {
            zbuf[idx] = z2;
            const lit = lightenRgb(baseColor, brightness * 0.8);
            buf[idx * 4] = lit.r;
            buf[idx * 4 + 1] = lit.g;
            buf[idx * 4 + 2] = lit.b;
            buf[idx * 4 + 3] = 255;
          }
        }
      }
    }
  }
  ctx.putImageData(imgData, 0, 0);
}

/* Initialize and animate the severity torus.  This function sets up
   the segment definitions based on the severity map, selects base
   colours from CSS variables, and starts an animation loop.  The
   torus spins by incrementing its Y rotation angle on each frame. */
function initSeverityTorus(sevMap) {
  const canvas = document.getElementById('severityTorus');
  if (!canvas) return;
  // Compute cumulative distribution of severities in the order
  // Low, Medium, High, Critical, Unknown.  Segments are sorted by
  // ascending start position on the torus (0 = 0°, 1 = 360°).
  const order = ['Low', 'Medium', 'High', 'Critical', 'Unknown'];
  const counts = order.map(l => sevMap[l] || 0);
  const total = counts.reduce((a, b) => a + b, 0);
  let cumulative = 0;
  const segments = [];
  for (let i = 0; i < order.length; i++) {
    const count = counts[i];
    const start = cumulative;
    const end = total > 0 ? cumulative + count / total : cumulative;
    segments.push({ start, end, label: order[i] });
    cumulative = end;
  }
  // Fetch base colours from CSS variables
  const rootStyles = getComputedStyle(document.documentElement);
  const baseColors = {
    Low: rootStyles.getPropertyValue('--sev-low').trim() || '#00e676',
    Medium: rootStyles.getPropertyValue('--sev-medium').trim() || '#eab308',
    High: rootStyles.getPropertyValue('--sev-high').trim() || '#f97316',
    Critical: rootStyles.getPropertyValue('--sev-critical').trim() || '#ef4444',
    Unknown: '#9ca3af'
  };
  let rotY = 0;
  function animate() {
    // Use the smooth torus renderer instead of the original one.  This
    // function produces a fully round torus with proper colour
    // segmentation and shading.
    drawSeverityTorusSmooth(canvas, segments, baseColors, rotY);
    rotY += 0.03;
    requestAnimationFrame(animate);
  }
  animate();
}

/*
 * Draw a smooth 3D torus representing the severity distribution.  The
 * torus is rendered using a per‑pixel z‑buffer and Lambertian
 * shading.  Colours for each segment are drawn according to the
 * cumulative severity distribution passed via `segments`.  This
 * implementation enforces a square canvas to avoid distortion and
 * scales the torus to fill the available area.  It is optimised
 * for clarity over raw performance.
 */
function drawSeverityTorusSmooth(canvas, segments, baseColors, rotY) {
  const ctx = canvas.getContext('2d');
  // Use a square internal resolution based on the element width.
  const maxRes = 300;
  const res = Math.min(maxRes, Math.floor(canvas.clientWidth || 0));
  canvas.width = res;
  canvas.height = res;
  const width = res;
  const height = res;
  const imgData = ctx.createImageData(width, height);
  const buf = imgData.data;
  const zbuf = new Float32Array(width * height);
  // Initialise z‑buffer to a very small value
  for (let i = 0; i < zbuf.length; i++) zbuf[i] = -1e9;
  // Rotation angles: gentle tilt around X and dynamic rotation around Y
  // Reduce the tilt angle further to make the torus appear more
  // circular when projected.  A smaller tilt reduces vertical
  // compression from perspective.
  const tiltX = 12 * Math.PI / 180;
  const cosX = Math.cos(tiltX);
  const sinX = Math.sin(tiltX);
  const cosY = Math.cos(rotY);
  const sinY = Math.sin(rotY);

  const R = 0.8;
  const r = 0.20;

  const baseRgb = {};
  Object.keys(baseColors).forEach(key => {
    baseRgb[key] = hexToRgb(baseColors[key]);
  });

  let light = { x: 0.2, y: 0.4, z: 0.9 };
  const lm = Math.hypot(light.x, light.y, light.z);
  light.x /= lm;
  light.y /= lm;
  light.z /= lm;

  const nPhi = Math.floor(res * 1.2);
  const nTheta = Math.floor(res * 0.6);

  const viewer = 7;
  const k = res * 1.4;

  const yScale = 1.2;
  for (let i = 0; i < nPhi; i++) {
    const phi = (i / nPhi) * 2 * Math.PI;

    let segLabel = segments[segments.length - 1].label;
    const phiNorm = (phi / (2 * Math.PI)) % 1;
    for (const seg of segments) {
      if (phiNorm >= seg.start && phiNorm < seg.end) {
        segLabel = seg.label;
        break;
      }
    }
    const baseCol = baseRgb[segLabel] || baseRgb.Unknown || { r: 0, g: 255, b: 0 };
    const cosPhi = Math.cos(phi);
    const sinPhi = Math.sin(phi);
    for (let j = 0; j < nTheta; j++) {
      const theta = (j / nTheta) * 2 * Math.PI;
      const cosTheta = Math.cos(theta);
      const sinTheta = Math.sin(theta);
      // Point on the torus before rotation
      const x0 = (R + r * cosTheta) * cosPhi;
      const y0 = (R + r * cosTheta) * sinPhi;
      const z0 = r * sinTheta;
      // Rotate around Y
      let x1 = x0 * cosY + z0 * sinY;
      let z1 = -x0 * sinY + z0 * cosY;
      let y1 = y0;
      
      const y2 = y1 * cosX - z1 * sinX;
      const z2 = y1 * sinX + z1 * cosX;

      let nx = cosTheta * cosPhi;
      let ny = cosTheta * sinPhi;
      let nz = sinTheta;
      let nxr = nx * cosY + nz * sinY;
      let nzr = -nx * sinY + nz * cosY;
      let nyr = ny;
      const nyr2 = nyr * cosX - nzr * sinX;
      const nzr2 = nyr * sinX + nzr * cosX;

      let dot = nxr * light.x + nyr2 * light.y + nzr2 * light.z;
      if (dot < 0) dot = 0;
      const shade = 0.4 + 0.6 * dot;

      const denom = z2 + viewer;
      if (denom <= 0) continue;
      const ooz = 1 / denom;
      const px = Math.floor(width / 2 + x1 * k * ooz);

      const py = Math.floor(height / 2 - (y2 * yScale) * k * ooz);
      if (px < 0 || px >= width || py < 0 || py >= height) continue;
      const idx = px + py * width;
      if (z2 > zbuf[idx]) {
        zbuf[idx] = z2;
        const i4 = idx * 4;
        buf[i4] = Math.min(255, Math.round(baseCol.r * shade));
        buf[i4 + 1] = Math.min(255, Math.round(baseCol.g * shade));
        buf[i4 + 2] = Math.min(255, Math.round(baseCol.b * shade));
        buf[i4 + 3] = 255;
      }
    }
  }
  ctx.putImageData(imgData, 0, 0);
}

/* Draw a single layer of the 3D severity distribution.  Each layer
   uses the same ring shape but with colours lightened to create a
   gradient from front to back.  The layerIndex argument ranges
   from 0 (frontmost) to layerCount-1 (rearmost). */
function drawSeverityDistributionLayer(canvas, sevMap, layerIndex, layerCount) {
  const ctx = canvas.getContext('2d');
  const DPR = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  canvas.width = rect.width * DPR;
  canvas.height = rect.height * DPR;
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  const w = rect.width;
  const h = rect.height;
  ctx.clearRect(0, 0, w, h);
  const cx = w / 2;
  const cy = h / 2;
  // Radii similar to the base donut: occupy most of the container
  const radius = Math.min(w, h) * 0.45;
  const innerRadius = radius * 0.6;
  // Determine lighten amount based on layer position.  Front layers
  // receive more light to simulate a light source; back layers are
  // relatively darker.  The range is modest to avoid overly washing
  // out colours.  Adjust these values to tune the shading effect.
  const ratio = 1 - layerIndex / (layerCount - 1);
  // Adjust shading amounts.  Increase the lightening range and
  // darkening effect to give more pronounced depth with fewer layers.
  const lightenAmount = 0.25 + 0.10 * ratio;
  const darkenAmount = 0.15 * (1 - ratio);
  // Order of severities
  const order = ['Low', 'Medium', 'High', 'Critical', 'Unknown'];
  // Get base colours from CSS variables
  const rootStyles = getComputedStyle(document.documentElement);
  const baseMap = {
    Low: rootStyles.getPropertyValue('--sev-low').trim() || '#00e676',
    Medium: rootStyles.getPropertyValue('--sev-medium').trim() || '#eab308',
    High: rootStyles.getPropertyValue('--sev-high').trim() || '#f97316',
    Critical: rootStyles.getPropertyValue('--sev-critical').trim() || '#ef4444',
    Unknown: '#9ca3af'
  };
  const labels = order.filter(l => sevMap[l]);
  const total = labels.reduce((sum, l) => sum + (sevMap[l] || 0), 0);
  let startAngle = -Math.PI / 2;
  labels.forEach(l => {
    const count = sevMap[l] || 0;
    if (!count) return;
    const angle = (count / total) * 2 * Math.PI;
    const endAngle = startAngle + angle;
    // Lighten or darken the base colour depending on the layer's
    // position.  Use lightenColour for front shading and darkenColour
    // for back shading.  Then create a radial gradient from a
    // further lightened tone at the inner radius to the shade at
    // the outer radius.  This gives each arc a subtle highlight.
    const base = baseMap[l] || '#00e676';
    const midColour = lightenColor(base, lightenAmount);
    const shadeColour = darkenColor(base, darkenAmount);
    const grad = ctx.createRadialGradient(cx, cy, innerRadius, cx, cy, radius);
    grad.addColorStop(0, lightenColor(midColour, 0.5));
    grad.addColorStop(1, midColour);
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(startAngle) * radius, cy + Math.sin(startAngle) * radius);
    ctx.arc(cx, cy, radius, startAngle, endAngle);
    ctx.lineTo(cx + Math.cos(endAngle) * innerRadius, cy + Math.sin(endAngle) * innerRadius);
    ctx.arc(cx, cy, innerRadius, endAngle, startAngle, true);
    ctx.closePath();
    ctx.fillStyle = grad;
    ctx.fill();
    // Draw outer edge highlight on the frontmost layer only to
    // emphasise the silhouette.  Decrease opacity for deeper layers.
    const edgeAlpha = 1 - layerIndex / layerCount;
    ctx.lineWidth = 2;
    ctx.strokeStyle = `${midColour}${Math.round(edgeAlpha * 255).toString(16).padStart(2, '0')}`;
    ctx.shadowBlur = 10 * edgeAlpha;
    ctx.shadowColor = midColour;
    ctx.beginPath();
    ctx.arc(cx, cy, radius, startAngle, endAngle);
    ctx.stroke();
    ctx.shadowBlur = 0;
    startAngle = endAngle;
  });
}

/* Build the multi‑layer severity donut.  Creates a set of canvases,
   positions them along the Z axis and draws the distribution on
   each. */
function drawSeverityDistribution3D(sevMap) {
  const container = document.getElementById('severity3d');
  if (!container) return;
  // Remove any existing layers
  container.innerHTML = '';
  // Determine number of layers and overall thickness.  More layers
  // give smoother thickness at the cost of performance.  The
  // thickness is proportional to the container width to adapt to
  // responsive layouts.
  const layerCount = 12;
  const bounds = container.getBoundingClientRect();
  // Use 20% of the container width for the total thickness.  A
  // shallower thickness combined with a smaller tilt angle keeps
  // the donut from splitting into distinct stripes.
  const thickness = bounds.width * 0.2;
  for (let i = 0; i < layerCount; i++) {
    const cv = document.createElement('canvas');
    cv.className = 'donut-layer';
    // Position along the Z axis: centre layers around z=0
    const z = ((i / (layerCount - 1)) - 0.5) * thickness;
    cv.style.transform = `translateZ(${z}px)`;
    container.appendChild(cv);
    drawSeverityDistributionLayer(cv, sevMap, i, layerCount);
  }
}

/* Draw a custom severity distribution donut chart.  This function
   renders arcs corresponding to each severity, filled with neon
   gradients, and draws nothing when there are no severities. */
function drawSeverityDistribution(canvas, sevMap) {
  const ctx = canvas.getContext('2d');
  const DPR = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  canvas.width = rect.width * DPR;
  canvas.height = rect.height * DPR;
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  const w = rect.width;
  const h = rect.height;
  ctx.clearRect(0, 0, w, h);
  const cx = w / 2;
  const cy = h / 2;
  // Choose radii so the chart appears fully round and thick.  Use
  // nearly half the minimum dimension for the outer radius, and
  // create a substantial inner hole for a donut look.  A thicker
  // ring better matches the CRT style.
  const radius = Math.min(w, h) * 0.45;
  const innerRadius = radius * 0.6;
  // Order of severities
  const order = ['Low', 'Medium', 'High', 'Critical', 'Unknown'];
  const rootStyles = getComputedStyle(document.documentElement);
  const severityColorMap = {
    Low: rootStyles.getPropertyValue('--sev-low').trim() || '#00e676',
    Medium: rootStyles.getPropertyValue('--sev-medium').trim() || '#eab308',
    High: rootStyles.getPropertyValue('--sev-high').trim() || '#f97316',
    Critical: rootStyles.getPropertyValue('--sev-critical').trim() || '#ef4444',
    Unknown: '#9ca3af'
  };
  const labels = order.filter(l => sevMap[l]);
  const total = labels.reduce((sum, l) => sum + (sevMap[l] || 0), 0);
  let startAngle = -Math.PI / 2;
  labels.forEach(l => {
    const count = sevMap[l] || 0;
    if (!count) return;
    const angle = (count / total) * 2 * Math.PI;
    const endAngle = startAngle + angle;
    const color = severityColorMap[l] || '#00e676';
    // Create a radial gradient for the arc to give depth
    // Create a radial gradient for the arc to give depth.  Start
    // closer to white for a soft inner glow and end at the solid
    // severity colour on the outer edge.
    const grad = ctx.createRadialGradient(cx, cy, innerRadius, cx, cy, radius);
    grad.addColorStop(0, lightenColor(color, 0.5));
    grad.addColorStop(1, color);
    ctx.beginPath();
    // Outer arc
    ctx.moveTo(cx + Math.cos(startAngle) * radius, cy + Math.sin(startAngle) * radius);
    ctx.arc(cx, cy, radius, startAngle, endAngle);
    // Inner arc back
    ctx.lineTo(cx + Math.cos(endAngle) * innerRadius, cy + Math.sin(endAngle) * innerRadius);
    ctx.arc(cx, cy, innerRadius, endAngle, startAngle, true);
    ctx.closePath();
    ctx.fillStyle = grad;
    ctx.fill();
    // Draw glow on outer edge
    ctx.lineWidth = 2;
    ctx.strokeStyle = color;
    ctx.shadowBlur = 10;
    ctx.shadowColor = color;
    ctx.beginPath();
    ctx.arc(cx, cy, radius, startAngle, endAngle);
    ctx.stroke();
    ctx.shadowBlur = 0;
    startAngle = endAngle;
  });
}

/* Update the legend for the severity distribution.  Accepts an
   ordered array of labels and matching colours. */
function updateSeverityLegend(container, labels, colours) {
  container.innerHTML = '';
  labels.forEach((label, i) => {
    const item = document.createElement('span');
    item.className = 'legend-item';
    const dot = document.createElement('span');
    dot.className = 'legend-dot';
    dot.style.background = colours[i];
    dot.style.boxShadow = `0 0 4px ${colours[i]}, 0 0 8px ${colours[i]}`;
    const text = document.createElement('span');
    text.className = 'legend-label';
    text.textContent = label;
    item.appendChild(dot);
    item.appendChild(text);
    container.appendChild(item);
  });
}

/* Fetch the CSV and return a list of objects with normalised keys.
   Each object will have id, software, cwe, score (string), severity.
   Additional fields from the CSV are ignored. */
async function loadCSV(url) {
  const resp = await fetch(url, { cache: 'no-store' });
  if (!resp.ok) throw new Error(`Failed to fetch ${url} (${resp.status})`);
  const text = await resp.text();
  const objects = csvToObjects(text).map(o => ({
    id: o.ID || '',
    software: o.SOFTWARE || '',
    cwe: o.CWE || '',
    score: o.SCORE || '',
    severity: o.SEVERITY || ''
  }));
  return objects;
}

/* Animate a radial heatmap of CVE scores.  A sweeping radar line
   rotates around the centre, highlighting points as it passes.  The
   rings are annotated with score ranges (e.g. "9-10", "7-8").  The
   animation automatically adapts to canvas resizing. */
function animateHeatMap(canvas, data) {
  const ctx = canvas.getContext('2d');
  const DPR = window.devicePixelRatio || 1;
  // Severity colours from CSS
  const rootStyles = getComputedStyle(document.documentElement);
  const severityColorMap = {
    Low: rootStyles.getPropertyValue('--sev-low').trim() || '#00e676',
    Medium: rootStyles.getPropertyValue('--sev-medium').trim() || '#eab308',
    High: rootStyles.getPropertyValue('--sev-high').trim() || '#f97316',
    Critical: rootStyles.getPropertyValue('--sev-critical').trim() || '#ef4444',
    Unknown: '#9ca3af'
  };
  // Score ranges used for rings and labels.  These are ordered from
  // highest severity to lowest so that inner rings correspond to
  // higher CVSS scores.  We will sort these later by radius when
  // drawing the legend to avoid crossing connector lines.
  const ranges = [
    { low: 9, high: 10 },
    { low: 7, high: 8 },
    { low: 5, high: 6 },
    { low: 3, high: 4 },
    { low: 1, high: 2 }
  ];
  let points = [];
  let ringRadii = [];
  let labels = [];
  let w, h, cx, cy, maxRadius;
  function compute() {
    // Update sizes and scale
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * DPR;
    canvas.height = rect.height * DPR;
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    w = rect.width;
    h = rect.height;
    cx = w / 2;
    cy = h / 2;
    maxRadius = Math.min(w, h) / 2 * 0.9;
    // Precompute points in polar and cartesian coordinates
    const n = data.length;
    const angleStep = n > 0 ? (2 * Math.PI) / n : 0;
    points = [];
    for (let i = 0; i < n; i++) {
      const d = data[i];
      let score = parseFloat(d.score);
      if (!Number.isFinite(score)) continue;
      score = Math.max(0, Math.min(score, 10));
      const fraction = 1 - score / 10;
      const r = fraction * maxRadius;
      const angle = i * angleStep;
      const x = cx + Math.cos(angle) * r;
      const y = cy + Math.sin(angle) * r;
      let sev = (d.severity || 'Unknown').trim();
      sev = sev.charAt(0).toUpperCase() + sev.slice(1).toLowerCase();
      const color = severityColorMap[sev] || severityColorMap.Unknown;
      points.push({ x, y, angle, color });
    }
    // Precompute ring radii and labels.  We assign a radius to each
    // range based on its lower bound; larger radii represent lower
    // scores (towards the outside) and smaller radii represent high
    // scores (towards the centre).  The resulting arrays are
    // deliberately kept in the same order as the original ranges so
    // that the radial ordering is preserved when drawing rings.
    ringRadii = ranges.map(({ low }) => (1 - low / 10) * maxRadius);
    labels = ranges.map(({ low, high }) => `${low}-${high}`);
  }
  compute();
  window.addEventListener('resize', compute);
  let scanAngle = 0;
  // Keep a list of past sweep wedges to draw fading tails.  Each
  // entry stores the wedge start and end angles along with an
  // alpha value that decays over time.  New segments are added on
  // each frame and old ones are removed when fully faded.  A
  // narrower sweep width and faster decay shorten the visible tail.
  const tails = [];
  function draw() {
    ctx.clearRect(0, 0, w, h);
    // The grid background for the radar is now handled via CSS on the
    // heatmap container.  We no longer draw an additional grid in
    // the canvas to avoid overlapping patterns.
    // Draw concentric rings with a stronger glow.  Increase the
    // line width and alpha values to make the circles stand out
    // more prominently against the background.
    ctx.lineWidth = 1.2;
    ringRadii.forEach((r, idx) => {
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, 2 * Math.PI);
      // Base alpha for outermost ring is small; inner rings are
      // slightly brighter.
      const alpha = 0.08 + (ringRadii.length - idx) * 0.03;
      ctx.strokeStyle = `rgba(0,230,118,${alpha})`;
      ctx.stroke();
    });

    // Define the angular width of the sweep tail.  A smaller value
    // produces a shorter, more realistic wedge behind the pointer.
    const sweepWidth = 0.2; // radians
    // Add the current sweep segment to the tails list.  Each segment
    // starts behind the current scan angle and ends at the current
    // angle with full opacity (alpha=1).  Over time these segments
    // will fade out.
    tails.push({ start: scanAngle - sweepWidth, end: scanAngle, alpha: 1.0 });
    // Draw all tail segments.  Newer segments are brighter; older
    // segments gradually fade.  We fill each wedge with a solid
    // colour scaled by its alpha value.
    // Draw all tail segments.  Newer segments are brighter; older
    // segments gradually fade.  We fill each wedge with a solid
    // colour scaled by its alpha value.
    for (const seg of tails) {
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, maxRadius, seg.start, seg.end, false);
      ctx.closePath();
      // scale opacity relative to the base sweep colour
      ctx.fillStyle = `rgba(0,230,118,${0.12 * seg.alpha})`;
      ctx.fill();
    }
    // Decay the alpha of each tail and remove those that have faded.
    // Increase the decay rate and adjust the angular shift so the
    // tail dissipates more quickly and does not extend too far.
    for (let i = tails.length - 1; i >= 0; i--) {
      tails[i].alpha -= 0.04;
      // shift the segment angles forward as the scan rotates around
      // the circle so that tails remain stationary relative to the
      // rotation.  Without this adjustment the tail would smear.
      tails[i].start -= 0.015;
      tails[i].end -= 0.015;
      if (tails[i].alpha <= 0) tails.splice(i, 1);
    }

    // Draw the current scanning line.  Limit its length to the
    // outer radius so it doesn't extend beyond the rim.
    const scanX = cx + Math.cos(scanAngle) * maxRadius;
    const scanY = cy + Math.sin(scanAngle) * maxRadius;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(scanX, scanY);
    ctx.strokeStyle = 'rgba(0,230,118,0.7)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Draw points and highlight those within the sweep width behind the
    // current scan line.  The highlight width scales with the
    // sweepWidth so that points close to the sweep are brighter.
    for (const p of points) {
      // compute angular distance between point and scan line
      let delta = Math.abs(p.angle - scanAngle);
      delta = Math.min(delta, 2 * Math.PI - delta);
      const highlight = delta < sweepWidth / 2;
      // When a point is within the sweep's immediate vicinity,
      // restore its alpha to full brightness and enlarge it.  Points
      // outside the sweep gradually fade by reducing their alpha on
      // each frame.  Once the pointer comes around again the alpha
      // resets, giving the impression of pulsing blips.
      if (p.alpha === undefined) p.alpha = 0.3;
      if (highlight) {
        p.alpha = 1.0;
      } else {
        // Fade towards a baseline minimum so points never fully
        // disappear.  The fade rate controls how long blips linger.
        p.alpha -= 0.012;
        if (p.alpha < 0.05) p.alpha = 0.05;
      }
      const radius = highlight ? 4.0 : 2.4;
      ctx.beginPath();
      ctx.arc(p.x, p.y, radius, 0, 2 * Math.PI);
      ctx.fillStyle = p.color;
      ctx.globalAlpha = p.alpha;
      ctx.shadowBlur = highlight ? 12 : 0;
      ctx.shadowColor = p.color;
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.shadowBlur = 0;
    }

    // Draw legend lines and boxes.  To prevent connector lines from
    // crossing, we sort rings and labels by descending radius.  Each
    // CVSS range is displayed in its own small box.  Half of the
    // labels are placed on the left side of the radar and half on
    // the right side with individual horizontal offsets.  Boxes on
    // the right appear to the right of their anchor whereas boxes on
    // the left appear to the left.  Connector lines use dotted
    // strokes and small tick marks.
    const legendMargin = 40;
    // Left and right anchor x coordinates relative to the radar.  A
    // margin is added to push the labels away from the chart.  We
    // compute these once per frame for consistency across labels.
    // Position the legend anchors closer to the radar so labels
    // remain within the viewport.  Instead of using a fixed
    // margin, derive the anchor positions from the maximum radius
    // to ensure consistent spacing across different canvas sizes.
    // Place legend anchors closer to the centre to avoid clipping
    // against the edge of the container.  Anchors sit at half the
    // maximum radius from the centre, leaving room for the label
    // boxes within the heatmap panel.
    // Position the legend anchors further away from the centre to
    // lengthen the connector lines.  Increasing the multiplier
    // pushes the labels outward so they do not overlap the radar.
    const legendXLeft = cx - maxRadius * 0.6;
    const legendXRight = cx + maxRadius * 0.6;
    // Sort radii and labels by descending radius.  This ensures
    // vertical ordering of labels corresponds to ring ordering and
    // avoids line crossings.
    const zippedLegend = ringRadii.map((r, i) => ({ r, lbl: labels[i] }));
    zippedLegend.sort((a, b) => b.r - a.r);
    const sortedRadii = zippedLegend.map(z => z.r);
    const sortedLabels = zippedLegend.map(z => z.lbl);
    // Determine how many labels go on the left side.  Distribute the
    // labels roughly evenly between the left and right.  If there is
    // an odd number, the left side will get the extra label.  This
    // approach ensures a balanced appearance.
    const totalLegend = sortedLabels.length;
    const leftCount = Math.ceil(totalLegend / 2);
    // Prepare horizontal offset arrays.  These arrays contain
    // offsets in pixels relative to the anchor x coordinate.  They
    // introduce irregular spacing to make the labels feel less
    // mechanical.  The left side values should be negative (moving
    // further left) while the right side values should be positive.
    // Offsets for positioning legend boxes relative to their
    // anchors.  Keeping these values modest prevents the labels
    // from spilling off the side of the panel.
    const offsetLeft = [-30, -10, -20, -5, -15];
    const offsetRight = [30, 10, 20, 5, 15];
    // Measure the widest label for sizing boxes.  Each label is
    // rendered as "N+ CVSS" (e.g. "3+ CVSS"), so compute the max
    // width among these strings.  We set a default font for
    // measurement.
    ctx.font = '12px ui-monospace, monospace';
    let maxLabelWidthLegend = 0;
    sortedLabels.forEach(lbl => {
      // Compute the width of the "low-high" range label rather than
      // "N+ CVSS".  This ensures the bounding box accounts for the
      // actual text that will be rendered on screen.
      const partsMeasure = lbl.split('-');
      const text = `${partsMeasure[0]}-${partsMeasure[1]}`;
      const wlbl = ctx.measureText(text).width;
      if (wlbl > maxLabelWidthLegend) maxLabelWidthLegend = wlbl;
    });
    const boxPaddingX = 6;
    const boxWidth = maxLabelWidthLegend + boxPaddingX * 2;
    const boxHeight = 18;
    const vSpacing = 8;
    const legendTop = cy - maxRadius;
    // Loop through each legend item and draw connecting lines, ticks
    // and boxes.  Determine side (left/right), anchor positions
    // and offsets based on index.
    for (let i = 0; i < totalLegend; i++) {
      const raw = sortedLabels[i];
      // Derive a range label (e.g. "3-4") directly from the
      // underlying score range.  Using the explicit range clarifies
      // which scores correspond to each ring.
      const partsRange = raw.split('-');
      const label = `${partsRange[0]}-${partsRange[1]}`;
      const r = sortedRadii[i];
      // Align the legend entry vertically with its ring rather than using
      // the running index.  Using the ring radius ensures that the
      // highest CVSS scores (smallest radius) appear nearest the centre
      // and the lowest scores (largest radius) appear toward the edge.
      const yCenter = cy - r;
      const boxY = yCenter - boxHeight / 2;
      const isLeft = i < leftCount;
      // Choose anchor and horizontal offset for this side
      const anchorX = isLeft ? legendXLeft : legendXRight;
      // Use offsets cyclically if more labels than offsets defined
      const offsetArr = isLeft ? offsetLeft : offsetRight;
      const offsetXVal = offsetArr[i % offsetArr.length] || 0;
      const endX = anchorX + offsetXVal;
      const endY = yCenter;
      // Determine start of the connector line on the ring.  To ensure
      // that each connector touches the correct circle, begin the line
      // exactly at the topmost point of the ring (no horizontal offset).
      // This guarantees that the dotted line points to the proper
      // circle rather than outside it.
      const startXLegend = cx;
      const startYLegend = cy - r;
      // Draw connecting dotted line
      ctx.beginPath();
      ctx.moveTo(startXLegend, startYLegend);
      ctx.lineTo(endX, endY);
      ctx.setLineDash([2, 3]);
      ctx.strokeStyle = 'rgba(0,230,118,0.28)';
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.setLineDash([]);
      // Draw a tick mark leading into the box.  Direction depends
      // on which side the box is on.  Left side ticks extend
      // leftwards; right side ticks extend rightwards.
      ctx.beginPath();
      if (isLeft) {
        ctx.moveTo(endX, endY);
        ctx.lineTo(endX - 4, endY);
      } else {
        ctx.moveTo(endX, endY);
        ctx.lineTo(endX + 4, endY);
      }
      ctx.strokeStyle = 'rgba(0,230,118,0.38)';
      ctx.lineWidth = 1;
      ctx.stroke();
      // Compute the x coordinate of the legend box.  On the
      // left side the box sits to the left of the anchor; on the
      // right side it sits to the right.
      let boxX;
      if (isLeft) {
        boxX = endX - (boxWidth + 4);
      } else {
        boxX = endX + 4;
      }
      // Draw box background
      ctx.fillStyle = 'rgba(0,0,0,0.8)';
      ctx.fillRect(boxX, boxY, boxWidth, boxHeight);
      // Draw box border with dashed lines to echo the CRT motif
      ctx.strokeStyle = 'rgba(0,230,118,0.4)';
      ctx.setLineDash([3, 4]);
      ctx.strokeRect(boxX, boxY, boxWidth, boxHeight);
      ctx.setLineDash([]);
      // Draw label text centered inside the box
      ctx.fillStyle = rootStyles.getPropertyValue('--green-soft').trim() || '#7cf6c1';
      ctx.font = '12px ui-monospace, monospace';
      const textWidth = ctx.measureText(label).width;
      const textX = boxX + (boxWidth - textWidth) / 2;
      ctx.fillText(label, textX, boxY + boxHeight / 2 + 4);
    }

    // Update scan angle and queue next frame
    scanAngle += 0.015;
    if (scanAngle > 2 * Math.PI) scanAngle -= 2 * Math.PI;
    requestAnimationFrame(draw);
  }
  requestAnimationFrame(draw);
}

/* Initialise the analytics dashboard once the DOM is loaded */
document.addEventListener('DOMContentLoaded', async () => {
  try {
    const data = await loadCSV('cves.csv');
    // Update dataset meta count in header if present
    const metaEl = document.getElementById('dataset-meta');
    if (metaEl) metaEl.textContent = `Total CVEs: ${data.length}`;

    // Build top CWEs list.  Show more entries on the CRT dashboard for
    // additional context.
    const cweMap = aggregateBy(data, d => d.cwe || 'Unknown');
    const top = topEntries(cweMap, 10);
    const palette = colors(top.length);
    const cweListEl = document.getElementById('cweList');
    renderRankList(cweListEl, top, palette);

    // Compute severity counts and render the CRT‑style pie chart below
    // the radar.  Each severity label is normalised to capitalise
    // properly (e.g. "medium" -> "Medium").
    const sevMap = aggregateBy(data, d => {
      let s = (d.severity || 'Unknown').trim();
      s = s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
      return s;
    });
    // Initialise the rotating 3D torus representing the severity
    // distribution.  This replaces the previous multi‑layer donut.
    initSeverityTorus(sevMap);
    // Render the legend for present severities.  The legend uses
    // coloured dots to label the categories in the same order.
    const sevLegendEl = document.getElementById('sevLegend');
    if (sevLegendEl) {
      const orderLegend = ['Low', 'Medium', 'High', 'Critical'];
      const labelsLegend = orderLegend.filter(l => sevMap[l]);
      const coloursLegend = paletteForSeverities(labelsLegend);
      updateSeverityLegend(sevLegendEl, labelsLegend, coloursLegend);
    }

    // Animate the ratings heat map
    const heatCanvas = document.getElementById('heatmapCanvas');
    animateHeatMap(heatCanvas, data);
  } catch (err) {
    console.error(err);
    const el = document.getElementById('loadError');
    if (el) {
      el.textContent = err.message || String(err);
      el.style.display = 'block';
    }
  }
});