import {
  createEmptyValues,
  parseDuration,
  parseOutage,
  type FormValues,
  type Job,
  type Machine,
  type Outage,
  type OutageValues,
  type Variant,
} from "./domain";

/**
 * Input generated from the grid (only the cells of the chosen variant).
 * It is converted to the repo's `inputs/instance_*.json` format by
 * `toSolverPayload` in solverApi.ts.
 */
export interface SolverInput {
  jobs: Job[];
  machines: Machine[];
  /** durations[job][machine], in whole hours. */
  durations: Record<string, Record<string, number>>;
  /** Present only when the outage switch is on. */
  outages?: Outage[];
}

export type BuildResult =
  | { ok: true; input: SolverInput }
  | { ok: false; error: string };

/**
 * The solver in the repo works on positive integer durations, so anything
 * else is rejected with a message instead of being silently rounded.
 */
export function buildSolverInput(
  values: FormValues,
  variant: Variant,
  outageValues: OutageValues | null = null,
): BuildResult {
  const durations: SolverInput["durations"] = {};

  for (const job of variant.jobs) {
    durations[job] = {};
    for (const machine of variant.machines) {
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

  let outages: Outage[] | undefined;
  if (outageValues) {
    const outage = parseOutage(outageValues, variant);
    if (!outage) {
      return { ok: false, error: "The outage is incomplete or invalid." };
    }
    if (!Number.isInteger(outage.start) || !Number.isInteger(outage.end)) {
      return { ok: false, error: "Outage start and end must be whole numbers." };
    }
    outages = [outage];
  }

  return {
    ok: true,
    input: {
      jobs: [...variant.jobs],
      machines: [...variant.machines],
      durations,
      ...(outages ? { outages } : {}),
    },
  };
}

export type ParseResult =
  | { ok: true; values: FormValues; outage: OutageValues | null }
  | { ok: false; error: string };

const fail = (error: string): ParseResult => ({ ok: false, error });

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

/**
 * Reads the text of an uploaded file in the repo's input format
 * ({ problem, jobs: [{ id, operations: [{ machine, duration }] }] })
 * and returns the grid values. The file has to fit the chosen variant exactly,
 * e.g. for 3x3: jobs Z1-Z3, each with one operation on T, F and S.
 */
export function parseSolverInputFile(text: string, variant: Variant): ParseResult {
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
  if (data.jobs.length !== variant.jobs.length) {
    return fail(
      `For ${variant.name} the file must contain exactly ${variant.jobs.length} jobs: ${variant.jobs.join(", ")}.`,
    );
  }

  let outage: OutageValues | null = null;
  if (data.outages !== undefined) {
    if (!Array.isArray(data.outages)) return fail('"outages" must be an array.');
    if (data.outages.length > 1) {
      return fail("Only one outage is supported in this form.");
    }
    if (data.outages.length === 1) {
      const entry: unknown = data.outages[0];
      if (!isRecord(entry)) return fail("The outage entry is invalid.");
      if (
        typeof entry.machine !== "string" ||
        !variant.machines.some((m) => m === entry.machine)
      ) {
        return fail(`Outage machine must be one of: ${variant.machines.join(", ")}.`);
      }
      const candidate: OutageValues = {
        machine: entry.machine as Machine,
        start: String(entry.start),
        end: String(entry.end),
      };
      if (
        typeof entry.start !== "number" ||
        typeof entry.end !== "number" ||
        parseOutage(candidate, variant) === null
      ) {
        return fail(
          "Outage start and end must be numbers greater than zero, with start smaller than end.",
        );
      }
      outage = candidate;
    }
  }

  const values = createEmptyValues();

  for (const job of variant.jobs) {
    const entry = data.jobs.find((j) => isRecord(j) && j.id === job);
    if (!isRecord(entry)) return fail(`Job ${job} is missing.`);

    const operations = entry.operations;
    if (!Array.isArray(operations) || operations.length !== variant.machines.length) {
      return fail(
        `For ${variant.name}, job ${job} must have exactly ${variant.machines.length} operations: ${variant.machines.join(", ")}.`,
      );
    }

    for (const machine of variant.machines) {
      const op = operations.find((o) => isRecord(o) && o.machine === machine);
      if (!isRecord(op)) return fail(`Job ${job} has no operation on ${machine}.`);

      const duration = op.duration;
      if (typeof duration !== "number" || !Number.isFinite(duration) || duration < 0) {
        return fail(`Duration of ${job} on ${machine} must be a non-negative number.`);
      }
      values[job][machine] = String(duration);
    }
  }

  return { ok: true, values, outage };
}