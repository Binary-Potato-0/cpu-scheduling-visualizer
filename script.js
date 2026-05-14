/* ═══════════════════════════════════
   CONSTANTS & STATE
═══════════════════════════════════ */
const COLORS = ['#c026d3','#3b82f6','#8b5cf6','#06b6d4','#ec4899','#f59e0b','#10b981','#ef4444','#f97316','#14b8a6','#6366f1','#84cc16'];

const ALGO_INFO = {
  fcfs:     'Non-preemptive. Runs in arrival order.',
  sjf:      'Non-preemptive. Picks shortest burst from available.',
  srtf:     'Preemptive SJF. Interrupts if shorter job arrives.',
  rr:       'Preemptive. Each process gets equal time slices.',
  priority: 'Non-preemptive. Lower number = higher priority.',
  hrrn:     'Non-preemptive. Picks highest (W+B)/B ratio.',
  mq:       '3 fixed queues by burst length. High→FCFS, Med→RR, Low→SJF.',
  mfq:      '3 levels. L1:RR(q=2) → L2:RR(q=4) → L3:FCFS. Demotes if not done.'
};

let procs = [], pid = 1, mode = 'single';

/* ═══════════════════════════════════
   PLAYBACK CONTROLLER
═══════════════════════════════════ */
const Playback = {
  tick: 0, maxTick: 0, playing: false, timer: null, segs: [], procs: [],

  init(segs, procs, total) {
    this.segs = segs; this.procs = procs;
    this.maxTick = total; this.tick = 0;
    this.playing = false; this.stop();
  },

  play() {
    if (this.tick >= this.maxTick) this.tick = 0;
    this.playing = true;
    document.getElementById('play-btn-main').textContent = '⏸';
    this.timer = setInterval(() => {
      this.tick++;
      if (this.tick >= this.maxTick) { this.tick = this.maxTick; this.pause(); }
      this.updateUI();
    }, 500);
    this.updateUI();
  },

  pause() {
    this.playing = false;
    document.getElementById('play-btn-main').textContent = '▶';
    this.stop(); this.updateUI();
  },

  toggle() { this.playing ? this.pause() : this.play(); },

  stop() { if (this.timer) clearInterval(this.timer); this.timer = null; },

  step(dir) {
    this.pause();
    this.tick = Math.max(0, Math.min(this.maxTick, this.tick + dir));
    this.updateUI();
  },

  seek(val) { this.pause(); this.tick = parseInt(val); this.updateUI(); },

  updateUI() {
    const slider = document.getElementById('play-slider-input');
    const tickDisplay = document.getElementById('play-tick-val');
    if (slider) slider.value = this.tick;
    if (tickDisplay) tickDisplay.textContent = this.tick;
    renderPlaybackState(this.tick, this.segs, this.procs, this.maxTick);
  }
};

/* ═══════════════════════════════════
   UI CONTROLS
═══════════════════════════════════ */
function onAlgoChange() {
  const a = document.getElementById('algo').value;
  document.getElementById('qfield').style.display = a === 'rr' ? 'block' : 'none';
  document.getElementById('pri-field').style.display = a === 'priority' ? 'block' : 'none';
  document.getElementById('algo-info').textContent = ALGO_INFO[a] || '';
}

function switchMode(m) {
  mode = m;
  document.querySelectorAll('.mode-tab').forEach((t, i) =>
    t.classList.toggle('active', ['single','compare'][i] === m));
  document.getElementById('algo-section').classList.toggle('hidden', m !== 'single');
  document.getElementById('cmp-section').classList.toggle('hidden', m !== 'compare');
  document.getElementById('output').classList.add('hidden');
  document.getElementById('empty').style.display = 'flex';
}

function addProc() {
  const a = +document.getElementById('arr').value;
  const b = +document.getElementById('burst').value;
  const p = +document.getElementById('pri').value || 1;
  const err = document.getElementById('err');
  if (b < 1) { err.textContent = 'Burst must be ≥ 1'; return; }
  err.textContent = '';
  procs.push({ id: pid++, arr: a, burst: b, pri: p });
  renderTags();
}

function randomProcs() {
  procs = []; pid = 1;
  const n = Math.floor(Math.random() * 4) + 3;
  for (let i = 0; i < n; i++)
    procs.push({
      id: pid++,
      arr: Math.floor(Math.random() * 6),
      burst: Math.floor(Math.random() * 8) + 1,
      pri: Math.floor(Math.random() * 5) + 1
    });
  renderTags();
}

function removeP(i) { procs.splice(i, 1); renderTags(); }

function clearAll() {
  procs = []; pid = 1; renderTags();
  document.getElementById('output').classList.add('hidden');
  document.getElementById('empty').style.display = 'flex';
}

