import React, { useEffect, useState } from "react";
import { Video } from "../types/youtube";
import { RefreshCw } from "lucide-react";
import VideoPlayer from "./VideoPlayer";

interface VideoListProps {
  channelId: string;
  onBack: () => void;
}

export default function VideoList({ channelId, onBack }: VideoListProps) {
  const [videos, setVideos] = useState<Video[]>([]);
  const [selectedVideo, setSelectedVideo] = useState<Video | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isRetrying, setIsRetrying] = useState(false);

  // ---------------------
  // 追加: キャッシュ管理用の定数
  // ---------------------
  const ONE_DAY_MS = 24 * 60 * 60 * 1000;

  // 何らかの形でキャッシュ保存する例 (LocalStorage など)
  const getCachedVideos = (channelId: string) => {
    const cacheString = localStorage.getItem(`youtubeVideos_${channelId}`);
    if (!cacheString) return null;

    const cache = JSON.parse(cacheString);
    // データが1日以内に取得されたものであれば再利用
    if (Date.now() - cache.timestamp < ONE_DAY_MS) {
      return cache.videos;
    }
    return null;
  };

  const setCachedVideos = (channelId: string, videos: any) => {
    const cacheData = {
      timestamp: Date.now(),
      videos,
    };
    localStorage.setItem(
      `youtubeVideos_${channelId}`,
      JSON.stringify(cacheData)
    );
  };

  // ---------------------
  // 既存の fetchVideos を修正
  // ---------------------
  const fetchVideos = async (retry = false) => {
    try {
      if (retry) {
        setIsRetrying(true);
      }
      setIsLoading(true);
      setError(null);

      // ====== 1. キャッシュを確認 ======
      const cached = getCachedVideos(channelId);
      if (cached) {
        console.log("Using cached videos (less than 1 day old).");
        setVideos(cached);
        const randomIndex = Math.floor(Math.random() * cached.length);
        setSelectedVideo(cached[randomIndex]);
        return;
      }

      // ====== 2. YouTube API キーの確認 ======
      const apiKey = import.meta.env.VITE_YOUTUBE_API_KEY;
      if (!apiKey) {
        throw new Error("YouTube API キーが設定されていません");
      }

      // ====== 3. API 呼び出し ======
      const response = await fetch(
        `https://www.googleapis.com/youtube/v3/search?part=snippet&channelId=${channelId}&order=date&type=video&maxResults=50&key=${apiKey}`
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error?.message || "動画の取得に失敗しました");
      }

      const data = await response.json();

      if (!data.items || data.items.length === 0) {
        throw new Error("動画が見つかりませんでした");
      }

      // short動画を除外
      const videos: Video[] = data.items
        .filter(
          (item: any) => !item.snippet.title.toLowerCase().includes("shorts")
        )
        .map((item: any) => ({
          id: item.id.videoId,
          title: item.snippet.title,
          thumbnail: item.snippet.thumbnails.medium.url,
          publishedAt: new Date(item.snippet.publishedAt),
          description: item.snippet.description,
        }));

      if (videos.length === 0) {
        throw new Error("フィルタリング後に動画が見つかりませんでした");
      }

      // ====== 4. 取得結果をキャッシュに保存 (timestamp付き) ======
      setCachedVideos(channelId, videos);

      // ====== 5. ランダム選択して状態を更新 ======
      setVideos(videos);
      const randomIndex = Math.floor(Math.random() * videos.length);
      setSelectedVideo(videos[randomIndex]);
    } catch (err) {
      console.error("Error fetching videos:", err);
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("予期せぬエラーが発生しました");
      }
    } finally {
      setIsLoading(false);
      setIsRetrying(false);
    }
  };

  useEffect(() => {
    fetchVideos();
  }, [channelId]);

  const handleNextVideo = () => {
    if (videos.length === 0) return;

    // ランダムに次の動画を選択
    const randomIndex = Math.floor(Math.random() * videos.length);
    setSelectedVideo(videos[randomIndex]);
  };

  if (isLoading) {
    return (
      <div className="text-center py-4">
        <p className="text-gray-600 dark:text-gray-400">動画を読み込み中...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-8 space-y-4">
        <div className="text-red-600 dark:text-red-400">{error}</div>
        <button
          onClick={() => fetchVideos(true)}
          disabled={isRetrying}
          className="flex items-center justify-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors disabled:bg-blue-400 disabled:cursor-not-allowed"
        >
          <RefreshCw
            className={`w-5 h-5 ${isRetrying ? "animate-spin" : ""}`}
          />
          再試行
        </button>
      </div>
    );
  }

  if (videos.length === 0) {
    return (
      <div className="text-center py-4">
        <p className="text-gray-600 dark:text-gray-400">
          動画が見つかりませんでした
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <button
          onClick={onBack}
          className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 font-medium transition-colors"
        >
          ← チャンネル一覧に戻る
        </button>
        <button
          onClick={handleNextVideo}
          className="flex items-center gap-2 text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 font-medium transition-colors"
        >
          次の動画
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>
      {selectedVideo && (
        <VideoPlayer key={selectedVideo.id} videoId={selectedVideo.id} />
      )}
    </div>
  );
}
