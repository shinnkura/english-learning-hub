import express from "express";
import { YoutubeTranscript } from "youtube-transcript";
import cors from "cors";
import Keyv from "keyv";
import rateLimit from "express-rate-limit";
import { createServer } from "node:http";
import axios from "axios";

const app = express();

// Vercel環境でのポート設定
const PORT = process.env.PORT || 3001;

app.set("trust proxy", true);

// キャッシュの設定
const cache = new Keyv({
  ttl: 24 * 60 * 60 * 1000, // 24時間
  store: process.env.VERCEL ? new Map() : undefined, // Vercel環境ではメモリキャッシュを使用
});

const errorCache = new Keyv({
  ttl: 30 * 60 * 1000, // 30分
  store: process.env.VERCEL ? new Map() : undefined,
});

// プロキシサーバーのリスト（必要に応じて追加）
const proxyServers = [
  // プロキシサーバーのURLを追加
];

let currentProxyIndex = 0;

const getNextProxy = () => {
  if (proxyServers.length === 0) return null;
  currentProxyIndex = (currentProxyIndex + 1) % proxyServers.length;
  return proxyServers[currentProxyIndex];
};

let isCircuitOpen = false;
let circuitResetTimeout: NodeJS.Timeout | null = null;
const CIRCUIT_RESET_TIME = 30 * 60 * 1000;

cache.on("error", (err) => console.error("Keyv connection error:", err));
errorCache.on("error", (err) => console.error("Error cache connection error:", err));

const corsOptions = {
  origin: "*",
  methods: ["GET", "POST", "OPTIONS"],
  allowedHeaders: [
    "Content-Type",
    "Authorization",
    "Accept",
    "X-Forwarded-For",
    "X-Forwarded-Proto",
    "X-Forwarded-Host",
  ],
  credentials: true,
  exposedHeaders: ["Retry-After"],
};

app.use(cors(corsOptions));
app.use(express.json());

app.use((_req, res, next) => {
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Expose-Headers", "Retry-After");
  next();
});

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { error: "リクエスト制限に達しました。しばらく待ってから再試行してください。" },
  keyGenerator: (request) => {
    const forwardedFor = request.headers["x-forwarded-for"];
    if (forwardedFor) {
      const ips = Array.isArray(forwardedFor) ? forwardedFor[0] : forwardedFor.split(",")[0].trim();
      if (ips) return ips;
    }

    return request.ip || request.connection.remoteAddress || request.socket.remoteAddress || "127.0.0.1";
  },
  skip: (req) => {
    return req.path === "/api/health" || req.method === "OPTIONS";
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, res) => {
    const retryAfter = Math.ceil(res.getHeader("Retry-After") as number);
    res.status(429).json({
      error: `リクエスト制限に達しました。${retryAfter}秒後に再試行してください。`,
      retryAfter,
    });
  },
});

app.use("/api", limiter);

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const openCircuit = () => {
  isCircuitOpen = true;
  if (circuitResetTimeout) {
    clearTimeout(circuitResetTimeout);
  }
  circuitResetTimeout = setTimeout(() => {
    isCircuitOpen = false;
    circuitResetTimeout = null;
  }, CIRCUIT_RESET_TIME);
};

const errorHandler = (err: Error, _req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error("Error:", err);
  if (!res.headersSent) {
    res.status(500).json({
      error: "予期せぬエラーが発生しました。もう一度お試しください。",
    });
  }
  next(err);
};

app.get("/api/captions/:videoId", async (req, res) => {
  try {
    const { videoId } = req.params;

    if (!videoId) {
      return res.status(400).json({
        error: "動画IDが指定されていません",
      });
    }

    // キャッシュの確認
    const cachedCaptions = await cache.get(videoId);
    if (cachedCaptions) {
      return res.json(cachedCaptions);
    }

    // エラーキャッシュの確認
    const cachedError = await errorCache.get(videoId);
    if (cachedError) {
      return res.status(429).json({
        error: "この動画の字幕は一時的に取得できません。しばらく待ってから再試行してください。",
        retryAfter: 1800,
      });
    }

    // プロキシの設定
    const proxy = getNextProxy();
    const axiosConfig = proxy ? { proxy } : {};

    // 字幕の取得を試みる
    let retryCount = 0;
    const maxRetries = 3;
    const languages = ["en", "en-US", "en-GB", "en-CA", "en-AU"];

    while (retryCount < maxRetries) {
      for (const lang of languages) {
        try {
          const transcripts = await YoutubeTranscript.fetchTranscript(videoId, {
            lang,
            ...axiosConfig,
          });

          if (!transcripts || transcripts.length === 0) {
            continue;
          }

          const captions = transcripts.map((transcript) => ({
            start: transcript.offset / 1000,
            end: (transcript.offset + transcript.duration) / 1000,
            text: transcript.text,
            lang,
          }));

          // キャッシュに保存
          await cache.set(videoId, captions);
          return res.json(captions);
        } catch (error: any) {
          console.error(`Error fetching captions for ${lang}:`, error);

          if (error.message?.includes("too many requests")) {
            retryCount++;
            if (retryCount < maxRetries) {
              await delay(1000 * Math.pow(2, retryCount));
              continue;
            }
          }

          if (error.message?.includes("Transcript is disabled")) {
            await errorCache.set(videoId, true);
            return res.status(404).json({
              error: "この動画では字幕が無効になっています。",
              details: "字幕が無効になっているか、非公開に設定されている可能性があります。",
              suggestion: "別の動画を試すか、字幕が有効になっている動画を選択してください。",
            });
          }
        }
      }
      break;
    }

    // すべての試行が失敗した場合
    await errorCache.set(videoId, true);
    return res.status(429).json({
      error: "字幕の取得に失敗しました。しばらく待ってから再試行してください。",
      details: "一時的な制限により字幕を取得できません。",
      retryAfter: 1800,
    });
  } catch (error: any) {
    console.error("Error in captions endpoint:", error);
    return res.status(500).json({
      error: "字幕の取得に失敗しました。",
      details: "予期せぬエラーが発生しました。しばらく待ってから再試行してください。",
    });
  }
});

app.get("/api/health", (_, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

app.options("*", cors(corsOptions));

app.use(errorHandler);

// Vercel環境でのサーバー起動
if (process.env.NODE_ENV !== "production") {
  const server = createServer(app);
  server.listen(PORT, () => {
    console.log(`字幕サーバーがポート${PORT}で起動しました`);
  });
}

// VercelのServerless Functions用にエクスポート
export default app;
