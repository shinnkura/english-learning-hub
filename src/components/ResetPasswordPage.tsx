import React, { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";
import { Lock, Loader2, ArrowRight } from "lucide-react";

export default function ResetPasswordPage() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const setupSession = async () => {
      try {
        // URLからハッシュパラメータを取得
        const hashParams = new URLSearchParams(
          window.location.hash.substring(1)
        );
        const accessToken = hashParams.get("access_token");
        const refreshToken = hashParams.get("refresh_token");

        if (!accessToken || !refreshToken) {
          throw new Error("無効なURLです");
        }

        // セッションを設定
        const { error } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });

        if (error) throw error;
      } catch (err) {
        console.error("Error setting up session:", err);
        if (err instanceof Error) {
          setError(err.message);
        } else {
          setError("セッションの設定に失敗しました");
        }
      }
    };

    setupSession();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      const { error: updateError } = await supabase.auth.updateUser({
        password: password,
      });

      if (updateError) throw updateError;

      setSuccess(true);
      // 3秒後にホームページにリダイレクト
      setTimeout(() => {
        window.location.href = "/";
      }, 3000);
    } catch (err) {
      console.error("Error resetting password:", err);
      if (err instanceof Error) {
        if (err.message.includes("Password should be")) {
          setError("パスワードは8文字以上である必要があります");
        } else {
          setError("パスワードの更新に失敗しました。もう一度お試しください。");
        }
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 space-y-6">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center justify-center gap-2">
              <Lock className="w-6 h-6 text-blue-600 dark:text-blue-400" />
              新しいパスワードを設定
            </h1>
          </div>

          {error && (
            <div className="p-4 rounded-lg bg-red-50 text-red-800 dark:bg-red-900/50 dark:text-red-200">
              {error}
            </div>
          )}

          {success ? (
            <div className="p-4 rounded-lg bg-green-50 text-green-800 dark:bg-green-900/50 dark:text-green-200">
              パスワードを更新しました。ホームページに移動します...
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label
                  htmlFor="password"
                  className="block text-sm font-medium text-gray-900 dark:text-white mb-1"
                >
                  新しいパスワード
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400 dark:text-gray-500" />
                  <input
                    type="password"
                    id="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-10 w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-4 py-2.5 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent transition-colors"
                    placeholder="8文字以上で入力"
                    required
                    minLength={8}
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-blue-500 to-indigo-600 text-white px-4 py-3 rounded-lg font-medium hover:from-blue-600 hover:to-indigo-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <>
                    パスワードを更新
                    <ArrowRight className="w-5 h-5" />
                  </>
                )}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
