/**
 * quantum-circuit.js
 * Quantum circuit simulator using complex number statevector simulation.
 * Supports: H, X, Y, Z, T, S gates (1-qubit) and CNOT (2-qubit controlled).
 * Simulates up to ~8 qubits (256 states) efficiently in the browser.
 */

'use strict';

// ─── Complex Number Math ──────────────────────────────────────────────────────

class Complex {
  constructor(re = 0, im = 0) {
    this.re = re;
    this.im = im;
  }
  add(c)  { return new Complex(this.re + c.re, this.im + c.im); }
  mul(c)  { return new Complex(this.re*c.re - this.im*c.im, this.re*c.im + this.im*c.re); }
  scale(s){ return new Complex(this.re * s, this.im * s); }
  abs2()  { return this.re*this.re + this.im*this.im; }
  abs()   { return Math.sqrt(this.abs2()); }
  conj()  { return new Complex(this.re, -this.im); }
  toString() {
    const r = this.re.toFixed(4), i = Math.abs(this.im).toFixed(4);
    if (Math.abs(this.im) < 1e-6) return r;
    return this.im >= 0 ? r + '+' + i + 'i' : r + '-' + i + 'i';
  }
}

const C = (re, im = 0) => new Complex(re, im);
const SQRT2_INV = 1 / Math.sqrt(2);

// ─── Gate Matrices (2×2 unitary) ─────────────────────────────────────────────

const GateMatrices = {
  H: [
    [C(SQRT2_INV), C(SQRT2_INV)],
    [C(SQRT2_INV), C(-SQRT2_INV)]
  ],
  X: [ [C(0), C(1)], [C(1), C(0)] ],
  Y: [ [C(0), C(0,-1)], [C(0,1), C(0)] ],
  Z: [ [C(1), C(0)],  [C(0), C(-1)) ] ],
  T: [ [C(1), C(0)],  [C(0), C(SQRT2_INV, SQRT2_INV)] ],
  S: [ [C(1), C(0)],  [C(0), C(0,1)] ],
  I: [ [C(1), C(0)],  [C(0), C(1)] ],   // Identity
};

// Fix typo in Z matrix
GateMatrices.Z = [ [C(1), C(0)], [C(0), C(-1)) ] ];
GateMatrices.Z = [ [C(1,0), C(0,0)], [C(0,0), C(-1,0)] ];

// ─── Quantum Statevector Simulator ───────────────────────────────────────────

class QuantumCircuit {
  /**
   * @param {number} numQubits - number of qubits (1-8)
   */
  constructor(numQubits) {
    this.numQubits = numQubits;
    this.numStates = 1 << numQubits; // 2^n
    this.circuit   = [];  // array of { type, qubit[, control] }
    this.statevector = this._initState();
  }

  /** Initialize |0...0> state */
  _initState() {
    const sv = Array.from({ length: this.numStates }, () => C(0));
    sv[0] = C(1);
    return sv;
  }

  reset() {
    this.statevector = this._initState();
    this.circuit = [];
  }

  /**
   * Add a single-qubit gate.
   * @param {string} type  - gate name (H, X, Y, Z, T, S)
   * @param {number} qubit - qubit index (0 = top qubit)
   */
  addGate(type, qubit) {
    if (qubit < 0 || qubit >= this.numQubits) return;
    this.circuit.push({ type, qubit });
  }

  /**
   * Add a CNOT gate.
   * @param {number} control - control qubit
   * @param {number} target  - target qubit
   */
  addCNOT(control, target) {
    if (control === target) return;
    this.circuit.push({ type: 'CNOT', qubit: target, control });
  }

