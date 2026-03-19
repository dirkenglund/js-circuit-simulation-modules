/**
 * ui-controller.js
 * Main UI controller that integrates analog, digital, and quantum simulation modules.
 * Handles tab switching, tool selection, simulation runs, and result display.
 */

'use strict';

// ─── Global State ─────────────────────────────────────────────────────────────

let analogCanvas   = null;
let digitalCanvas  = null;
let quantumUI      = null;
let currentAnalogTool  = 'resistor';
let currentGateTool    = 'AND';
let currentQGate       = 'H';

// ─── Tab Management ───────────────────────────────────────────────────────────

function showPanel(name) {
  document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  const panel = document.getElementById('panel-' + name);
  if (panel) panel.classList.add('active');
  const tabs = document.querySelectorAll('.tab');
  tabs.forEach(t => {
    if (t.textContent.toLowerCase().includes(name.toLowerCase().substring(0, 5))) {
      t.classList.add('active');
    }
  });
  // Initialize canvases lazily
  if (name === 'analog' && !analogCanvas) {
    analogCanvas = new AnalogCanvas('analog-canvas');
  }
  if (name === 'digital' && !digitalCanvas) {
    digitalCanvas = new DigitalCanvas('digital-canvas');
  }
  if (name === 'quantum' && !quantumUI) {
    initQuantumGrid();
  }
}

// ─── Analog Circuit Controls ──────────────────────────────────────────────────

function setTool(tool) {
  currentAnalogTool = tool;
  document.querySelectorAll('[id^="btn-"]').forEach(b => b.classList.remove('active'));
  const btn = document.getElementById('btn-' + tool);
  if (btn) btn.classList.add('active');
  if (analogCanvas) analogCanvas.setTool(tool);
}

function clearAnalog() {
  if (analogCanvas) analogCanvas.clear();
  document.getElementById('node-voltages').innerHTML = '<div style="color:#a0a0c0;font-size:0.8rem;">Run simulation to see results</div>';
  document.getElementById('branch-currents').innerHTML = '<div style="color:#a0a0c0;font-size:0.8rem;">Run simulation to see results</div>';
  document.getElementById('power-display').innerHTML = '<div style="color:#a0a0c0;font-size:0.8rem;">Run simulation to see results</div>';
  document.getElementById('analog-status').textContent = 'Canvas cleared.';
}

function loadExample() {
  if (!analogCanvas) analogCanvas = new AnalogCanvas('analog-canvas');
  analogCanvas.loadExample();
  document.getElementById('analog-status').textContent = 'RC voltage divider example loaded. Click ▶ Run Sim to solve.';
}

function runAnalog() {
  if (!analogCanvas) analogCanvas = new AnalogCanvas('analog-canvas');
  const results = analogCanvas.solveCircuit();
  const statusEl = document.getElementById('analog-status');

  if (results.error) {
    statusEl.textContent = '⚠ ' + results.error;
    statusEl.style.color = '#ff6b6b';
    return;
  }
  statusEl.style.color = '#2aff6e';
  statusEl.textContent = '✓ Simulation complete. DC operating point found.';

  // Display node voltages
  const nvDiv = document.getElementById('node-voltages');
  const nvHtml = Object.entries(results.nodeVoltages)
    .filter(([n]) => n !== 'GND')
    .map(([n, v]) =>
      '<div class="reading"><span>V(' + n + ')</span><span class="val">' +
      v.toFixed(4) + ' V</span></div>'
    ).join('');
  nvDiv.innerHTML = nvHtml || '<div style="color:#a0a0c0;">No node data</div>';

  // Display branch currents
  const bcDiv = document.getElementById('branch-currents');
  const bcHtml = Object.entries(results.branchCurrents).map(([id, i]) => {
    const mA = (i * 1000).toFixed(4);
    return '<div class="reading"><span>I(E' + id + ')</span><span class="val">' + mA + ' mA</span></div>';
  }).join('');
  bcDiv.innerHTML = bcHtml || '<div style="color:#a0a0c0;">No current data</div>';

  // Power dissipation
  const pwDiv = document.getElementById('power-display');
  const pwHtml = Object.entries(results.power).map(([id, p]) => {
    const mW = (p * 1000).toFixed(4);
    return '<div class="reading"><span>P(R' + id + ')</span><span class="val">' + mW + ' mW</span></div>';
  }).join('');
  pwDiv.innerHTML = pwHtml || '<div style="color:#a0a0c0;">No power data</div>';
}

