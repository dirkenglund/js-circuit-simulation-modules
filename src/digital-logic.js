/**
 * digital-logic.js
 * Boolean logic gate simulator with truth table generation.
 * Supports: AND, OR, NOT, NAND, NOR, XOR, XNOR gates.
 * Also supports combinational circuits and half/full adders.
 */

'use strict';

// ─── Gate Evaluation Functions ────────────────────────────────────────────────

const GateFunctions = {
  AND:  (inputs) => inputs.every(v => v === 1) ? 1 : 0,
  OR:   (inputs) => inputs.some(v => v === 1) ? 1 : 0,
  NOT:  (inputs) => inputs[0] === 0 ? 1 : 0,
  NAND: (inputs) => inputs.every(v => v === 1) ? 0 : 1,
  NOR:  (inputs) => inputs.some(v => v === 1) ? 0 : 1,
  XOR:  (inputs) => inputs.reduce((a, b) => a ^ b, 0),
  XNOR: (inputs) => (inputs.reduce((a, b) => a ^ b, 0)) === 0 ? 1 : 0,
  BUFFER: (inputs) => inputs[0],
};

// ─── Gate Class ───────────────────────────────────────────────────────────────

class LogicGate {
  /**
   * @param {string} id   - unique identifier
   * @param {string} type - gate type (AND, OR, NOT, etc.)
   * @param {number} x    - canvas x position
   * @param {number} y    - canvas y position
   */
  constructor(id, type, x, y) {
    this.id = id;
    this.type = type;
    this.x = x;
    this.y = y;
    this.inputs = [];   // array of { fromGate, fromOutput } connections
    this.output = null; // computed output value (0 or 1)
    this.width = 60;
    this.height = 40;
  }

  evaluate(state) {
    if (this.type === 'INPUT') {
      return state[this.id] ?? 0;
    }
    const inputVals = this.inputs.map(inp => {
      if (!inp) return 0;
      const src = inp.fromGate;
      if (src.output === null) src.evaluate(state);
      return src.output ?? 0;
    });
    if (inputVals.length === 0) return 0;
    const fn = GateFunctions[this.type];
    this.output = fn ? fn(inputVals) : 0;
    return this.output;
  }
}

// ─── Digital Logic Simulator ──────────────────────────────────────────────────

class DigitalLogicSim {
  constructor() {
    this.gates = new Map();  // id -> LogicGate
    this.wires = [];          // { fromId, toId }
    this.inputs = [];         // ordered input gate ids
    this.outputs = [];        // ordered output gate ids
    this.nextId = 1;
  }

  /**
   * Add a gate to the circuit.
   */
  addGate(type, x, y) {
    const id = 'G' + (this.nextId++);
    const gate = new LogicGate(id, type, x, y);
    this.gates.set(id, gate);
    if (type === 'INPUT') this.inputs.push(id);
    if (type === 'OUTPUT') this.outputs.push(id);
    return gate;
  }

  /**
   * Connect fromGate output to toGate input at inputIndex.
   */
  connect(fromId, toId, inputIndex = 0) {
    const from = this.gates.get(fromId);
    const to = this.gates.get(toId);
    if (!from || !to) return false;
    if (!to.inputs[inputIndex]) to.inputs[inputIndex] = null;
    to.inputs[inputIndex] = { fromGate: from, fromOutput: 0 };
    this.wires.push({ fromId, toId, inputIndex });
    return true;
  }

  /**
   * Evaluate circuit for a given input state.
   * @param {Object} state - { inputGateId: 0|1, ... }
   */
  evaluate(state) {
    // Reset all outputs
    for (const gate of this.gates.values()) gate.output = null;
    // Evaluate outputs
    const results = {};
    for (const outId of this.outputs) {
      const outGate = this.gates.get(outId);
      if (outGate && outGate.inputs.length > 0) {
        const src = outGate.inputs[0];
        if (src) {
          src.fromGate.output = null;
          results[outId] = src.fromGate.evaluate(state);
        }
      }
    }
    return results;
  }

