import { useEffect, useState } from "react";
import { Video } from "../types/youtube";
import { RefreshCw } from "lucide-react";
import VideoPlayer from "./VideoPlayer";

interface VideoListProps {
  channelId: string;
}

export default function VideoList({ channelId }: VideoListProps) {
  const [videos, setVideos] = useState<Video[]>([]);
  const [selectedVideo, setSelectedVideo] = useState<Video | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isRetrying, setIsRetrying] = useState(false);

  const fetchVideos = async (retry = false) => {
    try {
      if (retry) {
        setIsRetrying(true);
      }
      setIsLoading(true);
      setError(null);

      const apiKey = import.meta.env.VITE_YOUTUBE_API_KEY;
      if (!apiKey) {
        throw new Error("YouTube API キーが設定されていません");
      }

      const response = await fetch(
        `https://www.googleapis.com/youtube/v3/search?part=snippet&channelId=${channelId}&order=date&type=video&maxResults=10&key=${apiKey}`
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error?.message || "動画の取得に失敗しました");
      }

      const data = await response.json();

      if (!data.items || data.items.length === 0) {
        throw new Error("動画が見つかりませんでした");
      }

      const videos: Video[] = data.items.map((item: any) => ({
        id: item.id.videoId,
        title: item.snippet.title,
        thumbnail: item.snippet.thumbnails.medium.url,
        publishedAt: new Date(item.snippet.publishedAt),
        description: item.snippet.description,
      }));

      setVideos(videos);

      // ランダムに1つの動画を選択
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
      {selectedVideo && (
        <VideoPlayer key={selectedVideo.id} videoId={selectedVideo.id} />
      )}
    </div>
  );
}
