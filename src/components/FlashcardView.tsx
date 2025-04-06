import { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";
import { SavedWord } from "../types/youtube";
import { Rotate3D, Check, X, ExternalLink, ArrowLeft } from "lucide-react";

interface FlashcardViewProps {
  onClose: () => void;
}

export default function FlashcardView({ onClose }: FlashcardViewProps) {
  const [words, setWords] = useState<SavedWord[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchWords = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        throw new Error("ユーザーが認証されていません");
      }

      // 復習が必要な単語を取得
      const { data: wordsToReview, error: fetchError } = await supabase
        .from("saved_words")
        .select("*")
        .eq("user_id", user.id)
        .eq("remembered", false)
        .order("next_review_date", { ascending: true });

      if (fetchError) {
        throw new Error("単語の取得に失敗しました");
      }

      setWords(wordsToReview || []);
    } catch (err) {
      console.error("Error in fetchWords:", err);
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("予期せぬエラーが発生しました");
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchWords();
  }, []);

  const handleRemembered = async (remembered: boolean) => {
    if (!words[currentIndex]) return;

    try {
      const nextReviewDate = new Date();
      if (remembered) {
        nextReviewDate.setDate(nextReviewDate.getDate() + 49); // 7週間後
      } else {
        nextReviewDate.setDate(nextReviewDate.getDate() + 7); // 1週間後
      }

      const { error: updateError } = await supabase
        .from("saved_words")
        .update({
          remembered,
          next_review_date: nextReviewDate.toISOString(),
        })
        .eq("id", words[currentIndex].id);

      if (updateError) {
        throw new Error("更新に失敗しました");
      }

      // 次の単語へ
      if (currentIndex < words.length - 1) {
        setCurrentIndex((prev) => prev + 1);
        setIsFlipped(false);
      } else {
        // すべての単語を確認した場合は再読み込み
        await fetchWords();
        setCurrentIndex(0);
        setIsFlipped(false);
      }
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("予期せぬエラーが発生しました");
      }
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-4">
      <div className="mb-6">
        <button
          onClick={onClose}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
          トップに戻る
        </button>
      </div>

      {isLoading ? (
        <div className="text-center py-8">
          <p className="text-gray-600">単語を読み込み中...</p>
        </div>
      ) : error ? (
        <div className="text-center py-8">
          <p className="text-red-600">{error}</p>
        </div>
      ) : words.length === 0 ? (
        <div className="text-center py-8">
          <p className="text-gray-600">現在復習する単語はありません</p>
          <p className="text-sm text-gray-500 mt-2">
            動画を視聴して新しい単語を登録してください
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="text-center mb-4">
            <p className="text-gray-600">
              {currentIndex + 1} / {words.length}
            </p>
          </div>

          <div className="relative min-h-[300px] perspective-1000">
            <div
              className={`w-full bg-white rounded-xl shadow-lg transition-transform duration-500 transform-style-3d cursor-pointer ${
                isFlipped ? "rotate-y-180" : ""
              }`}
              onClick={() => setIsFlipped(!isFlipped)}
            >
              {/* 表面 */}
              <div
                className={`p-8 absolute w-full h-full backface-hidden ${
                  isFlipped ? "invisible" : ""
                }`}
              >
                <div className="flex justify-center items-center h-full">
                  <h2 className="text-3xl font-bold text-gray-900">
                    {words[currentIndex].word}
                  </h2>
                </div>
                <div className="absolute bottom-4 right-4">
                  <Rotate3D className="w-6 h-6 text-gray-400" />
                </div>
              </div>

              {/* 裏面 */}
              <div
                className={`p-8 absolute w-full h-full backface-hidden rotate-y-180 ${
                  !isFlipped ? "invisible" : ""
                }`}
              >
                <div className="space-y-4">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-700">
                      意味
                    </h3>
                    <p className="text-gray-900">
                      {words[currentIndex].meaning}
                    </p>
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-700">
                      コンテキスト
                    </h3>
                    <p className="text-gray-900">
                      {words[currentIndex].context}
                    </p>
                  </div>
                  <div>
                    <a
                      href={words[currentIndex].url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center text-blue-600 hover:text-blue-800"
                    >
                      <ExternalLink className="w-4 h-4 mr-1" />
                      動画を見る
                    </a>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {isFlipped && (
            <div className="flex justify-center gap-4 mt-8">
              <button
                onClick={() => handleRemembered(false)}
                className="flex items-center gap-2 px-6 py-3 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-colors"
              >
                <X className="w-5 h-5" />
                まだ
              </button>
              <button
                onClick={() => handleRemembered(true)}
                className="flex items-center gap-2 px-6 py-3 bg-green-100 text-green-700 rounded-lg hover:bg-green-200 transition-colors"
              >
                <Check className="w-5 h-5" />
                覚えた
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
