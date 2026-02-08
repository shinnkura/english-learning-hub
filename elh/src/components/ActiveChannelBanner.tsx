import React, { useEffect, useState } from 'react';
import { Target, ChevronRight, Trophy } from 'lucide-react';
import { db } from '../lib/db';
import { Channel, VideoProgress } from '../types/youtube';

interface ActiveChannelBannerProps {
  onChangeChannel: () => void;
  onSelectVideo: () => void;
}

interface ChannelStats {
  total: number;
  understood: number;
  in_commute: number;
}

export default function ActiveChannelBanner({ onChangeChannel, onSelectVideo }: ActiveChannelBannerProps) {
  const [activeChannel, setActiveChannel] = useState<Channel | null>(null);
  const [stats, setStats] = useState<ChannelStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadActiveChannel();
  }, []);

  const loadActiveChannel = async () => {
    try {
      const channel = await db.channels.findActive() as Channel | undefined;
      setActiveChannel(channel || null);

      if (channel) {
        const channelStats = await db.videoProgress.getStats(channel.id);
        setStats(channelStats as ChannelStats);
      }
    } catch (error) {
      console.error('Failed to load active channel:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-gradient-to-r from-indigo-500 to-purple-600 rounded-2xl p-6 text-white animate-pulse">
        <div className="h-6 bg-white/20 rounded w-1/3 mb-2"></div>
        <div className="h-4 bg-white/20 rounded w-1/2"></div>
      </div>
    );
  }

  if (!activeChannel) {
    return (
      <button
        onClick={onChangeChannel}
        className="w-full bg-gradient-to-r from-gray-100 to-gray-200 dark:from-gray-800 dark:to-gray-700 rounded-2xl p-6 text-left hover:shadow-lg transition-all duration-300 border-2 border-dashed border-gray-300 dark:border-gray-600"
      >
        <div className="flex items-center gap-3 text-gray-600 dark:text-gray-300">
          <Target className="w-8 h-8" />
          <div>
            <p className="font-semibold text-lg">チャンネルを選択して学習を始めよう</p>
            <p className="text-sm text-gray-500 dark:text-gray-400">お気に入りチャンネルから1つ選んで集中学習</p>
          </div>
          <ChevronRight className="w-6 h-6 ml-auto" />
        </div>
      </button>
    );
  }

  const progress = stats ? Math.round((stats.understood / Math.max(stats.total, 1)) * 100) : 0;

  return (
    <div className="bg-gradient-to-r from-indigo-500 to-purple-600 rounded-2xl p-6 text-white shadow-lg">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="bg-white/20 p-2 rounded-full">
            <Target className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm text-white/80">現在極め中</p>
            <h2 className="text-xl font-bold">{activeChannel.channel_name}</h2>
          </div>
        </div>
        <button
          onClick={onChangeChannel}
          className="text-sm bg-white/20 hover:bg-white/30 px-4 py-2 rounded-full transition-colors"
        >
          変更
        </button>
      </div>

      <div className="mb-4">
        <div className="flex justify-between text-sm mb-1">
          <span>進捗: {stats?.understood || 0} / {stats?.total || 0} 動画完了</span>
          <span>{progress}%</span>
        </div>
        <div className="w-full bg-white/20 rounded-full h-2">
          <div
            className="bg-white rounded-full h-2 transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      <div className="flex gap-3">
        <button
          onClick={onSelectVideo}
          className="flex-1 bg-white text-indigo-600 font-semibold py-3 rounded-xl hover:bg-white/90 transition-colors flex items-center justify-center gap-2"
        >
          <span>動画を見る</span>
          <ChevronRight className="w-5 h-5" />
        </button>
        {progress >= 80 && (
          <button
            onClick={() => {/* TODO: mark complete */}}
            className="bg-yellow-400 text-yellow-900 font-semibold py-3 px-4 rounded-xl hover:bg-yellow-300 transition-colors flex items-center gap-2"
          >
            <Trophy className="w-5 h-5" />
            完了
          </button>
        )}
      </div>
    </div>
  );
}
