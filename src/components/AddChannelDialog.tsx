import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/Dialog';
import { supabase } from '../lib/supabase';
import { Category } from '../types/youtube';

interface AddChannelDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onChannelAdded: () => void;
  category: Category;
}

export default function AddChannelDialog({ open, onOpenChange, onChannelAdded, category }: AddChannelDialogProps) {
  const [channelUrl, setChannelUrl] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const extractChannelIdentifier = (url: string): { type: 'id' | 'handle' | 'custom', value: string } => {
    try {
      const urlObj = new URL(url);
      
      if (urlObj.hostname === 'www.youtube.com' || urlObj.hostname === 'youtube.com') {
        // Handle /channel/UCxxxx format
        if (urlObj.pathname.startsWith('/channel/')) {
          const channelId = urlObj.pathname.split('/')[2];
          if (channelId && channelId.length > 0) {
            return { type: 'id', value: channelId };
          }
        }
        
        // Handle /@username format
        if (urlObj.pathname.startsWith('/@')) {
          const username = urlObj.pathname.slice(2);
          if (username && username.length > 0) {
            return { type: 'handle', value: username };
          }
        }
        
        // Handle /c/customname format
        if (urlObj.pathname.startsWith('/c/')) {
          const customName = urlObj.pathname.slice(3);
          if (customName && customName.length > 0) {
            return { type: 'custom', value: customName };
          }
        }
      }
      
      throw new Error('無効なYouTubeチャンネルURLです。チャンネルページのURLを入力してください。');
    } catch (err) {
      if (err instanceof Error) {
        throw new Error(err.message);
      }
      throw new Error('無効なURL形式です。正しいURLを入力してください。');
    }
  };

  const fetchChannelInfo = async (identifier: { type: 'id' | 'handle' | 'custom', value: string }) => {
    try {
      const apiKey = import.meta.env.VITE_YOUTUBE_API_KEY;
      if (!apiKey) {
        throw new Error('YouTube API キーが設定されていません');
      }

      let endpoint = 'https://www.googleapis.com/youtube/v3/channels?part=snippet';
      
      if (identifier.type === 'id') {
        endpoint += `&id=${identifier.value}`;
      } else if (identifier.type === 'handle' || identifier.type === 'custom') {
        endpoint += `&forHandle=@${identifier.value}`;
      }
      
      endpoint += `&key=${apiKey}`;

      const response = await fetch(endpoint);

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error?.message || 'YouTubeチャンネルの情報取得に失敗しました');
      }

      const data = await response.json();
      
      if (!data.items || data.items.length === 0) {
        // If handle lookup fails, try searching by username
        if (identifier.type === 'handle' || identifier.type === 'custom') {
          const searchEndpoint = `https://www.googleapis.com/youtube/v3/search?part=snippet&type=channel&q=${identifier.value}&key=${apiKey}`;
          const searchResponse = await fetch(searchEndpoint);
          
          if (!searchResponse.ok) {
            throw new Error('チャンネルの検索に失敗しました');
          }
          
          const searchData = await searchResponse.json();
          
          if (!searchData.items || searchData.items.length === 0) {
            throw new Error('チャンネルが見つかりませんでした。URLを確認してください。');
          }
          
          return {
            channelId: searchData.items[0].id.channelId,
            channelName: searchData.items[0].snippet.channelTitle
          };
        }
        
        throw new Error('チャンネルが見つかりませんでした。URLを確認してください。');
      }
      
      return {
        channelId: data.items[0].id,
        channelName: data.items[0].snippet.title
      };
    } catch (err) {
      if (err instanceof Error) {
        throw new Error(err.message);
      }
      throw new Error('チャンネル情報の取得中にエラーが発生しました');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('ユーザーが認証されていません');
      }

      const channelIdentifier = extractChannelIdentifier(channelUrl);
      const channelInfo = await fetchChannelInfo(channelIdentifier);

      // Check if channel already exists in this category
      const { data: existingChannels } = await supabase
        .from('channels')
        .select('*')
        .eq('category_id', category.id)
        .eq('channel_id', channelInfo.channelId);

      if (existingChannels && existingChannels.length > 0) {
        throw new Error('このチャンネルは既にこのカテゴリに追加されています');
      }

      const { error: insertError } = await supabase
        .from('channels')
        .insert([{ 
          category_id: category.id,
          channel_id: channelInfo.channelId,
          channel_name: channelInfo.channelName,
          user_id: user.id
        }]);

      if (insertError) {
        throw new Error('チャンネルの追加に失敗しました');
      }

      setChannelUrl('');
      onChannelAdded();
      onOpenChange(false);
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('予期せぬエラーが発生しました');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{category.name}にチャンネルを追加</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="p-3 rounded-md bg-red-50 text-red-800">
              {error}
            </div>
          )}
          <div>
            <label htmlFor="channelUrl" className="block text-sm font-medium text-gray-700">
              YouTubeチャンネルのURL
            </label>
            <input
              type="url"
              id="channelUrl"
              value={channelUrl}
              onChange={(e) => setChannelUrl(e.target.value)}
              placeholder="https://www.youtube.com/channel/..."
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              required
            />
            <p className="mt-1 text-sm text-gray-500">
              以下の形式のURLに対応しています：
              <br />
              - https://www.youtube.com/channel/UCxxxx...
              <br />
              - https://www.youtube.com/@username
              <br />
              - https://www.youtube.com/c/customname
            </p>
          </div>
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={isSubmitting}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors disabled:bg-blue-400 disabled:cursor-not-allowed"
            >
              {isSubmitting ? '追加中...' : '追加'}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}