// ─── Digital Logic Controls ───────────────────────────────────────────────────

function setGateTool(tool) {
  currentGateTool = tool;
  document.querySelectorAll('[id^="dg-"]').forEach(b => b.classList.remove('active'));
  const btn = document.getElementById('dg-' + tool);
  if (btn) btn.classList.add('active');
  if (digitalCanvas) digitalCanvas.setTool(tool);
}

function clearDigital() {
  if (digitalCanvas) digitalCanvas.clear();
  document.getElementById('truth-table').innerHTML = '<div style="color:#a0a0c0;">Load an example to generate truth table</div>';
  document.getElementById('logic-state').innerHTML = '<div style="color:#a0a0c0;">Run simulation to see logic states</div>';
  document.getElementById('digital-status').textContent = 'Canvas cleared.';
}

function loadDigitalExample() {
  if (!digitalCanvas) digitalCanvas = new DigitalCanvas('digital-canvas');
  digitalCanvas.loadHalfAdder();
  document.getElementById('digital-status').textContent = 'Half-adder loaded (XOR + AND). Click ▶ Truth Table to see all combinations.';
}

function runDigital() {
  if (!digitalCanvas) return;
  const tt = digitalCanvas.generateTruthTable();
  const ttDiv = document.getElementById('truth-table');
  const stateDiv = document.getElementById('logic-state');

  if (!tt) {
    ttDiv.innerHTML = '<div style="color:#ff6b6b;">Add INPUT and OUTPUT gates first.</div>';
    return;
  }

  // Header
  let html = '<div style="display:flex;gap:8px;padding:4px 0;border-bottom:1px solid #0f3460;margin-bottom:4px;">';
  for (const h of tt.headers) {
    html += '<span style="min-width:40px;color:#e94560;">' + h + '</span>';
  }
  html += '</div>';

  // Rows
  for (const row of tt.rows) {
    html += '<div style="display:flex;gap:8px;padding:3px 0;">';
    for (let i = 0; i < row.length; i++) {
      const isOutput = i >= tt.headers.length - tt.rows[0].length + (tt.rows[0].length - (tt.headers.length - tt.rows[0].length + tt.rows[0].length));
      const color = row[i] === 1 ? '#2aff6e' : '#4fc3f7';
      html += '<span style="min-width:40px;color:' + color + ';">' + row[i] + '</span>';
    }
    html += '</div>';
  }

  ttDiv.innerHTML = html;

  // Current state
  let stateHtml = '<div style="color:#4fc3f7;">Current logic evaluation:</div>';
  const inputState = {};
  digitalCanvas.sim.inputs.forEach((id, i) => {
    inputState[id] = digitalCanvas.inputStates[id] ?? 0;
    stateHtml += '<div class="reading"><span>' + id + ' (IN)</span><span class="val">' + (inputState[id] === 1 ? '1 (HIGH)' : '0 (LOW)') + '</span></div>';
  });
  const outResults = digitalCanvas.sim.evaluate(inputState);
  digitalCanvas.sim.outputs.forEach(id => {
    const v = outResults[id] ?? 0;
    stateHtml += '<div class="reading"><span>' + id + ' (OUT)</span><span class="val" style="color:' + (v === 1 ? '#2aff6e' : '#e94560') + ';">' + (v === 1 ? '1 (HIGH)' : '0 (LOW)') + '</span></div>';
  });
  stateDiv.innerHTML = stateHtml;
  document.getElementById('digital-status').textContent = '✓ Truth table generated with ' + tt.rows.length + ' combinations.';
}

// ─── Quantum Circuit Controls ─────────────────────────────────────────────────

function initQuantumGrid() {
  const qc = parseInt(document.getElementById('qubit-count')?.value || '3');
  const qs = parseInt(document.getElementById('circuit-steps')?.value || '8');
  if (!quantumUI) {
    quantumUI = new QuantumCircuitUI('quantum-grid-container', qc, qs);
  } else {
    quantumUI.resize(qc, qs);
  }
}

