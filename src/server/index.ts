import express from "express";
import { YoutubeTranscript } from "youtube-transcript";
import cors from "cors";
import Keyv from "keyv";
import rateLimit from "express-rate-limit";
import { createServer } from "node:http";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const DEFAULT_PORT = 3001;
const MAX_PORT_ATTEMPTS = 10;

app.set("trust proxy", true);
app.use(
  cors({
    origin: "*",
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Accept"],
    credentials: true,
  })
);
app.use(express.json());

// 静的ファイルの提供
app.use(express.static(path.join(__dirname, "../../dist")));

// すべてのルートでindex.htmlを提供
app.get("*", (_req, res) => {
  res.sendFile(path.join(__dirname, "../../dist/index.html"));
});

const cache = new Keyv();
const errorCache = new Keyv();
let isCircuitOpen = false;
const CIRCUIT_RESET_TIME = 30 * 60 * 1000; // 30 minutes

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const openCircuit = () => {
  isCircuitOpen = true;
  setTimeout(() => {
    isCircuitOpen = false;
  }, CIRCUIT_RESET_TIME);
};

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: {
    error: "リクエスト制限に達しました。しばらく待ってから再試行してください。",
  },
  keyGenerator: (request) => {
    const forwardedFor = request.headers["x-forwarded-for"];
    if (forwardedFor) {
      const ips = Array.isArray(forwardedFor)
        ? forwardedFor[0]
        : forwardedFor.split(",")[0].trim();
      if (ips) return ips;
    }

    return (
      request.ip ||
      request.connection.remoteAddress ||
      request.socket.remoteAddress ||
      "127.0.0.1"
    );
  },
  skip: (req) => {
    return req.path === "/api/health" || req.method === "OPTIONS";
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    const retryAfter = Math.ceil(res.getHeader("Retry-After") as number);
    res.status(429).json({
      error: `リクエスト制限に達しました。${retryAfter}秒後に再試行してください。`,
      retryAfter,
    });
  },
});

app.use("/api", limiter);

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok" });
});

const errorHandler = (
  err: Error,
  _req: express.Request,
  res: express.Response,
  next: express.NextFunction
) => {
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

    if (isCircuitOpen) {
      res.setHeader("Retry-After", Math.ceil(CIRCUIT_RESET_TIME / 1000));
      return res.status(429).json({
        error:
          "APIリクエスト制限に達しました。しばらく待ってから再試行してください。",
        retryAfter: Math.ceil(CIRCUIT_RESET_TIME / 1000),
      });
    }

    const cachedError = await errorCache.get(videoId);
    if (cachedError) {
      res.setHeader("Retry-After", 1800);
      return res.status(429).json({
        error:
          "APIリクエスト制限に達しました。しばらく待ってから再試行してください。",
        retryAfter: 1800,
      });
    }

    const cachedCaptions = await cache.get(videoId);
    if (cachedCaptions) {
      return res.json(cachedCaptions);
    }

    await delay(500);

    let retryCount = 0;
    const maxRetries = 5;
    const baseDelay = 3000;
    let consecutiveErrors = 0;

    while (retryCount < maxRetries) {
      try {
        const transcripts = await YoutubeTranscript.fetchTranscript(videoId, {
          lang: "en",
        });

        if (!transcripts || transcripts.length === 0) {
          return res.status(404).json({
            error: "この動画には英語の字幕がありません。",
          });
        }

        const captions = transcripts.map((transcript) => ({
          start: transcript.offset / 1000,
          end: (transcript.offset + transcript.duration) / 1000,
          text: transcript.text,
        }));

        consecutiveErrors = 0;
        await cache.set(videoId, captions);
        return res.json(captions);
      } catch (error: any) {
        if (error.message?.includes("too many requests")) {
          consecutiveErrors++;

          if (consecutiveErrors >= 3) {
            openCircuit();
            await errorCache.set(videoId, true);
            res.setHeader("Retry-After", Math.ceil(CIRCUIT_RESET_TIME / 1000));
            return res.status(429).json({
              error:
                "APIリクエスト制限に達しました。しばらく待ってから再試行してください。",
              retryAfter: Math.ceil(CIRCUIT_RESET_TIME / 1000),
            });
          }

          retryCount++;
          if (retryCount < maxRetries) {
            const jitter = Math.random() * 2000;
            const delayTime = baseDelay * Math.pow(2, retryCount) + jitter;
            await delay(delayTime);
            continue;
          }
        }
        throw error;
      }
    }

    await errorCache.set(videoId, true);
    openCircuit();
    res.setHeader("Retry-After", Math.ceil(CIRCUIT_RESET_TIME / 1000));
    throw new Error("APIリクエスト制限に達しました");
  } catch (error: any) {
    console.error("Error fetching captions:", error);

    if (error.message?.includes("Transcript is disabled")) {
      return res.status(404).json({
        error: "この動画では字幕が無効になっています。",
      });
    }

    if (
      error.message?.includes("too many requests") ||
      error.message?.includes("APIリクエスト制限")
    ) {
      res.setHeader("Retry-After", Math.ceil(CIRCUIT_RESET_TIME / 1000));
      return res.status(429).json({
        error:
          "APIリクエスト制限に達しました。しばらく待ってから再試行してください。",
        retryAfter: Math.ceil(CIRCUIT_RESET_TIME / 1000),
      });
    }

    res.status(500).json({
      error:
        "字幕の取得に失敗しました。この動画は英語の字幕が利用できない可能性があります。",
    });
  }
});

app.use(errorHandler);

const startServer = async () => {
  const server = createServer(app);

  for (
    let port = DEFAULT_PORT;
    port < DEFAULT_PORT + MAX_PORT_ATTEMPTS;
    port++
  ) {
    try {
      await new Promise((resolve, reject) => {
        server.listen(port, "0.0.0.0", () => {
          console.log(`字幕サーバーがポート${port}で起動しました`);
          resolve(true);
        });

        server.on("error", (err: NodeJS.ErrnoException) => {
          if (err.code === "EADDRINUSE") {
            server.close();
            resolve(false);
          } else {
            reject(err);
          }
        });
      });

      return port;
    } catch (err) {
      console.error(`ポート${port}での起動に失敗しました:`, err);
      if (port === DEFAULT_PORT + MAX_PORT_ATTEMPTS - 1) {
        throw err;
      }
    }
  }

  throw new Error("利用可能なポートが見つかりませんでした");
};

startServer().catch((err) => {
  console.error("サーバーの起動に失敗しました:", err);
  process.exit(1);
});
