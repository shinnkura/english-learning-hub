import React, { useEffect, useState } from 'react';
import { RefreshCw, Play, Calendar } from 'lucide-react';
import { db } from '../lib/db';
import { VideoProgress } from '../types/youtube';

interface RetryVideoListProps {
  onPlayVideo: (video: VideoProgress) => void;
}

export default function RetryVideoList({ onPlayVideo }: RetryVideoListProps) {
  const [videos, setVideos] = useState<VideoProgress[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadVideos();
  }, []);

  const loadVideos = async () => {
    try {
      const data = await db.videoProgress.findForRetry();
      setVideos(data as VideoProgress[]);
    } catch (error) {
      console.error('Failed to load retry videos:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2].map((i) => (
          <div key={i} className="h-20 bg-gray-200 dark:bg-gray-700 rounded-xl animate-pulse" />
        ))}
      </div>
    );
  }

  if (videos.length === 0) {
    return (
      <div className="text-center py-8 bg-gray-50 dark:bg-gray-800/50 rounded-xl">
        <RefreshCw className="w-10 h-10 text-gray-300 dark:text-gray-600 mx-auto mb-2" />
        <p className="text-gray-500 dark:text-gray-400">再挑戦する動画はありません</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-orange-500">
        <RefreshCw className="w-5 h-5" />
        <h3 className="font-semibold">再挑戦 ({videos.length})</h3>
      </div>
      {videos.map((video) => (
        <button
          key={video.id}
          onClick={() => onPlayVideo(video)}
          className="w-full flex items-center gap-4 p-4 bg-white dark:bg-gray-800 rounded-xl shadow-sm hover:shadow-md transition-all text-left group"
        >
          <div className="flex-shrink-0 w-20 h-14 bg-gray-200 dark:bg-gray-700 rounded-lg overflow-hidden relative">
            {video.thumbnail_url ? (
              <img
                src={video.thumbnail_url}
                alt={video.video_title}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <Play className="w-5 h-5 text-gray-400" />
              </div>
            )}
            <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
              <Play className="w-6 h-6 text-white" />
            </div>
          </div>
          <div className="flex-1 min-w-0">
            <h4 className="font-medium text-gray-900 dark:text-white line-clamp-1">
              {video.video_title}
            </h4>
            <div className="flex items-center gap-3 text-sm text-gray-500 dark:text-gray-400 mt-1">
              <span className="flex items-center gap-1">
                <RefreshCw className="w-3 h-3" />
                {video.retry_count}回目
              </span>
              <span className="flex items-center gap-1">
                <Calendar className="w-3 h-3" />
                視聴: {video.watch_count}回
              </span>
            </div>
          </div>
          <div className="flex-shrink-0 bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 px-3 py-1 rounded-full text-sm font-medium">
            再挑戦
          </div>
        </button>
      ))}
    </div>
  );
}
