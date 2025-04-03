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

  // const handleVideoSelect = (video: Video) => {
  //   setSelectedVideo(video);
  // };

  // const formatDate = (date: Date) => {
  //   return new Intl.DateTimeFormat("ja-JP", {
  //     year: "numeric",
  //     month: "long",
  //     day: "numeric",
  //   }).format(date);
  // };

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
          <RefreshCw className={`w-5 h-5 ${isRetrying ? "animate-spin" : ""}`} />
          再試行
        </button>
      </div>
    );
  }

  if (videos.length === 0) {
    return (
      <div className="text-center py-4">
        <p className="text-gray-600 dark:text-gray-400">動画が見つかりませんでした</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {selectedVideo && (
        <>
          {/* <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden">
            <div className="flex flex-col sm:flex-row items-start gap-4 p-4">
              <img
                src={selectedVideo.thumbnail}
                alt={selectedVideo.title}
                className="w-full sm:w-[320px] h-[180px] object-cover rounded-md"
              />
              <div className="flex-1 min-w-0">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">{selectedVideo.title}</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 flex items-center gap-2 mb-2">
                  <Calendar className="w-4 h-4" />
                  {formatDate(selectedVideo.publishedAt)}
                </p>
                <p className="text-gray-700 dark:text-gray-300 text-sm">{selectedVideo.description}</p>
              </div>
            </div>
          </div> */}
          <VideoPlayer key={selectedVideo.id} videoId={selectedVideo.id} />
        </>
      )}

      {/* <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-4">
        <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">他の動画</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {videos.map((video) => (
            <button
              key={video.id}
              onClick={() => handleVideoSelect(video)}
              className={`text-left rounded-lg overflow-hidden transition-all duration-300 ${
                selectedVideo?.id === video.id
                  ? 'ring-2 ring-blue-500 dark:ring-blue-400'
                  : 'hover:bg-gray-50 dark:hover:bg-gray-700/50'
              }`}
            >
              <div className="relative">
                <img
                  src={video.thumbnail}
                  alt={video.title}
                  className="w-full h-[180px] object-cover"
                />
                {selectedVideo?.id === video.id && (
                  <div className="absolute inset-0 bg-blue-500/10 flex items-center justify-center">
                    <Play className="w-12 h-12 text-blue-500" />
                  </div>
                )}
              </div>
              <div className="p-3">
                <h4 className="font-medium text-gray-900 dark:text-white line-clamp-2 mb-1">
                  {video.title}
                </h4>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {formatDate(video.publishedAt)}
                </p>
              </div>
            </button>
          ))}
        </div>
      </div> */}
    </div>
  );
}
