const API_URL = 'https://jfriedli-ai-proxy.jonas-friedli.workers.dev';
const MAX_MESSAGE_LEN = 2000;

/* ------ GLOBE / TERMINAL TUNING PARAMETERS ------ */

const TERMINAL_TYPE_SPEED_MS = 2;      // lower = faster typing in the overlay terminal
const TERMINAL_HOLD_DURATION_MS = 300;  // how long (ms) the overlay terminal stays after text finished

// how much the globe “breathes” when going from orange (fast) to green (idle)
const GLOBE_COOLDOWN_PULSE_AMPLITUDE = 0.14;  // scale amount (0.14 = ±14% size)
const GLOBE_COOLDOWN_PULSE_STEP = 0.045;      // how quickly the pulse progresses

/* ---------------- CHAT STATE ---------------- */

// span element we’re currently typing into
let currentBotSpan = null;
// simple “busy” flag for user input
let isGenerating = false;

// controller from the globe module (set in initGlobe)
let globeController = null;

// boot callback – set by initChat, used by initGlobe when intro terminal finishes
let bootCompleteHandler = null;

/* --------------- LINK TOKEN HANDLING --------------- */

// Map from tokens the model emits to real links
const LINK_TOKEN_MAP = {
  '[LINKEDIN]': {
    text: 'LinkedIn',
    href: 'https://www.linkedin.com/in/jonas-benjamin-friedli/'
  },
  '[GITHUB]': {
    text: 'GitHub',
    href: 'https://github.com/jFriedli'
  },
  '[EXPLOIT_DB]': {
    text: 'Exploit-DB',
    href: 'https://www.exploit-db.com/?author=12089'
  },
  '[WORDFENCE]': {
    text: 'Wordfence',
    href: 'https://www.wordfence.com/threat-intel/vulnerabilities/researchers/jonas-benjamin-friedli'
  },
  '[KAGGLE]': {
    text: 'Kaggle',
    href: 'https://www.kaggle.com/jbfriedli'
  },
  '[MEDIUM]': {
    text: 'Medium',
    href: 'https://medium.com/@jonas.friedli'
  },
  '[MUSIC]': {
    text: 'Music',
    href: 'https://li.sten.to/8beznzex'
  }
};

// Regex that finds any of the link tokens
const LINK_TOKEN_REGEX =
  /\[(LINKEDIN|GITHUB|EXPLOIT_DB|WORDFENCE|KAGGLE|MEDIUM|MUSIC)\]/;

// Render a text string into a span, replacing tokens with <a> elements
function renderTextWithLinks(targetSpan, text) {
  targetSpan.textContent = ''; // clear existing content

  const parts = text.split(
    /(\[LINKEDIN\]|\[GITHUB\]|\[EXPLOIT_DB\]|\[WORDFENCE\]|\[KAGGLE\]|\[MEDIUM\]|\[MUSIC\])/
  );

  parts.forEach(part => {
    const def = LINK_TOKEN_MAP[part];
    if (def) {
      const a = document.createElement('a');
      a.href = def.href;
      a.textContent = def.text;
      a.target = '_blank';
      a.rel = 'noopener';
      a.className = 'reference'; // optional: reuse table link styling
      targetSpan.appendChild(a);
    } else if (part) {
      targetSpan.appendChild(document.createTextNode(part));
    }
  });
}

/* --------------- UTILITIES --------------- */

// type text character by character into target element (plain text only)
function typeWithCursor(targetSpan, fullText, onDone, speedMs = 18) {
  targetSpan.textContent = '';
  const cursor = document.createElement('span');
  cursor.className = 'crt-cursor';
  cursor.textContent = ' ';
  targetSpan.appendChild(cursor);

  let i = 0;
  function step() {
    if (i < fullText.length) {
      cursor.insertAdjacentText('beforebegin', fullText[i]);
      i += 1;

      // keep chat scrolled to bottom while typing
      const chatLog = document.getElementById('chat-log');
      if (chatLog) {
        chatLog.scrollTop = chatLog.scrollHeight;
      }

      setTimeout(step, speedMs);
    } else {
      cursor.remove();
      if (onDone) onDone();
    }
  }
  step();
}

/* --------------- BACKEND CALL --------------- */

