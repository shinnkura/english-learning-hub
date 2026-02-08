import React from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Home from "./app/page";
import LegalPage from "./app/legal/page";
import { ThemeProvider } from "./contexts/ThemeContext";

function App() {
  return (
    <Router>
      <ThemeProvider>
        <div className="min-h-screen bg-gray-100 dark:bg-gray-900">
          <Routes>
            <Route path="/legal" element={<LegalPage />} />
            <Route path="/" element={<Home />} />
          </Routes>
        </div>
      </ThemeProvider>
    </Router>
  );
}

export default App;
