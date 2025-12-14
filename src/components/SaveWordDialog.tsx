import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./ui/Dialog";
import { db } from "../lib/db";

interface SaveWordDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  word: string;
  context: string;
  videoId: string;
}

export default function SaveWordDialog({
  open,
  onOpenChange,
  word,
  context,
  videoId,
}: SaveWordDialogProps) {
  const [meaning, setMeaning] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSaved, setIsSaved] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      const url = `https://www.youtube.com/watch?v=${videoId}`;
      await db.savedWords.create({
        word,
        context,
        video_id: videoId,
        url,
        meaning: meaning.trim(),
        next_review_date: new Date().toISOString(),
        remembered: false,
      });

      setIsSaved(true);
      setTimeout(() => {
        setMeaning("");
        setIsSaved(false);
        onOpenChange(false);
      }, 1500);
    } catch (err) {
      console.error("Error saving word:", err);
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("予期せぬエラーが発生しました");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>単語を保存</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="p-3 rounded-md bg-red-50 text-red-800">{error}</div>
          )}
          {isSaved && (
            <div className="p-3 rounded-md bg-green-50 text-green-800">
              単語を保存しました！
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              単語
            </label>
            <div className="p-3 bg-gray-50 rounded-md text-gray-900">
              {word}
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              コンテキスト
            </label>
            <div className="p-3 bg-gray-50 rounded-md text-gray-900">
              {context}
            </div>
          </div>
          <div>
            <label
              htmlFor="meaning"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              意味・メモ
            </label>
            <textarea
              id="meaning"
              value={meaning}
              onChange={(e) => setMeaning(e.target.value)}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              rows={3}
              placeholder="単語の意味やメモを入力してください"
              required
            />
          </div>
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={isSubmitting || isSaved}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors disabled:bg-blue-400 disabled:cursor-not-allowed"
            >
              {isSubmitting ? "保存中..." : isSaved ? "保存済み" : "保存"}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
