# Development log — initial reproducible AI-assisted session

## 2026-10-16 — Problem definition

- Read the supplied `Quantum_Hackathon_2026_ERP_Challenge.pdf` and opening presentation.
- Identified the mandatory two baselines, their solver requirements and the need for a Stage-2 extension.
- Adopted a deterministic, integer-time, nonpreemptive flow-shop model. Explicitly documented assumptions not fully specified by the factory narrative.
- Rejected treating a fixed-horizon feasibility QUBO as a direct makespan objective; adopted an exact increasing-horizon feasibility search instead.

## 2026-10-16 — Baseline quantum model

- Chose a compact one-bit permutation QUBO for Instance A: `E(x)=4+x`.
- Implemented actual QAOA p=1 state-vector evolution (`exp(-i gamma H_C)` and `exp(-i beta X)`) and seeded computational-basis sampling.
- Explicitly classified the quantum demonstration as legitimate but computationally trivial; did not claim quantum speedup.

## 2026-10-16 — General QUBO formulation

- Implemented time-indexed operation-start bits with earliest/latest window pruning.
- Added exactly-one-start penalties, invalid technological-pair penalties, and machine-overlap penalties.
- Built an exact positive-pair QUBO-to-MILP linearization using SciPy/HiGHS; avoided presenting a plain MILP schedule solver as a QUBO solver.
- Verified that 3x3 at H=8 uses 39 start bits and 181 quadratic couplings. Exact QUBO optimum is zero.

## 2026-10-16 — Stage 2 extension and negative tests

- Selected a planned milling-machine downtime `[2,4)` as an explicitly hypothetical new factory requirement.
- Chose start-time exclusion rather than adding extra binary penalty variables for downtime.
- Ran exact QUBO models at horizons 8, 9 and 10; minimum energies were 1, 1 and 0. Therefore the extended optimum is 10 hours.
- Implemented an independent exhaustive machine-order reference for 3 jobs x 3 machines, covering all 216 machine-order tuples, not only common permutations.
- Added automatic infeasibility checks for overlapping operations and outage violations.
- Ran seven automated tests successfully and generated three valid schedule JSON files and detailed diagnostics.

## 2026-10-16 — uv environment migration
- Replaced `requirements.txt` installation workflow with `pyproject.toml`, `.python-version`, and `uv sync` / `uv run` commands.
- Created a local `.venv` with `uv`. The initial offline package did not contain a lockfile. The team subsequently resolved and committed `uv.lock`; the current repository uses `uv sync --locked`.
- Validated the code locally with `uv run --no-sync` and NumPy/SciPy already installed in the runner environment. Both baseline outputs and Stage 2 output reproduced; all seven unit tests passed. The initial offline check did not establish a fresh dependency install. Later local WSL sessions installed the full project environment.

## 2026-10-17 — VeloxQ integration and solver separation

- Added optional `veloxq-sdk==1.0.0` and `dimod`; kept the existing QAOA simulation and HiGHS optimizer as distinct, explicitly labeled methods. VeloxQ is a quantum-inspired *classical* remote solver, not a physical QPU.
- Implemented `quantum_erp/veloxq_backend.py`: convert the fixed-horizon BINARY QUBO to an equivalent SPIN BQM with `s=2x-1`; check sampled Ising/QUBO energies locally; normalize integer and string spin variable labels; and reject non-SPIN responses.
- Added `run_velox.py` for the 8-bit 2x2 *time-indexed* case, 39-bit 3x3 case and 50-bit milling-outage case, with post-solve schedule checks and classical-optimum comparison. This time-indexed 2x2 QUBO is not the one-bit QAOA permutation QUBO.
- Added `notebooks/veloxq_experiments.ipynb` for SDK connectivity, spin-convention checks, one-bit QUBO and all three scheduling QUBOs. Fixed notebook working-directory imports and spin decoding after local tests identified those problems.

## 2026-10-18 — Recorded remote VeloxQ experiments

- The saved notebook output records a successful official SDK connectivity test and successful remote solutions for the one-bit 2x2 demonstration and three time-indexed scheduling models.
- Notebook-observed results: 2x2 time-indexed H=4, locally recalculated energy 0 and validated makespan 4; 3x3 H=8, energy 0 and makespan 8 with 101 samples inspected; outage H=10, energy 0 and makespan 10 with 296 samples inspected. The single-bit test decoded the 4-hour optimum.
- These observations are evidence of the **saved execution**, not proof of repeatable success probability or speed. No systematic repeated trials, wall-clock benchmark or scaling study is supplied; no quantum speedup or quantum-hardware execution is claimed.
- Recalculation of QUBO energy and independent schedule validation are necessary because remote heuristic samples by themselves are not certificates of global optimality. Exact HiGHS and machine-order enumeration provide the reference optima for these small cases.

## 2026-10-18 — REST API, outage correctness and frontend integration

- Implemented and exercised the FastAPI `POST /solver` endpoint with canonical operation records and compact `jobs`/`machines`/`durations` JSON. Added strict handling of unknown outage machines, invalid time intervals, duplicates and overlapping outage windows (HTTP 422).
- Centralized non-preemptive machine availability in `Factory.operation_is_available()`; the time-indexed QUBO excludes starts crossing a fixed half-open unavailable interval, and the independent output validator rejects any remaining collision. The solver reruns schedule validation before returning a response.
- Reproduced a user-facing bug: the React form captured the outage but `toSolverPayload()` omitted `outages` from the HTTP request. Consequently the browser solved the *outage-free* 8-hour case while showing an F outage during [2,4).
- Fixed `webapp/src/solverApi.ts` to send `outages: input.outages ?? []`, without changing the QUBO penalty structure. Direct API calls with F downtime [2,4) then returned the validated 10-hour optimum. The corresponding outage-free case remained at 8 hours.
- Fixed `webapp/src/pages/Home.tsx` by removing unsupported Material UI `color="transparent"`; verified that the React/TypeScript/Vite production build passed under Linux-native Node.js after WSL accidentally invoked Windows npm in a temporary worktree.
- Merged backend corrections as [PR #2](https://github.com/JakubMeixner/quantum-erp-hackathon/pull/2) and the frontend transport/build fixes as [PR #3](https://github.com/JakubMeixner/quantum-erp-hackathon/pull/3). The project now has a public MIT-licensed GitHub repository.

## 2026-10-18 — Final reproducibility and regression audit

- Expanded the test suite from the initial seven cases to **16 offline tests**: benchmark optima, infeasible horizons, strict API input, outage boundary and collision counterexamples, QUBO pruning, Ising energy equivalence, and integer/string sample-label decoding.
- Replayed the tests against the uploaded project snapshot: all 16 passed. `run_demo.py` independently reproduced 4/8/10-hour reference makespans and exact outage QUBO energies 1, 1, 0 at H=8/9/10.
- Reviewed README commands, corrected the committed lockfile and public repository status, distinguished the local classical web solver from optional remote VeloxQ, and documented WSL Linux-native Node requirements.
- Remaining presentation deliverables: record and publish the demo video; perform the live jury defense; avoid treating notebook sample counts as runtime/scalability measurements. Repeat VeloxQ trials with measured latency and multiple problem sizes if claiming performance benefits.

## AI assistance and evidence standard

- AI assistance was used for code, tests, mathematical documentation, debugging and writing. Numerical conclusions are tied to exact solver outputs, independent enumeration, automated tests or clearly identified saved notebook outputs.
- Treat a **zero-energy exact solver optimum** as a fixed-horizon feasibility certificate. A heuristic zero-energy sample certifies feasibility only; a positive heuristic energy does not certify infeasibility. The project makes no quantum speedup claim.
