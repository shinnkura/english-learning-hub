import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./ui/Dialog";
import { useAuth } from "../contexts/AuthContext";
import {
  LogIn,
  UserPlus,
  Mail,
  Lock,
  ArrowRight,
  Loader2,
  ArrowLeft,
} from "lucide-react";

interface AuthDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type AuthMode = "login" | "signup" | "reset";

export default function AuthDialog({ open, onOpenChange }: AuthDialogProps) {
  const [mode, setMode] = useState<AuthMode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [resetEmailSent, setResetEmailSent] = useState(false);
  const [resetTimeout, setResetTimeout] = useState(0);
  const { signIn, signUp, resetPassword } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      if (mode === "signup") {
        await signUp(email, password);
        setError("確認メールを送信しました。メールを確認してください。");
      } else if (mode === "login") {
        await signIn(email, password);
        onOpenChange(false);
      } else if (mode === "reset") {
        if (resetEmailSent) {
          setError(
            `セキュリティのため、${resetTimeout}秒後に再度送信できます。`
          );
          return;
        }

        await resetPassword(email);
        setError(
          "パスワード再設定用のメールを送信しました。メールを確認してください。"
        );
        setResetEmailSent(true);

        // 60秒のカウントダウンを開始
        let timeLeft = 60;
        setResetTimeout(timeLeft);

        const timer = setInterval(() => {
          timeLeft -= 1;
          setResetTimeout(timeLeft);

          if (timeLeft <= 0) {
            clearInterval(timer);
            setResetEmailSent(false);
          }
        }, 1000);
      }
    } catch (err: any) {
      if (err.message === "Invalid login credentials") {
        setError("メールアドレスまたはパスワードが正しくありません");
      } else if (err.message?.includes("Password should be")) {
        setError("パスワードは8文字以上である必要があります");
      } else if (err.message?.includes("Email not confirmed")) {
        setError(
          "メールアドレスの確認が完了していません。確認メールをご確認ください"
        );
      } else if (err.message?.includes("over_email_send_rate_limit")) {
        setError("セキュリティのため、しばらく待ってから再度お試しください。");
        setResetEmailSent(true);
        setResetTimeout(33); // Supabaseのレート制限に合わせる
      } else {
        setError("エラーが発生しました。もう一度お試しください");
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleModeChange = (newMode: AuthMode) => {
    setMode(newMode);
    setError(null);
    setEmail("");
    setPassword("");
    setResetEmailSent(false);
    setResetTimeout(0);
  };

  const renderTitle = () => {
    switch (mode) {
      case "signup":
        return (
          <>
            <UserPlus className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            アカウント作成
          </>
        );
      case "reset":
        return (
          <>
            <Lock className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            パスワード再設定
          </>
        );
      default:
        return (
          <>
            <LogIn className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            ログイン
          </>
        );
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px] bg-white dark:bg-gray-800">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-2xl text-gray-900 dark:text-white">
            {renderTitle()}
          </DialogTitle>
        </DialogHeader>

        <div className="mt-4">
          {error && (
            <div
              className={`p-4 rounded-lg mb-4 ${
                error.includes("確認メール") ||
                error.includes("再設定") ||
                error.includes("セキュリティ")
                  ? "bg-blue-50 text-blue-800 dark:bg-blue-900/50 dark:text-blue-200"
                  : "bg-red-50 text-red-800 dark:bg-red-900/50 dark:text-red-200"
              }`}
            >
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-4">
              <div>
                <label
                  htmlFor="email"
                  className="block text-sm font-medium text-gray-900 dark:text-white mb-1"
                >
                  メールアドレス
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400 dark:text-gray-500" />
                  <input
                    type="email"
                    id="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="pl-10 w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-4 py-2.5 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent transition-colors"
                    placeholder="example@email.com"
                    required
                  />
                </div>
              </div>

              {mode !== "reset" && (
                <div>
                  <label
                    htmlFor="password"
                    className="block text-sm font-medium text-gray-900 dark:text-white mb-1"
                  >
                    パスワード
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400 dark:text-gray-500" />
                    <input
                      type="password"
                      id="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="pl-10 w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-4 py-2.5 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent transition-colors"
                      placeholder={
                        mode === "signup"
                          ? "8文字以上で入力"
                          : "パスワードを入力"
                      }
                      required
                      minLength={8}
                    />
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-4">
              <button
                type="submit"
                disabled={isLoading || (mode === "reset" && resetEmailSent)}
                className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-blue-500 to-indigo-600 text-white px-4 py-3 rounded-lg font-medium hover:from-blue-600 hover:to-indigo-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <>
                    {mode === "signup"
                      ? "アカウントを作成"
                      : mode === "reset"
                      ? "メールを送信"
                      : "ログイン"}
                    <ArrowRight className="w-5 h-5" />
                  </>
                )}
              </button>

              {mode === "reset" && resetEmailSent && resetTimeout > 0 && (
                <p className="text-sm text-center text-gray-600 dark:text-gray-400">
                  {resetTimeout}秒後に再度送信できます
                </p>
              )}

              <div className="space-y-2">
                {mode === "reset" ? (
                  <button
                    type="button"
                    onClick={() => handleModeChange("login")}
                    className="w-full flex items-center justify-center gap-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 transition-colors"
                  >
                    <ArrowLeft className="w-4 h-4" />
                    ログイン画面に戻る
                  </button>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() =>
                        handleModeChange(mode === "login" ? "signup" : "login")
                      }
                      className="w-full text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 transition-colors"
                    >
                      {mode === "login"
                        ? "アカウントをお持ちでない方"
                        : "すでにアカウントをお持ちの方"}
                      は
                      <span className="text-blue-600 dark:text-blue-400 font-medium">
                        {mode === "login" ? "こちら" : "こちら"}
                      </span>
                    </button>
                    {mode === "login" && (
                      <button
                        type="button"
                        onClick={() => handleModeChange("reset")}
                        className="w-full text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 transition-colors"
                      >
                        パスワードをお忘れの方は
                        <span className="text-blue-600 dark:text-blue-400 font-medium">
                          こちら
                        </span>
                      </button>
                    )}
                  </>
                )}
              </div>
            </div>
          </form>
        </div>
      </DialogContent>
    </Dialog>
  );
}
