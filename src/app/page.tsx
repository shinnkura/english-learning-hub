import React, { useState } from "react";
import {
  Plus,
  Sun,
  Moon,
  Sparkles,
  FileText,
} from "lucide-react";
import CategoryList from "../components/CategoryList";
import AddCategoryDialog from "../components/AddCategoryDialog";
import FlashcardView from "../components/FlashcardView";
import { useTheme } from "../contexts/ThemeContext";
import { Link } from "react-router-dom";
import Footer from "../components/Footer";

export default function Home() {
  const [isAddCategoryOpen, setIsAddCategoryOpen] = useState(false);
  const [showFlashcards, setShowFlashcards] = useState(false);
  const { theme, toggleTheme } = useTheme();
  const [key, setKey] = useState(0);

  const handleCategoryAdded = () => {
    setKey((prev) => prev + 1);
  };

  const handleTitleClick = () => {
    setShowFlashcards(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800">
      <div className="container mx-auto px-4 py-8">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-4">
          <div className="flex items-center gap-3">
            <button
              onClick={handleTitleClick}
              className="flex items-center gap-2 text-2xl sm:text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-500 to-indigo-500 dark:from-blue-400 dark:to-indigo-400 hover:from-indigo-500 hover:to-blue-500 dark:hover:from-indigo-400 dark:hover:to-blue-400 transition-all duration-300"
            >
              <Sparkles className="w-8 h-8" />
              <span>English Learning Hub</span>
            </button>
          </div>

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
              className="p-2 rounded-full bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 transition-all duration-300 text-gray-600 dark:text-gray-300"
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
          </div>
        </div>

        <div className="mb-8">
          <button
            onClick={() => setIsAddCategoryOpen(true)}
            className="flex items-center gap-2 px-6 py-3 text-white bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 rounded-full shadow-lg hover:shadow-xl transition-all duration-300"
          >
            <Plus className="w-5 h-5" />
            カテゴリを追加
          </button>
        </div>

        <div className="transform hover:scale-[1.01] transition-transform duration-300">
          {showFlashcards ? (
            <FlashcardView onClose={() => setShowFlashcards(false)} />
          ) : (
            <CategoryList key={key} />
          )}
        </div>

        <AddCategoryDialog
          data-add-category
          open={isAddCategoryOpen}
          onOpenChange={setIsAddCategoryOpen}
          onCategoryAdded={handleCategoryAdded}
        />
      </div>
      <Footer />
    </div>
  );
}