  /**
   * Generate the full truth table for the current circuit.
   * @returns {{ headers: string[], rows: number[][] }}
   */
  generateTruthTable() {
    const n = this.inputs.length;
    const m = this.outputs.length;
    if (n === 0 || m === 0) return null;
    const headers = [...this.inputs, ...this.outputs];
    const rows = [];
    for (let i = 0; i < Math.pow(2, n); i++) {
      const state = {};
      const row = [];
      for (let j = n - 1; j >= 0; j--) {
        const bit = (i >> j) & 1;
        state[this.inputs[n - 1 - j]] = bit;
        row.push(bit);
      }
      const results = this.evaluate(state);
      for (const outId of this.outputs) row.push(results[outId] ?? 0);
      rows.push(row);
    }
    return { headers, rows };
  }

  clear() {
    this.gates.clear();
    this.wires = [];
    this.inputs = [];
    this.outputs = [];
    this.nextId = 1;
  }

  /**
   * Load a half-adder circuit (2-input: A, B; outputs: Sum, Carry)
   */
  loadHalfAdder() {
    this.clear();
    const A   = this.addGate('INPUT', 40, 60);
    const B   = this.addGate('INPUT', 40, 160);
    const xor = this.addGate('XOR', 200, 80);
    const and = this.addGate('AND', 200, 180);
    const sum = this.addGate('OUTPUT', 360, 80);
    const carry = this.addGate('OUTPUT', 360, 180);
    this.connect(A.id, xor.id, 0);
    this.connect(B.id, xor.id, 1);
    this.connect(A.id, and.id, 0);
    this.connect(B.id, and.id, 1);
    this.connect(xor.id, sum.id, 0);
    this.connect(and.id, carry.id, 0);
    return this;
  }

  /**
   * Load a full-adder circuit (3-input: A, B, Cin; outputs: Sum, Cout)
   */
  loadFullAdder() {
    this.clear();
    const A   = this.addGate('INPUT', 40, 60);
    const B   = this.addGate('INPUT', 40, 140);
    const Cin = this.addGate('INPUT', 40, 220);
    const xor1  = this.addGate('XOR', 200, 80);
    const xor2  = this.addGate('XOR', 360, 80);
    const and1  = this.addGate('AND', 200, 200);
    const and2  = this.addGate('AND', 360, 200);
    const or    = this.addGate('OR', 520, 200);
    const sum   = this.addGate('OUTPUT', 520, 80);
    const cout  = this.addGate('OUTPUT', 680, 200);
    this.connect(A.id, xor1.id, 0);
    this.connect(B.id, xor1.id, 1);
    this.connect(A.id, and1.id, 0);
    this.connect(B.id, and1.id, 1);
    this.connect(xor1.id, xor2.id, 0);
    this.connect(Cin.id, xor2.id, 1);
    this.connect(xor1.id, and2.id, 0);
    this.connect(Cin.id, and2.id, 1);
    this.connect(and1.id, or.id, 0);
    this.connect(and2.id, or.id, 1);
    this.connect(xor2.id, sum.id, 0);
    this.connect(or.id, cout.id, 0);
    return this;
  }
}

// ─── Digital Canvas Renderer ──────────────────────────────────────────────────

class DigitalCanvas {
  constructor(canvasId) {
    this.canvas = document.getElementById(canvasId);
    this.ctx = this.canvas.getContext('2d');
    this.sim = new DigitalLogicSim();
    this.selectedTool = 'AND';
    this.inputStates = {};
    this._setupEvents();
    this.draw();
  }

  setTool(tool) { this.selectedTool = tool; }

  _setupEvents() {
    this.canvas.addEventListener('click', (e) => {
      const rect = this.canvas.getBoundingClientRect();
      const x = Math.round((e.clientX - rect.left) / 20) * 20;
      const y = Math.round((e.clientY - rect.top)  / 20) * 20;
      // Toggle input state if clicking near an INPUT gate
      for (const gate of this.sim.gates.values()) {
        if (gate.type === 'INPUT') {
          if (Math.abs(x - gate.x) < 30 && Math.abs(y - gate.y) < 20) {
            this.inputStates[gate.id] = this.inputStates[gate.id] === 1 ? 0 : 1;
            this.runAndDraw();
            return;
          }
        }
      }
      // Place gate
      if (this.selectedTool) {
        this.sim.addGate(this.selectedTool, x, y);
        this.draw();
      }
    });
  }