async function callBackend(message) {
  const res = await fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message })
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error('Backend error: ' + text);
  }

  const data = await res.json();
  return data.text || '';
}

/* --------------- CHAT UI --------------- */

function initChat() {
  const chatLog = document.getElementById('chat-log');
  const form = document.getElementById('chat-form');
  const input = document.getElementById('chat-input');
  const sendBtn = document.querySelector('.send-btn');
  const modelStatus = document.getElementById('model-status');

  function setStatus(text) {
    if (modelStatus) modelStatus.textContent = text;
  }

  function disableInput() {
    input.disabled = true;
    sendBtn.disabled = true;
  }

  function enableInput() {
    input.disabled = false;
    sendBtn.disabled = false;
    input.focus();
  }

  function appendRow(text, author) {
    const row = document.createElement('div');
    row.className = 'message-row';

    const label = document.createElement('span');
    label.className = 'message-label';
    label.textContent = author === 'user' ? 'YOU>' : 'OPERATOR>';

    const body = document.createElement('span');
    body.className = 'message-body';

    // User messages are always plain text for safety
    body.textContent = text;

    row.appendChild(label);
    row.appendChild(body);
    chatLog.appendChild(row);
    chatLog.scrollTop = chatLog.scrollHeight; // auto-scroll on new rows
    return body;
  }

  // show loading text + blinking cursor while model is thinking
  function showLoading(span) {
    if (!span) return;
    span.classList.add('loading');
    span.textContent = 'LOADING';
    const cursor = document.createElement('span');
    cursor.className = 'crt-cursor';
    cursor.textContent = ' ';
    span.appendChild(cursor);

    const chatLog = document.getElementById('chat-log');
    if (chatLog) chatLog.scrollTop = chatLog.scrollHeight;
  }

  // remote model is always "ready" from the frontend’s POV
  setStatus('MODEL: remote / ready');

  // boot message is shown only after the boot terminal animation finishes
  bootCompleteHandler = () => {
    const bootSpan = appendRow('', 'bot');
    const bootMsg =
      'Link established. Remote JONAS-LINK uplink online. Intel feed is probabilistic.';

    // Type the OPERATOR boot line
    typeWithCursor(bootSpan, bootMsg, () => {
      // Then type out Status: Active
      const statusSpan = document.getElementById('op-status');
      if (statusSpan) {
        // Trigger operator CRT reveal
        const opPhotoBox = document.querySelector('.operator-photo');
        if (opPhotoBox) {
          opPhotoBox.classList.add('revealed');
        }
        typeWithCursor(statusSpan, 'Active', null, 40);
      }
    }, 18);
  };

  /* --- Backend handling --- */

async function handleBackend(userText) {
  try {
    const raw = await callBackend(userText);
    const finalText = (raw || '').trim();

    // simple detection, safe because regex is not global
    const hasLinkTokens = LINK_TOKEN_REGEX.test(finalText);

    if (!currentBotSpan) {
      currentBotSpan = appendRow('', 'bot');
    }

    if (hasLinkTokens) {
      const textToShow = finalText;

      // 1) type out the raw text (tokens included)
      typeWithCursor(currentBotSpan, textToShow, () => {
        currentBotSpan.classList.remove('loading');

        // 2) then replace tokens with real <a> links in-place
        renderTextWithLinks(currentBotSpan, textToShow);

        const chatLog = document.getElementById('chat-log');
        if (chatLog) chatLog.scrollTop = chatLog.scrollHeight;

        currentBotSpan = null;
        isGenerating = false;
        enableInput();

        // 🔥 NOW we tell the globe to cool down: typing is finished
        if (globeController) globeController.setMode('cooldown');
      }, 18);
    } else {
      const displayText = finalText;

      typeWithCursor(currentBotSpan, displayText, () => {
        currentBotSpan.classList.remove('loading');
        currentBotSpan = null;
        isGenerating = false;
        enableInput();

        // 🔥 Same here: only cool down after all text is typed
        if (globeController) globeController.setMode('cooldown');
      }, 18);
    }
  } catch (err) {
    console.error(err);
    if (!currentBotSpan) currentBotSpan = appendRow('', 'bot');
    currentBotSpan.textContent = '[ERROR] Link to remote node failed.';
    currentBotSpan.classList.remove('loading');
    currentBotSpan = null;
    isGenerating = false;
    enableInput();
    if (globeController) globeController.setMode('idle');
  }
}



  /* --- transmit sequence (no terminal overlay per message) --- */

  function playTransmitSequence(userText) {
    if (globeController) {
      globeController.setMode('fast'); // orange fast spin while model is thinking
    }

    if (currentBotSpan) showLoading(currentBotSpan);

    handleBackend(userText);
  }

  /* --- submit handler --- */

  form.addEventListener('submit', (ev) => {
    ev.preventDefault();
    if (isGenerating) return;

    let text = input.value;
    if (!text) return;

    // Enforce same 2000-char limit as the worker
    if (text.length > MAX_MESSAGE_LEN) {
      appendRow(
        `[WARN] Payload too long (${text.length} chars). Limit is ${MAX_MESSAGE_LEN}.`,
        'bot'
      );
      return;
    }

    text = text.trim();
    if (!text) return;

    appendRow(text, 'user');
    input.value = '';

    disableInput();
    isGenerating = true;
    currentBotSpan = appendRow('', 'bot');

    playTransmitSequence(text);
  });
}

