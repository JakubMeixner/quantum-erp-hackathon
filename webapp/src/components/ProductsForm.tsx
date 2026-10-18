import {
  Alert,
  Box,
  Button,
  MenuItem,
  Paper,
  Switch,
  TextField,
  Typography,
} from "@mui/material";
import UploadIcon from "@mui/icons-material/Upload";
import {
  isValid,
  parseOutage,
  parsePositiveNumber,
  type FormValues,
  type Job,
  type Machine,
  type OutageValues,
  type Variant,
} from "../domain";

interface ProductsFormProps {
  values: FormValues;
  variant: Variant;
  onChange: (job: Job, machine: Machine, value: string) => void;
  outageEnabled: boolean;
  onOutageEnabledChange: (enabled: boolean) => void;
  outage: OutageValues;
  onOutageChange: (outage: OutageValues) => void;
  onRun: () => void;
  onUpload: (file: File) => void;
  running?: boolean;
  error?: string | null;
}

export default function ProductsForm({
  values,
  variant,
  onChange,
  outageEnabled,
  onOutageEnabledChange,
  outage,
  onOutageChange,
  onRun,
  onUpload,
  running = false,
  error = null,
}: ProductsFormProps) {
  const gridFilled = variant.jobs.every((j) =>
    variant.machines.every((m) => isValid(values[j][m])),
  );
  // With the outage switch on, machine, start and end must be valid too.
  const outageOk = !outageEnabled || parseOutage(outage, variant) !== null;
  const allFilled = gridFilled && outageOk;

  // Field-level error flags for the outage row.
  const outageStart = parsePositiveNumber(outage.start);
  const outageEnd = parsePositiveNumber(outage.end);
  const startInvalid = outage.start !== "" && outageStart === null;
  const endInvalid = outage.end !== "" && outageEnd === null;
  const orderInvalid =
    outageStart !== null && outageEnd !== null && outageStart >= outageEnd;

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

      {/* Outages */}
      <Box sx={{ mb: 3, color: "white" }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <Typography fontWeight={700} sx={{ color: "white" }}>
            Outages
          </Typography>
          <Switch
            checked={outageEnabled}
            disabled={running}
            onChange={(e) => onOutageEnabledChange(e.target.checked)}
            slotProps={{ input: { "aria-label": "Outages" } }}
            sx={{
              "& .MuiSwitch-switchBase, & .MuiSwitch-switchBase.Mui-checked": {
                color: "white",
              },
              "& .MuiSwitch-track, & .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track": {
                backgroundColor: "white",
              },
            }}
          />
        </Box>

        {outageEnabled && (
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
              gap: 1.5,
              alignItems: "center",
              mt: 1,
            }}
          >
            <Typography fontWeight={700} align="center" sx={{ color: "white" }}>
              machine
            </Typography>
            <Typography fontWeight={700} align="center" sx={{ color: "white" }}>
              start
            </Typography>
            <Typography fontWeight={700} align="center" sx={{ color: "white" }}>
              end
            </Typography>

            <TextField
              select
              size="small"
              value={outage.machine}
              onChange={(e) =>
                onOutageChange({ ...outage, machine: e.target.value as Machine })
              }
              sx={{
                color: "white",
                borderColor: "white",
                border: 1,
                "& .MuiSelect-select": { color: "white" },
                "& .MuiSvgIcon-root": { color: "white" },
              }}
            >
              {variant.machines.map((m) => (
                <MenuItem key={m} value={m}>
                  {m}
                </MenuItem>
              ))}
            </TextField>

            <TextField
              sx={{
                color: "white",
                borderColor: "white",
                border: 1,
                input: { color: "white" },
              }}
              type="number"
              size="small"
              value={outage.start}
              onChange={(e) => onOutageChange({ ...outage, start: e.target.value })}
              error={startInvalid || orderInvalid}
              slotProps={{
                htmlInput: { min: 0, step: "any", "aria-label": "Outage start" },
              }}
            />

            <TextField
              sx={{
                color: "white",
                borderColor: "white",
                border: 1,
                input: { color: "white" },
              }}
              type="number"
              size="small"
              value={outage.end}
              onChange={(e) => onOutageChange({ ...outage, end: e.target.value })}
              error={endInvalid || orderInvalid}
              slotProps={{
                htmlInput: { min: 0, step: "any", "aria-label": "Outage end" },
              }}
            />

            {(startInvalid || endInvalid || orderInvalid) && (
              <Typography
                variant="caption"
                sx={{ gridColumn: "1 / -1", color: "error.light" }}
              >
                {orderInvalid
                  ? "Start must be smaller than end."
                  : "Start and end must be greater than zero."}
              </Typography>
            )}
          </Box>
        )}
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