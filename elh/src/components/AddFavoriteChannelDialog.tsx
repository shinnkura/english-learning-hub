import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./ui/Dialog";
import { db } from "../lib/db";
import { Category } from "../types/youtube";

interface AddFavoriteChannelDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onChannelAdded: () => void;
}

export default function AddFavoriteChannelDialog({
  open,
  onOpenChange,
  onChannelAdded,
}: AddFavoriteChannelDialogProps) {
  const [channelUrl, setChannelUrl] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>("");

  useEffect(() => {
    if (open) {
      loadCategories();
    }
  }, [open]);

  const loadCategories = async () => {
    try {
      const data = await db.categories.findAll();
      setCategories(data as Category[]);
      if (data.length > 0 && !selectedCategoryId) {
        setSelectedCategoryId((data[0] as Category).id);
      }
    } catch (error) {
      console.error('Failed to load categories:', error);
    }
  };

  const extractChannelIdentifier = (
    url: string
  ): { type: "id" | "handle" | "custom"; value: string } => {
    try {
      const urlObj = new URL(url);

      if (
        urlObj.hostname === "www.youtube.com" ||
        urlObj.hostname === "youtube.com"
      ) {
        if (urlObj.pathname.startsWith("/channel/")) {
          const channelId = urlObj.pathname.split("/")[2];
          if (channelId && channelId.length > 0) {
            return { type: "id", value: channelId };
          }
        }

        if (urlObj.pathname.startsWith("/@")) {
          const username = urlObj.pathname.slice(2);
          if (username && username.length > 0) {
            return { type: "handle", value: username };
          }
        }

        if (urlObj.pathname.startsWith("/c/")) {
          const customName = urlObj.pathname.slice(3);
          if (customName && customName.length > 0) {
            return { type: "custom", value: customName };
          }
        }
      }

      throw new Error(
        "無効なYouTubeチャンネルURLです。チャンネルページのURLを入力してください。"
      );
    } catch (err) {
      if (err instanceof Error) {
        throw new Error(err.message);
      }
      throw new Error("無効なURL形式です。正しいURLを入力してください。");
    }
  };

  const ONE_DAY_MS = 24 * 60 * 60 * 1000;

  const fetchChannelInfo = async (identifier: {
    type: "id" | "handle" | "custom";
    value: string;
  }) => {
    const cacheKey = `channelInfo_${identifier.type}_${identifier.value}`;

    const cachedString = localStorage.getItem(cacheKey);
    if (cachedString) {
      const cached = JSON.parse(cachedString) as {
        data: { channelId: string; channelName: string; thumbnailUrl?: string };
        timestamp: number;
      };
      if (Date.now() - cached.timestamp < ONE_DAY_MS) {
        return cached.data;
      }
    }

    try {
      const apiKey = import.meta.env.VITE_YOUTUBE_API_KEY;
      if (!apiKey) {
        throw new Error("YouTube API キーが設定されていません");
      }

      let endpoint =
        "https://www.googleapis.com/youtube/v3/channels?part=snippet";
      if (identifier.type === "id") {
        endpoint += `&id=${identifier.value}`;
      } else if (identifier.type === "handle" || identifier.type === "custom") {
        endpoint += `&forHandle=@${identifier.value}`;
      }
      endpoint += `&key=${apiKey}`;

      const response = await fetch(endpoint);
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(
          data.error?.message || "YouTubeチャンネルの情報取得に失敗しました"
        );
      }

      const data = await response.json();

      if (!data.items || data.items.length === 0) {
        if (identifier.type === "handle" || identifier.type === "custom") {
          const searchEndpoint = `https://www.googleapis.com/youtube/v3/search?part=snippet&type=channel&q=${identifier.value}&key=${apiKey}`;
          const searchResponse = await fetch(searchEndpoint);
          if (!searchResponse.ok) {
            throw new Error("チャンネルの検索に失敗しました");
          }

          const searchData = await searchResponse.json();
          if (!searchData.items || searchData.items.length === 0) {
            throw new Error(
              "チャンネルが見つかりませんでした。URLを確認してください。"
            );
          }
          const fallbackResult = {
            channelId: searchData.items[0].id.channelId,
            channelName: searchData.items[0].snippet.channelTitle,
            thumbnailUrl: searchData.items[0].snippet.thumbnails?.default?.url,
          };
          localStorage.setItem(
            cacheKey,
            JSON.stringify({ data: fallbackResult, timestamp: Date.now() })
          );
          return fallbackResult;
        }

        throw new Error(
          "チャンネルが見つかりませんでした。URLを確認してください。"
        );
      }

      const result = {
        channelId: data.items[0].id,
        channelName: data.items[0].snippet.title,
        thumbnailUrl: data.items[0].snippet.thumbnails?.default?.url,
      };

      localStorage.setItem(
        cacheKey,
        JSON.stringify({
          data: result,
          timestamp: Date.now(),
        })
      );

      return result;
    } catch (err) {
      if (err instanceof Error) {
        throw new Error(err.message);
      }
      throw new Error("チャンネル情報の取得中にエラーが発生しました");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      // Ensure we have a category
      let categoryId = selectedCategoryId;
      if (!categoryId) {
        // Create a default category if none exists
        const defaultCategory = await db.categories.create({ name: "お気に入り" });
        categoryId = defaultCategory.id;
      }

      const channelIdentifier = extractChannelIdentifier(channelUrl);
      const channelInfo = await fetchChannelInfo(channelIdentifier);

      // Check if channel already exists
      const existingChannels = await db.channels.findByCategoryAndChannelId(
        categoryId,
        channelInfo.channelId
      );

      if (existingChannels && existingChannels.length > 0) {
        // Channel exists, just make it favorite
        await db.channels.setFavorite((existingChannels[0] as any).id, true);
      } else {
        // Create new channel
        await db.channels.create({
          category_id: categoryId,
          channel_id: channelInfo.channelId,
          channel_name: channelInfo.channelName,
          thumbnail_url: channelInfo.thumbnailUrl,
        });
      }

      setChannelUrl("");
      onChannelAdded();
      onOpenChange(false);
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("予期せぬエラーが発生しました");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>お気に入りチャンネルを追加</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="p-3 rounded-md bg-red-50 dark:bg-red-900/30 text-red-800 dark:text-red-300">{error}</div>
          )}
          <div>
            <label
              htmlFor="channelUrl"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300"
            >
              YouTubeチャンネルのURL
            </label>
            <input
              type="url"
              id="channelUrl"
              value={channelUrl}
              onChange={(e) => setChannelUrl(e.target.value)}
              placeholder="https://www.youtube.com/@channel"
              className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm focus:border-blue-500 focus:ring-blue-500 px-3 py-2"
              required
            />
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              例: https://www.youtube.com/@TED-Ed
            </p>
          </div>

          {categories.length > 0 && (
            <div>
              <label
                htmlFor="category"
                className="block text-sm font-medium text-gray-700 dark:text-gray-300"
              >
                カテゴリ
              </label>
              <select
                id="category"
                value={selectedCategoryId}
                onChange={(e) => setSelectedCategoryId(e.target.value)}
                className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm focus:border-blue-500 focus:ring-blue-500 px-3 py-2"
              >
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
            >
              キャンセル
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors disabled:bg-blue-400 disabled:cursor-not-allowed"
            >
              {isSubmitting ? "追加中..." : "追加"}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