  /**
   * Apply a single-qubit gate matrix to the statevector.
   * @param {Complex[][]} U - 2×2 unitary matrix
   * @param {number} q      - qubit index
   */
  _applySingleQubit(U, q) {
    const sv = this.statevector;
    const n  = this.numQubits;
    // Iterate over all basis states, pair up |0> and |1> for qubit q
    for (let i = 0; i < this.numStates; i++) {
      // Only process pairs where qubit q bit is 0
      if ((i >> (n - 1 - q)) & 1) continue;
      const j = i | (1 << (n - 1 - q)); // flip qubit q bit
      const a = sv[i];
      const b = sv[j];
      sv[i] = U[0][0].mul(a).add(U[0][1].mul(b));
      sv[j] = U[1][0].mul(a).add(U[1][1].mul(b));
    }
  }

  /**
   * Apply CNOT gate.
   */
  _applyCNOT(control, target) {
    const sv = this.statevector;
    const n  = this.numQubits;
    for (let i = 0; i < this.numStates; i++) {
      // Only process when control qubit is |1> and target qubit is |0>
      const cBit = (i >> (n - 1 - control)) & 1;
      const tBit = (i >> (n - 1 - target)) & 1;
      if (cBit === 1 && tBit === 0) {
        const j = i ^ (1 << (n - 1 - target)); // flip target
        [sv[i], sv[j]] = [sv[j], sv[i]]; // swap amplitudes
      }
    }
  }

  /**
   * Run the circuit and return the resulting statevector.
   */
  run() {
    this.statevector = this._initState();
    for (const op of this.circuit) {
      if (op.type === 'CNOT') {
        this._applyCNOT(op.control, op.qubit);
      } else {
        const U = GateMatrices[op.type];
        if (U) this._applySingleQubit(U, op.qubit);
      }
    }
    return this.statevector;
  }

  /**
   * Get measurement probabilities for each basis state.
   * @returns {Object[]} array of { state, binary, probability }
   */
  getMeasurementProbabilities() {
    const probs = [];
    for (let i = 0; i < this.numStates; i++) {
      const prob = this.statevector[i].abs2();
      if (prob > 1e-8) {
        probs.push({
          state: i,
          binary: i.toString(2).padStart(this.numQubits, '0'),
          probability: prob,
          amplitude: this.statevector[i].toString()
        });
      }
    }
    return probs.sort((a, b) => b.probability - a.probability);
  }

  /**
   * Simulate one measurement shot. Returns collapsed basis state index.
   */
  measure() {
    const r = Math.random();
    let cumulative = 0;
    for (let i = 0; i < this.numStates; i++) {
      cumulative += this.statevector[i].abs2();
      if (r <= cumulative) return i;
    }
    return this.numStates - 1;
  }

  /**
   * Run multiple measurement shots and return histogram.
   */
  measureMultiple(shots = 1000) {
    const counts = new Array(this.numStates).fill(0);
    for (let s = 0; s < shots; s++) counts[this.measure()]++;
    return counts.map((c, i) => ({
      state: i,
      binary: i.toString(2).padStart(this.numQubits, '0'),
      count: c,
      probability: c / shots
    }));
  }

  /**
   * Load Bell State circuit: H on qubit 0, then CNOT(0,1)
   */
  static bellState(numQubits = 2) {
    const qc = new QuantumCircuit(Math.max(numQubits, 2));
    qc.addGate('H', 0);
    qc.addCNOT(0, 1);
    return qc;
  }

  /**
   * Load GHZ State: H on qubit 0, CNOT(0,1), CNOT(0,2)
   */
  static ghzState(numQubits = 3) {
    const qc = new QuantumCircuit(Math.max(numQubits, 3));
    qc.addGate('H', 0);
    qc.addCNOT(0, 1);
    qc.addCNOT(0, 2);
    return qc;
  }

  /**
   * 2-qubit Grover search (searches for |11>)
   */
  static grover2() {
    const qc = new QuantumCircuit(2);
    // Initialize uniform superposition
    qc.addGate('H', 0);
    qc.addGate('H', 1);
    // Oracle for |11>: Z on both qubits (simplified)
    qc.addGate('Z', 0);
    qc.addGate('Z', 1);
    qc.addCNOT(0, 1);
    // Diffusion operator
    qc.addGate('H', 0);
    qc.addGate('H', 1);
    qc.addGate('X', 0);
    qc.addGate('X', 1);
    qc.addCNOT(0, 1);
    qc.addGate('X', 0);
    qc.addGate('X', 1);
    qc.addGate('H', 0);
    qc.addGate('H', 1);
    return qc;
  }
}

