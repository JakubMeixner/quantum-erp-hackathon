import {
  JOBS,
  MACHINES,
  type Job,
  type Machine,
  type ScheduledOperation,
} from "./domain";
import type { SolverInput } from "./solverInput";

/** Base URL of the FastAPI server (api.py). Override with VITE_API_URL. */
const API_URL: string = import.meta.env.VITE_API_URL ?? "http://localhost:8000";

/** One operation in the response, as in results/schedule_3x3.json. */
export interface ScheduleRecord {
  job: string;
  machine: string;
  start: number;
  end: number;
}

/** Response of POST /solver. Same form as results/schedule_3x3.json. */
export interface SolverResponse {
  instance: string;
  method: string;
  makespan: number;
  schedule: ScheduleRecord[];
}

/** Form input -> the format of `inputs/instance_3x3.json`. */
function toSolverPayload(input: SolverInput) {
  return {
    problem: "erp_scheduling",
    jobs: input.jobs.map((job) => ({
      id: job,
      operations: input.machines.map((machine) => ({
        machine,
        duration: input.durations[job][machine],
      })),
    })),
  };
}

const isJob = (v: string): v is Job => (JOBS as readonly string[]).includes(v);
const isMachine = (v: string): v is Machine =>
  (MACHINES as readonly string[]).includes(v);

/** `schedule` records (job, machine, start, end) -> operations the timetable draws. */
export function scheduleToOperations(response: SolverResponse): ScheduledOperation[] {
  return response.schedule.map((record) => {
    if (!isJob(record.job) || !isMachine(record.machine)) {
      throw new Error(
        `Unexpected operation in solver response: ${record.job} on ${record.machine}.`,
      );
    }
    return {
      job: record.job,
      machine: record.machine,
      start: record.start,
      duration: record.end - record.start,
    };
  });
}

export async function callSolver(input: SolverInput): Promise<SolverResponse> {
  const payload = toSolverPayload(input);

  let response: Response;
  try {
    response = await fetch(`${API_URL}/solver`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  } catch {
    throw new Error(`Cannot reach the solver at ${API_URL}/solver.`);
  }

  if (!response.ok) {
    // FastAPI reports errors as { "detail": ... }.
    let detail = `${response.status} ${response.statusText}`;
    try {
      const body = await response.json();
      if (body && typeof body.detail === "string") detail = body.detail;
    } catch {
      // keep the status text
    }
    throw new Error(`Solver error: ${detail}`);
  }

  return (await response.json()) as SolverResponse;
}
