import { Box, Button, Typography } from "@mui/material";
import { useNavigate } from "react-router-dom";

// Industrial, condensed display font (loaded in index.html), with fallbacks.
const INDUSTRIAL_FONT =
  '"Barlow Condensed", "Arial Narrow", "Roboto Condensed", Impact, sans-serif';

export default function Home() {
  const navigate = useNavigate();

  return (
    <Box
      sx={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 6,
        p: 3,
        textAlign: "center",
        // Darkening layer on top of the photo keeps the text readable.
        // The image is served from webapp/public/background.jpg.
        backgroundImage:
          "linear-gradient(rgba(0, 0, 0, 0.5), rgba(0, 0, 0, 0.5)), url('/images/background.png')",
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
      }}
    >
      <Typography
        variant="h2"
        component="h1"
        sx={{
          fontFamily: INDUSTRIAL_FONT,
          fontWeight: 800,
          letterSpacing: "0.04em",
          textTransform: "uppercase",
          color: "rgba(255,255,255,.8)",
          textShadow: '2px 2px 4px rgba(0, 0, 0, 0.5)',
        }}
      >
        Productionalizator 2000
      </Typography>

      <Button
        variant="contained"
        onClick={() => navigate("/optimize")}
        sx={{
          fontFamily: INDUSTRIAL_FONT,
          fontWeight: 800,
          fontSize: { xs: "1.75rem", md: "2.25rem" },
          letterSpacing: "0.12em",
          px: { xs: 6, md: 10 },
          py: { xs: 2, md: 2.5 },
          color: 'rgba(255,255,255,.8)',
          background: 'rgba(98,12,49,.7)',
          '&:hover': {
            background: 'rgba(48,12,49,.7)',
          }
        }}
      >
        Optimize
      </Button>
    </Box>
  );
}