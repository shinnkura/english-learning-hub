import React, { useEffect, useState } from 'react';
import { Plus, Target, Trash2, Star } from 'lucide-react';
import { db } from '../lib/db';
import { Channel } from '../types/youtube';
import youtubeIcon from '../assets/yt_icon_rgb.png';

interface FavoriteChannelsProps {
  onAddChannel: () => void;
  onSelectActive: (channel: Channel) => void;
  refreshKey?: number;
}

export default function FavoriteChannels({ onAddChannel, onSelectActive, refreshKey }: FavoriteChannelsProps) {
  const [channels, setChannels] = useState<Channel[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadChannels();
  }, [refreshKey]);

  const loadChannels = async () => {
    try {
      const data = await db.channels.findFavorites();
      setChannels(data as Channel[]);
    } catch (error) {
      console.error('Failed to load favorite channels:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSetActive = async (channel: Channel) => {
    try {
      await db.channels.setActive(channel.id);
      onSelectActive(channel);
      await loadChannels();
    } catch (error) {
      console.error('Failed to set active channel:', error);
    }
  };

  const handleRemoveFavorite = async (id: string) => {
    try {
      await db.channels.setFavorite(id, false);
      await loadChannels();
    } catch (error) {
      console.error('Failed to remove favorite:', error);
    }
  };

  if (loading) {
    return (
      <div className="flex gap-3 overflow-x-auto pb-2">
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex-shrink-0 w-32 h-24 bg-gray-200 dark:bg-gray-700 rounded-xl animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 flex items-center gap-2">
        <Star className="w-4 h-4" />
        お気に入りチャンネル
      </h3>
      <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-thin">
        {channels.map((channel) => (
          <div
            key={channel.id}
            className={`flex-shrink-0 relative group ${
              channel.is_active
                ? 'ring-2 ring-indigo-500 ring-offset-2 dark:ring-offset-gray-900'
                : ''
            }`}
          >
            <button
              onClick={() => handleSetActive(channel)}
              className="flex flex-col items-center gap-2 p-4 bg-white dark:bg-gray-800 rounded-xl shadow-sm hover:shadow-md transition-all duration-200 w-28"
            >
              <div className="w-12 h-12 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden flex items-center justify-center">
                {channel.thumbnail_url ? (
                  <img src={channel.thumbnail_url} alt={channel.channel_name} className="w-full h-full object-cover" />
                ) : (
                  <img src={youtubeIcon} alt={channel.channel_name} className="w-8 h-8" />
                )}
              </div>
              <span className="text-xs font-medium text-gray-700 dark:text-gray-300 text-center line-clamp-2">
                {channel.channel_name}
              </span>
              {channel.is_active && (
                <span className="absolute top-1 right-1 bg-indigo-500 text-white text-xs px-2 py-0.5 rounded-full flex items-center gap-1">
                  <Target className="w-3 h-3" />
                </span>
              )}
            </button>
            <button
              onClick={() => handleRemoveFavorite(channel.id)}
              className="absolute -top-2 -right-2 p-1 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600"
            >
              <Trash2 className="w-3 h-3" />
            </button>
          </div>
        ))}
        <button
          onClick={onAddChannel}
          className="flex-shrink-0 flex flex-col items-center justify-center gap-2 p-4 bg-gray-100 dark:bg-gray-800 rounded-xl border-2 border-dashed border-gray-300 dark:border-gray-600 hover:border-indigo-400 dark:hover:border-indigo-500 transition-colors w-28 h-[104px]"
        >
          <Plus className="w-6 h-6 text-gray-400 dark:text-gray-500" />
          <span className="text-xs text-gray-500 dark:text-gray-400">追加</span>
        </button>
      </div>
    </div>
  );
}
