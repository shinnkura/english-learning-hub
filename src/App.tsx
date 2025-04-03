import React, { useEffect } from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Home from "./app/page";
import ResetPasswordPage from "./components/ResetPasswordPage";
import LegalPage from "./app/legal/page";
import { AuthProvider } from "./contexts/AuthContext";
import { ThemeProvider } from "./contexts/ThemeContext";

function App() {
  useEffect(() => {
    // URLのハッシュパラメータをチェック
    const hashParams = new URLSearchParams(window.location.hash.substring(1));
    const type = hashParams.get("type");
    const accessToken = hashParams.get("access_token");

    // パスワードリセット用のURLの場合、パスを変更
    if ((type === "recovery" || type === "signup") && accessToken) {
      const newUrl = `/reset-password${window.location.hash}`;
      window.history.replaceState({}, "", newUrl);
    }
  }, []);

  return (
    <Router>
      <ThemeProvider>
        <AuthProvider>
          <div className="min-h-screen bg-gray-100 dark:bg-gray-900">
            <Routes>
              <Route path="/reset-password" element={<ResetPasswordPage />} />
              <Route path="/legal" element={<LegalPage />} />
              <Route path="/" element={<Home />} />
            </Routes>
          </div>
        </AuthProvider>
      </ThemeProvider>
    </Router>
  );
}

export default App;
