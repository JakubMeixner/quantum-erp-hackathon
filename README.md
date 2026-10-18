# QPoland 2026 — ERP production scheduling QUBO (runnable submission package)

**Status:** Public MIT-licensed project with two baseline implementations, an outage-aware extension, a React/FastAPI demo, and an optional VeloxQ backend. The video and live jury presentation are separate deliverables.

## Quick start and reproducibility

**Requirements:** Python >=3.10, [uv](https://docs.astral.sh/uv/), and (for the web UI) Linux-native Node.js 22 with npm. On WSL, verify `node -p "process.platform"` returns `linux`; Windows npm cannot reliably build inside a Linux `/tmp` worktree. Run commands from the repository root unless stated otherwise. `uv.lock` and `webapp/package-lock.json` are committed for reproducibility.

### Python: QAOA simulation, exact QUBO solver, and tests

1. `uv sync --locked`
2. `uv run python run_demo.py`
3. `uv run python -m unittest discover -s tests -v`

`run_demo.py` writes the two baseline schedules, the outage schedule, diagnostics and machine-readable QUBO coefficients to `results/`. Change the destination using `--output <directory>` and the input directory using `--inputs <directory>`. These local calculations do **not** require a VeloxQ token.

### Web application: use two terminals

1. **Backend**, at repository root: `uv run uvicorn api:app --host 127.0.0.1 --port 8000`
2. **Frontend**, in a second terminal: `cd webapp && npm ci && npm run build && npm run dev`
3. Open <http://localhost:5173/>; API documentation is at <http://127.0.0.1:8000/docs>.

The frontend sends job durations and `outages` to `POST /solver`; the backend parses either the canonical `jobs[].operations[]` format or compact `jobs`/`machines`/`durations` format. Invalid outages receive HTTP 422. The response contains `instance`, `method`, `makespan` and `schedule`. The browser uses the **exact classical HiGHS** backend; it does not call VeloxQ.

To verify the outage independently, from the repository root with the backend running:

`curl --fail-with-body -sS -X POST http://127.0.0.1:8000/solver -H 'Content-Type: application/json' --data-binary @inputs/extension_milling_outage.json`

Expect `"makespan":10`; every operation on F must end at or before 2, or start at or after 4. Without the outage, the 3x3 instance has makespan 8.

### VeloxQ remote experiments (optional)

VeloxQ is a **physics-inspired classical remote QUBO optimizer**, not a physical QPU. Set the secret `VELOX_TOKEN` environment variable in the shell launching the process; never put tokens in source files or notebooks. Then run:

- `uv run python run_velox.py --case a` — 2x2 **time-indexed** QUBO (8 variables; distinct from the 1-bit QAOA demo).
- `uv run python run_velox.py --case b` — 3x3 QUBO (39 variables).
- `uv run python run_velox.py --case outage` — outage QUBO (50 variables).
- `uv run python run_velox.py --case all` — run all three remotely.

For the notebook, run `uv run jupyter notebook --no-browser --ip=127.0.0.1 --port=8890`, then open `notebooks/veloxq_experiments.ipynb`. The integration converts BINARY to SPIN with `s=2x-1` (and `x=(s+1)/2`), handles integer/string labels, recomputes original QUBO energy and validates any feasible schedule locally. A nonzero energy from a heuristic sample **does not prove infeasibility**. The CLI writes a `*_veloxq.json` schedule only after finding and validating a feasible candidate.

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
6. The public repository is [JakubMeixner/quantum-erp-hackathon](https://github.com/JakubMeixner/quantum-erp-hackathon). A recorded video and a live jury presentation remain separate deliverables; source code is not evidence that either has taken place.

## Repository guide

| Path | Purpose |
|---|---|
| `api.py`, `webapp/` | FastAPI `/solver` and React/MUI production-scheduling interface |
| `quantum_erp/io.py`, `model.py` | Strict JSON parsing, factory data, outage availability and schedule validation |
| `quantum_erp/qubo.py`, `reference.py` | Time-indexed QUBO, exact HiGHS optimization and independent enumeration |
| `quantum_erp/qaoa.py`, `run_demo.py` | One-qubit QAOA simulation and reproducible benchmark runner |
| `quantum_erp/veloxq_backend.py`, `run_velox.py` | Optional remote Ising/QUBO adapter and CLI |
| `notebooks/veloxq_experiments.ipynb` | Saved SDK experiments and their recorded outputs |
| `inputs/`, `results/` | Canonical factory cases, example schedules and QUBO coefficients |
| `tests/` | 16 offline automated regression tests (including outage and spin decoding) |
| `PROJECT_DESIGN.md`, `DEVELOPMENT_LOG.md`, `DEMO_SCRIPT.md` | Mathematics, engineering history and presentation plan |

## AI-use disclosure (required by hackathon)

This initial implementation, accompanying documentation, test cases and analysis were generated with AI assistance on 2026-10-16. Mathematical claims were checked using independent algorithmic cross-verification and tests; the team must inspect the code, run it, understand the derivations and take responsibility for the final submitted work. No physical quantum hardware was used. The notebook contains recorded VeloxQ remote-solver experiments, separately from the exact classical benchmarks.

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

## Remote VeloxQ results recorded in the notebook

The uploaded notebook contains one recorded successful execution of each scheduling model. This evidence is **not** a repeated-run benchmark, latency measurement or claim of scaling performance:

| Remote QUBO case | Bits / couplings | Recorded local energy | Recorded makespan | Samples inspected |
|---|---:|---:|---:|---:|
| Time-indexed 2x2 | 8 / 12 | 0 | 4 h | Not summarized here |
| Time-indexed 3x3 | 39 / 181 | 0 | 8 h | 101 |
| F outage [2,4) | 50 / 277 | 0 | 10 h | 296 |

An additional notebook cell tests the **one-bit** 2x2 QUBO separately. The saved remote responses are checked against the original QUBO and independently validated when a zero-energy schedule is found. The repository contains no systematic multi-seed, wall-clock or scaling comparison; such experiments must be run and reported separately.

## Outage constraint and API integration

An outage `[a,b)` blocks an uninterrupted operation `[t,t+p)` on its machine unless `t+p<=a` or `t>=b`. The same condition is used to exclude illegal QUBO start variables and to validate returned schedules. The frontend transport fix was merged in [PR #3](https://github.com/JakubMeixner/quantum-erp-hackathon/pull/3); the backend validation and input handling were merged in [PR #2](https://github.com/JakubMeixner/quantum-erp-hackathon/pull/2).

For the 3x3 example, outage-free optimum is 8 hours. The F outage `[2,4)` changes the optimum to 10 hours (+25%). Exact minimum QUBO energy is 1 at horizons 8 and 9, then 0 at horizon 10. This is an exact solver certificate for these specific small instances, not a quantum speedup claim.
