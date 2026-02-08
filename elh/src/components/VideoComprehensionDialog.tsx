import React from 'react';
import { Check, X, Headphones, RefreshCw } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from './ui/Dialog';

interface VideoComprehensionDialogProps {
  open: boolean;
  videoTitle: string;
  watchCount: number;
  onUnderstood: () => void;
  onNotUnderstood: () => void;
  onClose: () => void;
}

export default function VideoComprehensionDialog({
  open,
  videoTitle,
  watchCount,
  onUnderstood,
  onNotUnderstood,
  onClose,
}: VideoComprehensionDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-center">この動画は理解できましたか?</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <p className="text-sm text-gray-600 dark:text-gray-400 text-center line-clamp-2">
            {videoTitle}
          </p>
          {watchCount > 1 && (
            <p className="text-xs text-gray-500 dark:text-gray-500 text-center">
              {watchCount}回目の視聴
            </p>
          )}
          <div className="grid grid-cols-2 gap-4 pt-4">
            <button
              onClick={onUnderstood}
              className="flex flex-col items-center gap-3 p-6 bg-gradient-to-br from-green-500 to-emerald-600 text-white rounded-xl hover:from-green-600 hover:to-emerald-700 transition-all duration-200 shadow-lg hover:shadow-xl"
            >
              <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center">
                <Check className="w-8 h-8" />
              </div>
              <span className="font-bold text-lg">理解できた</span>
              <div className="flex items-center gap-1 text-xs text-white/80">
                <Headphones className="w-3 h-3" />
                <span>通勤ゾーンへ</span>
              </div>
            </button>
            <button
              onClick={onNotUnderstood}
              className="flex flex-col items-center gap-3 p-6 bg-gradient-to-br from-orange-500 to-red-500 text-white rounded-xl hover:from-orange-600 hover:to-red-600 transition-all duration-200 shadow-lg hover:shadow-xl"
            >
              <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center">
                <X className="w-8 h-8" />
              </div>
              <span className="font-bold text-lg">できなかった</span>
              <div className="flex items-center gap-1 text-xs text-white/80">
                <RefreshCw className="w-3 h-3" />
                <span>2日後に再挑戦</span>
              </div>
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