function renderTags() {
  const pl = document.getElementById('plist');
  if (!procs.length) { pl.innerHTML = '<span class="ehint">No processes yet...</span>'; return; }
  const showPri = document.getElementById('algo').value === 'priority';
  pl.innerHTML = procs.map((p, i) =>
    `<div class="tag">
      <div class="tag-info">
        <div class="tdot" style="background:${COLORS[i % COLORS.length]}"></div>
        <span>P${p.id} a:${p.arr} b:${p.burst}${showPri ? ` pr:${p.pri}` : ''}</span>
      </div>
      <span class="tag-x" onclick="removeP(${i})">×</span>
    </div>`
  ).join('');
}

/* ═══════════════════════════════════
   ALGORITHMS
═══════════════════════════════════ */
function addIdle(res, from, to) {
  if (from < to) res.push({ id: 'idle', start: from, end: to });
}

// 1. FCFS
function fcfs(ps) {
  let t = 0, res = [];
  [...ps].sort((a, b) => a.arr - b.arr || a.id - b.id).forEach(p => {
    addIdle(res, t, p.arr); t = Math.max(t, p.arr);
    res.push({ id: p.id, start: t, end: t + p.burst }); t += p.burst;
  });
  return res;
}

// 2. SJF
function sjf(ps) {
  let t = 0, res = [], done = new Set(), sorted = [...ps].sort((a, b) => a.arr - b.arr);
  while (done.size < ps.length) {
    let av = sorted.filter(p => !done.has(p.id) && p.arr <= t);
    if (!av.length) { const nx = sorted.find(p => !done.has(p.id)); addIdle(res, t, nx.arr); t = nx.arr; continue; }
    let p = av.sort((a, b) => a.burst - b.burst || a.arr - b.arr)[0];
    res.push({ id: p.id, start: t, end: t + p.burst }); t += p.burst; done.add(p.id);
  }
  return res;
}

// 3. SRTF
function srtf(ps) {
  let t = 0, res = [], rem = ps.map(p => ({ ...p, rem: p.burst })), done = new Set();
  const total = ps.reduce((s, p) => s + p.burst, 0) + Math.max(...ps.map(p => p.arr));
  let last = null;
  while (done.size < ps.length && t < total * 2) {
    const av = rem.filter(p => !done.has(p.id) && p.arr <= t);
    if (!av.length) {
      const nx = rem.filter(p => !done.has(p.id)).sort((a, b) => a.arr - b.arr)[0];
      if (last && last.id !== 'idle') last = null;
      addIdle(res, t, nx.arr); t = nx.arr; last = null; continue;
    }
    const p = av.sort((a, b) => a.rem - b.rem || a.arr - b.arr)[0];
    if (last && last.id === p.id) { last.end = t + 1; }
    else { last = { id: p.id, start: t, end: t + 1 }; res.push(last); }
    p.rem--; t++;
    if (p.rem === 0) done.add(p.id);
  }
  return mergeSegs(res);
}

function mergeSegs(segs) {
  const out = [];
  segs.forEach(s => {
    if (out.length && out[out.length - 1].id === s.id && out[out.length - 1].end === s.start)
      out[out.length - 1].end = s.end;
    else out.push({ ...s });
  });
  return out;
}

// 4. Round Robin
function rrAlgo(ps, q) {
  let t = 0, segs = [], rem = ps.map(p => ({ ...p, rem: p.burst })), queue = [], arrived = new Set();
  rem.sort((a, b) => a.arr - b.arr);
  function enq(now) { rem.forEach(p => { if (!arrived.has(p.id) && p.arr <= now) { arrived.add(p.id); queue.push(p); } }); }
  enq(0);
  while (queue.length) {
    let p = queue.shift();
    if (t < p.arr) { addIdle(segs, t, p.arr); t = p.arr; }
    let run = Math.min(q, p.rem);
    segs.push({ id: p.id, start: t, end: t + run });
    t += run; p.rem -= run; enq(t);
    if (p.rem > 0) queue.push(p);
  }
  return segs;
}

// 5. Priority
function prioritySched(ps) {
  let t = 0, res = [], done = new Set(), sorted = [...ps].sort((a, b) => a.arr - b.arr);
  while (done.size < ps.length) {
    let av = sorted.filter(p => !done.has(p.id) && p.arr <= t);
    if (!av.length) { const nx = sorted.find(p => !done.has(p.id)); addIdle(res, t, nx.arr); t = nx.arr; continue; }
    let p = av.sort((a, b) => a.pri - b.pri || a.arr - b.arr)[0];
    res.push({ id: p.id, start: t, end: t + p.burst }); t += p.burst; done.add(p.id);
  }
  return res;
}

