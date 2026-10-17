import { Alert, Box, Button, Paper, TextField, Typography } from "@mui/material";
import UploadIcon from "@mui/icons-material/Upload";
import {
  isValid,
  type FormValues,
  type Job,
  type Machine,
  type Variant,
} from "../domain";

interface ProductsFormProps {
  values: FormValues;
  variant: Variant;
  onChange: (job: Job, machine: Machine, value: string) => void;
  onRun: () => void;
  onUpload: (file: File) => void;
  running?: boolean;
  error?: string | null;
}

export default function ProductsForm({
  values,
  variant,
  onChange,
  onRun,
  onUpload,
  running = false,
  error = null,
}: ProductsFormProps) {
  const allFilled = variant.jobs.every((j) =>
    variant.machines.every((m) => isValid(values[j][m])),
  );

  return (
    <Paper
      component="section"
      variant="outlined"
      sx={{ p: 2, flexGrow: 1, minWidth: 0, display: "flex", flexDirection: "column", background: "rgba(48,12,48,.6)", borderColor: "white" }}
    >
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 1,
        }}
      >
        <Typography variant="h5" component="h2" sx={{color: "white"}}>
          Products to plan
        </Typography>
        <Button
          component="label"
          variant="outlined"
          size="small"
          startIcon={<UploadIcon />}
          disabled={running}
          sx={{color: "white", borderColor: 'white'}}
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
          gridTemplateColumns: `auto repeat(${variant.machines.length}, minmax(0, 1fr))`,
          gap: 1.5,
          alignItems: "center",
          mt: 2,
          mb: 3,
          color: "white", borderColor: 'white' 
        }}
      >
        <Box />
        {variant.machines.map((m) => (
          <Typography key={m} fontWeight={700} align="center" sx={{color: "white", borderColor: 'white'}}>
            {m}
          </Typography>
        ))}

        {variant.jobs.map((j) => (
          <Box key={j} sx={{ display: "contents", color: "white", borderColor: 'white'  }}>
            <Typography fontWeight={700} sx={{ color: "white", borderColor: 'white' }}>{j}</Typography>
            {variant.machines.map((m) => (
              <TextField
                key={m}
                sx={{
                  color: "white", 
                  borderColor: 'white', 
                  border: 1, 
                  input: {color: "white"},
                }}
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
        sx={{ mt: "auto", color: "white", borderColor: 'white', 
          background: 'rgba(98,12,49,.7)',
          transition: 'filter 0.4s',
          '&:hover': {
            filter: 'brightness(70%)'
          }
         }}
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
