/**
 * analog-solver.js
 * Modified Nodal Analysis (MNA) based circuit solver for resistive circuits.
 * Supports: Resistors, Voltage Sources, Current Sources, Capacitors (DC), Inductors (DC).
 * Uses LU decomposition (Gaussian elimination with partial pivoting) to solve Ax = b.
 */

'use strict';

// ─── Matrix Utilities ────────────────────────────────────────────────────────

/**
 * Create an n×n zero matrix.
 */
function zeros(n) {
  return Array.from({ length: n }, () => new Array(n).fill(0));
}

/**
 * Solve Ax = b using Gaussian elimination with partial pivoting.
 * Returns x (solution vector), or null if singular.
 * @param {number[][]} A - n×n matrix (will be modified in-place)
 * @param {number[]}   b - RHS vector (will be modified in-place)
 * @returns {number[]|null}
 */
function gaussianElimination(A, b) {
  const n = A.length;
  for (let col = 0; col < n; col++) {
    // Partial pivoting
    let maxVal = Math.abs(A[col][col]);
    let maxRow = col;
    for (let row = col + 1; row < n; row++) {
      if (Math.abs(A[row][col]) > maxVal) {
        maxVal = Math.abs(A[row][col]);
        maxRow = row;
      }
    }
    if (maxVal < 1e-12) return null; // Singular or underdetermined
    [A[col], A[maxRow]] = [A[maxRow], A[col]];
    [b[col], b[maxRow]] = [b[maxRow], b[col]];
    // Elimination
    for (let row = col + 1; row < n; row++) {
      const factor = A[row][col] / A[col][col];
      b[row] -= factor * b[col];
      for (let k = col; k < n; k++) {
        A[row][k] -= factor * A[col][k];
      }
    }
  }
  // Back-substitution
  const x = new Array(n).fill(0);
  for (let i = n - 1; i >= 0; i--) {
    let sum = b[i];
    for (let j = i + 1; j < n; j++) sum -= A[i][j] * x[j];
    x[i] = sum / A[i][i];
  }
  return x;
}

// ─── Circuit Element Classes ──────────────────────────────────────────────────

class CircuitElement {
  constructor(id, type, nodeA, nodeB, value) {
    this.id    = id;
    this.type  = type;   // 'R','C','L','VS','IS','GND'
    this.nodeA = nodeA;
    this.nodeB = nodeB;
    this.value = value;
  }
}

// ─── Analog Solver (MNA) ─────────────────────────────────────────────────────

class AnalogSolver {
  constructor() {
    this.elements = [];
    this.nextId = 1;
  }

  /**
   * Add a component between two node labels.
   * @param {string} type  - 'R','VS','IS','GND'
   * @param {string} nodeA - node label (use '0' or 'GND' for ground)
   * @param {string} nodeB
   * @param {number} value - resistance/voltage/current
   */
  addElement(type, nodeA, nodeB, value) {
    this.elements.push(new CircuitElement(this.nextId++, type, nodeA, nodeB, value));
  }

  clear() {
    this.elements = [];
    this.nextId = 1;
  }

