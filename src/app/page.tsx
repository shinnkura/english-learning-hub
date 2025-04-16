import React, { useState } from "react";
import {
  Plus,
  LogIn,
  BookOpen,
  Menu,
  Sun,
  Moon,
  Sparkles,
  BookOpenCheck,
  Users,
  FileText,
} from "lucide-react";
import CategoryList from "../components/CategoryList";
import AddCategoryDialog from "../components/AddCategoryDialog";
import AuthDialog from "../components/AuthDialog";
import FlashcardView from "../components/FlashcardView";
import ActivityGraph from "../components/ActivityGraph";
import { useAuth } from "../contexts/AuthContext";
import { useTheme } from "../contexts/ThemeContext";
import { Link } from "react-router-dom";

export default function Home() {
  const [isAddCategoryOpen, setIsAddCategoryOpen] = useState(false);
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [showFlashcards, setShowFlashcards] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const { user, signOut } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [key, setKey] = useState(0);

  const handleCategoryAdded = () => {
    setKey((prev) => prev + 1);
  };

  const handleTitleClick = () => {
    setShowFlashcards(false);
  };

  const handleMenuToggle = () => {
    setIsMenuOpen(!isMenuOpen);
  };

  const features = [
    {
      icon: (
        <img
          src="/youtube_social_icon_red.png"
          alt="YouTube"
          width={48}
          height={48}
        />
      ),
      title: "YouTubeで英語学習",
      description:
        "お気に入りのYouTube動画で楽しく英語を学習。字幕を使って効果的に学べます。",
    },
    {
      icon: <BookOpenCheck className="w-12 h-12 text-green-500" />,
      title: "単語の管理と復習",
      description:
        "動画から学んだ単語を保存し、効率的に復習。スペース反復システムで記憶を定着。",
    },
    {
      icon: <Users className="w-12 h-12 text-blue-500" />,
      title: "カテゴリ管理",
      description:
        "チャンネルをカテゴリごとに整理して、効率的に学習を進められます。",
    },
  ];

  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800">
        <div className="container mx-auto px-4 py-8">
          {/* Header */}
          <div className="flex justify-between items-center mb-16">
            <div className="flex items-center gap-2 text-2xl sm:text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-purple-600 dark:from-blue-400 dark:to-purple-400">
              <Sparkles className="w-8 h-8" />
              <span className="hidden sm:inline">English Learning Hub</span>
              <span className="sm:hidden">EL Hub</span>
            </div>
            <div className="flex items-center gap-2 sm:gap-4">
              <Link
                to="/legal"
                className="flex items-center gap-1 text-gray-600 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 transition-colors duration-300"
              >
                <FileText className="w-5 h-5" />
                <span className="hidden sm:inline">利用規約</span>
              </Link>
              <button
                onClick={toggleTheme}
                className="p-2 rounded-full bg-white dark:bg-gray-800 shadow-lg hover:shadow-xl transition-all duration-300 text-gray-600 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400"
                title={
                  theme === "dark"
                    ? "ライトモードに切り替え"
                    : "ダークモードに切り替え"
                }
              >
                {theme === "dark" ? (
                  <Sun className="w-5 h-5" />
                ) : (
                  <Moon className="w-5 h-5" />
                )}
              </button>
              <button
                onClick={() => setIsAuthOpen(true)}
                className="flex items-center justify-center gap-1 sm:gap-2 bg-gradient-to-r from-blue-500 to-indigo-600 text-white px-3 sm:px-6 py-2 sm:py-2.5 rounded-full text-sm sm:text-base shadow-lg hover:shadow-xl hover:translate-y-[-1px] transition-all duration-300 min-w-[80px] sm:min-w-[100px]"
              >
                <LogIn className="w-4 h-4 sm:w-5 sm:h-5" />
                <span>ログイン</span>
              </button>
            </div>
          </div>

          {/* Hero Section */}
          <div className="text-center mb-16">
            <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold text-gray-900 dark:text-white mb-6">
              YouTubeで楽しく
              <span className="bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-purple-600 dark:from-blue-400 dark:to-purple-400">
                {" "}
                英語学習
              </span>
            </h1>
            <p className="text-xl text-gray-600 dark:text-gray-300 mb-8 max-w-2xl mx-auto">
              お気に入りのYouTube動画で英語を学習。字幕から単語を保存して、効率的に復習できます。
            </p>
            <button
              onClick={() => setIsAuthOpen(true)}
              className="inline-flex items-center gap-2 bg-gradient-to-r from-blue-500 to-indigo-600 text-white px-8 py-4 rounded-full text-lg font-semibold shadow-lg hover:shadow-xl hover:translate-y-[-1px] transition-all duration-300"
            >
              <LogIn className="w-6 h-6" />
              無料で始める
            </button>
          </div>

          {/* Features */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-16">
            {features.map((feature, index) => (
              <div
                key={index}
                className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-lg hover:shadow-xl transition-all duration-300"
              >
                <div className="flex flex-col items-center text-center">
                  <div className="mb-4 p-3 bg-gray-50 dark:bg-gray-700 rounded-full">
                    {feature.icon}
                  </div>
                  <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                    {feature.title}
                  </h3>
                  <p className="text-gray-600 dark:text-gray-300">
                    {feature.description}
                  </p>
                </div>
              </div>
            ))}
          </div>

          {/* Call to Action */}
          <div className="text-center bg-gradient-to-r from-blue-500 to-indigo-600 rounded-2xl p-8 shadow-xl">
            <h2 className="text-3xl font-bold text-white mb-4">
              今すぐ始めましょう
            </h2>
            <p className="text-blue-100 mb-6">
              無料アカウントを作成して、YouTubeで英語学習を始めましょう。
            </p>
            <button
              onClick={() => setIsAuthOpen(true)}
              className="bg-white text-blue-600 px-8 py-3 rounded-full font-semibold hover:shadow-lg hover:translate-y-[-1px] transition-all duration-300"
            >
              アカウントを作成
            </button>
          </div>
        </div>

        <AuthDialog open={isAuthOpen} onOpenChange={setIsAuthOpen} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800">
      <div className="container mx-auto px-4 py-8">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-4">
          <button
            onClick={handleTitleClick}
            className="flex items-center gap-2 text-2xl sm:text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-purple-600 dark:from-blue-400 dark:to-purple-400 hover:from-purple-600 hover:to-blue-600 dark:hover:from-purple-400 dark:hover:to-blue-400 transition-all duration-300"
          >
            <Sparkles className="w-8 h-8" />
            English Learning Hub
          </button>

          <div className="flex items-center gap-4">
            <Link
              to="/legal"
              className="flex items-center gap-1 text-gray-600 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 transition-colors duration-300"
            >
              <FileText className="w-5 h-5" />
              <span className="hidden sm:inline">利用規約</span>
            </Link>
            <button
              onClick={toggleTheme}
              className="p-2 rounded-full bg-white dark:bg-gray-800 shadow-lg hover:shadow-xl transition-all duration-300 text-gray-600 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400"
              title={
                theme === "dark"
                  ? "ライトモードに切り替え"
                  : "ダークモードに切り替え"
              }
            >
              {theme === "dark" ? (
                <Sun className="w-5 h-5" />
              ) : (
                <Moon className="w-5 h-5" />
              )}
            </button>

            <button
              onClick={handleMenuToggle}
              className="sm:hidden p-2 rounded-full bg-white dark:bg-gray-800 shadow-lg hover:shadow-xl transition-all duration-300 text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white"
            >
              <Menu className="w-6 h-6" />
            </button>
          </div>

          <div
            className={`
            flex flex-col sm:flex-row gap-3 w-full sm:w-auto
            ${isMenuOpen ? "block" : "hidden"} sm:flex
          `}
          >
            <button
              onClick={() => setShowFlashcards(!showFlashcards)}
              className="flex items-center justify-center gap-2 bg-gradient-to-r from-green-500 to-emerald-600 dark:from-green-600 dark:to-emerald-700 text-white px-6 py-2.5 rounded-full shadow-lg hover:shadow-xl hover:translate-y-[-1px] transition-all duration-300 w-full sm:w-auto"
            >
              <BookOpen className="w-5 h-5" />
              {showFlashcards ? "学習を終了" : "単語を復習"}
            </button>
            <button
              onClick={() => setIsAddCategoryOpen(true)}
              className="flex items-center justify-center gap-2 bg-gradient-to-r from-blue-500 to-indigo-600 dark:from-blue-600 dark:to-indigo-700 text-white px-6 py-2.5 rounded-full shadow-lg hover:shadow-xl hover:translate-y-[-1px] transition-all duration-300 w-full sm:w-auto"
            >
              <Plus className="w-5 h-5" />
              カテゴリを追加
            </button>
            <button
              onClick={() => signOut()}
              className="flex items-center justify-center gap-2 bg-gradient-to-r from-gray-500 to-gray-600 dark:from-gray-600 dark:to-gray-700 text-white px-6 py-2.5 rounded-full shadow-lg hover:shadow-xl hover:translate-y-[-1px] transition-all duration-300 w-full sm:w-auto"
            >
              ログアウト
            </button>
          </div>
        </div>

        {user && !showFlashcards && (
          <div className="mb-8 transform hover:scale-[1.01] transition-transform duration-300">
            <ActivityGraph />
          </div>
        )}

        <div className="transform hover:scale-[1.01] transition-transform duration-300">
          {showFlashcards ? (
            <FlashcardView onClose={() => setShowFlashcards(false)} />
          ) : (
            <CategoryList key={key} />
          )}
        </div>

        <AddCategoryDialog
          open={isAddCategoryOpen}
          onOpenChange={setIsAddCategoryOpen}
          onCategoryAdded={handleCategoryAdded}
        />
        <AuthDialog open={isAuthOpen} onOpenChange={setIsAuthOpen} />
      </div>
    </div>
  );
}
