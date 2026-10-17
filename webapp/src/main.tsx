import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { CssBaseline, ThemeProvider, createTheme } from "@mui/material";
import App from "./App";

const theme = createTheme({
  palette: {
    primary: { main: "#1f4e5f" },
    secondary: { main: "#d98e04" },
    info: { main: "#1565c0" },
    background: { default: "#eef1f2" },
  },
  shape: { borderRadius: 4 },
  typography: {
    fontFamily: '"Segoe UI", "Helvetica Neue", Arial, sans-serif',
    h2: { fontWeight: 800, letterSpacing: "-0.02em" },
    h5: { fontWeight: 700 },
  },
});

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </ThemeProvider>
  </StrictMode>,
);
