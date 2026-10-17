import { useMemo, useState } from "react";
import {
  Box,
  Button,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from "@mui/material";
import ProductsForm from "../components/ProductsForm";
import Timetable, { type TimetableBlock } from "../components/Timetable";
import {
  VARIANT_2X2,
  VARIANT_3X3,
  createEmptyValues,
  packSchedule,
  type FormValues,
  type Job,
  type Machine,
  type ScheduledOperation,
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
  // On = 3x3, off = 2x2 (columns T, F; rows Z1, Z2).
  const [is3x3, setIs3x3] = useState(true);
  const variant = is3x3 ? VARIANT_3X3 : VARIANT_2X2;

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
      (solved?.operations ?? packSchedule(values, variant)).map((op) => ({
        id: `${op.job}-${op.machine}`,
        row: variant.machines.indexOf(op.machine),
        start: op.start,
        duration: op.duration,
        label: op.job,
        color: JOB_COLORS[op.job],
      })),
    [values, variant, solved],
  );

  const handleVariantChange = (checked: boolean) => {
    setIs3x3(checked);
    // A result and an error belong to the variant they were made for.
    setSolved(null);
    setInputError(null);
  };

  const handleChange = (job: Job, machine: Machine, value: string) => {
    setValues((prev) => ({ ...prev, [job]: { ...prev[job], [machine]: value } }));
    // The solver result no longer matches the inputs.
    setSolved(null);
  };

  const handleUpload = async (file: File) => {
    try {
      const parsed = parseSolverInputFile(await file.text(), variant);
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
    const result = buildSolverInput(values, variant);
    if (!result.ok) {
      setInputError(result.error);
      return;
    }
    setInputError(null);
    setRunning(true);
    try {
      const response = await callSolver(result.input);
      setSolved({ response, operations: scheduleToOperations(response, variant) });
    } catch (err) {
      setInputError(err instanceof Error ? err.message : String(err));
    } finally {
      setRunning(false);
    }
  };

  return (
    <Box sx={{ minHeight: '100vh', display: "flex", flexDirection: "column",        backgroundImage:
          "linear-gradient(rgba(0, 0, 0, 0.7), rgba(0, 0, 0, 0.7)), url('/images/background.png')", gap: 3, p: { xs: 2, md: 4 } }}
    >
      {/* Problem size selector */}
      <Box
        sx={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 1.5,
        }}
      >
        <Typography variant="h4" component="h2" align="center" sx={{
          color: "white",
          textShadow: "2px 2px 4px rgba(0, 0, 0, 0.5)"
        }}>
          Select problem size
        </Typography>
        <Box
          sx={{
            border: 1,
            borderColor: "divider",
            borderRadius: 3,
            p: 0.5,
            background: "rgba(48, 25, 52, 0.8)"
          }}
        >
          <ToggleButtonGroup
            exclusive
            color="primary"
            value={variant.name}
            disabled={running}
            onChange={(_, value: string | null) => {
              // Clicking the selected button gives null: keep the current size.
              if (value) handleVariantChange(value === "3x3");
            }}
            aria-label="Problem size"
            sx={{
              gap: 0.5,
              color: "white",
              "&& .MuiToggleButtonGroup-grouped": {
                border: 0,
                borderRadius: 2,
                m: 0,
                px: 3,
              },
            }}
          >
            <ToggleButton value="2x2" sx={{
              color: "white"
            }}>2x2</ToggleButton>
            <ToggleButton value="3x3" sx={{
              color: "white"
            }}>3x3</ToggleButton>
          </ToggleButtonGroup>
        </Box>
      </Box>

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
            variant={variant}
            onChange={handleChange}
            onRun={handleRun}
            onUpload={handleUpload}
            running={running}
            error={inputError}
          />
        </Box>

        {/* Right-hand side: flex 3 */}
        <Box sx={{ flex: 3, minWidth: 0, display: "flex" }}>
          <Timetable
            machines={variant.machines}
            blocks={blocks}
            horizon={solved?.response.makespan}
          />
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
              color: 'white'
            }}
          >
            <Typography fontWeight={600}>
              Makespan: {solved.response.makespan}
            </Typography>
            <Button
              variant="outlined"
              onClick={() => downloadJson("results.json", solved.response)}
              sx={{color: "white", borderColor: "white"}}
            >
              Download results
            </Button>
          </Box>
        </Box>
      )}
    </Box>
  );
}