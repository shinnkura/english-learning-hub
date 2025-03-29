import React, { useEffect } from 'react';
import Home from './app/page';
import ResetPasswordPage from './components/ResetPasswordPage';
import { AuthProvider } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';

function App() {
  useEffect(() => {
    // URLのハッシュパラメータをチェック
    const hashParams = new URLSearchParams(window.location.hash.substring(1));
    const type = hashParams.get('type');
    const accessToken = hashParams.get('access_token');

    // パスワードリセット用のURLの場合、パスを変更
    if ((type === 'recovery' || type === 'signup') && accessToken) {
      const newUrl = `/reset-password${window.location.hash}`;
      window.history.replaceState({}, '', newUrl);
    }
  }, []);

  // パスをチェックしてパスワードリセットページを表示
  const isResetPasswordPage = window.location.pathname === '/reset-password';

  return (
    <ThemeProvider>
      <AuthProvider>
        <div className="min-h-screen bg-gray-100 dark:bg-gray-900">
          {isResetPasswordPage ? <ResetPasswordPage /> : <Home />}
        </div>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;