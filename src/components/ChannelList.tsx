import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import type { Channel } from "../types/youtube";
import { Trash2, GraduationCap } from "lucide-react";
import VideoList from "./VideoList";

interface ChannelListProps {
  categoryId: string;
}

export default function ChannelList({ categoryId }: ChannelListProps) {
  const [channels, setChannels] = useState<Channel[]>([]);
  const [selectedChannel, setSelectedChannel] = useState<Channel | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchChannels = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .from("channels")
        .select("*")
        .eq("category_id", categoryId)
        .order("created_at", { ascending: false });

      if (fetchError) {
        console.error("Error fetching channels:", fetchError);
        setError("チャンネルの取得に失敗しました");
        return;
      }

      setChannels(data || []);
    } catch (err) {
      console.error("Error:", err);
      setError("予期せぬエラーが発生しました");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchChannels();
  }, [categoryId]);

  const handleDelete = async (id: string) => {
    try {
      const { error: deleteError } = await supabase
        .from("channels")
        .delete()
        .eq("id", id);

      if (deleteError) {
        console.error("Error deleting channel:", deleteError);
        setError("チャンネルの削除に失敗しました");
        return;
      }

      await fetchChannels();
    } catch (err) {
      console.error("Error:", err);
      setError("予期せぬエラーが発生しました");
    }
  };

  if (isLoading) {
    return (
      <div className="text-center py-4">
        <p className="text-gray-600 dark:text-gray-400">読み込み中...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-4">
        <p className="text-red-600 dark:text-red-400">{error}</p>
      </div>
    );
  }

  if (channels.length === 0) {
    return (
      <div className="text-center py-4">
        <p className="text-gray-600 dark:text-gray-400">
          チャンネルがありません
        </p>
      </div>
    );
  }

  if (selectedChannel) {
    return (
      <div className="space-y-4">
        <button
          onClick={() => setSelectedChannel(null)}
          className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 font-medium transition-colors"
        >
          ← チャンネル一覧に戻る
        </button>
        <VideoList channelId={selectedChannel.channel_id} />
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {channels.map((channel) => (
        <div
          key={channel.id}
          className="flex items-center justify-between bg-white/50 dark:bg-gray-800/50 backdrop-blur-sm rounded-lg shadow-sm p-3 hover:shadow-md transition-all duration-300"
        >
          <button
            onClick={() => setSelectedChannel(channel)}
            className="flex items-center gap-2 text-gray-900 dark:text-white hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
          >
            <GraduationCap className="w-5 h-5 text-red-600 dark:text-red-500" />
            <span>{channel.channel_name}</span>
          </button>
          <button
            onClick={() => handleDelete(channel.id)}
            className="text-gray-600 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400 transition-colors"
          >
            <Trash2 className="w-5 h-5" />
          </button>
        </div>
      ))}
    </div>
  );
}
