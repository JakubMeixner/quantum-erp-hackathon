# Project design: exact mathematical construction and verification

*2026-10-16. Based on the supplied 2026 ERP challenge, Sections 2, 4, 5, 8 and 14.*

## 1. Physical factory and formal optimization

Let `J={1,...,n}` and `M={1,...,m}`. Every job visits machines in the same order; operation `(j,k)` has a positive integer duration `p[j,k]`. Define integer start time `S[j,k]`, completion `C[j,k]=S[j,k]+p[j,k]` and `Cmax=max_j C[j,m]`.

Minimize `Cmax`, subject to:

- `S[j,k]>=0`;
- `S[j,k+1]>=S[j,k]+p[j,k]` (technological order);
- for distinct `i,j` on machine `k`, either `S[i,k]+p[i,k]<=S[j,k]` OR `S[j,k]+p[j,k]<=S[i,k]` (exclusive machine);
- `Cmax>=S[j,m]+p[j,m]`.

All operations are nonpreemptive. All jobs arrive at time 0. Waiting between operations is allowed, and there are no buffer limitations, transfer times or baseline setup times. The schedule uses half-open intervals `[start,end)` so a machine may start another job at the instant one job finishes.

**Stage 2:** The milling machine (`F`, index 1) is unavailable on `[2,4)`; each milling operation must satisfy `S[j,F]+p[j,F] <= 2 OR S[j,F] >= 4`. All other constraints remain identical. This is a deliberate modeling choice, not hackathon data.

## 2. Baseline A: direct 1-bit permutation QUBO and quantum algorithm

For two jobs, a permutation schedule is optimal under standard two-machine makespan flow-shop assumptions. For each common order `pi`, the earliest completion recurrence is

`D[r,k] = p[pi[r],k] + max(D[r-1,k], D[r,k-1])`,

with zero boundaries. The two orders have makespans:

- `pi=(Z2,Z1)` => 4 hours;
- `pi=(Z1,Z2)` => 5 hours.

Set binary `x=0` for the first order and `x=1` for the second. The complete 2x2 QUBO is **`E(x)=4+x`** (constant 4 and linear coefficient 1, no quadratic cross term because only one bit exists). Every binary outcome maps to a feasible schedule, so no feasibility penalties are needed.

Define `H_C=diag(4,5)` and `X=[[0,1],[1,0]]`. For p=1 QAOA, prepare `|+>=(|0>+|1>)/sqrt(2)` and compute

`|psi(beta,gamma)> = exp(-i beta X) exp(-i gamma H_C) |+>`.

The program evaluates the 2-element complex state vector directly, searches a deterministic grid of `gamma` and `beta`, and samples 1024 shots using seed 2026. The sample with highest count determines a decoded permutation; all resulting operations are separately validated. With this especially simple energy landscape, the grid includes parameters which prepare `|0>` with probability 1 (within floating-point tolerance). The software uses no Qiskit or external quantum service.

**Limitation:** the 1-bit QUBO coefficients were calculated using an exact classical recurrence, so the quantum execution is genuine but computationally trivial. This should not be described as a speedup.

## 3. Time-indexed QUBO for baseline B and extension

For candidate makespan bound `H`, define binary `x[j,k,t]=1` iff operation `(j,k)` starts at integer time `t`. Safe job-level start windows:

- earliest `E[j,k] = sum_{l<k}p[j,l]`;
- latest `L[j,k] = H - sum_{l>=k}p[j,l]`;
- admissible times `T[j,k]= {E[j,k],...,L[j,k]}` excluding any time `t` for which `[t,t+p[j,k])` intersects an outage interval on machine `k`.

If any window is empty, the candidate horizon is automatically infeasible.

Set

`P_once = sum_(j,k) (sum_{t in T[j,k]} x[j,k,t]-1)^2`.

For technological precedence, prohibit pair `(j,k,t)` and `(j,k+1,u)` whenever `u<t+p[j,k]`:

