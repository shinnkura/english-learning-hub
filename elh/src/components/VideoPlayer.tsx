import React from "react";
import { useState, useEffect, useRef } from "react";
import YouTube from "react-youtube";
import { Caption } from "../types/youtube";
import {
  BookOpen,
  Play,
  AlertTriangle,
  RefreshCw,
  Loader2,
  Clock,
} from "lucide-react";
import SaveWordDialog from "./SaveWordDialog";
import CaptionModal from "./CaptionModal";

interface VideoPlayerProps {
  videoId: string;
  videoTitle?: string;
}

/**
 * HTMLエンティティをデコードする関数
 * @param {string} text - デコードするテキスト
 * @returns {string} デコードされたテキスト
 */
function decodeHTMLEntities(text: string | undefined): string {
  if (!text) return "";

  const textarea = document.createElement("textarea");
  textarea.innerHTML = text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'");
  return textarea.value;
}

const CACHE_PREFIX = "youtube_captions_";
const CACHE_EXPIRY = 24 * 60 * 60 * 1000; // 24 hours
const MAX_RETRIES = 3;
const INITIAL_RETRY_DELAY = 1000; // 1 second

export default function VideoPlayer({ videoId, videoTitle }: VideoPlayerProps) {
  const [captions, setCaptions] = useState<Caption[]>([]);
  const [currentTime, setCurrentTime] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isRetrying, setIsRetrying] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const [retryDelay, setRetryDelay] = useState(INITIAL_RETRY_DELAY);
  const [showVideo, setShowVideo] = useState(false);
  const [isCaptionModalOpen, setIsCaptionModalOpen] = useState(false);
  const [selectedText, setSelectedText] = useState("");
  const [isSaveWordOpen, setIsSaveWordOpen] = useState(false);
  const [selectedCaption, setSelectedCaption] = useState<Caption | null>(null);
  const [saveButtonPosition, setSaveButtonPosition] = useState<{
    top: number;
    left: number;
  } | null>(null);
  const [isCircuitOpenClient, setIsCircuitOpenClient] = useState(false);
  const [retryAfterClient, setRetryAfterClient] = useState<number | null>(null);
  const [circuitResetTimer, setCircuitResetTimer] =
    useState<NodeJS.Timeout | null>(null);
  const [retryTimeoutId, setRetryTimeoutId] = useState<NodeJS.Timeout | null>(
    null
  );
  const playerRef = useRef<any>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  const retryTimeoutRef = useRef<NodeJS.Timeout>();

  const formatTimeRemaining = (seconds: number) => {
    if (seconds < 60) {
      return `${seconds}秒`;
    }
    const minutes = Math.floor(seconds / 60);
    return `${minutes}分`;
  };

  const getCachedCaptions = (videoId: string): Caption[] | null => {
    const cached = localStorage.getItem(`${CACHE_PREFIX}${videoId}`);
    if (!cached) return null;

    try {
      const { data, timestamp } = JSON.parse(cached);
      if (Date.now() - timestamp > CACHE_EXPIRY) {
        localStorage.removeItem(`${CACHE_PREFIX}${videoId}`);
        return null;
      }
      return data;
    } catch {
      return null;
    }
  };

  const setCachedCaptions = (videoId: string, captions: Caption[]) => {
    try {
      localStorage.setItem(
        `${CACHE_PREFIX}${videoId}`,
        JSON.stringify({
          data: captions,
          timestamp: Date.now(),
        })
      );
    } catch (err) {
      console.warn("Failed to cache captions:", err);
    }
  };

  const clearCaptionsCache = (videoId: string) => {
    try {
      localStorage.removeItem(`${CACHE_PREFIX}${videoId}`);
    } catch (err) {
      console.warn("Failed to clear captions cache:", err);
    }
  };

  const fetchCaptions = async (retry = false) => {
    try {
      if (retry) {
        setIsRetrying(true);
      } else {
        setIsLoading(true);
      }
      setError(null);

      if (!videoId) {
        throw new Error("動画IDが指定されていません。");
      }

      // Check if circuit breaker is open
      if (isCircuitOpenClient) {
        throw new Error(
          `APIリクエスト制限に達しました。${retryAfterClient}秒後に再試行してください。`
        );
      }

      // Check cache first
      const cachedCaptions = getCachedCaptions(videoId);
      if (cachedCaptions) {
        setCaptions(cachedCaptions);
        setIsLoading(false);
        setIsRetrying(false);
        return;
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000);

      try {
        const response = await fetch(`/api/captions/${videoId}`, {
          signal: controller.signal,
          headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
          },
        });

        clearTimeout(timeoutId);

        const data = await response.json();

        if (!response.ok) {
          throw new Error(
            data.error || "この動画の字幕を取得できませんでした。"
          );
        }

        if (!data || !Array.isArray(data) || data.length === 0) {
          throw new Error("この動画には英語の字幕がありません。");
        }

        // 字幕データの処理を改善
        const decodedCaptions = data
          .filter((caption) => caption && caption.text) // nullチェックを追加
          .map((caption, index, array) => {
            if (!caption) return null;
            // endプロパティがnullの場合、次の字幕のstart時間を使用
            const end =
              caption.end !== null
                ? caption.end
                : index < array.length - 1
                ? array[index + 1].start
                : caption.start + 5; // 最後の字幕の場合は5秒後をデフォルト値として設定

            return {
              ...caption,
              text: decodeHTMLEntities(caption.text) || "",
              end: end,
            };
          })
          .filter((caption): caption is Caption => caption !== null);

        if (decodedCaptions.length === 0) {
          throw new Error("字幕の処理中にエラーが発生しました。");
        }

        setCaptions(decodedCaptions);
        setCachedCaptions(videoId, decodedCaptions);
        setRetryCount(0);
        setRetryDelay(INITIAL_RETRY_DELAY);
      } catch (err) {
        clearTimeout(timeoutId);
        throw err;
      }
    } catch (err) {
      console.error("Error fetching captions:", err);

      const errorMessage =
        err instanceof Error ? err.message : "字幕の取得に失敗しました。";
      setError(errorMessage);

      // Only attempt retries if not rate limited
      if (
        !isCircuitOpenClient &&
        (errorMessage.includes("Failed to fetch") ||
          errorMessage.includes("network") ||
          errorMessage.includes("timeout"))
      ) {
        if (retryCount < MAX_RETRIES) {
          if (retryTimeoutRef.current) {
            clearTimeout(retryTimeoutRef.current);
          }

          setRetryCount((prev) => prev + 1);
          const nextDelay = Math.min(retryDelay * 2, 10000); // Max 10 seconds
          setRetryDelay(nextDelay);

          const jitter = Math.random() * 1000;
          const actualDelay = nextDelay + jitter;

          const timeoutId = setTimeout(() => {
            fetchCaptions(true);
          }, actualDelay);

          setRetryTimeoutId(timeoutId);
        }
      }
    } finally {
      setIsLoading(false);
      setIsRetrying(false);
    }
  };

  useEffect(() => {
    if (videoId) {
      fetchCaptions();
    }

    return () => {
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
      }
      if (circuitResetTimer) {
        clearTimeout(circuitResetTimer);
      }
      if (retryTimeoutId) {
        clearTimeout(retryTimeoutId);
      }
    };
  }, [videoId]);

  const handlePlayerReady = (event: any) => {
    playerRef.current = event.target;
  };

  const handlePlayerStateChange = (event: any) => {
    const time = event.target.getCurrentTime();
    setCurrentTime(time);
  };

  const handleTimeUpdate = () => {
    if (playerRef.current) {
      const time = playerRef.current.getCurrentTime();
      setCurrentTime(time);
    }
  };

  useEffect(() => {
    const interval = setInterval(handleTimeUpdate, 100);
    return () => clearInterval(interval);
  }, []);

  const handleCaptionClick = (caption: Caption) => {
    if (playerRef.current) {
      playerRef.current.seekTo(caption.start);
    }
  };

  useEffect(() => {
    const handleSelectionChange = () => {
      const selection = window.getSelection();
      if (!selection || selection.isCollapsed) {
        setSaveButtonPosition(null);
        return;
      }

      const range = selection.getRangeAt(0);
      const rect = range.getBoundingClientRect();

      const captionElement = range.commonAncestorContainer.parentElement;
      const captionText = captionElement?.textContent;
      const caption = captions.find((c) => c.text === captionText);

      if (caption) {
        setSelectedCaption(caption);
        setSelectedText(selection.toString().trim());

        if (!showVideo && previewRef.current) {
          const previewRect = previewRef.current.getBoundingClientRect();
          setSaveButtonPosition({
            top: rect.top - previewRect.top - 40,
            left: rect.left - previewRect.left + rect.width / 2 - 50,
          });
        } else {
          setSaveButtonPosition({
            top: rect.top + window.scrollY - 40,
            left: rect.left + window.scrollX + rect.width / 2 - 50,
          });
        }
      }
    };

    document.addEventListener("selectionchange", handleSelectionChange);
    return () =>
      document.removeEventListener("selectionchange", handleSelectionChange);
  }, [captions, showVideo]);

  const handleRetry = () => {
    setRetryCount(0);
    setRetryDelay(INITIAL_RETRY_DELAY);
    fetchCaptions(true);
  };

  const getYouTubePlayerOpts = () => {
    const protocol = window.location.protocol;
    const hostname = window.location.hostname;
    const port = window.location.port;
    const origin = `${protocol}//${hostname}${port ? `:${port}` : ""}`;

    return {
      width: "100%",
      height: "100%",
      playerVars: {
        autoplay: 0,
        modestbranding: 1,
        rel: 0,
        cc_load_policy: 0,
        cc_lang_pref: "en",
        origin: origin,
        enablejsapi: 1,
      },
    };
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-6 h-6 animate-spin text-blue-600 dark:text-blue-400" />
        <p className="ml-2 text-gray-600 dark:text-gray-400">
          字幕を読み込み中...
        </p>
      </div>
    );
  }

  if (isCircuitOpenClient) {
    return (
      <div className="space-y-6">
        <div className="text-center py-8 space-y-4">
          <div className="flex items-center justify-center gap-2 text-red-600 dark:text-red-400">
            <AlertTriangle className="w-6 h-6" />
            <p>APIリクエスト制限に達しました</p>
          </div>
          {retryAfterClient && (
            <div className="flex items-center justify-center gap-2 text-gray-600 dark:text-gray-400">
              <Clock className="w-5 h-5" />
              <p>
                {formatTimeRemaining(retryAfterClient)}
                後に字幕の取得を再試行します
              </p>
            </div>
          )}
          <button
            onClick={() => {
              setShowVideo(true);
              setCaptions([]); // 字幕をクリア
            }}
            className="mt-4 flex items-center justify-center gap-2 bg-gradient-to-r from-blue-500 to-indigo-600 dark:from-blue-600 dark:to-indigo-700 text-white px-8 py-3 rounded-full shadow-lg hover:shadow-xl hover:translate-y-[-1px] transition-all duration-300"
          >
            <Play className="w-5 h-5" />
            字幕なしで動画を再生
          </button>
        </div>
        {showVideo && (
          <div className="aspect-video w-full bg-black rounded-lg overflow-hidden">
            <YouTube
              videoId={videoId}
              opts={getYouTubePlayerOpts() as any}
              onReady={handlePlayerReady}
              onStateChange={handlePlayerStateChange}
              className="w-full h-full"
              iframeClassName="w-full h-full"
            />
          </div>
        )}
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <div className="text-center py-4 space-y-4">
          <div className="flex items-center justify-center gap-2 text-red-600 dark:text-red-400">
            <AlertTriangle className="w-5 h-5" />
            <p>{error}</p>
          </div>
          {isRetrying ? (
            <div className="flex items-center justify-center gap-2 text-gray-600 dark:text-gray-400">
              <RefreshCw className="w-5 h-5 animate-spin" />
              <p>
                再試行中... ({retryCount}/{MAX_RETRIES})
              </p>
            </div>
          ) : (
            retryCount < MAX_RETRIES &&
            !error.includes("APIリクエスト制限") && (
              <div className="flex items-center justify-center gap-4">
                <button
                  onClick={handleRetry}
                  className="flex items-center justify-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
                >
                  <RefreshCw className="w-5 h-5" />
                  字幕を再取得
                </button>
                <button
                  onClick={() => {
                    setShowVideo(true);
                    setCaptions([]); // 字幕をクリア
                  }}
                  className="flex items-center justify-center gap-2 bg-gradient-to-r from-blue-500 to-indigo-600 dark:from-blue-600 dark:to-indigo-700 text-white px-4 py-2 rounded-lg hover:from-blue-600 hover:to-indigo-700 transition-colors"
                >
                  <Play className="w-5 h-5" />
                  字幕なしで再生
                </button>
              </div>
            )
          )}
        </div>
        {showVideo && (
          <div className="aspect-video w-full bg-black rounded-lg overflow-hidden">
            <YouTube
              videoId={videoId}
              opts={getYouTubePlayerOpts() as any}
              onReady={handlePlayerReady}
              onStateChange={handlePlayerStateChange}
              className="w-full h-full"
              iframeClassName="w-full h-full"
            />
          </div>
        )}
      </div>
    );
  }

  if (!showVideo) {
    return (
      <div className="space-y-6">
        <div className="aspect-video w-full bg-black rounded-lg overflow-hidden mb-6">
          <YouTube
            videoId={videoId}
            opts={getYouTubePlayerOpts() as any}
            onReady={handlePlayerReady}
            onStateChange={handlePlayerStateChange}
            className="w-full h-full"
            iframeClassName="w-full h-full"
          />
        </div>
        <button
          onClick={() => setIsCaptionModalOpen(true)}
          className="w-full flex items-center justify-center gap-2 bg-blue-600 text-white px-8 py-4 rounded-lg hover:bg-blue-700 transition-colors"
        >
          <BookOpen className="w-6 h-6" />
          字幕を表示
        </button>
        <CaptionModal
          isOpen={isCaptionModalOpen}
          onClose={() => setIsCaptionModalOpen(false)}
          captions={captions}
          onCaptionClick={handleCaptionClick}
          currentTime={currentTime}
          videoId={videoId}
          videoTitle={videoTitle}
        />
        {selectedCaption && (
          <SaveWordDialog
            open={isSaveWordOpen}
            onOpenChange={setIsSaveWordOpen}
            word={selectedText}
            context={selectedCaption.text}
            videoId={videoId}
          />
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="aspect-video w-full bg-black rounded-lg overflow-hidden">
        <YouTube
          videoId={videoId}
          opts={getYouTubePlayerOpts() as any}
          onReady={handlePlayerReady}
          onStateChange={handlePlayerStateChange}
          className="w-full h-full"
          iframeClassName="w-full h-full"
        />
      </div>
      <button
        onClick={() => setIsCaptionModalOpen(true)}
        className="w-full flex items-center justify-center gap-2 bg-blue-600 text-white px-8 py-4 rounded-lg hover:bg-blue-700 transition-colors"
      >
        <BookOpen className="w-6 h-6" />
        字幕を表示
      </button>
      <CaptionModal
        isOpen={isCaptionModalOpen}
        onClose={() => setIsCaptionModalOpen(false)}
        captions={captions}
        onCaptionClick={handleCaptionClick}
        currentTime={currentTime}
        videoId={videoId}
        videoTitle={videoTitle}
      />
      {selectedCaption && (
        <SaveWordDialog
          open={isSaveWordOpen}
          onOpenChange={setIsSaveWordOpen}
          word={selectedText}
          context={selectedCaption.text}
          videoId={videoId}
        />
      )}
    </div>
  );
}
