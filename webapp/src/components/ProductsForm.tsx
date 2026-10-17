import { Alert, Box, Button, Paper, TextField, Typography } from "@mui/material";
import UploadIcon from "@mui/icons-material/Upload";
import {
  JOBS,
  MACHINES,
  isValid,
  type FormValues,
  type Job,
  type Machine,
} from "../domain";

interface ProductsFormProps {
  values: FormValues;
  onChange: (job: Job, machine: Machine, value: string) => void;
  onRun: () => void;
  onUpload: (file: File) => void;
  running?: boolean;
  error?: string | null;
}

export default function ProductsForm({
  values,
  onChange,
  onRun,
  onUpload,
  running = false,
  error = null,
}: ProductsFormProps) {
  const allFilled = JOBS.every((j) => MACHINES.every((m) => isValid(values[j][m])));

  return (
    <Paper
      component="section"
      variant="outlined"
      sx={{ p: 2, flexGrow: 1, minWidth: 0, display: "flex", flexDirection: "column" }}
    >
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 1,
        }}
      >
        <Typography variant="h5" component="h2">
          Products to plan
        </Typography>
        <Button
          component="label"
          variant="outlined"
          size="small"
          startIcon={<UploadIcon />}
          disabled={running}
        >
          Upload
          <input
            hidden
            type="file"
            accept=".json,application/json"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) onUpload(file);
              e.target.value = ""; // allow choosing the same file again
            }}
          />
        </Button>
      </Box>

      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: "auto repeat(3, minmax(0, 1fr))",
          gap: 1.5,
          alignItems: "center",
          mt: 2,
          mb: 3,
        }}
      >
        <Box />
        {MACHINES.map((m) => (
          <Typography key={m} fontWeight={700} align="center">
            {m}
          </Typography>
        ))}

        {JOBS.map((j) => (
          <Box key={j} sx={{ display: "contents" }}>
            <Typography fontWeight={700}>{j}</Typography>
            {MACHINES.map((m) => (
              <TextField
                key={m}
                type="number"
                size="small"
                value={values[j][m]}
                onChange={(e) => onChange(j, m, e.target.value)}
                error={values[j][m] !== "" && !isValid(values[j][m])}
                slotProps={{
                  htmlInput: {
                    min: 0,
                    step: "any",
                    "aria-label": `${j} ${m}`,
                  },
                }}
              />
            ))}
          </Box>
        ))}
      </Box>

      <Button
        variant="contained"
        color="info"
        size="large"
        fullWidth
        disabled={!allFilled || running}
        onClick={onRun}
        sx={{ mt: "auto" }}
      >
        Run optimization
      </Button>

      {error && (
        <Alert severity="error" sx={{ mt: 2 }}>
          {error}
        </Alert>
      )}
    </Paper>
  );
}