`P_prec = sum_{(j,k,t,u) forbidden} x[j,k,t] x[j,k+1,u]`.

For machine capacity, prohibit `(i,k,t)` and `(j,k,u)` for `i<j` whenever intervals `[t,t+p[i,k])` and `[u,u+p[j,k])` intersect:

`P_machine = sum_{(i,j,k,t,u) overlapping} x[i,k,t] x[j,k,u]`.

The genuine QUBO is

`E_H(x) = P_once + P_prec + P_machine`.

Because it is a sum of nonnegative integer penalties, `E_H(x)>=0` and **`E_H(x)=0` iff `x` decodes to a feasible schedule with makespan <= H**. There is no soft-versus-hard penalty ambiguity for this pure feasibility QUBO: zero is attainable precisely when all three constraint classes are satisfied. This is *not* a single-QUBO direct makespan objective. The program checks each integer horizon starting from a valid lower bound; the first horizon with global minimum zero equals the exact makespan optimum.

## 4. Bounds and completeness

The lower bound used is the maximum of three families:

1. maximum job processing total: `max_j sum_k p[j,k]`;
2. maximum machine processing total: `max_k sum_j p[j,k]`;
3. pipeline bound for each machine `k`:

`min_j sum_{l<k}p[j,l] + sum_j p[j,k] + min_j sum_{l>k}p[j,l]`.

The pipeline inequality follows from the first and last operation using machine `k`. The first must have completed its upstream processing; the machine must perform all assigned operations; the last must complete downstream processing. Taking independent minima can only weaken the bound, never invalidate it.

To ensure that a feasible horizon is reached, use upper bound `max_outage_end + sum_{j,k}p[j,k]`, corresponding to executing all operations sequentially after the last outage end. It is conservative but valid. Hence the finite integer-horizon search is complete.

## 5. QUBO size and exact numerical result

| Model at examined H | H | Raw `nmH` | After job start-window pruning | After outage pruning | Nonzero quadratic couplings | Minimum QUBO energy |
|---|---:|---:|---:|---:|---:|---:|
| Baseline B | 8 | 72 | 39 | 39 | 181 | 0 |
| Stage 2 with F outage | 8 | 72 | 39 | 32 | 122 | 1 |
| Stage 2 with F outage | 9 | 81 | 48 | 41 | 192 | 1 |
| Stage 2 with F outage | 10 | 90 | 57 | 50 | 277 | 0 |

For any job `j`, the number of window-pruned times for each operation is `H - sum_k p[j,k] + 1`. At H=8, baseline B has `3*(8-5+1)+3*(8-4+1)+3*(8-5+1)=39` start variables. At H=10, there are 57 before outage pruning and 50 after. The extension adds machine-unavailability constraints but can eliminate impossible start times before constructing quadratic penalties.

The quadratic coupling count is the number of unique nonzero pairs *after* aggregating one-hot, precedence and machine conflicts; the counts are empirical outputs from the supplied code. A QUBO variable is not the same as an auxiliary MILP linearization variable or physical hardware qubit.

## 6. Exact QUBO solver proof

Our QUBO has the form

`E(x)=c + sum_i a_i*x_i + sum_{i<j} q_ij*x_i*x_j`,

with every nonzero `q_ij>0` and binary `x_i`. For each positive quadratic pair, introduce a *continuous* auxiliary `y_ij in [0,1]` and impose `x_i+x_j-y_ij<=1`. Optimize the linear objective

`c + sum_i a_i*x_i + sum_(i,j) q_ij*y_ij`.

For fixed binary `x`, minimizing a positive `q_ij*y_ij` forces `y_ij = max(0,x_i+x_j-1)=x_i*x_j`. Thus the auxiliary MILP is **exactly equivalent** to the QUBO. All `x_i` remain integer; `y_ij` can be continuous. SciPy/HiGHS returns an optimal branch-and-bound status and zero MIP gap on these cases. The code re-evaluates the original quadratic energy to verify equality with the optimized linear objective. This is a valid **classical QUBO solver**, not a simulated quantum QUBO algorithm.

