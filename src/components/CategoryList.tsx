import React, { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import type { Category } from "../types/youtube";
import { Pencil, Trash2, ChevronDown, ChevronUp, Plus } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import ChannelList from "./ChannelList";
import AddChannelDialog from "./AddChannelDialog";
import EditCategoryDialog from "./EditCategoryDialog";

export default function CategoryList() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);
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
    <div className="space-y-4">
      {categories.map((category) => (
        <div
          key={category.id}
          className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm rounded-lg shadow-lg overflow-hidden transition-all duration-300 hover:shadow-xl"
        >
          <div className="p-4">
            <div className="flex flex-col sm:flex-row sm:items-center gap-4">
              <button
                onClick={() =>
                  setExpandedCategory(
                    expandedCategory === category.id ? null : category.id
                  )
                }
                className="flex items-center gap-2 text-lg font-semibold text-gray-900 dark:text-white hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
              >
                {category.name}
                {expandedCategory === category.id ? (
                  <ChevronUp className="w-5 h-5" />
                ) : (
                  <ChevronDown className="w-5 h-5" />
                )}
              </button>
              <div className="flex gap-2 sm:ml-auto">
                <button
                  onClick={() => handleAddChannel(category)}
                  className="text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors p-2"
                  title="チャンネルを追加"
                >
                  <Plus className="w-5 h-5" />
                </button>
                <button
                  onClick={() => handleEditCategory(category)}
                  className="text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors p-2"
                  title="カテゴリを編集"
                >
                  <Pencil className="w-5 h-5" />
                </button>
                <button
                  onClick={() => handleDelete(category.id)}
                  className="text-gray-600 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400 transition-colors p-2"
                  title="カテゴリを削除"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>
          {expandedCategory === category.id && (
            <div className="border-t border-gray-100 dark:border-gray-700 p-4">
              <ChannelList categoryId={category.id} />
            </div>
          )}
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
