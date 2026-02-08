import React, { useState, useEffect, useCallback } from "react";
import {
  Sun,
  Moon,
  Headphones,
  BookOpen,
  RefreshCw,
  ArrowLeft,
  Play,
} from "lucide-react";
import { useTheme } from "../contexts/ThemeContext";
import { db } from "../lib/db";
import { Channel, VideoProgress } from "../types/youtube";
import ActiveChannelBanner from "../components/ActiveChannelBanner";
import FavoriteChannels from "../components/FavoriteChannels";
import CommuteZone from "../components/CommuteZone";
import RetryVideoList from "../components/RetryVideoList";
import VideoPlayer from "../components/VideoPlayer";
import VideoComprehensionDialog from "../components/VideoComprehensionDialog";
import FlashcardView from "../components/FlashcardView";
import AddFavoriteChannelDialog from "../components/AddFavoriteChannelDialog";
import CategoryList from "../components/CategoryList";

type ViewMode = 'home' | 'commute' | 'video' | 'flashcards' | 'channels';

interface CurrentVideo {
  videoId: string;
  title: string;
  channelId: string;
  progressId?: string;
  watchCount: number;
}

export default function Home() {
  const { theme, toggleTheme } = useTheme();
  const [viewMode, setViewMode] = useState<ViewMode>('home');
  const [activeChannel, setActiveChannel] = useState<Channel | null>(null);
  const [currentVideo, setCurrentVideo] = useState<CurrentVideo | null>(null);
  const [showComprehensionDialog, setShowComprehensionDialog] = useState(false);
  const [isAddChannelOpen, setIsAddChannelOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [retryCount, setRetryCount] = useState(0);
  const [videos, setVideos] = useState<any[]>([]);
  const [isLoadingVideos, setIsLoadingVideos] = useState(false);

  useEffect(() => {
    loadActiveChannel();
    loadRetryCount();
  }, []);

  const loadActiveChannel = async () => {
    try {
      const channel = await db.channels.findActive() as Channel | undefined;
      setActiveChannel(channel || null);
    } catch (error) {
      console.error('Failed to load active channel:', error);
    }
  };

  const loadRetryCount = async () => {
    try {
      const retryVideos = await db.videoProgress.findForRetry();
      setRetryCount((retryVideos as VideoProgress[]).length);
    } catch (error) {
      console.error('Failed to load retry count:', error);
    }
  };

  const fetchVideosFromChannel = async (channelId: string) => {
    const API_KEY = import.meta.env.VITE_YOUTUBE_API_KEY;
    const cacheKey = `youtube_videos_${channelId}`;
    const cacheExpiry = 24 * 60 * 60 * 1000;

    // Check cache
    const cached = localStorage.getItem(cacheKey);
    if (cached) {
      try {
        const { data, timestamp } = JSON.parse(cached);
        if (Date.now() - timestamp < cacheExpiry) {
          return data;
        }
      } catch (e) {
        // Invalid cache
      }
    }

    // Fetch from API
    const response = await fetch(
      `https://www.googleapis.com/youtube/v3/search?key=${API_KEY}&channelId=${channelId}&part=snippet,id&order=date&maxResults=50&type=video`
    );
    const data = await response.json();

    if (!data.items) {
      throw new Error('Failed to fetch videos');
    }

    const videos = data.items.map((item: any) => ({
      id: item.id.videoId,
      title: item.snippet.title,
      thumbnail: item.snippet.thumbnails.medium.url,
      publishedAt: new Date(item.snippet.publishedAt),
      description: item.snippet.description,
    }));

    // Cache the result
    localStorage.setItem(cacheKey, JSON.stringify({
      data: videos,
      timestamp: Date.now(),
    }));

    return videos;
  };

  const handleSelectVideo = async () => {
    if (!activeChannel) return;

    setIsLoadingVideos(true);
    try {
      const channelVideos = await fetchVideosFromChannel(activeChannel.channel_id);
      setVideos(channelVideos);

      // Get progress for all videos
      const progressList = await db.videoProgress.findByChannel(activeChannel.id);
      const progressMap = new Map((progressList as VideoProgress[]).map(p => [p.video_id, p]));

      // Find unwatched or retry videos
      const retryVideos = await db.videoProgress.findForRetry();
      const retryVideoIds = new Set((retryVideos as VideoProgress[]).map(v => v.video_id));

      // Priority: retry videos first, then unwatched
      let selectedVideo = null;

      // First check retry videos
      for (const video of channelVideos) {
        if (retryVideoIds.has(video.id)) {
          const progress = progressMap.get(video.id);
          selectedVideo = {
            video,
            progress,
            isRetry: true,
          };
          break;
        }
      }

      // If no retry videos, pick an unwatched one
      if (!selectedVideo) {
        for (const video of channelVideos) {
          const progress = progressMap.get(video.id);
          if (!progress || progress.status === 'unwatched') {
            selectedVideo = {
              video,
              progress,
              isRetry: false,
            };
            break;
          }
        }
      }

      // If all watched, pick random from non-mastered
      if (!selectedVideo && channelVideos.length > 0) {
        const nonMastered = channelVideos.filter((v: any) => {
          const p = progressMap.get(v.id);
          return !p || p.status !== 'mastered';
        });
        if (nonMastered.length > 0) {
          const video = nonMastered[Math.floor(Math.random() * nonMastered.length)];
          selectedVideo = {
            video,
            progress: progressMap.get(video.id),
            isRetry: false,
          };
        }
      }

      if (selectedVideo) {
        // Create or update progress
        let progress: VideoProgress = selectedVideo.progress as VideoProgress;
        if (!progress) {
          progress = await db.videoProgress.create({
            channel_id: activeChannel.id,
            video_id: selectedVideo.video.id,
            video_title: selectedVideo.video.title,
            thumbnail_url: selectedVideo.video.thumbnail,
          }) as VideoProgress;
        }

        // Increment watch count
        progress = await db.videoProgress.incrementWatchCount(progress.id) as VideoProgress;

        setCurrentVideo({
          videoId: selectedVideo.video.id,
          title: selectedVideo.video.title,
          channelId: activeChannel.channel_id,
          progressId: progress.id,
          watchCount: progress.watch_count,
        });
        setViewMode('video');
      }
    } catch (error) {
      console.error('Failed to select video:', error);
    } finally {
      setIsLoadingVideos(false);
    }
  };

  const handleVideoEnd = () => {
    setShowComprehensionDialog(true);
  };

  const handleUnderstood = async () => {
    if (currentVideo?.progressId) {
      await db.videoProgress.markUnderstood(currentVideo.progressId);
    }
    setShowComprehensionDialog(false);
    setCurrentVideo(null);
    setViewMode('home');
    loadRetryCount();
    setRefreshKey(prev => prev + 1);
  };

  const handleNotUnderstood = async () => {
    if (currentVideo?.progressId) {
      await db.videoProgress.markNotUnderstood(currentVideo.progressId);
    }
    setShowComprehensionDialog(false);
    setCurrentVideo(null);
    setViewMode('home');
    loadRetryCount();
    setRefreshKey(prev => prev + 1);
  };

  const handlePlayRetryVideo = async (video: VideoProgress) => {
    // Increment watch count
    const progress = await db.videoProgress.incrementWatchCount(video.id);

    setCurrentVideo({
      videoId: video.video_id,
      title: video.video_title,
      channelId: video.channel_id,
      progressId: video.id,
      watchCount: progress.watch_count,
    });
    setViewMode('video');
  };

  const handlePlayCommuteVideo = (videoId: string, title: string) => {
    setCurrentVideo({
      videoId,
      title,
      channelId: '',
      watchCount: 0,
    });
    setViewMode('video');
  };

  const handleChannelAdded = () => {
    setRefreshKey(prev => prev + 1);
    loadActiveChannel();
  };

  const handleSelectActive = (channel: Channel) => {
    setActiveChannel(channel);
    setRefreshKey(prev => prev + 1);
  };

  // Video view
  if (viewMode === 'video' && currentVideo) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800">
        <div className="container mx-auto px-4 py-6">
          <button
            onClick={() => {
              setViewMode('home');
              setCurrentVideo(null);
            }}
            className="flex items-center gap-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white mb-4"
          >
            <ArrowLeft className="w-5 h-5" />
            <span>戻る</span>
          </button>

          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 line-clamp-2">
            {currentVideo.title}
          </h2>

          <VideoPlayer videoId={currentVideo.videoId} videoTitle={currentVideo.title} />

          <div className="mt-6 flex justify-center">
            <button
              onClick={handleVideoEnd}
              className="px-8 py-4 bg-gradient-to-r from-indigo-500 to-purple-600 text-white font-semibold rounded-xl hover:from-indigo-600 hover:to-purple-700 transition-all shadow-lg"
            >
              視聴完了 - 理解度を選択
            </button>
          </div>

          <VideoComprehensionDialog
            open={showComprehensionDialog}
            videoTitle={currentVideo.title}
            watchCount={currentVideo.watchCount}
            onUnderstood={handleUnderstood}
            onNotUnderstood={handleNotUnderstood}
            onClose={() => setShowComprehensionDialog(false)}
          />
        </div>
      </div>
    );
  }

  // Commute zone view
  if (viewMode === 'commute') {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800">
        <div className="container mx-auto px-4 py-6">
          <CommuteZone
            onBack={() => setViewMode('home')}
            onPlayVideo={handlePlayCommuteVideo}
          />
        </div>
      </div>
    );
  }

  // Flashcards view
  if (viewMode === 'flashcards') {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800">
        <div className="container mx-auto px-4 py-6">
          <FlashcardView onClose={() => setViewMode('home')} />
        </div>
      </div>
    );
  }

  // Channel management view
  if (viewMode === 'channels') {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800">
        <div className="container mx-auto px-4 py-6">
          <button
            onClick={() => setViewMode('home')}
            className="flex items-center gap-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white mb-6"
          >
            <ArrowLeft className="w-5 h-5" />
            <span>戻る</span>
          </button>
          <CategoryList />
        </div>
      </div>
    );
  }

  // Home view
  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800">
      <div className="container mx-auto px-4 py-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-500 to-indigo-500 dark:from-blue-400 dark:to-indigo-400">
            English Learning Hub
          </h1>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setViewMode('commute')}
              className="flex items-center gap-2 px-4 py-2 bg-green-500 text-white rounded-full hover:bg-green-600 transition-colors"
            >
              <Headphones className="w-5 h-5" />
              <span className="hidden sm:inline">通勤ゾーン</span>
            </button>
            <button
              onClick={toggleTheme}
              className="p-2 rounded-full bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors text-gray-600 dark:text-gray-300"
            >
              {theme === "dark" ? (
                <Sun className="w-5 h-5" />
              ) : (
                <Moon className="w-5 h-5" />
              )}
            </button>
          </div>
        </div>

        {/* Active Channel Banner */}
        <ActiveChannelBanner
          onChangeChannel={() => setIsAddChannelOpen(true)}
          onSelectVideo={handleSelectVideo}
        />

        {/* Loading indicator */}
        {isLoadingVideos && (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500"></div>
            <span className="ml-3 text-gray-600 dark:text-gray-400">動画を選択中...</span>
          </div>
        )}

        {/* Today's Learning */}
        <div className="grid grid-cols-3 gap-4">
          <button
            onClick={handleSelectVideo}
            disabled={!activeChannel || isLoadingVideos}
            className="flex flex-col items-center gap-2 p-6 bg-white dark:bg-gray-800 rounded-xl shadow-sm hover:shadow-md transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center">
              <Play className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            </div>
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">新規動画</span>
          </button>

          <button
            onClick={() => {/* TODO: show retry list */}}
            className="flex flex-col items-center gap-2 p-6 bg-white dark:bg-gray-800 rounded-xl shadow-sm hover:shadow-md transition-all relative"
          >
            <div className="w-12 h-12 bg-orange-100 dark:bg-orange-900/30 rounded-full flex items-center justify-center">
              <RefreshCw className="w-6 h-6 text-orange-600 dark:text-orange-400" />
            </div>
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">再挑戦</span>
            {retryCount > 0 && (
              <span className="absolute top-2 right-2 bg-orange-500 text-white text-xs px-2 py-0.5 rounded-full">
                {retryCount}
              </span>
            )}
          </button>

          <button
            onClick={() => setViewMode('flashcards')}
            className="flex flex-col items-center gap-2 p-6 bg-white dark:bg-gray-800 rounded-xl shadow-sm hover:shadow-md transition-all"
          >
            <div className="w-12 h-12 bg-purple-100 dark:bg-purple-900/30 rounded-full flex items-center justify-center">
              <BookOpen className="w-6 h-6 text-purple-600 dark:text-purple-400" />
            </div>
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">復習</span>
          </button>
        </div>

        {/* Retry Videos */}
        {retryCount > 0 && (
          <RetryVideoList onPlayVideo={handlePlayRetryVideo} />
        )}

        {/* Favorite Channels */}
        <FavoriteChannels
          onAddChannel={() => setIsAddChannelOpen(true)}
          onSelectActive={handleSelectActive}
          refreshKey={refreshKey}
        />

        {/* Add Channel Dialog */}
        <AddFavoriteChannelDialog
          open={isAddChannelOpen}
          onOpenChange={setIsAddChannelOpen}
          onChannelAdded={handleChannelAdded}
        />
      </div>
    </div>
  );
}