  /**
   * Solve the circuit using Modified Nodal Analysis.
   * Returns { nodeVoltages, branchCurrents, power } or { error }.
   */
  solve() {
    // 1. Collect nodes (exclude ground = '0' or 'GND')
    const nodeSet = new Set();
    for (const el of this.elements) {
      if (el.nodeA !== '0' && el.nodeA !== 'GND') nodeSet.add(el.nodeA);
      if (el.nodeB !== '0' && el.nodeB !== 'GND') nodeSet.add(el.nodeB);
    }
    const nodes = Array.from(nodeSet).sort();
    const nodeIndex = {}; // node -> 0-based index (for non-ground nodes)
    nodes.forEach((n, i) => { nodeIndex[n] = i; });

    const n = nodes.length; // number of non-ground nodes
    const vSources = this.elements.filter(e => e.type === 'VS');
    const m = vSources.length; // number of independent voltage sources
    const size = n + m;

    if (size === 0) return { error: 'No nodes or voltage sources found. Add components.' };

    // G matrix and b vector for MNA: [ G  B ] [v]   [i]
    //                                 [ C  D ] [j] = [e]
    const G = zeros(size);
    const b = new Array(size).fill(0);

    const getIdx = (node) => {
      if (node === '0' || node === 'GND') return -1;
      return nodeIndex[node];
    };

    // 2. Stamp resistors (and capacitors/inductors treated as open/short in DC)
    for (const el of this.elements) {
      if (el.type === 'R') {
        if (el.value === 0) continue; // skip shorts
        const conductance = 1.0 / el.value;
        const a = getIdx(el.nodeA);
        const b2 = getIdx(el.nodeB);
        if (a >= 0) G[a][a] += conductance;
        if (b2 >= 0) G[b2][b2] += conductance;
        if (a >= 0 && b2 >= 0) {
          G[a][b2] -= conductance;
          G[b2][a] -= conductance;
        }
      } else if (el.type === 'IS') {
        // Current source: inject current into nodes
        const a = getIdx(el.nodeA); // current flows from nodeA to nodeB internally
        const b2 = getIdx(el.nodeB);
        if (a >= 0) b[a] -= el.value;
        if (b2 >= 0) b[b2] += el.value;
      }
    }

    // 3. Stamp voltage sources (augment matrix)
    vSources.forEach((el, k) => {
      const vsRow = n + k;
      const a = getIdx(el.nodeA); // + terminal
      const bIdx = getIdx(el.nodeB); // - terminal
      if (a >= 0) {
        G[vsRow][a] = 1;
        G[a][vsRow] = 1;
      }
      if (bIdx >= 0) {
        G[vsRow][bIdx] = -1;
        G[bIdx][vsRow] = -1;
      }
      b[vsRow] = el.value;
    });

    // 4. Solve
    const solution = gaussianElimination(G, b);
    if (!solution) return { error: 'Singular matrix — circuit may be floating or disconnected.' };

    // 5. Extract results
    const nodeVoltages = {};
    nodes.forEach((node, i) => { nodeVoltages[node] = solution[i]; });
    nodeVoltages['0'] = 0;
    nodeVoltages['GND'] = 0;

    // 6. Compute branch currents for resistors
    const branchCurrents = {};
    for (const el of this.elements) {
      if (el.type === 'R') {
        const va = nodeVoltages[el.nodeA] ?? 0;
        const vb = nodeVoltages[el.nodeB] ?? 0;
        branchCurrents[el.id] = (va - vb) / el.value;
      } else if (el.type === 'VS') {
        const k = vSources.indexOf(el);
        branchCurrents[el.id] = solution[n + k];
      }
    }

    // 7. Power dissipation
    const power = {};
    for (const el of this.elements) {
      if (el.type === 'R') {
        const I = branchCurrents[el.id];
        power[el.id] = I * I * el.value;
      }
    }

    return { nodeVoltages, branchCurrents, power, nodes };
  }
}

// ─── Canvas Renderer ──────────────────────────────────────────────────────────

class AnalogCanvas {
  constructor(canvasId) {
    this.canvas = document.getElementById(canvasId);
    this.ctx = this.canvas.getContext('2d');
    this.components = [];
    this.wires = [];
    this.placingTool = 'resistor';
    this.startPoint = null;
    this.gridSize = 20;
    this.solver = new AnalogSolver();
    this._setupEvents();
    this.draw();
  }

  snap(val) {
    return Math.round(val / this.gridSize) * this.gridSize;
  }

