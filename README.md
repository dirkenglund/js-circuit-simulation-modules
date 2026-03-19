# JS Circuit Simulation Modules

> **Interactive browser-based circuit simulation in pure JavaScript** — analog, digital logic, and quantum circuits in one app.

[![MIT License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![JavaScript](https://img.shields.io/badge/language-JavaScript-yellow.svg)]()
[![No Dependencies](https://img.shields.io/badge/dependencies-none-green.svg)]()

## Overview

This project implements three types of circuit simulators that run entirely in the browser with no external dependencies:

| Module | File | Description |
|--------|------|-------------|
| **Analog** | `src/analog-solver.js` | Modified Nodal Analysis (MNA) solver for resistive DC circuits |
| **Digital** | `src/digital-logic.js` | Boolean logic gate simulator with truth table generation |
| **Quantum** | `src/quantum-circuit.js` | Statevector quantum circuit simulator (up to 8 qubits) |
| **UI** | `src/ui-controller.js` | Main controller integrating all three modules |

## Features

### ⚡ Analog Circuit Simulator
- **Modified Nodal Analysis (MNA)** for accurate DC operating point analysis
- Supports: Resistors, Voltage Sources, Current Sources, Capacitors (DC), Inductors (DC)
- **Gaussian elimination** with partial pivoting for solving the linear system
- Interactive canvas for placing and wiring components
- Displays node voltages, branch currents, and power dissipation
- Built-in RC voltage divider example

### 🔲 Digital Logic Simulator
- 7 gate types: AND, OR, NOT, NAND, NOR, XOR, XNOR
- Automatic **truth table generation** for any combinational circuit
- Pre-built examples: Half-Adder, Full-Adder
- Interactive canvas with real-time logic state display
- Click INPUT gates to toggle their state

### 🔮 Quantum Circuit Simulator
- **Statevector simulation** with complex number amplitudes
- Single-qubit gates: H, X (NOT), Y, Z, T (π/8), S (phase)
- Two-qubit gate: CNOT (controlled-NOT)
- Measurement simulation with probability histograms
- Grid-based circuit editor (qubits × time steps)
- Pre-loaded circuits: Bell State, GHZ State, Grover's Algorithm (2-qubit)
- Supports up to 8 qubits (256 basis states)

## Getting Started

### Option 1: Open Directly (No Server Required)
```bash
git clone https://github.com/dirkenglund/js-circuit-simulation-modules.git
cd js-circuit-simulation-modules
open index.html  # or double-click index.html
```

### Option 2: Local Server
```bash
# Python 3
python -m http.server 8080
# Then open: http://localhost:8080
```

## Project Structure
```
js-circuit-simulation-modules/
├── index.html              # Main application UI (3-tab interface)
├── src/
│   ├── analog-solver.js    # MNA circuit solver + canvas renderer
│   ├── digital-logic.js    # Boolean gate simulator + truth tables
│   ├── quantum-circuit.js  # Quantum statevector simulator + grid UI
│   └── ui-controller.js    # Tab/tool/results controller
├── LICENSE                 # MIT
└── README.md
```

## Technical Details

### Analog Solver (MNA)

The Modified Nodal Analysis approach builds a conductance matrix G and solves:

```
G × x = b

where:
  G = [conductance matrix (G) | branch connectivity (B)]
      [branch connectivity (C) | voltage source matrix (D)]
  x = [node voltages; branch currents for voltage sources]
  b = [current source injections; voltage source values]
```

The system is solved using Gaussian elimination with partial pivoting.

### Quantum Simulator

The quantum simulator uses a statevector representation. For `n` qubits, the state is a vector of `2^n` complex amplitudes. Each gate is applied as a unitary matrix transformation:

- Single-qubit gates: iterate over pairs of basis states differing only in the target qubit
- CNOT gate: swap amplitudes of states where control=1

The Hadamard gate creates superpositions; CNOT entangles qubits to produce Bell states and GHZ states.

## Inspiration & References

This project draws inspiration from:
- **[CircuitJS1](https://github.com/sharpie7/circuitjs1)** — Paul Falstad's browser circuit simulator (Java→JS via GWT)
- **[CircuitVerse](https://github.com/CircuitVerse/CircuitVerse)** — Digital logic education platform
- **[quantastica/quantum-circuit](https://github.com/quantastica/quantum-circuit)** — JS quantum circuit simulator
- **MIT cktsim.js** — Analog circuit solver developed for MIT OpenCourseWare
- **[emilamaj/js-circuit-solver](https://github.com/emilamaj/js-circuit-solver)** — Lightweight resistive circuit solver

## License

[MIT License](LICENSE) — Copyright (c) 2026 Dirk Englund
