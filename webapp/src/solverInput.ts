import {
  JOBS,
  MACHINES,
  createEmptyValues,
  parseDuration,
  type FormValues,
  type Job,
  type Machine,
} from "./domain";

/**
 * Input generated from the form grid.
 *
 * Intermediate form built from the grid. It is converted to the repo's
 * `inputs/instance_*.json` format by `toSolverPayload` in solverApi.ts.
 */
export interface SolverInput {
  jobs: Job[];
  machines: Machine[];
  /** durations[job][machine], in whole hours. */
  durations: Record<Job, Record<Machine, number>>;
}

export type BuildResult =
  | { ok: true; input: SolverInput }
  | { ok: false; error: string };

/**
 * The solver in the repo works on positive integer durations, so anything
 * else is rejected with a message instead of being silently rounded.
 */
export function buildSolverInput(values: FormValues): BuildResult {
  const durations = {} as SolverInput["durations"];

  for (const job of JOBS) {
    durations[job] = {} as Record<Machine, number>;
    for (const machine of MACHINES) {
      const n = parseDuration(values[job][machine]);
      if (n === null || !Number.isInteger(n) || n < 1) {
        return {
          ok: false,
          error: `${job} on ${machine} must be a whole number of at least 1.`,
        };
      }
      durations[job][machine] = n;
    }
  }

  return {
    ok: true,
    input: { jobs: [...JOBS], machines: [...MACHINES], durations },
  };
}

export type ParseResult =
  | { ok: true; values: FormValues }
  | { ok: false; error: string };

const fail = (error: string): ParseResult => ({ ok: false, error });

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

/**
 * Reads the text of an uploaded file in the repo's input format
 * ({ problem, jobs: [{ id, operations: [{ machine, duration }] }] })
 * and returns the grid values. The file has to fit the grid exactly:
 * jobs Z1-Z3, each with one operation on T, F and S.
 */
export function parseSolverInputFile(text: string): ParseResult {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return fail("The file is not valid JSON.");
  }

  if (!isRecord(data) || !Array.isArray(data.jobs)) {
    return fail('The file must be a JSON object with a "jobs" array.');
  }
  if (data.problem !== undefined && data.problem !== "erp_scheduling") {
    return fail('"problem" must be "erp_scheduling".');
  }
  if (Array.isArray(data.outages) && data.outages.length > 0) {
    return fail("Inputs with outages cannot be shown in this form.");
  }
  if (data.jobs.length !== JOBS.length) {
    return fail(`The file must contain exactly ${JOBS.length} jobs: ${JOBS.join(", ")}.`);
  }

  const values = createEmptyValues();

  for (const job of JOBS) {
    const entry = data.jobs.find((j) => isRecord(j) && j.id === job);
    if (!isRecord(entry)) return fail(`Job ${job} is missing.`);

    const operations = entry.operations;
    if (!Array.isArray(operations) || operations.length !== MACHINES.length) {
      return fail(
        `Job ${job} must have exactly ${MACHINES.length} operations: ${MACHINES.join(", ")}.`,
      );
    }

    for (const machine of MACHINES) {
      const op = operations.find((o) => isRecord(o) && o.machine === machine);
      if (!isRecord(op)) return fail(`Job ${job} has no operation on ${machine}.`);

      const duration = op.duration;
      if (typeof duration !== "number" || !Number.isFinite(duration) || duration < 0) {
        return fail(`Duration of ${job} on ${machine} must be a non-negative number.`);
      }
      values[job][machine] = String(duration);
    }
  }

  return { ok: true, values };
}
