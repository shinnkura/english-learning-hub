import React, { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import type { Category } from "../types/youtube";
import { Pencil, Trash2, Plus } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
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
  const { user } = useAuth();

  const fetchCategories = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .from("categories")
        .select("*")
        .order("created_at", { ascending: false });

      if (fetchError) {
        console.error("Error fetching categories:", fetchError);
        setError("カテゴリの取得に失敗しました");
        return;
      }

      setCategories(data || []);
    } catch (err) {
      console.error("Error:", err);
      setError("予期せぬエラーが発生しました");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      fetchCategories();
    } else {
      setCategories([]);
      setIsLoading(false);
    }
  }, [user]);

  const handleDelete = async (id: string) => {
    try {
      const { error: deleteError } = await supabase
        .from("categories")
        .delete()
        .eq("id", id);

      if (deleteError) {
        console.error("Error deleting category:", deleteError);
        setError("カテゴリの削除に失敗しました");
        return;
      }

      await fetchCategories();
    } catch (err) {
      console.error("Error:", err);
      setError("予期せぬエラーが発生しました");
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

  if (!user) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-600 dark:text-gray-400">
          ログインしてカテゴリを管理してください
        </p>
      </div>
    );
  }

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
