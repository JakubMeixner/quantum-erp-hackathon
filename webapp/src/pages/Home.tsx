import { Button, Container, Typography } from "@mui/material";
import { useNavigate } from "react-router-dom";

export default function Home() {
  const navigate = useNavigate();

  return (
    <Container maxWidth="md" sx={{ py: { xs: 6, md: 10 } }}>
      <Typography variant="h2" component="h1" color="primary" gutterBottom>
        Productionionalizator 2000
      </Typography>
      <Button
        variant="contained"
        size="large"
        onClick={() => navigate("/optimize")}
      >
        Optimize
      </Button>
    </Container>
  );
}
