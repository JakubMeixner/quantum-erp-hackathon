import { Route, Routes } from "react-router-dom";
import Home from "./pages/Home";
import Optimize from "./pages/Optimize";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/optimize" element={<Optimize />} />
    </Routes>
  );
}