// 6. HRRN
function hrrn(ps) {
  let t = 0, res = [], done = new Set(), sorted = [...ps].sort((a, b) => a.arr - b.arr);
  while (done.size < ps.length) {
    let av = sorted.filter(p => !done.has(p.id) && p.arr <= t);
    if (!av.length) { const nx = sorted.find(p => !done.has(p.id)); addIdle(res, t, nx.arr); t = nx.arr; continue; }
    let p = av.sort((a, b) => {
      const ra = ((t - a.arr) + a.burst) / a.burst;
      const rb = ((t - b.arr) + b.burst) / b.burst;
      return rb - ra;
    })[0];
    res.push({ id: p.id, start: t, end: t + p.burst }); t += p.burst; done.add(p.id);
  }
  return res;
}

// 7. Multiple Queue
function multiQueue(ps) {
  const q1 = ps.filter(p => p.burst <= 3);
  const q2 = ps.filter(p => p.burst >= 4 && p.burst <= 6);
  const q3 = ps.filter(p => p.burst >= 7);
  let t = 0, res = [];

  function runFCFS(group) {
    [...group].sort((a, b) => a.arr - b.arr).forEach(p => {
      t = Math.max(t, p.arr);
      if (res.length && res[res.length - 1].end < t) res.push({ id: 'idle', start: res[res.length - 1].end, end: t });
      res.push({ id: p.id, start: t, end: t + p.burst, queue: 'Q1' }); t += p.burst;
    });
  }

  function runRR(group, q) {
    let rem = group.map(p => ({ ...p, rem: p.burst })), queue2 = [], arrived = new Set();
    rem.sort((a, b) => a.arr - b.arr);
    function enq(now) { rem.forEach(p => { if (!arrived.has(p.id) && p.arr <= now) { arrived.add(p.id); queue2.push(p); } }); }
    enq(t);
    while (queue2.length) {
      let p = queue2.shift();
      if (t < p.arr) t = p.arr;
      let run = Math.min(q, p.rem);
      res.push({ id: p.id, start: t, end: t + run, queue: 'Q2' });
      t += run; p.rem -= run; enq(t);
      if (p.rem > 0) queue2.push(p);
    }
  }

  function runSJF(group) {
    let done = new Set(), sorted = [...group].sort((a, b) => a.arr - b.arr);
    while (done.size < group.length) {
      let av = sorted.filter(p => !done.has(p.id) && p.arr <= t);
      if (!av.length) { const nx = sorted.find(p => !done.has(p.id)); t = nx.arr; continue; }
      let p = av.sort((a, b) => a.burst - b.burst)[0];
      res.push({ id: p.id, start: t, end: t + p.burst, queue: 'Q3' }); t += p.burst; done.add(p.id);
    }
  }

  if (q1.length) runFCFS(q1);
  if (q2.length) runRR(q2, 2);
  if (q3.length) runSJF(q3);
  return res.filter(s => !(s.id === 'idle' && s.start === s.end));
}

// 8. Multilevel Feedback Queue
function mfq(ps) {
  let t = 0, segs = [];
  let procs2 = ps.map(p => ({ ...p, rem: p.burst, level: 1 }));
  procs2.sort((a, b) => a.arr - b.arr);
  let q1 = [], q2 = [], q3 = [], arrived = new Set();

  function enq(now) {
    procs2.forEach(p => { if (!arrived.has(p.id) && p.arr <= now) { arrived.add(p.id); q1.push(p); } });
  }
  enq(0);

  let safety = 0;
  while ((q1.length || q2.length || q3.length) && safety++ < 10000) {
    let p = null, quantum = 0, lv = 0;
    if (q1.length) { p = q1.shift(); quantum = 2; lv = 1; }
    else if (q2.length) { p = q2.shift(); quantum = 4; lv = 2; }
    else if (q3.length) { p = q3.shift(); quantum = Infinity; lv = 3; }
    if (!p) {
      const allWaiting = procs2.filter(x => !arrived.has(x.id));
      if (!allWaiting.length) break;
      const nx = allWaiting.sort((a, b) => a.arr - b.arr)[0];
      if (t < nx.arr) { segs.push({ id: 'idle', start: t, end: nx.arr, level: 0 }); t = nx.arr; }
      enq(t); continue;
    }
    if (t < p.arr) { segs.push({ id: 'idle', start: t, end: p.arr, level: 0 }); t = p.arr; }
    const run = Math.min(quantum, p.rem);
    segs.push({ id: p.id, start: t, end: t + run, level: lv });
    t += run; p.rem -= run; enq(t);
    if (p.rem > 0) {
      if (lv === 1) q2.push({ ...p, level: 2 });
      else if (lv === 2) q3.push({ ...p, level: 3 });
      else q3.push(p);
    }
  }
  return segs;
}

/* ═══════════════════════════════════
   STATS + RENDER HELPERS
═══════════════════════════════════ */
function computeStats(segs, ps) {
  let finish = {}, start = {};
  segs.filter(s => s.id !== 'idle').forEach(s => {
    if (start[s.id] === undefined) start[s.id] = s.start;
    finish[s.id] = s.end;
  });
  return ps.map(p => ({
    id: p.id, arr: p.arr, burst: p.burst, pri: p.pri,
    finish: finish[p.id] ?? 0,
    wt: (start[p.id] ?? p.arr) - p.arr,
    tat: (finish[p.id] ?? p.arr) - p.arr
  }));
}

