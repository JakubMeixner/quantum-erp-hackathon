import type { ReactNode } from "react";
import { Box, Paper, Typography, Tooltip } from "@mui/material";
import type { Machine, Outage } from "../domain";

/** The time axis is at least this long; it grows when the schedule is longer. */
const MIN_HORIZON = 24;

const ROW_HEIGHT = 64;
const LABEL_WIDTH = 48;

const OUTAGE_RED = "#e53935";

export interface TimetableBlock {
  id: string;
  /** Index of the row in `machines`. */
  row: number;
  /** Position on the time axis. Any number, not snapped to the ticks. */
  start: number;
  /** Width on the time axis. */
  duration: number;
  label?: string;
  color?: string;
}

interface TimetableProps {
  /** One row per machine, in this order. */
  machines: readonly Machine[];
  blocks?: TimetableBlock[];
  /** Exact length of the time axis (e.g. the makespan returned by the solver). */
  horizon?: number;
  /** Outages as sent to the solver; each one is drawn on its machine's row. */
  outages?: Outage[];
  /** Rendered at the bottom of the panel, under the rows. */
  children?: ReactNode;
}

export default function Timetable({
  machines,
  blocks = [],
  horizon: fixedHorizon,
  outages = [],
  children,
}: TimetableProps) {
  const blocksEnd = Math.ceil(
    blocks.reduce((max, b) => Math.max(max, b.start + b.duration), 0),
  );
  const outagesEnd = Math.ceil(outages.reduce((max, o) => Math.max(max, o.end), 0));
  // Never cut off a block or an outage.
  const extent = Math.max(blocksEnd, outagesEnd);
  // With a fixed horizon the axis ends exactly there (unless something reaches further).
  const horizon =
    fixedHorizon !== undefined
      ? Math.max(1, Math.ceil(fixedHorizon), extent)
      : Math.max(MIN_HORIZON, extent);
  const tickEvery = Math.max(1, Math.ceil(horizon / 12));

  const pct = (units: number) => `${(units / horizon) * 100}%`;

  const ticks: number[] = [];
  for (let t = 0; t <= horizon; t += tickEvery) ticks.push(t);

  return (
    <Paper
      component="section"
      variant="outlined"
      sx={{ p: 2, flexGrow: 1, minWidth: 0, background: "rgba(48,12,48,.6)", borderColor: "white" }}
    >
      <Typography variant="h5" component="h2" gutterBottom sx={{color: "white"}}>
        Timetable
      </Typography>

      {/* Time axis */}
      <Box sx={{ display: "flex", ml: `${LABEL_WIDTH}px`, mt: 2, color: "white", borderColor: 'white' }}>
        <Box sx={{ position: "relative", flex: 1, height: 20,color: "white", borderColor: 'white' }}>
          {ticks.map((t) => (
            <Typography
              key={t}
              variant="caption"
              color="white"
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
      {machines.map((label, rowIndex) => (
        <Box key={label} sx={{ display: "flex", alignItems: "stretch" }}>
          <Typography
            fontWeight={700}
            sx={{
              width: LABEL_WIDTH,
              display: "flex",
              alignItems: "center",
              flexShrink: 0,
              color: 'white'
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
              borderBottom: rowIndex === machines.length - 1 ? 1 : 0,
              borderColor: "white",
              backgroundImage:
                "linear-gradient(to right, rgba(255,255,255,0.08) 1px, transparent 1px)",
              backgroundSize: `${(100 * tickEvery) / horizon}% 100%`,
            }}
          >
            {blocks
              .filter((b) => b.row === rowIndex)
              .map((b) => (
                <Tooltip key={b.id} title={`${b.label} - from ${b.start} to ${b.start + b.duration}`}>
                <Box
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
                    borderColor: 'white'
                  }}
                >
                  {b.label}
                </Box>
                </Tooltip>
              ))}

            {outages
              .filter((o) => o.machine === label)
              .map((o, i) => (
                <Tooltip key={`outage-${i}`} title="Machine outage">
                  <Box
                    sx={{
                      position: "absolute",
                      top: 6,
                      bottom: 6,
                      left: pct(o.start),
                      width: pct(o.end - o.start),
                      boxSizing: "border-box",
                      border: `2px solid ${OUTAGE_RED}`,
                      borderRadius: 2,
                      backgroundColor: "rgba(229,57,53,0.12)",
                      backgroundImage: `repeating-linear-gradient(45deg, ${OUTAGE_RED} 0 3px, transparent 3px 10px)`,
                    }}
                  />
                </Tooltip>
              ))}
          </Box>
        </Box>
      ))}

      {children && <Box sx={{ mt: 2 }}>{children}</Box>}
    </Paper>
  );
}