// ─── Quantum Circuit Grid UI ──────────────────────────────────────────────────

class QuantumCircuitUI {
  constructor(containerId, numQubits = 3, numSteps = 8) {
    this.container = document.getElementById(containerId);
    this.numQubits = numQubits;
    this.numSteps  = numSteps;
    this.grid      = [];  // grid[qubit][step] = gate type or null
    this.selectedGate = 'H';
    this._initGrid();
    this._render();
  }

  _initGrid() {
    this.grid = Array.from({ length: this.numQubits }, () =>
      new Array(this.numSteps).fill(null)
    );
  }

  setGate(gate) { this.selectedGate = gate; }

  resize(numQubits, numSteps) {
    this.numQubits = numQubits;
    this.numSteps  = numSteps;
    this._initGrid();
    this._render();
  }

  _render() {
    if (!this.container) return;
    const html = [];
    html.push('<div class="quantum-grid">');
    for (let q = 0; q < this.numQubits; q++) {
      // Qubit label
      html.push('<div class="q-label">|q' + q + '⟩</div>');
      for (let s = 0; s < this.numSteps; s++) {
        const gate = this.grid[q][s];
        const cls = gate ? 'q-cell ' + gate : 'q-cell';
        html.push('<div class="' + cls + '" data-qubit="' + q + '" data-step="' + s + '">' +
          (gate || '') + '</div>');
      }
    }
    html.push('</div>');
    this.container.innerHTML = html.join('');
    // Add click handlers
    this.container.querySelectorAll('.q-cell').forEach(cell => {
      cell.addEventListener('click', () => {
        const q = parseInt(cell.dataset.qubit);
        const s = parseInt(cell.dataset.step);
        if (this.grid[q][s] === this.selectedGate) {
          this.grid[q][s] = null;
        } else {
          this.grid[q][s] = this.selectedGate;
        }
        this._render();
      });
    });
  }

  clear() {
    this._initGrid();
    this._render();
  }

  /**
   * Build and run the QuantumCircuit from the grid layout.
   */
  run() {
    const qc = new QuantumCircuit(this.numQubits);
    for (let s = 0; s < this.numSteps; s++) {
      for (let q = 0; q < this.numQubits; q++) {
        const gate = this.grid[q][s];
        if (!gate) continue;
        if (gate === 'CNOT') {
          // Look for control in the same step
          const controlQ = q > 0 ? q - 1 : q + 1;
          qc.addCNOT(controlQ, q);
        } else if (gate !== 'measure') {
          qc.addGate(gate, q);
        }
      }
    }
    qc.run();
    return qc;
  }

  /**
   * Load Bell State example into grid
   */
  loadBellState() {
    this._initGrid();
    if (this.numQubits >= 2) {
      this.grid[0][0] = 'H';
      this.grid[1][1] = 'CNOT';
    }
    this._render();
  }

  /**
   * Load Grover 2-qubit example
   */
  loadGrover() {
    this._initGrid();
    if (this.numQubits >= 2) {
      this.grid[0][0] = 'H';
      this.grid[1][0] = 'H';
      this.grid[0][1] = 'Z';
      this.grid[1][1] = 'Z';
      this.grid[1][2] = 'CNOT';
      this.grid[0][3] = 'H';
      this.grid[1][3] = 'H';
      this.grid[0][4] = 'X';
      this.grid[1][4] = 'X';
      this.grid[1][5] = 'CNOT';
      this.grid[0][6] = 'X';
      this.grid[1][6] = 'X';
      this.grid[0][7] = 'H';
    }
    this._render();
  }
}

// Export
window.QuantumCircuit = QuantumCircuit;
window.QuantumCircuitUI = QuantumCircuitUI;
window.Complex = Complex;
