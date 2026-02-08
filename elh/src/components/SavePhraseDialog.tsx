import React, { useState } from 'react';
import { MessageSquare, X } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from './ui/Dialog';
import { db } from '../lib/db';

interface SavePhraseDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  phrase: string;
  videoId: string;
  videoTitle?: string;
  timestampStart?: number;
  timestampEnd?: number;
}

export default function SavePhraseDialog({
  open,
  onOpenChange,
  phrase,
  videoId,
  videoTitle,
  timestampStart,
  timestampEnd,
}: SavePhraseDialogProps) {
  const [translation, setTranslation] = useState('');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      await db.savedPhrases.create({
        phrase,
        translation: translation || undefined,
        video_id: videoId,
        video_title: videoTitle,
        timestamp_start: timestampStart,
        timestamp_end: timestampEnd,
        url: `https://www.youtube.com/watch?v=${videoId}${timestampStart ? `&t=${Math.floor(timestampStart)}` : ''}`,
        notes: notes || undefined,
      });

      setTranslation('');
      setNotes('');
      onOpenChange(false);
    } catch (err) {
      console.error('Failed to save phrase:', err);
      setError('フレーズの保存に失敗しました');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageSquare className="w-5 h-5" />
            フレーズを保存
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="p-3 rounded-md bg-red-50 dark:bg-red-900/30 text-red-800 dark:text-red-300 text-sm">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              フレーズ
            </label>
            <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg text-gray-900 dark:text-white">
              {phrase}
            </div>
          </div>

          <div>
            <label
              htmlFor="translation"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
            >
              日本語訳（任意）
            </label>
            <input
              type="text"
              id="translation"
              value={translation}
              onChange={(e) => setTranslation(e.target.value)}
              placeholder="訳を入力..."
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
          </div>

          <div>
            <label
              htmlFor="notes"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
            >
              メモ（任意）
            </label>
            <textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="メモを追加..."
              rows={2}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none"
            />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
            >
              キャンセル
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors disabled:bg-indigo-400 disabled:cursor-not-allowed"
            >
              {isSubmitting ? '保存中...' : '保存'}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
