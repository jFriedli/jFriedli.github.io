/*
 * Custom JavaScript for the analytics dashboard.  This file reuses the
 * CSV parsing helpers from main.js (parseCSV and csvToObjects) and
 * introduces additional functions to aggregate data, build charts and
 * render a bespoke radial heatmap for CVE scores.  Keeping this
 * logic separate makes the analytics page self‑contained and easier
 * to maintain.
 */

/* Aggregate a list by a derived key. Returns an object mapping
   keys to counts. */
// Display any runtime errors in the dashboard.  Without devtools
// access we need to surface exceptions directly on the page so
// debugging can occur when loading via file://.  Errors will
// populate the element with ID 'loadError'.
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
    const sevCanvas = document.getElementById('severityCanvas');
    if (sevCanvas) {
      drawSeverityDistribution(sevCanvas, sevMap);
      // Render a legend for the severity distribution.  This
      // legend displays coloured dots alongside their severity
      // names (Low, Medium, High, Critical) so users can clearly
      // interpret the donut chart.  Only severities present in
      // the dataset are shown.
      const sevLegendEl = document.getElementById('sevLegend');
      if (sevLegendEl) {
        const order = ['Low','Medium','High','Critical'];
        const labels = order.filter(l => sevMap[l]);
        const colours = paletteForSeverities(labels);
        updateSeverityLegend(sevLegendEl, labels, colours);
      }
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