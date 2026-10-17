export const MACHINES = ["T", "F", "S"] as const;
export const JOBS = ["Z1", "Z2", "Z3"] as const;

export type Machine = (typeof MACHINES)[number];
export type Job = (typeof JOBS)[number];

/** Raw input strings, one per cell of the form grid: values[job][machine]. */
export type FormValues = Record<Job, Record<Machine, string>>;

export const createEmptyValues = (): FormValues =>
  Object.fromEntries(
    JOBS.map((j) => [j, Object.fromEntries(MACHINES.map((m) => [m, ""]))]),
  ) as FormValues;

/** Returns the number, or null when the cell is empty, not a number or negative. */
export const parseDuration = (value: string): number | null => {
  if (value.trim() === "") return null;
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? n : null;
};

export const isValid = (value: string): boolean => parseDuration(value) !== null;

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
 * Packs the operations in the order the user wrote them (Z1, Z2, Z3; T, F, S):
 * each operation goes at the earliest moment that
 *  1. the machine is free (one job at a time per machine), and
 *  2. respects the T -> F -> S constraint for that job.
 * Empty, invalid or zero-length cells are not placed.
 */
export function packSchedule(values: FormValues): ScheduledOperation[] {
  const machineFreeAt: Record<Machine, number> = { T: 0, F: 0, S: 0 };
  const operations: ScheduledOperation[] = [];

  for (const job of JOBS) {
    let previousStart = 0;
    let previousEnd = 0;

    for (const machine of MACHINES) {
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
