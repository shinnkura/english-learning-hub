import React, { useEffect, useState } from 'react';
import { Headphones, Play, Trash2, ArrowLeft, Shuffle } from 'lucide-react';
import { db } from '../lib/db';
import { VideoProgress } from '../types/youtube';

interface CommuteZoneProps {
  onBack: () => void;
  onPlayVideo: (videoId: string, title: string) => void;
}

export default function CommuteZone({ onBack, onPlayVideo }: CommuteZoneProps) {
  const [videos, setVideos] = useState<VideoProgress[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadVideos();
  }, []);

  const loadVideos = async () => {
    try {
      const data = await db.videoProgress.findCommuteZone();
      setVideos(data as VideoProgress[]);
    } catch (error) {
      console.error('Failed to load commute zone:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRemove = async (id: string) => {
    try {
      await db.videoProgress.removeFromCommuteZone(id);
      await loadVideos();
    } catch (error) {
      console.error('Failed to remove from commute zone:', error);
    }
  };

  const handlePlayRandom = () => {
    if (videos.length > 0) {
      const randomVideo = videos[Math.floor(Math.random() * videos.length)];
      onPlayVideo(randomVideo.video_id, randomVideo.video_title);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-24 bg-gray-200 dark:bg-gray-700 rounded-xl animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
          <span>戻る</span>
        </button>
        {videos.length > 0 && (
          <button
            onClick={handlePlayRandom}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-500 text-white rounded-full hover:bg-indigo-600 transition-colors"
          >
            <Shuffle className="w-4 h-4" />
            <span>シャッフル再生</span>
          </button>
        )}
      </div>

      <div className="flex items-center gap-3 p-4 bg-gradient-to-r from-green-500 to-teal-500 rounded-xl text-white">
        <Headphones className="w-8 h-8" />
        <div>
          <h2 className="text-xl font-bold">通勤中に聞くゾーン</h2>
          <p className="text-sm text-white/80">{videos.length} 本の動画</p>
        </div>
      </div>

      {videos.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 dark:bg-gray-800/50 rounded-xl">
          <Headphones className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
          <p className="text-gray-500 dark:text-gray-400">まだ動画がありません</p>
          <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">
            動画を理解できたら自動で追加されます
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {videos.map((video) => (
            <div
              key={video.id}
              className="flex items-center gap-4 p-4 bg-white dark:bg-gray-800 rounded-xl shadow-sm hover:shadow-md transition-all group"
            >
              <div className="flex-shrink-0 w-24 h-16 bg-gray-200 dark:bg-gray-700 rounded-lg overflow-hidden">
                {video.thumbnail_url ? (
                  <img
                    src={video.thumbnail_url}
                    alt={video.video_title}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Play className="w-6 h-6 text-gray-400" />
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-medium text-gray-900 dark:text-white line-clamp-2">
                  {video.video_title}
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  視聴回数: {video.watch_count}回
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => onPlayVideo(video.video_id, video.video_title)}
                  className="p-3 bg-indigo-500 text-white rounded-full hover:bg-indigo-600 transition-colors"
                >
                  <Play className="w-5 h-5" />
                </button>
                <button
                  onClick={() => handleRemove(video.id)}
                  className="p-2 text-gray-400 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
