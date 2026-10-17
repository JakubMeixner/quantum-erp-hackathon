import { Box, Paper, Typography } from "@mui/material";
import { MACHINES } from "../domain";

/** The time axis is at least this long; it grows when the schedule is longer. */
const MIN_HORIZON = 24;

const ROW_HEIGHT = 64;
const LABEL_WIDTH = 48;

export interface TimetableBlock {
  id: string;
  /** Index of the row (0 = T, 1 = F, 2 = S). */
  row: number;
  /** Position on the time axis. Any number, not snapped to the ticks. */
  start: number;
  /** Width on the time axis. */
  duration: number;
  label?: string;
  color?: string;
}

interface TimetableProps {
  blocks?: TimetableBlock[];
  /** Exact length of the time axis (e.g. the makespan returned by the solver). */
  horizon?: number;
}

export default function Timetable({ blocks = [], horizon: fixedHorizon }: TimetableProps) {
  const blocksEnd = Math.ceil(
    blocks.reduce((max, b) => Math.max(max, b.start + b.duration), 0),
  );
  // With a fixed horizon the axis ends exactly there (never shorter than the blocks).
  const horizon =
    fixedHorizon !== undefined
      ? Math.max(1, Math.ceil(fixedHorizon), blocksEnd)
      : Math.max(MIN_HORIZON, blocksEnd);
  const tickEvery = Math.max(1, Math.ceil(horizon / 12));

  const pct = (units: number) => `${(units / horizon) * 100}%`;

  const ticks: number[] = [];
  for (let t = 0; t <= horizon; t += tickEvery) ticks.push(t);

  return (
    <Paper
      component="section"
      variant="outlined"
      sx={{ p: 2, flexGrow: 1, minWidth: 0 }}
    >
      <Typography variant="h5" component="h2" gutterBottom>
        Timetable
      </Typography>

      {/* Time axis */}
      <Box sx={{ display: "flex", ml: `${LABEL_WIDTH}px`, mt: 2 }}>
        <Box sx={{ position: "relative", flex: 1, height: 20 }}>
          {ticks.map((t) => (
            <Typography
              key={t}
              variant="caption"
              color="text.secondary"
              sx={{
                position: "absolute",
                left: pct(t),
                transform: "translateX(-50%)",
              }}
            >
              {t}
            </Typography>
          ))}
        </Box>
      </Box>

      {/* Rows */}
      {MACHINES.map((label, rowIndex) => (
        <Box key={label} sx={{ display: "flex", alignItems: "stretch" }}>
          <Typography
            fontWeight={700}
            sx={{
              width: LABEL_WIDTH,
              display: "flex",
              alignItems: "center",
              flexShrink: 0,
            }}
          >
            {label}
          </Typography>

          <Box
            sx={{
              position: "relative",
              flex: 1,
              height: ROW_HEIGHT,
              borderTop: 1,
              borderBottom: rowIndex === MACHINES.length - 1 ? 1 : 0,
              borderColor: "divider",
              backgroundImage:
                "linear-gradient(to right, rgba(0,0,0,0.08) 1px, transparent 1px)",
              backgroundSize: `${(100 * tickEvery) / horizon}% 100%`,
            }}
          >
            {blocks
              .filter((b) => b.row === rowIndex)
              .map((b) => (
                <Box
                  key={b.id}
                  sx={{
                    position: "absolute",
                    top: 6,
                    bottom: 6,
                    left: pct(b.start),
                    width: pct(b.duration),
                    bgcolor: b.color ?? "primary.main",
                    color: "common.white",
                    borderRadius: 1,
                    px: 1,
                    display: "flex",
                    alignItems: "center",
                    overflow: "hidden",
                    whiteSpace: "nowrap",
                  }}
                >
                  {b.label}
                </Box>
              ))}
          </Box>
        </Box>
      ))}
    </Paper>
  );
}