function ci(id) { return procs.findIndex(p => p.id === id); }

function buildLegend(stats) {
  const mw = Math.max(...stats.map(p => p.wt));
  return `<div class="legend">${procs.map((p, i) => {
    const s = stats.find(x => x.id === p.id);
    const lw = s && s.wt === mw && mw > 0;
    return `<div class="li${lw ? ' lw' : ''}">
      <div class="ld" style="background:${COLORS[i % COLORS.length]}"></div>
      P${p.id} wt:${s ? s.wt : 0}ms
      ${lw ? '<span class="wbadge">longest</span>' : ''}
    </div>`;
  }).join('')}</div>`;
}

function buildGantt(segs, total, gid, h = 48) {
  const bars = segs.map(s => {
    const w = ((s.end - s.start) / total * 100).toFixed(3);
    const color = s.id === 'idle' ? 'var(--bg4)' : COLORS[ci(s.id) % COLORS.length];
    const lvl = s.level ? ` L${s.level}` : '';
    return `<div class="gb${s.id === 'idle' ? ' idle' : ''}" data-w="${w}"
      style="background:${color};height:${h}px"
      title="${s.id === 'idle' ? 'IDLE' : `P${s.id}`}: ${s.start}–${s.end}${lvl}">
      ${s.id === 'idle' ? '·' : `P${s.id}`}
    </div>`;
  }).join('');
  const ticks = [...new Set(segs.flatMap(s => [s.start, s.end]))].sort((a, b) => a - b);
  const tr = ticks.map((t, i) => {
    const nx = ticks[i + 1];
    const w = nx ? (((nx - t) / total) * 100).toFixed(3) : '0';
    return `<div class="tick" style="width:${w}%;min-width:${i === ticks.length - 1 ? '14px' : '0'}">${t}</div>`;
  }).join('');
  return `<div class="gwrap"><div class="gbar" id="${gid}">${bars}</div></div><div class="trow">${tr}</div>`;
}

function buildStatCards(stats) {
  const aw = (stats.reduce((s, p) => s + p.wt, 0) / stats.length).toFixed(1);
  const at = (stats.reduce((s, p) => s + p.tat, 0) / stats.length).toFixed(1);
  const tot = Math.max(...stats.map(p => p.finish));
  return `<div class="stat-row">
    <div class="sc"><div class="sc-label">Avg Waiting</div><div class="sc-val">${aw}<span>ms</span></div></div>
    <div class="sc"><div class="sc-label">Avg Turnaround</div><div class="sc-val">${at}<span>ms</span></div></div>
    <div class="sc"><div class="sc-label">Total Time</div><div class="sc-val">${tot}<span>ms</span></div></div>
  </div>`;
}

function buildTable(stats, showPri = false) {
  const mw = Math.max(...stats.map(p => p.wt)), lw = Math.min(...stats.map(p => p.wt));
  const priCol = showPri ? '<th>Priority</th>' : '';
  const priCells = p => showPri ? `<td>${p.pri}</td>` : '';
  return `<div class="twrap"><table>
    <thead><tr><th>Process</th><th>Arrival</th><th>Burst</th>${priCol}<th>Finish</th><th>Waiting</th><th>Turnaround</th></tr></thead>
    <tbody>${stats.map(p => `<tr>
      <td class="tpid">P${p.id}</td>
      <td>${p.arr}</td><td>${p.burst}</td>${priCells(p)}<td>${p.finish}</td>
      <td class="${p.wt === mw && mw > 0 ? 'hw' : p.wt === lw ? 'lw2' : ''}">${p.wt}</td>
      <td>${p.tat}</td>
    </tr>`).join('')}</tbody>
  </table></div>`;
}

function starvWarn(stats, algo) {
  if (!['sjf', 'srtf', 'priority'].includes(algo)) return '';
  const mw = Math.max(...stats.map(p => p.wt));
  if (mw < 8) return '';
  const p = stats.find(s => s.wt === mw);
  return `<div class="starve-warn">⚠ P${p.id} waited ${p.wt}ms — potential starvation in ${algo.toUpperCase()}.</div>`;
}