/* --------------- GLOBE + TERMINAL --------------- */

function initGlobe() {
  const canvas = document.getElementById('globe-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');

  const overlay = document.getElementById('globe-terminal');
  const overlayText = document.getElementById('globe-terminal-text');
  const overlayTitle = document.getElementById('globe-terminal-title');

  const size = Math.min(canvas.width, canvas.height);
  const baseRadius = size * 0.42;
  let radiusScale = 1.0;

  let rotY = 0;
  let rotX = 0;

  // motion state
  let mode = 'idle'; // start directly in idle (green)
  const speeds = {
    boot:  { y: 0.03, x: 0.015 },
    idle:  { y: 0.02, x: 0.01 },
    fast:  { y: 0.09, x: 0.04 }
  };

  let curSpeedY = speeds.idle.y;
  let curSpeedX = speeds.idle.x;

  // pulse state for the orange -> green transition
  let cooldownPulseT = 0; // 0..~1 for one shrink-grow cycle

  function project([x, y, z]) {
    const cosY = Math.cos(rotY);
    const sinY = Math.sin(rotY);

    let xr = x * cosY + z * sinY;
    let zr = -x * sinY + z * cosY;
    let yr = y;

    const cosX = Math.cos(rotX);
    const sinX = Math.sin(rotX);
    const yr2 = yr * cosX - zr * sinX;
    const zr2 = yr * sinX + zr * cosX;

    xr = xr;
    yr = yr2;

    const radius = baseRadius * radiusScale;
    return [size / 2 + xr * radius, size / 2 - yr * radius];
  }

  // precompute sphere lines
  const meridians = [];
  const parallels = [];
  const meridianCount = 12;
  const parallelCount = 6;

  for (let m = 0; m < meridianCount; m++) {
    const angle = (m / meridianCount) * Math.PI * 2;
    const pts = [];
    for (let t = -Math.PI / 2; t <= Math.PI / 2 + 0.01; t += Math.PI / 36) {
      const x = Math.cos(angle) * Math.cos(t);
      const y = Math.sin(angle) * Math.cos(t);
      const z = Math.sin(t);
      pts.push([x, y, z]);
    }
    meridians.push(pts);
  }

  for (let p = 1; p < parallelCount; p++) {
    const phi = (-Math.PI / 2) + (p / parallelCount) * Math.PI;
    const circle = [];
    for (let t = 0; t <= Math.PI * 2 + 0.01; t += Math.PI / 36) {
      const x = Math.cos(t) * Math.cos(phi);
      const y = Math.sin(t) * Math.cos(phi);
      const z = Math.sin(phi);
      circle.push([x, y, z]);
    }
    parallels.push(circle);
  }

  function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    let colour;
    let targetY;
    let targetX;

    switch (mode) {
      case 'fast':
        colour = 'rgba(255,190,80,0.85)'; // orange
        targetY = speeds.fast.y;
        targetX = speeds.fast.x;
        curSpeedY = targetY;
        curSpeedX = targetX;
        radiusScale = 1.0;
        break;
      case 'cooldown':
        colour = 'rgba(0,255,140,0.75)'; // green but overspin then decay
        targetY = speeds.idle.y;
        targetX = speeds.idle.x;
        // exponential decay toward idle speed
        curSpeedY = curSpeedY * 0.96 + targetY * 0.04;
        curSpeedX = curSpeedX * 0.96 + targetX * 0.04;

        // nice shrink+grow pulse as it cools from orange to green
        cooldownPulseT += GLOBE_COOLDOWN_PULSE_STEP;
        const pulse = Math.sin(Math.min(cooldownPulseT, 1) * Math.PI);
        radiusScale = 1.0 + GLOBE_COOLDOWN_PULSE_AMPLITUDE * pulse;

        if (
          Math.abs(curSpeedY - targetY) < 0.0005 &&
          Math.abs(curSpeedX - targetX) < 0.0005 &&
          cooldownPulseT >= 1
        ) {
          curSpeedY = targetY;
          curSpeedX = targetX;
          radiusScale = 1.0;
          mode = 'idle';
        }
        break;
      case 'idle':
      default:
        colour = 'rgba(0,255,140,0.75)'; // green
        targetY = speeds.idle.y;
        targetX = speeds.idle.x;
        curSpeedY = targetY;
        curSpeedX = targetX;
        radiusScale = 1.0;
        break;
    }

    ctx.strokeStyle = colour;
    ctx.lineWidth = 1;

    meridians.forEach(pts => {
      ctx.beginPath();
      pts.forEach((pt, i) => {
        const [px, py] = project(pt);
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      });
      ctx.stroke();
    });

    parallels.forEach(circle => {
      ctx.beginPath();
      circle.forEach((pt, i) => {
        const [px, py] = project(pt);
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      });
      ctx.stroke();
    });

    rotY += curSpeedY;
    rotX += curSpeedX;

    requestAnimationFrame(draw);
  }

  draw();

  // Controller exposed to chat logic
  globeController = {
    setMode(newMode) {
      // if we go from fast -> cooldown, give it a little extra kick
      if (newMode === 'cooldown' && mode === 'fast') {
        curSpeedY *= 1.4;
        curSpeedX *= 1.4;
        cooldownPulseT = 0; // reset pulse so we get a clean shrink+grow
      }
      mode = newMode;
    },
    showTerminal() {
      if (!overlay) return;
      canvas.style.opacity = '0'; 
      overlay.style.display = 'block';
      if (overlayTitle) overlayTitle.textContent = 'LINK PIPELINE';
      if (overlayText) overlayText.textContent = '';
    },
    hideTerminal() {
      if (!overlay) return;
      overlay.style.display = 'none';
      canvas.style.opacity = '1';
    },
    // typing speed + hold duration are parameterised via the constants at top
    typeTerminal(text, done, speedMs = TERMINAL_TYPE_SPEED_MS, holdMs = TERMINAL_HOLD_DURATION_MS) {
      if (!overlayText) {
        if (done) done();
        return;
      }
      overlayText.textContent = '';
      let i = 0;
      function step() {
        if (i < text.length) {
          overlayText.textContent += text[i];
          i += 1;
          setTimeout(step, speedMs);
        } else {
          if (holdMs > 0) {
            setTimeout(() => {
              if (done) done();
            }, holdMs);
          } else if (done) {
            done();
          }
        }
      }
      step();
    }
  };

  // Intro terminal message ONCE on page load,
  // then smooth transition: terminal -> fast spin -> cooldown -> idle
  if (globeController) {
    globeController.showTerminal();
    const introScript =
      '[BOOT] OPS TERMINAL ONLINE...\n' +
      '[NOTICE] RESPONSES ARE SYNTHETIC, NOT CANONICAL\n' +
      '[STATUS] IDLE / AWAITING INPUT';
    globeController.typeTerminal(introScript, () => {
      globeController.hideTerminal();

      // show boot message in chat after terminal is "through"
      if (typeof bootCompleteHandler === 'function') {
        bootCompleteHandler();
      }

      // spin up fast, then gracefully cool down to idle
      globeController.setMode('fast');
      setTimeout(() => {
        globeController.setMode('cooldown');
      }, 2500);
    });
  }
}

/* --------------- BOOT --------------- */

window.addEventListener('DOMContentLoaded', () => {
  initGlobe(); // globe first so controller exists
  initChat();
});
