import React, { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";
import { format, subDays, startOfDay, endOfDay } from "date-fns";
import { ActivityData } from "../types/youtube";
import {
  ResponsiveContainer,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  BarChart,
  Bar,
} from "recharts";

export default function ActivityGraph() {
  const [data, setData] = useState<ActivityData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [period, setPeriod] = useState<7 | 14 | 30>(7);

  useEffect(() => {
    const fetchActivityData = async () => {
      try {
        setIsLoading(true);
        setError(null);

        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) {
          throw new Error("ユーザーが認証されていません");
        }

        const days = Array.from({ length: period }, (_, i) => {
          const date = subDays(new Date(), i);
          return {
            start: startOfDay(date).toISOString(),
            end: endOfDay(date).toISOString(),
            date: format(date, "M/d"),
          };
        }).reverse();

        // 並列でデータを取得
        const [wordsResult, videosResult, reviewsResult] = await Promise.all([
          supabase
            .from("saved_words")
            .select("created_at")
            .eq("user_id", user.id),

          supabase
            .from("saved_words")
            .select("video_id, created_at")
            .eq("user_id", user.id),

          supabase
            .from("saved_words")
            .select("created_at")
            .eq("user_id", user.id)
            .eq("remembered", true),
        ]);

        // エラーチェック
        if (wordsResult.error) throw wordsResult.error;
        if (videosResult.error) throw videosResult.error;
        if (reviewsResult.error) throw reviewsResult.error;

        const activityData = days.map(({ date, start, end }) => {
          const dayWords =
            wordsResult.data?.filter(
              (w) => w.created_at >= start && w.created_at <= end
            ).length || 0;

          const dayVideos = new Set(
            videosResult.data
              ?.filter((v) => v.created_at >= start && v.created_at <= end)
              .map((v) => v.video_id)
          ).size;

          const dayReviews =
            reviewsResult.data?.filter(
              (r) => r.created_at >= start && r.created_at <= end
            ).length || 0;

          return {
            date,
            words: dayWords,
            videos: dayVideos,
            reviews: dayReviews,
          };
        });

        setData(activityData);
      } catch (err) {
        console.error("Error fetching activity data:", err);
        if (err instanceof Error) {
          setError(err.message);
        } else {
          setError("予期せぬエラーが発生しました");
        }
      } finally {
        setIsLoading(false);
      }
    };

    fetchActivityData();
  }, [period]);

  if (isLoading) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-600 dark:text-gray-400">
          データを読み込み中...
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-8">
        <p className="text-red-600 dark:text-red-400">{error}</p>
      </div>
    );
  }

  return (
    <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm rounded-2xl shadow-xl p-4 sm:p-6">
      <div className="flex flex-col sm:flex-row sm:items-center gap-4 mb-6">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
          学習アクティビティ
        </h2>
        <div className="flex gap-2 sm:ml-auto">
          {[
            { value: 7, label: "1週間" },
            { value: 14, label: "2週間" },
            { value: 30, label: "1ヶ月" },
          ].map(({ value, label }) => (
            <button
              key={value}
              onClick={() => setPeriod(value as 7 | 14 | 30)}
              className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all duration-300 ${
                period === value
                  ? "bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200"
                  : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="h-[300px] sm:h-[400px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={data}
            margin={{
              top: 5,
              right: 5,
              left: -15,
              bottom: 5,
            }}
          >
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="#374151"
              opacity={0.5}
              vertical={false}
            />
            <XAxis
              dataKey="date"
              stroke="#9CA3AF"
              tick={{ fontSize: 12 }}
              tickMargin={8}
              axisLine={false}
            />
            <YAxis
              stroke="#9CA3AF"
              tick={{ fontSize: 12 }}
              tickMargin={8}
              axisLine={false}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "rgba(17, 24, 39, 0.9)",
                backdropFilter: "blur(8px)",
                border: "none",
                borderRadius: "1rem",
                color: "#fff",
                boxShadow:
                  "0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)",
                padding: "12px",
              }}
              itemStyle={{ fontSize: "14px" }}
              labelStyle={{ fontSize: "14px", marginBottom: "8px" }}
            />
            <Legend
              wrapperStyle={{
                paddingTop: "20px",
              }}
              formatter={(value) => (
                <span className="text-sm text-gray-700 dark:text-gray-300">
                  {value}
                </span>
              )}
            />
            <Bar
              dataKey="words"
              name="登録単語"
              fill="url(#colorWords)"
              radius={[4, 4, 0, 0]}
              maxBarSize={40}
            />
            <Bar
              dataKey="videos"
              name="視聴動画"
              fill="url(#colorVideos)"
              radius={[4, 4, 0, 0]}
              maxBarSize={40}
            />
            <Bar
              dataKey="reviews"
              name="復習完了"
              fill="url(#colorReviews)"
              radius={[4, 4, 0, 0]}
              maxBarSize={40}
            />
            <defs>
              <linearGradient id="colorWords" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#3B82F6" stopOpacity={0.8} />
                <stop offset="100%" stopColor="#2563EB" stopOpacity={0.8} />
              </linearGradient>
              <linearGradient id="colorVideos" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#10B981" stopOpacity={0.8} />
                <stop offset="100%" stopColor="#059669" stopOpacity={0.8} />
              </linearGradient>
              <linearGradient id="colorReviews" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#F59E0B" stopOpacity={0.8} />
                <stop offset="100%" stopColor="#D97706" stopOpacity={0.8} />
              </linearGradient>
            </defs>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
