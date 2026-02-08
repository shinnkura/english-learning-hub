import React, { useEffect, useState } from "react";
import { db } from "../lib/db";
import type { Category } from "../types/youtube";
import { Pencil, Trash2, Plus } from "lucide-react";
import ChannelList from "./ChannelList";
import AddChannelDialog from "./AddChannelDialog";
import EditCategoryDialog from "./EditCategoryDialog";

export default function CategoryList() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isAddChannelOpen, setIsAddChannelOpen] = useState(false);
  const [isEditCategoryOpen, setIsEditCategoryOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(
    null
  );

  const fetchCategories = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const data = await db.categories.findAll();
      setCategories(data as Category[]);
    } catch (err) {
      console.error("Error:", err);
      setError("カテゴリの取得に失敗しました");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchCategories();
  }, []);

  const handleDelete = async (id: string) => {
    try {
      await db.categories.delete(id);
      await fetchCategories();
    } catch (err) {
      console.error("Error:", err);
      setError("カテゴリの削除に失敗しました");
    }
  };

  const handleAddChannel = (category: Category) => {
    setSelectedCategory(category);
    setIsAddChannelOpen(true);
  };

  const handleEditCategory = (category: Category) => {
    setSelectedCategory(category);
    setIsEditCategoryOpen(true);
  };

  if (isLoading) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-600 dark:text-gray-400">読み込み中...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-8">
        <p className="text-red-600 dark:text-red-400">{error}</p>
      </div>
    );
  }

  if (categories.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-600 dark:text-gray-400">カテゴリがありません</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {categories.map((category) => (
        <div key={category.id} className="space-y-6">
          <div className="flex items-center justify-between bg-gradient-to-r from-white/90 to-white/70 dark:from-gray-800/90 dark:to-gray-800/70 backdrop-blur-sm rounded-2xl p-6 shadow-lg hover:shadow-xl transition-all duration-300">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              {category.name}
            </h2>
            <div className="flex gap-2">
              <button
                onClick={() => handleAddChannel(category)}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 rounded-full shadow-sm hover:shadow-md transition-all duration-300"
                title="チャンネルを追加"
              >
                <Plus className="w-4 h-4" />
                <span>チャンネル追加</span>
              </button>
              <button
                onClick={() => handleEditCategory(category)}
                className="text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full"
                title="カテゴリを編集"
              >
                <Pencil className="w-5 h-5" />
              </button>
              <button
                onClick={() => handleDelete(category.id)}
                className="text-gray-600 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400 transition-colors p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full"
                title="カテゴリを削除"
              >
                <Trash2 className="w-5 h-5" />
              </button>
            </div>
          </div>
          <ChannelList categoryId={category.id} />
        </div>
      ))}
      {selectedCategory && (
        <>
          <AddChannelDialog
            open={isAddChannelOpen}
            onOpenChange={setIsAddChannelOpen}
            onChannelAdded={fetchCategories}
            category={selectedCategory}
          />
          <EditCategoryDialog
            open={isEditCategoryOpen}
            onOpenChange={setIsEditCategoryOpen}
            onCategoryUpdated={fetchCategories}
            category={selectedCategory}
          />
        </>
      )}
    </div>
  );
}