function buildQChart(ps, curQ) {
  if (!ps.length) return '';
  const pts = [];
  for (let q = 1; q <= 10; q++) {
    const segs = rrAlgo(ps, q);
    const st = computeStats(segs, ps);
    pts.push({ q, aw: +(st.reduce((s, p) => s + p.wt, 0) / st.length).toFixed(2) });
  }
  const maxAw = Math.max(...pts.map(p => p.aw), 1);
  const W = 420, H = 90, pl = 32, pr = 12, pt = 8, pb = 26;
  const cx = i => pl + (i / 9) * (W - pl - pr);
  const cy = v => H - pb - ((v / maxAw) * (H - pt - pb));
  const path = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${cx(i)},${cy(p.aw)}`).join(' ');
  const dots = pts.map((p, i) => `<circle cx="${cx(i)}" cy="${cy(p.aw)}" r="${p.q === curQ ? 5 : 3}" fill="${p.q === curQ ? '#d946ef' : '#a78bfa'}"/>`).join('');
  const labels = pts.map((p, i) => `<text x="${cx(i)}" y="${H - 8}" text-anchor="middle" font-size="9" fill="var(--text3)" font-family="'DM Mono',monospace">${p.q}</text>`).join('');
  return `<div class="qchart-panel">
    <div class="qchart-title">// quantum impact — avg waiting time vs quantum (Round Robin)</div>
    <svg viewBox="0 0 ${W} ${H}" style="width:100%">
      <defs><linearGradient id="qg" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" stop-color="#c026d3"/><stop offset="100%" stop-color="#3b82f6"/>
      </linearGradient></defs>
      <line x1="${pl}" y1="${pt}" x2="${pl}" y2="${H - pb}" stroke="var(--border2)" stroke-width="1"/>
      <line x1="${pl}" y1="${H - pb}" x2="${W - pr}" y2="${H - pb}" stroke="var(--border2)" stroke-width="1"/>
      ${labels}
      <path d="${path}" fill="none" stroke="url(#qg)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
      ${dots}
    </svg>
    <div style="font-size:10px;color:var(--text3);font-family:'DM Mono',monospace;text-align:center;margin-top:2px">
      x: quantum &nbsp;|&nbsp; y: avg wait (ms) &nbsp;|&nbsp; <span style="color:var(--mag2)">●</span> current
    </div>
  </div>`;
}

/* ═══════════════════════════════════
   MQ & MFQ VISUALIZERS
═══════════════════════════════════ */
function buildMQGantt(segs, gidPrefix) {
  const total = Math.max(...segs.map(s => s.end));
  const queues = ['Q1', 'Q2', 'Q3'];
  const qColors = { Q1: 'rgba(192,38,211,.25)', Q2: 'rgba(59,130,246,.25)', Q3: 'rgba(139,92,246,.25)' };
  const qBorder = { Q1: 'rgba(192,38,211,.5)',  Q2: 'rgba(59,130,246,.5)',  Q3: 'rgba(139,92,246,.5)' };
  const qText   = { Q1: '#d946ef', Q2: '#60a5fa', Q3: '#a78bfa' };
  const qDesc   = { Q1: 'FCFS',   Q2: 'RR q=2',  Q3: 'SJF' };

  const ticks = [...new Set(segs.flatMap(s => [s.start, s.end]))].sort((a, b) => a - b);
  const tr = ticks.map((t, i) => {
    const nx = ticks[i + 1];
    const w = nx ? (((nx - t) / total) * 100).toFixed(3) : '0';
    return `<div class="tick" style="width:${w}%;min-width:${i === ticks.length - 1 ? '14px' : '0'}">${t}</div>`;
  }).join('');

  const rows = queues.map((q, qi) => {
    const bars = segs.map(s => {
      const w = ((s.end - s.start) / total * 100).toFixed(3);
      if (s.id === 'idle' || s.queue !== q)
        return `<div style="width:${w}%;height:36px;background:var(--bg3);flex-shrink:0;border-right:1px solid var(--bg)"></div>`;
      const color = COLORS[ci(s.id) % COLORS.length];
      return `<div class="gb" data-w="${w}" data-gid="${gidPrefix}-${qi}"
        style="background:${color};height:36px;border-right:2px solid rgba(0,0,0,.2)"
        title="P${s.id}: ${s.start}–${s.end} (${q})">P${s.id}</div>`;
    }).join('');
    return `<div class="mrow">
      <div class="mrow-label" style="background:${qColors[q]};border-color:${qBorder[q]};color:${qText[q]}">${q} — ${qDesc[q]}</div>
      <div class="mrow-bar-wrap"><div class="mrow-bar" id="${gidPrefix}-${qi}">${bars}</div></div>
    </div>`;
  }).join('');

  const assigned = { Q1: [], Q2: [], Q3: [] };
  segs.filter(s => s.id !== 'idle' && s.queue).forEach(s => {
    if (!assigned[s.queue].includes(s.id)) assigned[s.queue].push(s.id);
  });
  const assignRows = Object.entries(assigned).map(([q, ids]) => {
    if (!ids.length) return '';
    const reason = { Q1: 'burst 1–3ms', Q2: 'burst 4–6ms', Q3: 'burst 7+ms' };
    return `<div style="display:flex;align-items:center;gap:8px;margin-bottom:5px">
      <span style="font-size:10px;font-family:'DM Mono',monospace;color:${qText[q]};width:60px">${q}</span>
      <span style="font-size:10px;font-family:'DM Mono',monospace;color:var(--text3);width:80px">${reason[q]}</span>
      <span style="display:flex;gap:4px">${ids.map(id => {
        const pidx = procs.findIndex(p => p.id === id);
        return `<span style="font-size:10px;font-family:'DM Mono',monospace;padding:2px 7px;border-radius:4px;
          background:${COLORS[pidx % COLORS.length]}22;border:1px solid ${COLORS[pidx % COLORS.length]}44;
          color:${COLORS[pidx % COLORS.length]}">P${id}</span>`;
      }).join('')}</span>
    </div>`;
  }).join('');

  return `<div class="mrow-wrap">${rows}</div>
    <div class="mrow-tick-wrap"><div class="trow">${tr}</div></div>
    <div class="assign-wrap">
      <div class="assign-title">// process assignment</div>
      ${assignRows}
    </div>`;
}

function buildMFQGantt(segs, gidPrefix) {
  const total = Math.max(...segs.map(s => s.end));
  const levels = [1, 2, 3];
  const lColors = { 1: 'rgba(192,38,211,.22)', 2: 'rgba(59,130,246,.22)', 3: 'rgba(139,92,246,.22)' };
  const lBorder = { 1: 'rgba(192,38,211,.45)', 2: 'rgba(59,130,246,.45)', 3: 'rgba(139,92,246,.45)' };
  const lText   = { 1: '#d946ef', 2: '#60a5fa', 3: '#a78bfa' };
  const lDesc   = { 1: 'L1 RR q=2', 2: 'L2 RR q=4', 3: 'L3 FCFS' };

  const ticks = [...new Set(segs.flatMap(s => [s.start, s.end]))].sort((a, b) => a - b);
  const tr = ticks.map((t, i) => {
    const nx = ticks[i + 1];
    const w = nx ? (((nx - t) / total) * 100).toFixed(3) : '0';
    return `<div class="tick" style="width:${w}%;min-width:${i === ticks.length - 1 ? '14px' : '0'}">${t}</div>`;
  }).join('');

  const rows = levels.map((lv, li) => {
    const bars = segs.map(s => {
      const w = ((s.end - s.start) / total * 100).toFixed(3);
      if (s.id === 'idle' || s.level !== lv)
        return `<div style="width:${w}%;height:36px;background:var(--bg3);flex-shrink:0;border-right:1px solid var(--bg)"></div>`;
      const color = COLORS[ci(s.id) % COLORS.length];
      return `<div class="gb" data-w="${w}" data-gid="${gidPrefix}-${li}"
        style="background:${color};height:36px;border-right:2px solid rgba(0,0,0,.2)"
        title="P${s.id}: ${s.start}–${s.end} (L${lv})">P${s.id}</div>`;
    }).join('');
    return `<div class="mrow">
      <div class="mrow-label" style="background:${lColors[lv]};border-color:${lBorder[lv]};color:${lText[lv]}">${lDesc[lv]}</div>
      <div class="mrow-bar-wrap"><div class="mrow-bar" id="${gidPrefix}-${li}">${bars}</div></div>
    </div>`;
  }).join('');

  const demotions = {};
  segs.filter(s => s.id !== 'idle').forEach(s => {
    if (!demotions[s.id]) demotions[s.id] = [];
    const last = demotions[s.id][demotions[s.id].length - 1];
    if (!last || last !== s.level) demotions[s.id].push(s.level);
  });

  const demoteRows = Object.entries(demotions).map(([id, lvls]) => {
    const pidx = procs.findIndex(p => p.id === +id);
    const color = COLORS[pidx % COLORS.length];
    const lc  = { 1: '#d946ef', 2: '#60a5fa', 3: '#a78bfa' };
    const lbg = { 1: 'rgba(192,38,211,.12)', 2: 'rgba(59,130,246,.12)', 3: 'rgba(139,92,246,.12)' };
    const badges = lvls.map((lv, i) =>
      `${i > 0 ? '<span class="demote-arrow"> → </span>' : ''}
       <span class="dbadge" style="background:${lbg[lv]};border:1px solid ${lc[lv]}44;color:${lc[lv]}">L${lv}</span>`
    ).join('');
    const demoteCount = lvls.length - 1;
    const note = demoteCount === 0
      ? '<span style="font-size:9px;color:var(--green);font-family:\'DM Mono\',monospace"> ✓ finished L1</span>'
      : `<span style="font-size:9px;color:var(--amber);font-family:'DM Mono',monospace"> demoted ${demoteCount}×</span>`;
    return `<div class="demote-row">
      <span class="demote-pid" style="color:${color}">P${id}</span>
      <span style="display:flex;align-items:center;flex-wrap:wrap;gap:2px">${badges}</span>
      ${note}
    </div>`;
  }).join('');

  return `<div class="mrow-wrap">${rows}</div>
    <div class="mrow-tick-wrap"><div class="trow">${tr}</div></div>
    <div class="demote-wrap">
      <div class="demote-title">// process demotion path</div>
      ${demoteRows}
    </div>`;
}

function buildMQInfo(segs)  { return buildMQGantt(segs,  'mqg'); }
function buildMFQInfo(segs) { return buildMFQGantt(segs, 'mfqg'); }

/* ═══════════════════════════════════
   PLAYBACK RENDERER
═══════════════════════════════════ */
function renderPlaybackState(tick, segs, procs, total) {
  let running = null;
  let remainingBursts = {};
  procs.forEach(p => remainingBursts[p.id] = p.burst);

  segs.filter(s => s.id !== 'idle').forEach(s => {
    if (tick >= s.end) {
      remainingBursts[s.id] -= (s.end - s.start);
    } else if (tick > s.start && tick < s.end) {
      remainingBursts[s.id] -= (tick - s.start);
      running = s;
    }
  });

  const readyQueue = procs.filter(p =>
    p.arr <= tick && remainingBursts[p.id] > 0 && (!running || running.id !== p.id));

  const runDisplay = document.getElementById('play-state-run');
  const rqDisplay  = document.getElementById('play-state-rq');

  if (runDisplay) {
    if (running) {
      const color = COLORS[ci(running.id) % COLORS.length];
      runDisplay.innerHTML = `<span style="color:${color}">P${running.id}</span>`;
    } else {
      runDisplay.innerHTML = '<span style="color:var(--text3)">IDLE</span>';
    }
  }
  if (rqDisplay) {
    rqDisplay.innerHTML = readyQueue.length === 0
      ? '<span style="color:var(--text3)">empty</span>'
      : readyQueue.map(p => {
          const color = COLORS[ci(p.id) % COLORS.length];
          return `<span style="color:${color}">P${p.id}</span>`;
        }).join(', ');
  }

  // Playhead
  const gwrap = document.querySelector('.gwrap');
  let playhead = document.getElementById('playhead-line');
  if (gwrap) {
    if (!playhead) {
      playhead = document.createElement('div');
      playhead.id = 'playhead-line';
      playhead.className = 'playhead';
      gwrap.appendChild(playhead);
    }
    playhead.style.left = `${total === 0 ? 0 : (tick / total) * 100}%`;
  }
}

/* ═══════════════════════════════════
   ANIMATE & OUTPUT
═══════════════════════════════════ */
function animate(id) {
  document.querySelectorAll(`#${id} .gb`).forEach((b, i) => {
    b.style.width = '0';
    setTimeout(() => {
      b.style.transition = 'width 0.28s cubic-bezier(.4,0,.2,1)';
      b.style.width = b.dataset.w + '%';
    }, i * 80);
  });
}

