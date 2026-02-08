/**
 * English Learning Hub - Minimal API Server
 *
 * Chrome拡張機能用の最小限APIサーバー
 * - 学習ログ（Neon DB）
 * - YouTube字幕取得
 * - Unsplash画像検索
 * - Cambridge辞書（CORS回避）
 */

import express from 'express';
import { Innertube } from 'youtubei.js';
import cors from 'cors';
import Keyv from 'keyv';
import rateLimit from 'express-rate-limit';
import { createServer } from 'node:http';
import { neon } from '@neondatabase/serverless';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

app.set('trust proxy', true);

// ============================================
// Cache Setup
// ============================================

const cache = new Keyv({
  ttl: 24 * 60 * 60 * 1000, // 24 hours
  store: new Map(),
});

const errorCache = new Keyv({
  ttl: 5 * 60 * 1000, // 5 minutes
  store: new Map(),
});

cache.on('error', (err) => console.error('Cache error:', err));
errorCache.on('error', (err) => console.error('Error cache error:', err));

// ============================================
// YouTube Client
// ============================================

let youtube: Innertube | null = null;

const initYoutube = async () => {
  if (!youtube) {
    youtube = await Innertube.create({
      lang: 'en',
      location: 'US',
      retrieve_player: false,
    });
  }
  return youtube;
};

// ============================================
// Middleware
// ============================================

const corsOptions = {
  origin: '*',
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
  credentials: true,
};

app.use(cors(corsOptions));
app.use(express.json());

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200, // limit each IP to 200 requests per windowMs
  message: { error: 'Too many requests, please try again later.' },
  skip: (req) => req.path === '/api/health' || req.method === 'OPTIONS',
  standardHeaders: true,
  legacyHeaders: false,
});

app.use('/api', limiter);

// ============================================
// Health Check
// ============================================

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ============================================
// Study Logs API
// ============================================

app.post('/api/study-logs', async (req, res) => {
  try {
    const { url, domain, page_title, duration, started_at, ended_at, notes } = req.body;

    if (!url || !started_at || !ended_at || duration === undefined) {
      return res.status(400).json({
        error: 'Missing required fields: url, started_at, ended_at, duration',
        success: false,
      });
    }

    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) {
      return res.status(500).json({
        error: 'Database not configured',
        success: false,
      });
    }

    const sql = neon(databaseUrl);
    const result = await sql`
      INSERT INTO study_logs (url, domain, page_title, duration, started_at, ended_at, notes)
      VALUES (${url}, ${domain || null}, ${page_title || null}, ${duration}, ${started_at}, ${ended_at}, ${notes || null})
      RETURNING *
    `;

    return res.json({
      success: true,
      data: result[0],
    });
  } catch (error: any) {
    console.error('Error saving study log:', error);
    return res.status(500).json({
      error: 'Failed to save study log',
      details: error.message,
      success: false,
    });
  }
});

app.get('/api/study-logs', async (req, res) => {
  try {
    const { start_date, end_date, limit = '100' } = req.query;

    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) {
      return res.status(500).json({
        error: 'Database not configured',
        success: false,
      });
    }

    const sql = neon(databaseUrl);
    const limitNum = parseInt(limit as string, 10) || 100;

    let result;
    if (start_date && end_date) {
      result = await sql`
        SELECT * FROM study_logs
        WHERE started_at >= ${start_date as string}
          AND started_at <= ${end_date as string}
        ORDER BY started_at DESC
        LIMIT ${limitNum}
      `;
    } else {
      result = await sql`
        SELECT * FROM study_logs
        ORDER BY started_at DESC
        LIMIT ${limitNum}
      `;
    }

    return res.json({
      success: true,
      data: result,
    });
  } catch (error: any) {
    console.error('Error fetching study logs:', error);
    return res.status(500).json({
      error: 'Failed to fetch study logs',
      details: error.message,
      success: false,
    });
  }
});

// ============================================
// YouTube Captions API
// ============================================

