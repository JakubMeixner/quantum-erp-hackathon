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

## Open tasks for a submitting team

- Set up and publish the required public MIT-licensed Git repository.
- Record an actual ≤5-minute screen-capture demo; `DEMO_SCRIPT.md` contains a suggested walkthrough but **is not a video**.
- Attend the live jury presentation and be prepared to defend why Instance A's one-qubit QAOA is genuine but does not scale.
- Optionally run on external quantum/hybrid hardware or VeloxQ and add independently measured runtimes, multiple seeds, and reproducible performance statistics. These optional experiments have **not** been performed.

## AI assistance disclosure

The initial source code, research framing, mathematical notes and test harness were produced with AI assistance. The results and exact solver statuses were verified locally by executing the code. The submitting team should personally rerun and review all claims.

## 2026-10-16 — uv environment migration
- Replaced `requirements.txt` installation workflow with `pyproject.toml`, `.python-version`, and `uv sync` / `uv run` commands.
- Created a local `.venv` with `uv`. The execution environment could not reach PyPI to resolve a universal `uv.lock`, so the archive deliberately does not contain a lockfile. An online `uv sync` will create it; teams should commit it after generation.
- Validated the code locally with `uv run --no-sync` and NumPy/SciPy already installed in the runner environment. Both baseline outputs and Stage 2 output reproduced; all seven unit tests passed. No claim is made that `uv sync` completed with a fresh dependency download in this offline environment.