function showOut(html) {
  document.getElementById('empty').style.display = 'none';
  const o = document.getElementById('output');
  o.classList.remove('hidden');
  o.innerHTML = html;
}

function runActive() {
  if (!procs.length) { document.getElementById('err').textContent = 'Add at least one process.'; return; }
  document.getElementById('err').textContent = '';
  mode === 'single' ? runSingle() : runCompare();
}

function getSegs(algo, q) {
  switch (algo) {
    case 'fcfs':     return fcfs(procs);
    case 'sjf':      return sjf(procs);
    case 'srtf':     return srtf(procs);
    case 'rr':       return rrAlgo(procs, q);
    case 'priority': return prioritySched(procs);
    case 'hrrn':     return hrrn(procs);
    case 'mq':       return multiQueue(procs);
    case 'mfq':      return mfq(procs);
    default:         return fcfs(procs);
  }
}

/* ═══════════════════════════════════
   RUN SINGLE
═══════════════════════════════════ */
function runSingle() {
  const algo = document.getElementById('algo').value;
  const q = +document.getElementById('quantum').value || 2;
  const segs = getSegs(algo, q);
  const st = computeStats(segs, procs);
  const total = Math.max(...segs.map(s => s.end));
  const idle = segs.filter(s => s.id === 'idle').reduce((sum, s) => sum + (s.end - s.start), 0);

  const NAMES = {
    fcfs: 'First Come, First Served', sjf: 'Shortest Job First',
    srtf: 'Shortest Remaining Time First', rr: `Round Robin — q=${q}`,
    priority: 'Priority Scheduling', hrrn: 'Highest Response Ratio Next',
    mq: 'Multiple Queue Scheduling', mfq: 'Multilevel Feedback Queue'
  };
  const BADGES = {
    fcfs: 'Non-preemptive', sjf: 'Non-preemptive', srtf: 'Preemptive',
    rr: 'Preemptive', priority: 'Non-preemptive', hrrn: 'Non-preemptive',
    mq: 'Multi-queue', mfq: 'Preemptive'
  };

  const idleNote = idle > 0
    ? `<span style="font-size:10px;font-family:'DM Mono',monospace;color:var(--red2);margin-left:10px">⬤ idle: ${idle}ms</span>`
    : '';
  const extra = algo === 'mq' ? buildMQInfo(segs) : algo === 'mfq' ? buildMFQInfo(segs) : '';

  const playPanel = `<div class="play-panel">
    <div class="play-controls">
      <button class="play-btn" onclick="Playback.step(-1)">⏮</button>
      <button class="play-btn" id="play-btn-main" onclick="Playback.toggle()">▶</button>
      <button class="play-btn" onclick="Playback.step(1)">⏭</button>
      <div class="play-slider">
        <input type="range" id="play-slider-input" min="0" max="${total}" value="0" step="1" oninput="Playback.seek(this.value)">
      </div>
      <div class="play-tick" id="play-tick-val">0</div>
    </div>
    <div class="play-state">
      <div class="play-state-item"><span class="play-state-label">Running:</span> <span id="play-state-run"><span style="color:var(--text3)">IDLE</span></span></div>
      <div class="play-state-item"><span class="play-state-label">Ready Q:</span> <span id="play-state-rq"><span style="color:var(--text3)">empty</span></span></div>
    </div>
  </div>`;

  showOut(`<div class="rblock">
    <div class="rheader"><span class="rtitle">${NAMES[algo]}${idleNote}</span><span class="rbadge">${BADGES[algo]}</span></div>
    ${starvWarn(st, algo)}
    ${buildStatCards(st)}
    ${playPanel}
    <div class="gpanel">${extra}${buildLegend(st)}${buildGantt(segs, total, 'g-s')}</div>
    ${buildTable(st, algo === 'priority')}
    ${algo === 'rr' ? buildQChart(procs, q) : ''}
  </div>`);

  setTimeout(() => {
    animate('g-s');
    [0, 1, 2].forEach(i => animate('mqg-' + i));
    [0, 1, 2].forEach(i => animate('mfqg-' + i));
  }, 60);

  Playback.init(segs, procs, total);
}

