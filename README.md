# QPoland 2026 — ERP production scheduling QUBO (runnable submission package)

**Status:** Two baseline instances and one rigorously verified Stage-2 extension are implemented. Demo video, public hosting, and live jury presentation must be completed externally by the submitting team.

## Run

### Quantum part

Requires [uv](https://docs.astral.sh/uv/) and Python 3.10+ (the `.python-version` selects Python 3.13 by default). `uv` installs NumPy and SciPy (including SciPy `optimize.milp` / HiGHS) into an isolated `.venv` using `pyproject.toml`. The first online sync also generates `uv.lock`. No cloud login, hardware, VeloxQ token, or Qiskit installation is needed.

```bash
# In the extracted project directory:
uv sync
uv run python run_demo.py
uv run python -m unittest discover -s tests -v
```

The first command creates `.venv/`, resolves the dependencies from `pyproject.toml`, generates `uv.lock`, and installs the packages. An internet connection is needed for the first sync unless the wheels are already cached. After the first successful sync, commit `uv.lock` for reproducibility.
If you later edit dependencies, run `uv lock` followed by `uv sync`.
To activate the environment for manual Python commands, use `source .venv/bin/activate` on macOS/Linux or `.venv\Scripts\activate` on Windows.

To install `uv` if needed, see the [official installation instructions](https://docs.astral.sh/uv/getting-started/installation/).

`uv run python run_demo.py --inputs inputs --output results` can be used to specify input/output directories. The inputs use the hackathon's JSON schema; the extension adds an `outages` array.

### Application part

To run the QUBO part in the web application view, make sure you have the node 20.9.0 or newer and npm of 10.1.0 or newer.

Steps of running the application locally:
1. Open one terminal tab
2. Type `uv run uvicorn api:app --reload`
3. Open the second terminal tab
4. Execute `cd webapp`
5. Run `npm install`
6. Run `npm run dev`
7. The application should be available at `http://localhost:5173/`

## Validated results

| Case | Method | Makespan | Status |
|---|---|---:|---|
| Instance A (2x2) | QAOA p=1, genuine NumPy 1-qubit state-vector simulation | **4 h** | Feasible, matches exhaustive reference |
| Instance B (3x3) | 39-bit time-indexed QUBO, exact classical HiGHS MILP linearization | **8 h** | Feasible, globally optimal |
| Stage 2: F machine unavailable during [2,4) | Time-indexed QUBO and integer-horizon feasibility search | **10 h** | Feasible, globally optimal on extended model |

Outputs (all auto-generated):

- `results/schedule_2x2.json` (mandatory)
- `results/schedule_3x3.json` (mandatory)
- `results/schedule_extension.json` (extension)
- `results/diagnostics.json` (parameters, QUBO objective, variable/coupling counts, exact solver status)

All operations have integer start/end hours from time 0; the validator checks durations, precedence, machine capacity, outage non-overlap, coverage and makespan.

## Implementation explained

**A:** The standard 2-machine makespan problem has a permutation optimum. Only two job orders exist. Let `x=0` mean Z2 -> Z1 and `x=1` mean Z1 -> Z2. The exact optimization QUBO is `E(x)=4+x` (no invalid binary states). The code constructs `exp(-i gamma E)` and `exp(-i beta X)` on an initialized `|+>` 1-qubit state vector, searches a parameter grid, and samples 1024 computational-basis outcomes with a fixed seed. This is a real quantum-algorithm simulation, but it is **a pedagogically small one-qubit problem**. It does *not* demonstrate an advantage over checking the two possibilities classically.

**B:** A binary `x[j,k,t]` says that operation `(job j, machine k)` starts at time `t`. Start-window pruning at horizon 8 reduces the input to 39 decision bits, from 72 unpruned slots. The nonnegative QUBO consists of exactly-one-start squares plus pairwise precedence and machine-overlap violation penalties. The exact classical solver minimizes this **actual QUBO**, by introducing continuous auxiliary variables for positive pairwise products and solving the resulting equivalent MILP with SciPy/HiGHS. A minimum QUBO energy of zero certifies feasible scheduling within `H`; the first feasible integer horizon starting from a valid lower bound is optimal.

**Stage 2:** A **pre-planned two-hour milling outage** `[2,4)` is introduced. No operation may intersect this unavailable interval; this is an invented, fully documented extension, *not* hackathon-supplied factory data. The identical time-indexed QUBO builder excludes start times crossing the outage. A sequence-independent exhaustive reference checks all 216 machine-order tuples and constructs earliest permissible starts. The exact QUBO returns energy 1 at horizons 8 and 9 (infeasible), zero at horizon 10 (feasible). Baseline B makespan increases from 8 to 10 hours under this outage.

At horizon `H=10`, the raw time-indexed model has 90 operation-start slots, standard job-window pruning leaves 57, and outage pruning leaves 50. The final extension QUBO has 277 nonzero quadratic couplings. **Auxiliary variables used internally by the MILP linearization are not QUBO variables.** See the diagnostics file for every horizon.

## Scope and cautions

1. The baseline is a nonpreemptive, deterministic flow shop: all jobs available at time zero; unlimited intermediate waiting; no unmodeled setup/transfer costs. All machines have capacity 1 and all jobs have the same machine route.
2. The time-indexed Stage-2 approach does **not** assume common machine permutations. This matters because a machine outage changes the scheduling environment and the permutation-dominance theorem should not be generalized blindly.
3. A zero-penalty QUBO at a **fixed** horizon is a feasibility certificate, not by itself a makespan-minimizing objective. Searching horizons starting at a proven lower bound is how this project recovers the optimal makespan.
4. HiGHS is a **classical** exact QUBO solver through a mathematically equivalent MILP; this is expressly allowed for Instance B. The extension is also classical. There are no claims of quantum speedup, NISQ performance, or hardware feasibility of a 39-qubit circuit.
5. Running a classical enumeration to compute A's one-bit QUBO coefficients makes it especially instructive but not scalable. The time-indexed builder is the more general representation shown in B and Stage 2.
6. This is a ready-to-publish **local project package**, not a remotely published Git repository. Recording/uploading a demo video and attending the live presentation require actions outside this runtime.

## Repo structure

```text
pyproject.toml             uv dependency declaration (`uv.lock` generated on first online sync)
.python-version            Python 3.13 selection (modifiable)
inputs/                 Provided baseline inputs + extended outage input
quantum_erp/model.py    Data model, bounds, independent schedule validator
quantum_erp/io.py       Read JSON, verify common machine route
quantum_erp/reference.py  Exact exhaustive machine-order reference
quantum_erp/qubo.py     Time-indexed quadratic penalties + certified exact QUBO solver
quantum_erp/qaoa.py     Genuine one-qubit p=1 QAOA state-vector simulation
run_demo.py             End-to-end runner
results/                Precomputed, independently validated JSON outputs
tests/                  Unittest regression and negative constraint tests
PROJECT_DESIGN.md       Detailed mathematical derivation and proof obligations
DEVELOPMENT_LOG.md      Dated AI-assisted implementation notes
DEMO_SCRIPT.md          Proposed 5-minute video + 3-minute live demo script
LICENSE                 MIT
```

## AI-use disclosure (required by hackathon)

This initial implementation, accompanying documentation, test cases and analysis were generated with AI assistance on 2026-10-16. Mathematical claims were checked using independent algorithmic cross-verification and tests; the team must inspect the code, run it, understand the derivations and take responsibility for the final submitted work. The code was not tested on external quantum hardware or VeloxQ.

## Relevant sources

- QPoland **Production Scheduling Optimization (ERP)** challenge PDF, particularly sections 2, 4, 5, 6, 8 and 14. The provided challenge data are reproduced under `inputs/`.
- Venturelli, Marchand, Rojo (2015), *Quantum Annealing Implementation of Job-Shop Scheduling*, https://arxiv.org/abs/1506.08479 (time-indexed QUBO and horizon strategy).
- Garey, Johnson, Sethi (1976), *The Complexity of Flowshop and Jobshop Scheduling*, https://doi.org/10.1287/moor.1.2.117 (classical complexity result).
- D-Wave documentation, *Binary Quadratic Models*, https://docs.dwavequantum.com/en/latest/concepts/models.html (QUBO definition and penalties).
- Farhi, Goldstone, Gutmann (2014), *A Quantum Approximate Optimization Algorithm*, https://arxiv.org/abs/1411.4028 (QAOA framework).

## Machine-readable QUBO coefficients

To reproduce or port the calculation into another QUBO backend, the runner also exports:

- `results/qubo_2x2.json` — one-bit optimization QUBO.
- `results/qubo_instance_3x3_H8.json` — 39-bit time-indexed feasibility QUBO.
- `results/qubo_extension_milling_outage_H10.json` — 50-bit outage QUBO.

Each includes the constant offset, every binary variable's meaning, all linear biases and all nonzero pairwise coefficients. In the latter two files the `quadratic` entries are `[index_i, index_j, coefficient]`. They are *real quadratic models*, not arbitrary matrices built after finding a schedule.

## VeloxQ Integration

The project supports three optimization backends:

1. QAOA: one-qubit quantum state-vector simulation.
2. SciPy/HiGHS: exact classical QUBO optimization.
3. VeloxQ: remote physics-inspired classical QUBO optimization.

VeloxQ is not physical quantum hardware.

### Installation

Run `uv sync` from the repository root.

### Authentication

Set the `VELOX_TOKEN` environment variable before starting Jupyter
or submitting remote jobs. Never commit API credentials.

### Jupyter experiments

Launch Jupyter using:

`uv run jupyter notebook --no-browser --ip=127.0.0.1 --port=8890`

Open `notebooks/veloxq_experiments.ipynb`.

The notebook includes SDK connectivity tests, binary-to-spin
verification, the 2x2 baseline, the 3x3 baseline, and the
milling-machine outage extension.

### Remote QUBO execution

- 2x2: `uv run python run_velox.py --case a`
- 3x3: `uv run python run_velox.py --case b`
- Outage: `uv run python run_velox.py --case outage`
- All: `uv run python run_velox.py --case all`

### QUBO formulation

At fixed horizon H, the QUBO penalizes violations of operation
uniqueness, technological precedence, and machine capacity.

A zero-energy assignment is a feasible schedule within H.

The dimod convention is `s = 2*x - 1`, with inverse `x = (s+1)/2`.

The adapter supports integer and string sample labels, and
recomputes original QUBO energies independently.

A positive heuristic energy does not prove infeasibility.

### Classical reference results

| Instance | Variables | Couplings | Makespan |
|---|---:|---:|---:|
| 2x2 | 8 | 12 | 4 hours |
| 3x3 | 39 | 181 | 8 hours |
| Milling outage | 50 | 277 | 10 hours |

These are independently checked classical results, not measured
VeloxQ success rates.

### Testing

Run `uv run python -m unittest discover -s tests -v`.

### Limitations

No physical quantum hardware execution or quantum advantage has
been demonstrated. The VeloxQ integration is a heuristic remote
backend; its returned schedules require independent validation.
