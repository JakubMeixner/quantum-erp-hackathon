# Demo video script (target: 4–5 minutes)

This is a storyboard only. **No demo video has been recorded or uploaded.**

**0:00–0:40 — Physics and factory interpretation.** Briefly present the three-machine T→F→S flow shop. Show `inputs/instance_3x3.json`. Explain exclusive machine occupancy, technological precedence and makespan.

**0:40–1:30 — Quantum algorithm for 2x2.** Show `quantum_erp/qaoa.py`. Explain both permutation orders and the exact QUBO `E(x)=4+x`; emphasize the actual `exp(-i gamma H_C)` and `exp(-i beta X)` state-vector calculation and measurement. Run `uv run python run_demo.py`. Show 4-hour feasible JSON. Explain why this tiny demonstration does not establish computational advantage.

**1:30–2:30 — 3x3 QUBO and exact classical solver.** Show `quantum_erp/qubo.py`, the `P_once`, `P_prec`, `P_machine` construction, start-window pruning and the exact positive-monomial QUBO linearization. Point to 39 bits, 181 couplings and zero QUBO energy at horizon eight. Show the 8-hour JSON and independent validator.

**2:30–3:40 — Own extension.** Show `inputs/extension_milling_outage.json`. Explain why machine F cannot process any interval that crosses `[2,4)`. Compare minimum QUBO energies at H8/H9/H10: 1/1/0; interpret this as 10-hour optimum and 2-hour increase. Explain 90 raw start slots, 57 after start-window pruning, 50 after outage pruning, 277 couplings. Show extended schedule JSON.

**3:40–4:30 — Reproducibility and conclusions.** Run `uv run python -m unittest discover -s tests -v`, show all tests passing, and highlight the independent exhaustive machine-order reference. State limits: small instances; no quantum advantage or measured scaling; exact classical solver for B and extension.

**4:30–5:00 — Close and point to sources.** Show `PROJECT_DESIGN.md`, `DEVELOPMENT_LOG.md`, and AI-use disclosure. Answer the most likely jury objection: why a zero-energy feasibility QUBO needs horizon search before you can claim makespan optimality.

# Live presentation plan (3 minutes + Q&A)

- 0:00–0:40: Factory and three constraints.
- 0:40–1:20: One-qubit quantum baseline A, 4h.
- 1:20–2:05: Exact time-indexed QUBO B, 39 bits, 8h.
- 2:05–2:45: Milling outage extension and mathematically certified 10h optimum.
- 2:45–3:00: Validation, reproducibility and limitations.

Suggested Q&A topics: the exactness of the QUBO-to-MILP reformulation; the difference between QUBO feasibility and makespan minimization; whether the outage preserves permutation dominance; why a QUBO bit count is not a hardware qubit count.
