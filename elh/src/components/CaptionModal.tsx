import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "../components/ui/Dialog";
import { Caption } from "../types/youtube";
import { BookOpen, MessageSquarePlus } from "lucide-react";
import SavePhraseDialog from "./SavePhraseDialog";

interface CaptionModalProps {
  isOpen: boolean;
  onClose: () => void;
  captions: Caption[];
  onCaptionClick: (caption: Caption) => void;
  currentTime: number;
  videoId: string;
  videoTitle?: string;
}

export default function CaptionModal({
  isOpen,
  onClose,
  captions,
  onCaptionClick,
  currentTime,
  videoId,
  videoTitle,
}: CaptionModalProps) {
  const [selectedPhrase, setSelectedPhrase] = useState<{
    text: string;
    start: number;
    end: number;
  } | null>(null);
  const [isSavePhraseOpen, setIsSavePhraseOpen] = useState(false);

  const getCurrentCaption = () => {
    return captions.find(
      (caption) => currentTime >= caption.start && currentTime <= caption.end
    );
  };

  const handleSavePhrase = (caption: Caption, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedPhrase({
      text: caption.text,
      start: caption.start,
      end: caption.end,
    });
    setIsSavePhraseOpen(true);
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-3xl max-h-[80vh] sm:max-w-[90vw] sm:max-h-[90vh] p-4 sm:p-6">
          <DialogHeader className="mb-4">
            <div className="flex items-center gap-2">
              <BookOpen className="w-6 h-6 text-blue-600 dark:text-blue-400" />
              <DialogTitle className="text-lg sm:text-xl">字幕</DialogTitle>
            </div>
          </DialogHeader>
          <div className="space-y-3 sm:space-y-4 overflow-y-auto max-h-[60vh] sm:max-h-[70vh] pr-2">
            {captions.map((caption, index) => (
              <div
                key={index}
                className={`group p-3 sm:p-4 rounded-lg transition-all duration-300 cursor-pointer ${
                  getCurrentCaption()?.start === caption.start
                    ? "bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 shadow-md"
                    : "hover:bg-gray-100 dark:hover:bg-gray-700"
                }`}
                onClick={() => onCaptionClick(caption)}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="text-base sm:text-lg leading-relaxed text-gray-900 dark:text-gray-100 flex-1">
                    {caption.text}
                  </div>
                  <button
                    onClick={(e) => handleSavePhrase(caption, e)}
                    className="flex-shrink-0 p-2 text-gray-400 hover:text-indigo-500 dark:hover:text-indigo-400 opacity-0 group-hover:opacity-100 transition-all rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600"
                    title="フレーズを保存"
                  >
                    <MessageSquarePlus className="w-5 h-5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {selectedPhrase && (
        <SavePhraseDialog
          open={isSavePhraseOpen}
          onOpenChange={setIsSavePhraseOpen}
          phrase={selectedPhrase.text}
          videoId={videoId}
          videoTitle={videoTitle}
          timestampStart={selectedPhrase.start}
          timestampEnd={selectedPhrase.end}
        />
      )}
    </>
  );
}