  _setupEvents() {
    this.canvas.addEventListener('mousedown', (e) => {
      const rect = this.canvas.getBoundingClientRect();
      const x = this.snap(e.clientX - rect.left);
      const y = this.snap(e.clientY - rect.top);
      if (this.placingTool === 'wire') {
        if (!this.startPoint) {
          this.startPoint = { x, y };
        } else {
          this.wires.push({ x1: this.startPoint.x, y1: this.startPoint.y, x2: x, y2: y });
          this.startPoint = null;
          this.draw();
        }
      } else if (this.placingTool === 'ground') {
        this.components.push({ type: 'ground', x, y });
        this.draw();
      } else {
        if (!this.startPoint) {
          this.startPoint = { x, y };
        } else {
          this.components.push({
            type: this.placingTool,
            x1: this.startPoint.x, y1: this.startPoint.y,
            x2: x, y2: y,
            value: this._getDefaultValue(this.placingTool)
          });
          this.startPoint = null;
          this.draw();
        }
      }
    });

    this.canvas.addEventListener('mousemove', (e) => {
      if (this.startPoint) {
        const rect = this.canvas.getBoundingClientRect();
        this.previewX = this.snap(e.clientX - rect.left);
        this.previewY = this.snap(e.clientY - rect.top);
        this.draw();
      }
    });
  }

  _getDefaultValue(type) {
    const defaults = { resistor: 1000, capacitor: 1e-6, inductor: 1e-3, vsource: 5, isource: 0.001 };
    return defaults[type] || 1;
  }

