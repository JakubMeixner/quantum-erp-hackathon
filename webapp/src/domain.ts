export const ALL_JOBS = ["Z1", "Z2", "Z3"] as const;
export const ALL_MACHINES = ["T", "F", "S"] as const;

export type Job = (typeof ALL_JOBS)[number];
export type Machine = (typeof ALL_MACHINES)[number];

/** Which part of the full 3x3 grid is in use. */
export interface Variant {
  name: string;
  jobs: readonly Job[];
  machines: readonly Machine[];
}

export const VARIANT_3X3: Variant = {
  name: "3x3",
  jobs: ALL_JOBS,
  machines: ALL_MACHINES,
};

export const VARIANT_2X2: Variant = {
  name: "2x2",
  jobs: ["Z1", "Z2"],
  machines: ["T", "F"],
};

/**
 * Raw input strings, one per cell of the full 3x3 grid: values[job][machine].
 * The state always holds all 9 cells, so switching to 2x2 and back keeps them.
 */
export type FormValues = Record<Job, Record<Machine, string>>;

export const createEmptyValues = (): FormValues =>
  Object.fromEntries(
    ALL_JOBS.map((j) => [j, Object.fromEntries(ALL_MACHINES.map((m) => [m, ""]))]),
  ) as FormValues;

/** Returns the number, or null when the cell is empty, not a number or negative. */
export const parseDuration = (value: string): number | null => {
  if (value.trim() === "") return null;
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? n : null;
};

export const isValid = (value: string): boolean => parseDuration(value) !== null;

/** Outage inputs as typed by the user. */
export interface OutageValues {
  machine: Machine | "";
  start: string;
  end: string;
}

export const createEmptyOutage = (): OutageValues => ({
  machine: "",
  start: "",
  end: "",
});

/** An outage as sent to the backend: machine unavailable in [start, end). */
export interface Outage {
  machine: Machine;
  start: number;
  end: number;
}

/** Returns the number, or null when the text is empty, not a number or not greater than zero. */
export const parsePositiveNumber = (value: string): number | null => {
  if (value.trim() === "") return null;
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : null;
};

/**
 * Valid outage: machine belongs to the variant, start and end are greater
 * than zero, and start is smaller than end (so they are never equal).
 */
export function parseOutage(values: OutageValues, variant: Variant): Outage | null {
  if (values.machine === "" || !variant.machines.includes(values.machine)) return null;
  const start = parsePositiveNumber(values.start);
  const end = parsePositiveNumber(values.end);
  if (start === null || end === null || start >= end) return null;
  return { machine: values.machine, start, end };
}

/**
 * How a job's operation on one machine is tied to the previous machine (T -> F -> S):
 *  - "start": it cannot START earlier than the job STARTS on the previous machine
 *             (literal reading of the requirement).
 *  - "end":   it cannot start earlier than the job ENDS on the previous machine.
 */
export const PRECEDENCE: "start" | "end" = "start";

export interface ScheduledOperation {
  job: Job;
  machine: Machine;
  start: number;
  duration: number;
}

/**
 * Packs the operations of the chosen variant in the order the user wrote them
 * (Z1, Z2, Z3; T, F, S): each operation goes at the earliest moment that
 *  1. the machine is free (one job at a time per machine), and
 *  2. respects the T -> F -> S constraint for that job.
 * Empty, invalid or zero-length cells are not placed.
 */
export function packSchedule(
  values: FormValues,
  variant: Variant,
): ScheduledOperation[] {
  const machineFreeAt: Record<Machine, number> = { T: 0, F: 0, S: 0 };
  const operations: ScheduledOperation[] = [];

  for (const job of variant.jobs) {
    let previousStart = 0;
    let previousEnd = 0;

    for (const machine of variant.machines) {
      const duration = parseDuration(values[job][machine]);
      if (duration === null || duration === 0) continue;

      const earliestByJob = PRECEDENCE === "start" ? previousStart : previousEnd;
      const start = Math.max(machineFreeAt[machine], earliestByJob);

      operations.push({ job, machine, start, duration });
      machineFreeAt[machine] = start + duration;
      previousStart = start;
      previousEnd = start + duration;
    }
  }

  return operations;
}