/* ═══════════════════════════════════
   RUN COMPARE
═══════════════════════════════════ */
function runCompare() {
  const q = +document.getElementById('cquantum').value || 2;
  const algos = [
    { key: 'fcfs',     name: 'FCFS'      },
    { key: 'sjf',      name: 'SJF'       },
    { key: 'srtf',     name: 'SRTF'      },
    { key: 'rr',       name: `RR q=${q}` },
    { key: 'priority', name: 'Priority'  },
    { key: 'hrrn',     name: 'HRRN'      },
    { key: 'mq',       name: 'Multi-Q'   },
    { key: 'mfq',      name: 'MFQ'       },
  ];
  const all = algos.map(a => ({ ...a, segs: getSegs(a.key, q) }))
                   .map(a => ({ ...a, st: computeStats(a.segs, procs) }));
  const bestWt = Math.min(...all.map(a => +(a.st.reduce((s, p) => s + p.wt, 0) / a.st.length).toFixed(1)));

  const cards = all.map((a, i) => {
    const aw  = (a.st.reduce((s, p) => s + p.wt,  0) / a.st.length).toFixed(1);
    const at  = (a.st.reduce((s, p) => s + p.tat, 0) / a.st.length).toFixed(1);
    const tot = Math.max(...a.segs.map(s => s.end));
    const isBest = +aw === bestWt;
    return `<div class="ccard${isBest ? ' best' : ''}">
      <div class="ctitle">${a.name}${isBest ? '<span class="bestbadge">best</span>' : ''}</div>
      ${buildGantt(a.segs, tot, 'g-c' + i, 32)}
      <div class="cstats">
        <div class="cstat"><span class="cslabel">Avg Wait</span><span class="csval">${aw}ms</span></div>
        <div class="cstat"><span class="cslabel">Avg TAT</span><span class="csval">${at}ms</span></div>
        <div class="cstat"><span class="cslabel">Total</span><span class="csval">${tot}ms</span></div>
      </div>
    </div>`;
  }).join('');

  showOut(`<div class="rblock">
    <div class="rheader"><span class="rtitle">All 8 Algorithms Compared</span><span class="rbadge">compare mode</span></div>
    <div class="cgrid">${cards}</div>
    ${buildQChart(procs, q)}
  </div>`);

  setTimeout(() => all.forEach((_, i) => animate('g-c' + i)), 60);
}

/* ═══════════════════════════════════
   EXPORT
═══════════════════════════════════ */
function exportPDF() {
  if (document.getElementById('output').classList.contains('hidden')) {
    alert('Run an algorithm first.'); return;
  }
  window.print();
}