function setQGate(gate) {
  currentQGate = gate;
  document.querySelectorAll('[id^="qg-"]').forEach(b => b.classList.remove('active'));
  const btn = document.getElementById('qg-' + gate);
  if (btn) btn.classList.add('active');
  if (quantumUI) quantumUI.setGate(gate);
}

function clearQuantum() {
  if (quantumUI) quantumUI.clear();
  document.getElementById('statevector-display').innerHTML = '<div style="color:#a0a0c0;">Run simulation to see statevector</div>';
  document.getElementById('prob-display').innerHTML = '<div style="color:#a0a0c0;">Run simulation to see probabilities</div>';
  document.getElementById('quantum-status').textContent = 'Grid cleared. Place gates and run.';
}

function loadBellState() {
  if (!quantumUI) initQuantumGrid();
  quantumUI.loadBellState();
  document.getElementById('quantum-status').textContent = 'Bell state circuit loaded: H|0⟩ then CNOT(0,1). Click ▶ Run Quantum Sim.';
}

function loadGrover() {
  if (!quantumUI) initQuantumGrid();
  quantumUI.loadGrover();
  document.getElementById('quantum-status').textContent = 'Grover 2-qubit circuit loaded. Amplifies |11⟩ state. Click ▶ Run Quantum Sim.';
}

function runQuantum() {
  if (!quantumUI) return;
  const qc = quantumUI.run();

  // Display statevector
  const svDiv = document.getElementById('statevector-display');
  let svHtml = '';
  for (let i = 0; i < qc.numStates; i++) {
    const amp = qc.statevector[i];
    const prob = amp.abs2();
    if (prob < 1e-8) continue;
    const bin = i.toString(2).padStart(qc.numQubits, '0');
    svHtml += '<div style="margin:3px 0;font-size:0.8rem;">' +
      '<span style="color:#a0a0c0;">|' + bin + '⟩ </span>' +
      '<span style="color:#4fc3f7;">' + amp.toString() + '</span>' +
      '<span style="color:#a0a0c0;"> (' + (prob * 100).toFixed(1) + '%)</span>' +
      '</div>';
  }
  svDiv.innerHTML = svHtml || '<div style="color:#ff6b6b;">No non-zero amplitudes found.</div>';

  // Display probability bars
  const probDiv = document.getElementById('prob-display');
  const probs = qc.getMeasurementProbabilities();
  let probHtml = '';
  for (const p of probs) {
    const pct = (p.probability * 100).toFixed(1);
    const barWidth = Math.round(p.probability * 150);
    probHtml += '<div class="result-bar">' +
      '<span style="color:#a0a0c0;min-width:45px;">|' + p.binary + '⟩</span>' +
      '<div class="bar" style="width:' + barWidth + 'px;"></div>' +
      '<span class="prob">' + pct + '%</span>' +
      '</div>';
  }
  probDiv.innerHTML = probHtml || '<div style="color:#a0a0c0;">No results</div>';

  // Run sample shots
  const shots = qc.measureMultiple(1000);
  const nonzero = shots.filter(s => s.count > 0);
  document.getElementById('quantum-status').textContent =
    '✓ Simulation complete. ' + probs.length + ' distinct states. ' +
    'Top result: |' + (probs[0]?.binary || '?') + '⟩ = ' + (probs[0] ? (probs[0].probability * 100).toFixed(1) : '0') + '%';
}

// ─── Initialize on page load ──────────────────────────────────────────────────

window.addEventListener('DOMContentLoaded', () => {
  // Initialize analog canvas (default tab)
  analogCanvas = new AnalogCanvas('analog-canvas');
  // Expose functions to window for HTML onclick handlers
  window.showPanel = showPanel;
  window.setTool = setTool;
  window.clearAnalog = clearAnalog;
  window.loadExample = loadExample;
  window.runAnalog = runAnalog;
  window.setGateTool = setGateTool;
  window.clearDigital = clearDigital;
  window.loadDigitalExample = loadDigitalExample;
  window.runDigital = runDigital;
  window.initQuantumGrid = initQuantumGrid;
  window.setQGate = setQGate;
  window.clearQuantum = clearQuantum;
  window.loadBellState = loadBellState;
  window.loadGrover = loadGrover;
  window.runQuantum = runQuantum;
});
