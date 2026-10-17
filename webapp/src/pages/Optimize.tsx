import { useMemo, useState } from "react";
import { Box, Button, Typography } from "@mui/material";
import ProductsForm from "../components/ProductsForm";
import Timetable, { type TimetableBlock } from "../components/Timetable";
import {
  MACHINES,
  createEmptyValues,
  packSchedule,
  type FormValues,
  type Job,
  type ScheduledOperation,
  type Machine,
} from "../domain";
import { buildSolverInput, parseSolverInputFile } from "../solverInput";
import {
  callSolver,
  scheduleToOperations,
  type SolverResponse,
} from "../solverApi";
import { downloadJson } from "../download";

const JOB_COLORS: Record<Job, string> = {
  Z1: "#1f4e5f",
  Z2: "#a65f00",
  Z3: "#6a4c93",
};

export default function Optimize() {
  const [values, setValues] = useState<FormValues>(createEmptyValues);
  const [inputError, setInputError] = useState<string | null>(null);
  // Result returned by the solver; null = show the local "as written" packing.
  const [solved, setSolved] = useState<{
    response: SolverResponse;
    operations: ScheduledOperation[];
  } | null>(null);
  const [running, setRunning] = useState(false);

  // Solver result if there is one, otherwise recomputed on every keystroke.
  const blocks: TimetableBlock[] = useMemo(
    () =>
      (solved?.operations ?? packSchedule(values)).map((op) => ({
        id: `${op.job}-${op.machine}`,
        row: MACHINES.indexOf(op.machine),
        start: op.start,
        duration: op.duration,
        label: op.job,
        color: JOB_COLORS[op.job],
      })),
    [values, solved],
  );

  const handleChange = (job: Job, machine: Machine, value: string) => {
    setValues((prev) => ({ ...prev, [job]: { ...prev[job], [machine]: value } }));
    // The solver result no longer matches the inputs.
    setSolved(null);
  };

  const handleUpload = async (file: File) => {
    try {
      const parsed = parseSolverInputFile(await file.text());
      if (!parsed.ok) {
        setInputError(parsed.error);
        return;
      }
      setValues(parsed.values);
      setSolved(null);
      setInputError(null);
    } catch {
      setInputError("The file could not be read.");
    }
  };

  const handleRun = async () => {
    const result = buildSolverInput(values);
    if (!result.ok) {
      setInputError(result.error);
      return;
    }
    setInputError(null);
    setRunning(true);
    try {
      const response = await callSolver(result.input);
      setSolved({ response, operations: scheduleToOperations(response) });
    } catch (err) {
      setInputError(err instanceof Error ? err.message : String(err));
    } finally {
      setRunning(false);
    }
  };

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 3, p: { xs: 2, md: 4 } }}>
      {/* Panels row: both panels stretch to the same height */}
      <Box
        sx={{
          display: "flex",
          flexDirection: { xs: "column", md: "row" },
          alignItems: "stretch",
          gap: 3,
        }}
      >
        {/* Left-hand side: flex 1 */}
        <Box sx={{ flex: 1, minWidth: 0, display: "flex" }}>
          <ProductsForm
            values={values}
            onChange={handleChange}
            onRun={handleRun}
            onUpload={handleUpload}
            running={running}
            error={inputError}
          />
        </Box>

        {/* Right-hand side: flex 3 */}
        <Box sx={{ flex: 3, minWidth: 0, display: "flex" }}>
          <Timetable blocks={blocks} horizon={solved?.response.makespan} />
        </Box>
      </Box>

      {/* Below the timetable, only once results exist */}
      {solved && (
        <Box sx={{ display: "flex", gap: 3 }}>
          <Box sx={{ flex: 1, display: { xs: "none", md: "block" } }} />
          <Box
            sx={{
              flex: 3,
              minWidth: 0,
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <Typography fontWeight={600}>
              Makespan: {solved.response.makespan}
            </Typography>
            <Button
              variant="outlined"
              onClick={() => downloadJson("results.json", solved.response)}
            >
              Download results
            </Button>
          </Box>
        </Box>
      )}
    </Box>
  );
}