  runAndDraw() {
    this.sim.evaluate(this.inputStates);
    this.draw();
  }

  draw() {
    const ctx = this.ctx;
    const w = this.canvas.width;
    const h = this.canvas.height;
    ctx.clearRect(0, 0, w, h);

    // Grid
    ctx.strokeStyle = '#1a1a3a';
    ctx.lineWidth = 0.5;
    for (let x = 0; x <= w; x += 20) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke();
    }
    for (let y = 0; y <= h; y += 20) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
    }

    // Draw wires
    for (const wire of this.sim.wires) {
      const from = this.sim.gates.get(wire.fromId);
      const to = this.sim.gates.get(wire.toId);
      if (!from || !to) continue;
      const fx = from.x + from.width;
      const fy = from.y;
      const tx = to.x;
      const ty = to.y - to.height / 4 + wire.inputIndex * (to.height / 2);
      const val = from.output;
      ctx.strokeStyle = val === 1 ? '#2aff6e' : val === 0 ? '#4fc3f7' : '#a0a0c0';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(fx, fy);
      ctx.bezierCurveTo(fx + 40, fy, tx - 40, ty, tx, ty);
      ctx.stroke();
    }

    // Draw gates
    for (const gate of this.sim.gates.values()) {
      this._drawGate(gate);
    }
  }

  _drawGate(gate) {
    const ctx = this.ctx;
    const { x, y, width, height, type, output } = gate;
    const colors = {
      AND: '#f5a623', OR: '#7ed321', NOT: '#e94560', NAND: '#bd10e0',
      NOR: '#4fc3f7', XOR: '#ff6b6b', XNOR: '#9b59b6',
      INPUT: '#2aff6e', OUTPUT: '#e94560', BUFFER: '#a0a0c0'
    };
    const fillColor = colors[type] || '#e0e0e0';

    ctx.fillStyle = output === 1 ? 'rgba(42,255,110,0.15)' : 'rgba(15,52,96,0.8)';
    ctx.strokeStyle = fillColor;
    ctx.lineWidth = 2;

    if (type === 'INPUT') {
      ctx.beginPath();
      ctx.ellipse(x, y, 28, 16, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      const stateVal = gate.output ?? 0;
      ctx.fillStyle = stateVal === 1 ? '#2aff6e' : '#e94560';
      ctx.font = 'bold 12px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(stateVal.toString(), x, y + 4);
      ctx.fillStyle = '#a0a0c0';
      ctx.font = '9px monospace';
      ctx.fillText(gate.id, x, y - 20);
      ctx.textAlign = 'left';
      return;
    }
    if (type === 'OUTPUT') {
      ctx.beginPath();
      ctx.ellipse(x, y, 28, 16, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      const outVal = gate.output ?? 0;
      ctx.fillStyle = outVal === 1 ? '#2aff6e' : '#e94560';
      ctx.font = 'bold 12px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(outVal.toString(), x, y + 4);
      ctx.fillStyle = '#a0a0c0';
      ctx.font = '9px monospace';
      ctx.fillText('OUT', x, y - 20);
      ctx.textAlign = 'left';
      return;
    }

    ctx.beginPath();
    ctx.roundRect(x - width / 2, y - height / 2, width, height, 6);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = fillColor;
    ctx.font = 'bold 11px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(type, x, y + 4);
    ctx.textAlign = 'left';
  }

  clear() {
    this.sim.clear();
    this.inputStates = {};
    this.draw();
  }

  loadHalfAdder() {
    this.sim.loadHalfAdder();
    // Set initial input states
    for (const id of this.sim.inputs) {
      this.inputStates[id] = 0;
    }
    this.runAndDraw();
  }

  generateTruthTable() {
    return this.sim.generateTruthTable();
  }
}

// Export
window.DigitalLogicSim = DigitalLogicSim;
window.DigitalCanvas = DigitalCanvas;
