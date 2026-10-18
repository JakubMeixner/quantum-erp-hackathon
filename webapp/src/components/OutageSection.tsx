import { Box, MenuItem, Switch, TextField, Typography } from "@mui/material";
import {
  parsePositiveNumber,
  type Machine,
  type OutageValues,
  type Variant,
} from "../domain";

interface OutageSectionProps {
  variant: Variant;
  enabled: boolean;
  onEnabledChange: (enabled: boolean) => void;
  outage: OutageValues;
  onChange: (outage: OutageValues) => void;
  disabled?: boolean;
}

/** "Outages" text + switch; when on, a row of machine / start / end inputs. */
export default function OutageSection({
  variant,
  enabled,
  onEnabledChange,
  outage,
  onChange,
  disabled = false,
}: OutageSectionProps) {
  const start = parsePositiveNumber(outage.start);
  const end = parsePositiveNumber(outage.end);
  const startInvalid = outage.start !== "" && start === null;
  const endInvalid = outage.end !== "" && end === null;
  const orderInvalid = start !== null && end !== null && start >= end;

  return (
    <Box sx={{ mb: 3 }}>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
        <Typography fontWeight={700}>Outages</Typography>
        <Switch
          checked={enabled}
          disabled={disabled}
          onChange={(e) => onEnabledChange(e.target.checked)}
          slotProps={{ input: { "aria-label": "Outages" } }}
        />
      </Box>

      {enabled && (
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
            gap: 1.5,
            alignItems: "center",
            mt: 1,
          }}
        >
          <Typography fontWeight={700} align="center">
            machine
          </Typography>
          <Typography fontWeight={700} align="center">
            start
          </Typography>
          <Typography fontWeight={700} align="center">
            end
          </Typography>

          <TextField
            select
            size="small"
            value={outage.machine}
            onChange={(e) => onChange({ ...outage, machine: e.target.value as Machine })}
          >
            {variant.machines.map((m) => (
              <MenuItem key={m} value={m}>
                {m}
              </MenuItem>
            ))}
          </TextField>

          <TextField
            type="number"
            size="small"
            value={outage.start}
            onChange={(e) => onChange({ ...outage, start: e.target.value })}
            error={startInvalid || orderInvalid}
            slotProps={{
              htmlInput: { min: 0, step: "any", "aria-label": "Outage start" },
            }}
          />

          <TextField
            type="number"
            size="small"
            value={outage.end}
            onChange={(e) => onChange({ ...outage, end: e.target.value })}
            error={endInvalid || orderInvalid}
            slotProps={{
              htmlInput: { min: 0, step: "any", "aria-label": "Outage end" },
            }}
          />

          {(startInvalid || endInvalid || orderInvalid) && (
            <Typography variant="caption" color="error" sx={{ gridColumn: "1 / -1" }}>
              {orderInvalid
                ? "Start must be smaller than end."
                : "Start and end must be greater than zero."}
            </Typography>
          )}
        </Box>
      )}
    </Box>
  );
}