## 7. Independent reference and feasibility checks

The reference algorithm enumerates up to `(n!)**m` tuples of machine-specific orders (216 for 3 jobs and 3 machines), constructs a directed acyclic precedence graph consisting of technological and adjacent same-machine arcs, and computes earliest permissible starts by topological traversal. Each operation start is the latest predecessor completion, shifted past the outage if processing would intersect downtime. The method does not reuse the QUBO variables or energy, so it provides an independent implementation check. A common permutation is not assumed for the extended model.

The post-hoc validator independently checks operation multiplicity, known processing times, precedence, machine-exclusive intervals, unavailable intervals and reported makespan. Unit tests include invalid overlap and invalid outage counterexamples. Sixteen offline tests pass in the audited repository, covering the original scheduling assertions, API outages, SPIN energy equivalence, and sample-label decoding.

Baseline A lower bound 4 and reference 4. Baseline B lower bound 8 and reference 8. For the outage extension, exact QUBO infeasibility at H=8 and H=9 and feasibility at H=10 prove the optimum 10; independent enumeration confirms it.

## 8. Interpretation and limitations

- Completion time deterioration due to the hypothetical outage: `10-8=2` hours, or `(10-8)/8=25%` relative to baseline. This is **not** a measured industrial efficiency effect.
- The Stage-2 experiment is small and deterministic. It does not establish solver scalability, noise robustness, cost effectiveness or quantum advantage.
- A time-indexed `H` must be specified: variable counts grow with it. Fewer QUBO bits do not imply fewer physical qubits or lower overall runtime.
- A fixed-horizon QUBO with zero minimum energy is a certificate of feasibility, *not* an optimization objective on its own.
- For larger instances, enumerating `(n!)**m` machine order tuples is computationally impractical; it is used only as a small-case independent reference.
- Outage times and durations must be known before planning; random outages and dynamic replanning would require a separate problem formulation.

## Sources

1. Hackathon 2026 ERP Challenge, supplied PDF, pp. 1–7: specific instance data, baseline requirements, Stage-2 extension rules, output schema and evaluation criteria.
2. Venturelli, Marchand and Rojo (2015), [*Quantum Annealing Implementation of Job-Shop Scheduling*](https://arxiv.org/abs/1506.08479), time-indexed binary formulation, pruning and horizon strategy.
3. Garey, Johnson and Sethi (1976), [*The Complexity of Flowshop and Jobshop Scheduling*](https://doi.org/10.1287/moor.1.2.117), formal computational complexity of larger flow shops.
4. Farhi, Goldstone and Gutmann (2014), [*A Quantum Approximate Optimization Algorithm*](https://arxiv.org/abs/1411.4028), p-layer cost and mixer unitaries.
5. D-Wave, [*Binary Quadratic Models*](https://docs.dwavequantum.com/en/latest/concepts/models.html), definitions of QUBO and Ising models.

No performance claim in this project relies on the above papers: the stated makespans, energies, variable counts and tests are reproducible by the supplied code.

## 9. Integration and experimental traceability (2026-10-18)

The FastAPI `/solver` endpoint accepts both the original challenge format and the compact frontend format, including an optional `outages` array. Invalid outage data is rejected before optimization. The React UI forwards this array to the exact classical HiGHS solver. This is separate from the remote VeloxQ CLI and notebook.

The VeloxQ adapter uses the `dimod` convention `s=2x-1`, `x=(s+1)/2`. It converts the original BINARY QUBO to SPIN and recomputes each returned sample's energy in the original model, supporting integer or string variable labels. Notebook-saved outputs report zero-energy candidates for the time-indexed 2x2, 3x3 and outage QUBOs and validated makespans of 4, 8 and 10 hours. The results are single saved experiments, not statistical comparisons of latency or scaling. VeloxQ is a quantum-inspired classical backend; no physical QPU was used.