app.get('/api/captions/:videoId', async (req, res) => {
  try {
    const { videoId } = req.params;
    const { lang } = req.query;

    if (!videoId) {
      return res.status(400).json({ error: 'Video ID is required' });
    }

    // Check cache
    const cacheKey = `captions:${videoId}:${lang || 'default'}`;
    const cachedCaptions = await cache.get(cacheKey);
    if (cachedCaptions) {
      return res.json(cachedCaptions);
    }

    // Check error cache
    const cachedError = await errorCache.get(videoId);
    if (cachedError) {
      return res.status(429).json({
        error: 'Captions temporarily unavailable. Please try again later.',
        retryAfter: 300,
      });
    }

    try {
      const yt = await initYoutube();
      const info = await yt.getInfo(videoId);
      const transcriptData = await info.getTranscript();

      if (!transcriptData || !transcriptData.transcript) {
        throw new Error('Transcript not found');
      }

      const transcript = transcriptData.transcript as any;
      const segments = transcript?.content?.body?.initial_segments || [];

      const captions = segments.map((segment: any) => ({
        start: segment.start_ms / 1000,
        end: (segment.start_ms + segment.duration_ms) / 1000,
        duration: segment.duration_ms / 1000,
        text: segment.snippet?.text || '',
      }));

      const response = { captions, languageCode: transcript?.language_code || 'en' };
      await cache.set(cacheKey, response);
      return res.json(response);
    } catch (error: any) {
      console.error('Error fetching transcript:', error);

      if (error.message?.includes('Transcript not found')) {
        await errorCache.set(videoId, true);
        return res.status(404).json({
          error: 'Captions not available for this video.',
        });
      }

      throw error;
    }
  } catch (error: any) {
    console.error('Error in captions endpoint:', error);
    return res.status(500).json({
      error: 'Failed to fetch captions.',
    });
  }
});

// ============================================
// Unsplash Image Search API
// ============================================

app.get('/api/unsplash', async (req, res) => {
  try {
    const { query } = req.query;

    if (!query) {
      return res.status(400).json({ error: 'Query parameter is required' });
    }

    const accessKey = process.env.UNSPLASH_ACCESS_KEY;

    if (accessKey && accessKey.length > 10) {
      const response = await fetch(
        `https://api.unsplash.com/search/photos?query=${encodeURIComponent(
          query as string
        )}&per_page=1&client_id=${accessKey}`,
        {
          headers: { 'Accept-Version': 'v1' },
        }
      );

      if (response.ok) {
        const data = (await response.json()) as { results: Array<{ urls: { small: string } }> };
        if (data.results && data.results.length > 0) {
          return res.json({
            imageUrl: data.results[0].urls.small,
            source: 'unsplash',
          });
        }
      }
    }

    // Fallback to placeholder
    return res.json({
      imageUrl: `https://picsum.photos/seed/${encodeURIComponent(query as string)}/400/300`,
      source: 'placeholder',
    });
  } catch (error) {
    console.error('Unsplash API error:', error);
    return res.json({
      imageUrl: `https://picsum.photos/seed/${Date.now()}/400/300`,
      source: 'placeholder',
    });
  }
});

// ============================================
// Cambridge Dictionary API (CORS workaround)
// ============================================

app.get('/api/cambridge-dictionary', async (req, res) => {
  try {
    const { word } = req.query;

    if (!word) {
      return res.status(400).json({ error: 'Word parameter is required' });
    }

    const url = `https://dictionary.cambridge.org/ja/dictionary/english/${encodeURIComponent(
      word as string
    )}`;

    const response = await fetch(url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
    });

    if (!response.ok) {
      return res.status(404).json({ error: 'Definition not found' });
    }

    const html = await response.text();

    // Extract definition
    const definitionMatch = html.match(/<div class="def ddef_d db">(.*?)<\/div>/s);

    if (!definitionMatch) {
      return res.status(404).json({ error: 'Definition not found' });
    }

    // Clean up the definition text
    let definition = definitionMatch[1];
    definition = definition.replace(/<a[^>]*>(.*?)<\/a>/g, '$1');
    definition = definition.replace(/<[^>]*>/g, '');
    definition = definition.replace(/\s+/g, ' ').trim();

    return res.json({ word, definition });
  } catch (error) {
    console.error('Cambridge Dictionary error:', error);
    return res.status(500).json({ error: 'Failed to fetch definition' });
  }
});

// ============================================
// Error Handler
// ============================================

app.use(
  (
    err: Error,
    _req: express.Request,
    res: express.Response,
    next: express.NextFunction
  ) => {
    console.error('Unhandled error:', err);
    if (!res.headersSent) {
      res.status(500).json({ error: 'An unexpected error occurred.' });
    }
    next(err);
  }
);

// ============================================
// Server Start
// ============================================

const server = createServer(app);
server.listen(PORT, () => {
  console.log(`
╔════════════════════════════════════════════════════════════╗
║       English Learning Hub - API Server                     ║
║                                                            ║
║   Server running on http://localhost:${PORT}                  ║
║                                                            ║
║   Endpoints:                                               ║
║   • GET  /api/health              - Health check           ║
║   • POST /api/study-logs          - Save study log         ║
║   • GET  /api/study-logs          - Get study logs         ║
║   • GET  /api/captions/:videoId   - YouTube captions       ║
║   • GET  /api/unsplash            - Image search           ║
║   • GET  /api/cambridge-dictionary - Cambridge dictionary  ║
╚════════════════════════════════════════════════════════════╝
  `);
});

export default app;