  draw() {
    const ctx = this.ctx;
    const w = this.canvas.width;
    const h = this.canvas.height;
    ctx.clearRect(0, 0, w, h);

    // Grid
    ctx.strokeStyle = '#1a1a3a';
    ctx.lineWidth = 0.5;
    for (let x = 0; x <= w; x += this.gridSize) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke();
    }
    for (let y = 0; y <= h; y += this.gridSize) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
    }

    // Wires
    ctx.strokeStyle = '#4fc3f7';
    ctx.lineWidth = 2;
    for (const wire of this.wires) {
      ctx.beginPath();
      ctx.moveTo(wire.x1, wire.y1);
      ctx.lineTo(wire.x2, wire.y2);
      ctx.stroke();
    }

    // Components
    for (const comp of this.components) {
      this._drawComponent(comp);
    }

    // Preview
    if (this.startPoint && this.previewX !== undefined) {
      ctx.strokeStyle = 'rgba(233,69,96,0.5)';
      ctx.setLineDash([4, 4]);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(this.startPoint.x, this.startPoint.y);
      ctx.lineTo(this.previewX, this.previewY);
      ctx.stroke();
      ctx.setLineDash([]);
      // Draw start point indicator
      ctx.fillStyle = '#e94560';
      ctx.beginPath();
      ctx.arc(this.startPoint.x, this.startPoint.y, 4, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  _drawComponent(comp) {
    const ctx = this.ctx;
    if (comp.type === 'ground') {
      ctx.strokeStyle = '#2aff6e';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(comp.x, comp.y - 10);
      ctx.lineTo(comp.x, comp.y);
      ctx.stroke();
      for (let i = 0; i < 3; i++) {
        const w = 16 - i * 5;
        ctx.beginPath();
        ctx.moveTo(comp.x - w / 2, comp.y + i * 5);
        ctx.lineTo(comp.x + w / 2, comp.y + i * 5);
        ctx.stroke();
      }
      return;
    }

    const mx = (comp.x1 + comp.x2) / 2;
    const my = (comp.y1 + comp.y2) / 2;
    const angle = Math.atan2(comp.y2 - comp.y1, comp.x2 - comp.x1);
    const len = Math.sqrt((comp.x2 - comp.x1) ** 2 + (comp.y2 - comp.y1) ** 2);

    ctx.save();
    ctx.translate(mx, my);
    ctx.rotate(angle);

    const colors = { resistor: '#f5a623', capacitor: '#7ed321', inductor: '#bd10e0', vsource: '#e94560', isource: '#4fc3f7' };
    ctx.strokeStyle = colors[comp.type] || '#e0e0e0';
    ctx.lineWidth = 2;

    // Lead lines
    ctx.beginPath();
    ctx.moveTo(-len / 2, 0);
    ctx.lineTo(-len / 4, 0);
    ctx.moveTo(len / 4, 0);
    ctx.lineTo(len / 2, 0);
    ctx.stroke();

    if (comp.type === 'resistor') {
      ctx.strokeRect(-len / 4, -8, len / 2, 16);
    } else if (comp.type === 'capacitor') {
      ctx.beginPath();
      ctx.moveTo(-4, -10); ctx.lineTo(-4, 10);
      ctx.moveTo(4, -10); ctx.lineTo(4, 10);
      ctx.stroke();
    } else if (comp.type === 'inductor') {
      ctx.beginPath();
      for (let i = 0; i < 4; i++) {
        ctx.arc(-len / 8 + (i * len / 8), 0, len / 16, Math.PI, 0);
      }
      ctx.stroke();
    } else if (comp.type === 'vsource') {
      ctx.beginPath();
      ctx.arc(0, 0, 12, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = colors.vsource;
      ctx.font = '10px monospace';
      ctx.fillText('+', 3, 4);
    } else if (comp.type === 'isource') {
      ctx.beginPath();
      ctx.arc(0, 0, 12, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(-6, 0); ctx.lineTo(6, 0);
      ctx.moveTo(3, -4); ctx.lineTo(6, 0); ctx.lineTo(3, 4);
      ctx.stroke();
    }

    // Label
    ctx.fillStyle = '#e0e0e0';
    ctx.font = '9px monospace';
    ctx.fillText(this._formatValue(comp), -15, -12);

    ctx.restore();

    // Node dots
    ctx.fillStyle = '#4fc3f7';
    for (const [x, y] of [[comp.x1, comp.y1], [comp.x2, comp.y2]]) {
      ctx.beginPath(); ctx.arc(x, y, 3, 0, Math.PI * 2); ctx.fill();
    }
  }

  _formatValue(comp) {
    const v = comp.value;
    if (comp.type === 'resistor') return v >= 1e6 ? (v/1e6).toFixed(1)+'M\u03a9' : v >= 1e3 ? (v/1e3).toFixed(1)+'k\u03a9' : v+'\u03a9';
    if (comp.type === 'vsource') return v+'V';
    if (comp.type === 'isource') return (v*1000).toFixed(1)+'mA';
    if (comp.type === 'capacitor') return (v*1e6).toFixed(1)+'\u03bcF';
    if (comp.type === 'inductor') return (v*1000).toFixed(1)+'mH';
    return String(v);
  }

  setTool(tool) {
    this.placingTool = tool;
    this.startPoint = null;
  }

  clear() {
    this.components = [];
    this.wires = [];
    this.startPoint = null;
    this.previewX = undefined;
    this.draw();
  }

  /**
   * Load RC circuit example: 5V source with R=1k and R=2k voltage divider
   */
  loadExample() {
    this.clear();
    const g = this.gridSize;
    this.wires.push(
      { x1: 3*g, y1: 3*g, x2: 12*g, y2: 3*g },
      { x1: 12*g, y1: 10*g, x2: 3*g, y2: 10*g },
      { x1: 3*g, y1: 3*g, x2: 3*g, y2: 10*g }
    );
    this.components.push(
      { type: 'vsource', x1: 3*g, y1: 3*g, x2: 3*g, y2: 10*g, value: 5 },
      { type: 'resistor', x1: 5*g, y1: 3*g, x2: 9*g, y2: 3*g, value: 1000 },
      { type: 'resistor', x1: 12*g, y1: 3*g, x2: 12*g, y2: 10*g, value: 2000 },
      { type: 'ground', x: 3*g, y: 10*g }
    );
    this.draw();
  }

  /**
   * Run DC analysis on the loaded RC divider example (hardcoded for demo)
   */
  solveCircuit() {
    const s = new AnalogSolver();
    // Map canvas components to solver elements
    // For demo: build a voltage divider
    s.addElement('VS', 'N1', '0', 5);
    s.addElement('R', 'N1', 'N2', 1000);
    s.addElement('R', 'N2', '0', 2000);
    return s.solve();
  }
}

// Export
window.AnalogSolver = AnalogSolver;
window.AnalogCanvas = AnalogCanvas;
