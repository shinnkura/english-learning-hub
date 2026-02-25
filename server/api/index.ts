/**
 * Vercel Serverless Function Entry Point
 *
 * このファイルはVercelのサーバーレス関数として動作し、
 * src/index.tsで定義されたExpressアプリと同等の機能を提供します。
 */

import express from 'express';
import cors from 'cors';
import Keyv from 'keyv';
import rateLimit from 'express-rate-limit';
import { neon } from '@neondatabase/serverless';
import { YoutubeTranscript } from 'youtube-transcript-scraper';
import { createRemoteJWKSet, jwtVerify } from 'jose';

// ============================================
// Neon Auth JWT Verification Setup
// ============================================

const NEON_AUTH_JWKS_URL = process.env.NEON_AUTH_JWKS_URL ||
  'https://ep-tiny-violet-aewayuqh.neonauth.c-2.us-east-2.aws.neon.tech/neondb/auth/.well-known/jwks.json';

let jwks: ReturnType<typeof createRemoteJWKSet> | null = null;

function getJWKS() {
  if (!jwks) {
    jwks = createRemoteJWKSet(new URL(NEON_AUTH_JWKS_URL));
  }
  return jwks;
}

// Extended Request type with user info
interface AuthenticatedRequest extends express.Request {
  user?: {
    id: string;
    email?: string;
  };
}

// JWT Authentication Middleware
async function authenticateJWT(
  req: AuthenticatedRequest,
  res: express.Response,
  next: express.NextFunction
): Promise<void> {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Authorization header required', success: false });
    return;
  }

  const token = authHeader.substring(7);

  try {
    const { payload } = await jwtVerify(token, getJWKS());

    req.user = {
      id: payload.sub as string,
      email: payload.email as string | undefined,
    };

    next();
  } catch (error: any) {
    console.error('JWT verification failed:', error.message);
    res.status(401).json({ error: 'Invalid or expired token', success: false });
  }
}

// Optional authentication - sets user if token present, continues otherwise
async function optionalAuth(
  req: AuthenticatedRequest,
  res: express.Response,
  next: express.NextFunction
): Promise<void> {
  const authHeader = req.headers.authorization;

  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    try {
      const { payload } = await jwtVerify(token, getJWKS());
      req.user = {
        id: payload.sub as string,
        email: payload.email as string | undefined,
      };
    } catch (error) {
      // Token invalid, but continue without user
    }
  }

  next();
}

const app = express();

// Cache Setup
const cache = new Keyv({ ttl: 24 * 60 * 60 * 1000, store: new Map() });
const errorCache = new Keyv({ ttl: 5 * 60 * 1000, store: new Map() });
cache.on('error', (err) => console.error('Cache error:', err));
errorCache.on('error', (err) => console.error('Error cache error:', err));

// Middleware
const corsOptions = {
  origin: '*',
  methods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
  credentials: true,
};

app.use(cors(corsOptions));
app.use(express.json());

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  message: { error: 'Too many requests, please try again later.' },
  skip: (req) => req.path === '/api/health' || req.method === 'OPTIONS',
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api', limiter);

// Health Check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Root endpoint
app.get('/', (_req, res) => {
  res.json({
    message: 'English Learning Hub API',
    endpoints: ['/api/health', '/api/flashcards', '/api/study-logs', '/api/youtube/channels', '/api/captions/:videoId']
  });
});

// ============================================
// Auth API
// ============================================

app.get('/api/auth/me', authenticateJWT, (req: AuthenticatedRequest, res) => {
  res.json({
    success: true,
    user: req.user,
  });
});

// ============================================
// Study Logs API
// ============================================

app.post('/api/study-logs', async (req, res) => {
  try {
    const { url, domain, page_title, duration, started_at, ended_at, notes } = req.body;
    if (!url || !started_at || !ended_at || duration === undefined) {
      return res.status(400).json({ error: 'Missing required fields', success: false });
    }
    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) {
      return res.status(500).json({ error: 'Database not configured', success: false });
    }
    const sql = neon(databaseUrl);
    const result = await sql`
      INSERT INTO study_logs (url, domain, page_title, duration, started_at, ended_at, notes)
      VALUES (${url}, ${domain || null}, ${page_title || null}, ${duration}, ${started_at}, ${ended_at}, ${notes || null})
      RETURNING *
    `;
    return res.json({ success: true, data: result[0] });
  } catch (error: any) {
    console.error('Error saving study log:', error);
    return res.status(500).json({ error: 'Failed to save study log', success: false });
  }
});

app.get('/api/study-logs', async (req, res) => {
  try {
    const { start_date, end_date, limit = '100' } = req.query;
    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) {
      return res.status(500).json({ error: 'Database not configured', success: false });
    }
    const sql = neon(databaseUrl);
    const limitNum = parseInt(limit as string, 10) || 100;
    let result;
    if (start_date && end_date) {
      result = await sql`
        SELECT * FROM study_logs
        WHERE started_at >= ${start_date as string} AND started_at <= ${end_date as string}
        ORDER BY started_at DESC LIMIT ${limitNum}
      `;
    } else {
      result = await sql`SELECT * FROM study_logs ORDER BY started_at DESC LIMIT ${limitNum}`;
    }
    return res.json({ success: true, data: result });
  } catch (error: any) {
    console.error('Error fetching study logs:', error);
    return res.status(500).json({ error: 'Failed to fetch study logs', success: false });
  }
});

// ============================================
// Flashcards API
// ============================================

app.post('/api/flashcards', async (req, res) => {
  try {
    const { word, meaning, definition, example, phonetic, image_url, source_url } = req.body;
    if (!word || !meaning) {
      return res.status(400).json({ error: 'Missing required fields: word, meaning', success: false });
    }
    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) {
      return res.status(500).json({ error: 'Database not configured', success: false });
    }
    const sql = neon(databaseUrl);
    const existing = await sql`SELECT id FROM flashcards WHERE word = ${word}`;
    if (existing.length > 0) {
      return res.status(409).json({ error: 'Word already exists', success: false, existingId: existing[0].id });
    }
    const result = await sql`
      INSERT INTO flashcards (word, meaning, definition, example, phonetic, image_url, source_url)
      VALUES (${word}, ${meaning}, ${definition || null}, ${example || null}, ${phonetic || null}, ${image_url || null}, ${source_url || null})
      RETURNING *
    `;
    return res.json({ success: true, data: result[0] });
  } catch (error: any) {
    console.error('Error creating flashcard:', error);
    return res.status(500).json({ error: 'Failed to create flashcard', success: false });
  }
});

app.get('/api/flashcards', async (req, res) => {
  try {
    const { limit = '100', offset = '0' } = req.query;
    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) {
      return res.status(500).json({ error: 'Database not configured', success: false });
    }
    const sql = neon(databaseUrl);
    const result = await sql`
      SELECT * FROM flashcards ORDER BY created_at DESC
      LIMIT ${parseInt(limit as string, 10)} OFFSET ${parseInt(offset as string, 10)}
    `;
    const countResult = await sql`SELECT COUNT(*) as total FROM flashcards`;
    return res.json({ success: true, data: result, total: parseInt(countResult[0].total as string, 10) });
  } catch (error: any) {
    console.error('Error fetching flashcards:', error);
    return res.status(500).json({ error: 'Failed to fetch flashcards', success: false });
  }
});

app.get('/api/flashcards/review', async (req, res) => {
  try {
    const { limit = '20' } = req.query;
    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) {
      return res.status(500).json({ error: 'Database not configured', success: false });
    }
    const sql = neon(databaseUrl);
    const result = await sql`
      SELECT * FROM flashcards WHERE next_review_at <= NOW()
      ORDER BY next_review_at ASC LIMIT ${parseInt(limit as string, 10)}
    `;
    return res.json({ success: true, data: result });
  } catch (error: any) {
    console.error('Error fetching review cards:', error);
    return res.status(500).json({ error: 'Failed to fetch review cards', success: false });
  }
});

app.post('/api/flashcards/:id/review', async (req, res) => {
  try {
    const { id } = req.params;
    const { quality } = req.body;
    if (quality === undefined || quality < 0 || quality > 5) {
      return res.status(400).json({ error: 'Quality must be between 0 and 5', success: false });
    }
    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) {
      return res.status(500).json({ error: 'Database not configured', success: false });
    }
    const sql = neon(databaseUrl);
    const cards = await sql`SELECT * FROM flashcards WHERE id = ${id}`;
    if (cards.length === 0) {
      return res.status(404).json({ error: 'Flashcard not found', success: false });
    }
    const card = cards[0];
    let { ease_factor, interval_days, repetitions } = card;
    if (quality < 3) {
      repetitions = 0;
      interval_days = 0;
    } else {
      if (repetitions === 0) interval_days = 1;
      else if (repetitions === 1) interval_days = 6;
      else interval_days = Math.round(interval_days * ease_factor);
      repetitions += 1;
    }
    ease_factor = Math.max(1.3, ease_factor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02)));
    const nextReview = new Date();
    nextReview.setDate(nextReview.getDate() + interval_days);
    const result = await sql`
      UPDATE flashcards SET ease_factor = ${ease_factor}, interval_days = ${interval_days},
        repetitions = ${repetitions}, next_review_at = ${nextReview.toISOString()}, last_reviewed_at = NOW()
      WHERE id = ${id} RETURNING *
    `;
    return res.json({ success: true, data: result[0] });
  } catch (error: any) {
    console.error('Error updating flashcard review:', error);
    return res.status(500).json({ error: 'Failed to update review', success: false });
  }
});

app.delete('/api/flashcards/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) {
      return res.status(500).json({ error: 'Database not configured', success: false });
    }
    const sql = neon(databaseUrl);
    await sql`DELETE FROM flashcards WHERE id = ${id}`;
    return res.json({ success: true });
  } catch (error: any) {
    console.error('Error deleting flashcard:', error);
    return res.status(500).json({ error: 'Failed to delete flashcard', success: false });
  }
});

app.get('/api/flashcards/stats', async (req, res) => {
  try {
    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) {
      return res.status(500).json({ error: 'Database not configured', success: false });
    }
    const sql = neon(databaseUrl);
    const totalResult = await sql`SELECT COUNT(*) as total FROM flashcards`;
    const dueResult = await sql`SELECT COUNT(*) as due FROM flashcards WHERE next_review_at <= NOW()`;
    const masteredResult = await sql`SELECT COUNT(*) as mastered FROM flashcards WHERE interval_days >= 21`;
    const learningResult = await sql`SELECT COUNT(*) as learning FROM flashcards WHERE interval_days > 0 AND interval_days < 21`;
    return res.json({
      success: true,
      total: parseInt(totalResult[0].total as string, 10),
      dueForReview: parseInt(dueResult[0].due as string, 10),
      mastered: parseInt(masteredResult[0].mastered as string, 10),
      learning: parseInt(learningResult[0].learning as string, 10),
    });
  } catch (error: any) {
    console.error('Error fetching flashcard stats:', error);
    return res.status(500).json({ error: 'Failed to fetch stats', success: false });
  }
});

// ============================================
// YouTube Captions API
// ============================================

app.get('/api/captions/:videoId', async (req, res) => {
  try {
    const { videoId } = req.params;
    const { lang = 'en' } = req.query;

    if (!videoId || !/^[a-zA-Z0-9_-]{11}$/.test(videoId)) {
      return res.status(400).json({ error: 'Valid Video ID is required' });
    }

    // Check cache
    const cacheKey = `captions:${videoId}:${lang}`;
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
      const transcript = await YoutubeTranscript.fetchTranscript(videoId, { lang: lang as string });

      if (!transcript || transcript.length === 0) {
        throw new Error('No captions found');
      }

      const captions = transcript.map((item: any) => ({
        start: item.start,
        duration: item.duration,
        end: item.start + item.duration,
        text: item.text
          .replace(/&amp;/g, '&')
          .replace(/&lt;/g, '<')
          .replace(/&gt;/g, '>')
          .replace(/&quot;/g, '"')
          .replace(/&#39;/g, "'")
          .replace(/\n/g, ' ')
          .trim(),
      }));

      console.log('Successfully fetched', captions.length, 'captions using youtube-transcript-scraper');

      const response = { captions, languageCode: lang as string };
      await cache.set(cacheKey, response);
      return res.json(response);
    } catch (error: any) {
      console.error('Error fetching captions:', error.message);

      if (error.message?.includes('No captions found') || error.message?.includes('Could not')) {
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
        `https://api.unsplash.com/search/photos?query=${encodeURIComponent(query as string)}&per_page=1&client_id=${accessKey}`,
        { headers: { 'Accept-Version': 'v1' } }
      );
      if (response.ok) {
        const data = (await response.json()) as { results: Array<{ urls: { small: string } }> };
        if (data.results && data.results.length > 0) {
          return res.json({ imageUrl: data.results[0].urls.small, source: 'unsplash' });
        }
      }
    }
    return res.json({
      imageUrl: `https://picsum.photos/seed/${encodeURIComponent(query as string)}/400/300`,
      source: 'placeholder',
    });
  } catch (error) {
    console.error('Unsplash API error:', error);
    return res.json({ imageUrl: `https://picsum.photos/seed/${Date.now()}/400/300`, source: 'placeholder' });
  }
});

// ============================================
// Cambridge Dictionary API
// ============================================

app.get('/api/cambridge-dictionary', async (req, res) => {
  try {
    const { word } = req.query;
    if (!word) {
      return res.status(400).json({ error: 'Word parameter is required' });
    }
    const url = `https://dictionary.cambridge.org/ja/dictionary/english/${encodeURIComponent(word as string)}`;
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
    });
    if (!response.ok) {
      return res.status(404).json({ error: 'Definition not found' });
    }
    const html = await response.text();
    const definitionMatch = html.match(/<div class="def ddef_d db">(.*?)<\/div>/s);
    if (!definitionMatch) {
      return res.status(404).json({ error: 'Definition not found' });
    }
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
// YouTube Channels API
// ============================================

function extractChannelIdentifier(input: string): { type: 'id' | 'handle' | 'username'; value: string } | null {
  if (/^UC[\w-]{22}$/.test(input)) return { type: 'id', value: input };
  const handleMatch = input.match(/@([\w.-]+)/);
  if (handleMatch) return { type: 'handle', value: handleMatch[1] };
  const patterns = [
    /youtube\.com\/channel\/(UC[\w-]{22})/,
    /youtube\.com\/@([\w.-]+)/,
    /youtube\.com\/c\/([\w.-]+)/,
    /youtube\.com\/user\/([\w.-]+)/,
  ];
  for (const pattern of patterns) {
    const match = input.match(pattern);
    if (match) {
      if (pattern.source.includes('/channel/')) return { type: 'id', value: match[1] };
      else if (pattern.source.includes('/@')) return { type: 'handle', value: match[1] };
      else return { type: 'username', value: match[1] };
    }
  }
  if (/^[\w.-]+$/.test(input)) return { type: 'handle', value: input };
  return null;
}

app.post('/api/youtube/channels', async (req, res) => {
  try {
    const { channelIdentifier } = req.body;
    if (!channelIdentifier) {
      return res.status(400).json({ error: 'Channel identifier is required', success: false });
    }
    const apiKey = process.env.YOUTUBE_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: 'YouTube API key not configured', success: false });
    }
    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) {
      return res.status(500).json({ error: 'Database not configured', success: false });
    }
    const identifier = extractChannelIdentifier(channelIdentifier.trim());
    if (!identifier) {
      return res.status(400).json({ error: 'Invalid channel identifier format', success: false });
    }
    let channelId = '';
    if (identifier.type === 'id') {
      channelId = identifier.value;
    } else if (identifier.type === 'handle') {
      const searchUrl = `https://www.googleapis.com/youtube/v3/search?part=snippet&type=channel&q=@${encodeURIComponent(identifier.value)}&key=${apiKey}`;
      const searchResponse = await fetch(searchUrl);
      const searchData = await searchResponse.json() as any;
      if (!searchData.items || searchData.items.length === 0) {
        return res.status(404).json({ error: 'Channel not found', success: false });
      }
      channelId = searchData.items[0].snippet.channelId;
    } else {
      const channelUrl = `https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics&forUsername=${encodeURIComponent(identifier.value)}&key=${apiKey}`;
      const channelResponse = await fetch(channelUrl);
      const channelData = await channelResponse.json() as any;
      if (!channelData.items || channelData.items.length === 0) {
        return res.status(404).json({ error: 'Channel not found', success: false });
      }
      channelId = channelData.items[0].id;
    }
    const detailsUrl = `https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics&id=${channelId}&key=${apiKey}`;
    const detailsResponse = await fetch(detailsUrl);
    const detailsData = await detailsResponse.json() as any;
    if (!detailsData.items || detailsData.items.length === 0) {
      return res.status(404).json({ error: 'Channel not found', success: false });
    }
    const channel = detailsData.items[0];
    const sql = neon(databaseUrl);
    const existing = await sql`SELECT id FROM youtube_channels WHERE channel_id = ${channelId}`;
    if (existing.length > 0) {
      return res.status(409).json({ error: 'Channel already registered', success: false, existingId: existing[0].id });
    }
    const result = await sql`
      INSERT INTO youtube_channels (channel_id, channel_name, thumbnail_url, subscriber_count, video_count, description)
      VALUES (${channelId}, ${channel.snippet.title}, ${channel.snippet.thumbnails?.default?.url || null},
        ${parseInt(channel.statistics?.subscriberCount || '0', 10)}, ${parseInt(channel.statistics?.videoCount || '0', 10)},
        ${channel.snippet.description || null})
      RETURNING *
    `;
    return res.json({ success: true, data: result[0] });
  } catch (error: any) {
    console.error('Error registering channel:', error);
    return res.status(500).json({ error: 'Failed to register channel', success: false });
  }
});

app.get('/api/youtube/channels', async (req, res) => {
  try {
    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) {
      return res.status(500).json({ error: 'Database not configured', success: false });
    }
    const sql = neon(databaseUrl);
    const result = await sql`SELECT * FROM youtube_channels ORDER BY created_at DESC`;
    return res.json({ success: true, data: result });
  } catch (error: any) {
    console.error('Error fetching channels:', error);
    return res.status(500).json({ error: 'Failed to fetch channels', success: false });
  }
});

app.delete('/api/youtube/channels/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) {
      return res.status(500).json({ error: 'Database not configured', success: false });
    }
    const sql = neon(databaseUrl);
    await sql`DELETE FROM youtube_channels WHERE id = ${id}`;
    return res.json({ success: true });
  } catch (error: any) {
    console.error('Error deleting channel:', error);
    return res.status(500).json({ error: 'Failed to delete channel', success: false });
  }
});

// ============================================
// Helper function to fetch and save videos from YouTube API
// ============================================

async function fetchAndSaveVideosFromYouTube(
  sql: ReturnType<typeof neon>,
  channelId: string,
  channelName: string,
  apiKey: string
): Promise<any[]> {
  const videos: any[] = [];

  try {
    const searchUrl = `https://www.googleapis.com/youtube/v3/search?part=snippet&channelId=${channelId}&type=video&order=date&maxResults=20&key=${apiKey}`;
    const searchResponse = await fetch(searchUrl);
    const searchData = await searchResponse.json() as any;

    if (!searchData.items || searchData.items.length === 0) {
      return videos;
    }

    const videoIds = searchData.items.map((item: any) => item.id.videoId).join(',');

    const detailsUrl = `https://www.googleapis.com/youtube/v3/videos?part=contentDetails,snippet&id=${videoIds}&key=${apiKey}`;
    const detailsResponse = await fetch(detailsUrl);
    const detailsData = await detailsResponse.json() as any;

    if (!detailsData.items) {
      return videos;
    }

    for (const video of detailsData.items) {
      const durationMatch = video.contentDetails.duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
      const hours = parseInt(durationMatch?.[1] || '0', 10);
      const minutes = parseInt(durationMatch?.[2] || '0', 10);
      const seconds = parseInt(durationMatch?.[3] || '0', 10);
      const durationSeconds = hours * 3600 + minutes * 60 + seconds;
      const durationFormatted = `${hours > 0 ? hours + ':' : ''}${minutes.toString().padStart(hours > 0 ? 2 : 1, '0')}:${seconds.toString().padStart(2, '0')}`;

      try {
        await sql`
          INSERT INTO youtube_videos (
            video_id, title, thumbnail_url, channel_id, channel_name,
            published_at, duration_seconds, duration_formatted
          ) VALUES (
            ${video.id},
            ${video.snippet.title},
            ${video.snippet.thumbnails?.medium?.url || video.snippet.thumbnails?.default?.url || null},
            ${channelId},
            ${channelName},
            ${video.snippet.publishedAt},
            ${durationSeconds},
            ${durationFormatted}
          )
          ON CONFLICT (video_id) DO UPDATE SET
            title = EXCLUDED.title,
            thumbnail_url = EXCLUDED.thumbnail_url,
            updated_at = NOW()
        `;
      } catch (dbError) {
        console.error(`Error saving video ${video.id} to database:`, dbError);
      }

      videos.push({
        videoId: video.id,
        title: video.snippet.title,
        thumbnail: video.snippet.thumbnails?.medium?.url || video.snippet.thumbnails?.default?.url,
        channelId: channelId,
        channelName: channelName,
        publishedAt: video.snippet.publishedAt,
        durationSeconds,
        duration: durationFormatted,
      });
    }
  } catch (error) {
    console.error(`Error fetching videos from YouTube for channel ${channelId}:`, error);
  }

  return videos;
}

// ============================================
// YouTube Videos API (with DB caching)
// ============================================

app.get('/api/youtube/videos', optionalAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const { limit = '10', exclude_watched = 'true', channel_id } = req.query;
    const limitNum = Math.min(parseInt(limit as string, 10) || 10, 50);
    const shouldExcludeWatched = exclude_watched !== 'false';
    const userId = req.user?.id;

    const apiKey = process.env.YOUTUBE_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: 'YouTube API key not configured', success: false });
    }

    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) {
      return res.status(500).json({ error: 'Database not configured', success: false });
    }

    const sql = neon(databaseUrl);

    // Get registered channels (or specific channel if provided)
    let channels;
    if (channel_id) {
      channels = await sql`SELECT channel_id, channel_name FROM youtube_channels WHERE channel_id = ${channel_id as string}`;
    } else {
      channels = await sql`SELECT channel_id, channel_name FROM youtube_channels`;
    }

    if (channels.length === 0) {
      return res.json({ success: true, data: [], message: 'No channels registered' });
    }

    let allVideos: any[] = [];
    let fetchedFromApi = false;

    // For each channel, check DB first, then fetch from YouTube if needed
    for (const channel of channels) {
      const dbVideos = await sql`
        SELECT video_id, title, thumbnail_url, channel_id, channel_name,
               published_at, duration_seconds, duration_formatted
        FROM youtube_videos
        WHERE channel_id = ${channel.channel_id}
        ORDER BY published_at DESC
        LIMIT 50
      `;

      if (dbVideos.length > 0) {
        for (const video of dbVideos) {
          allVideos.push({
            videoId: video.video_id,
            title: video.title,
            thumbnail: video.thumbnail_url,
            channelId: video.channel_id,
            channelName: video.channel_name,
            publishedAt: video.published_at,
            durationSeconds: video.duration_seconds,
            duration: video.duration_formatted,
          });
        }
      } else {
        console.log(`Fetching videos from YouTube for channel ${channel.channel_id}...`);
        const videos = await fetchAndSaveVideosFromYouTube(
          sql,
          channel.channel_id,
          channel.channel_name,
          apiKey
        );
        allVideos = allVideos.concat(videos);
        fetchedFromApi = true;
      }
    }

    // Get watched video IDs to exclude
    let watchedVideoIds: Set<string> = new Set();
    if (shouldExcludeWatched) {
      if (userId) {
        const watchedVideos = await sql`
          SELECT video_id FROM user_video_status
          WHERE user_id = ${userId} AND status = 'watched'
        `;
        watchedVideoIds = new Set(watchedVideos.map((v: any) => v.video_id));
      } else {
        const watchedVideos = await sql`SELECT DISTINCT video_id FROM youtube_learning_logs`;
        watchedVideoIds = new Set(watchedVideos.map((v: any) => v.video_id));
      }
    }

    // Filter out watched videos if requested
    let availableVideos = allVideos;
    if (shouldExcludeWatched && watchedVideoIds.size > 0) {
      availableVideos = allVideos.filter((video: any) => !watchedVideoIds.has(video.videoId));
    }

    // Shuffle and return random videos
    const shuffled = [...availableVideos].sort(() => Math.random() - 0.5);
    const selectedVideos = shuffled.slice(0, limitNum);

    return res.json({
      success: true,
      data: selectedVideos,
      totalCount: allVideos.length,
      excludedCount: allVideos.length - availableVideos.length,
      fetchedFromApi,
      authenticated: !!userId,
    });
  } catch (error: any) {
    console.error('Error fetching videos:', error);
    return res.status(500).json({ error: 'Failed to fetch videos', success: false });
  }
});

app.post('/api/youtube/videos/refresh', async (req, res) => {
  try {
    const { channel_id } = req.body;

    const apiKey = process.env.YOUTUBE_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: 'YouTube API key not configured', success: false });
    }

    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) {
      return res.status(500).json({ error: 'Database not configured', success: false });
    }

    const sql = neon(databaseUrl);

    let channels;
    if (channel_id) {
      channels = await sql`SELECT channel_id, channel_name FROM youtube_channels WHERE channel_id = ${channel_id as string}`;
    } else {
      channels = await sql`SELECT channel_id, channel_name FROM youtube_channels`;
    }

    if (channels.length === 0) {
      return res.json({ success: true, message: 'No channels to refresh', newVideosCount: 0 });
    }

    let totalNewVideos = 0;

    for (const channel of channels) {
      console.log(`Refreshing videos for channel ${channel.channel_id}...`);
      const videos = await fetchAndSaveVideosFromYouTube(
        sql,
        channel.channel_id,
        channel.channel_name,
        apiKey
      );
      totalNewVideos += videos.length;
    }

    await cache.delete('youtube:videos:all');

    return res.json({
      success: true,
      message: `Refreshed ${channels.length} channel(s)`,
      newVideosCount: totalNewVideos,
    });
  } catch (error: any) {
    console.error('Error refreshing videos:', error);
    return res.status(500).json({ error: 'Failed to refresh videos', success: false });
  }
});

// ============================================
// YouTube Learning Logs API
// ============================================

function calculateNextReviewDate(difficulty: string, repetitionLevel: number): Date | null {
  const now = new Date();

  if (difficulty === 'easy') {
    return null;
  }

  if (difficulty === 'difficult') {
    const days = 7 + Math.floor(Math.random() * 8);
    now.setDate(now.getDate() + days);
    return now;
  }

  const intervals = [1, 3, 7, 14, 30];
  const days = intervals[Math.min(repetitionLevel, intervals.length - 1)];
  now.setDate(now.getDate() + days);
  return now;
}

app.post('/api/youtube/learning-logs', optionalAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const {
      video_id,
      video_title,
      channel_id,
      channel_name,
      thumbnail_url,
      duration_seconds,
      video_duration_seconds,
      started_at,
      ended_at,
      notes,
      difficulty,
    } = req.body;

    const userId = req.user?.id || null;

    if (!video_id || !video_title || !started_at || !ended_at || duration_seconds === undefined) {
      return res.status(400).json({
        error: 'Missing required fields: video_id, video_title, started_at, ended_at, duration_seconds',
        success: false,
      });
    }

    if (duration_seconds < 30) {
      return res.status(400).json({
        error: 'Learning session must be at least 30 seconds',
        success: false,
      });
    }

    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) {
      return res.status(500).json({ error: 'Database not configured', success: false });
    }

    const sql = neon(databaseUrl);

    const result = await sql`
      INSERT INTO youtube_learning_logs (
        video_id, video_title, channel_id, channel_name, thumbnail_url,
        duration_seconds, video_duration_seconds, started_at, ended_at, notes, user_id
      ) VALUES (
        ${video_id},
        ${video_title},
        ${channel_id || null},
        ${channel_name || null},
        ${thumbnail_url || null},
        ${duration_seconds},
        ${video_duration_seconds || null},
        ${started_at},
        ${ended_at},
        ${notes || null},
        ${userId}
      )
      RETURNING *
    `;

    // Update user_video_status if authenticated
    if (userId) {
      await sql`
        INSERT INTO user_video_status (user_id, video_id, status, watched_at)
        VALUES (${userId}, ${video_id}, 'watched', NOW())
        ON CONFLICT (user_id, video_id) DO UPDATE SET
          status = 'watched',
          watched_at = NOW(),
          updated_at = NOW()
      `;
    }

    // Handle difficulty/review if provided
    if (difficulty && ['easy', 'normal', 'difficult'].includes(difficulty)) {
      const existingReview = await sql`
        SELECT * FROM youtube_video_reviews WHERE video_id = ${video_id}
      `;

      if (existingReview.length > 0) {
        const review = existingReview[0];
        let newRepetitionLevel = review.repetition_level;

        if (difficulty === 'normal') {
          newRepetitionLevel = Math.min((review.repetition_level || 0) + 1, 4);
        } else {
          newRepetitionLevel = 0;
        }

        const nextReviewAt = calculateNextReviewDate(difficulty, newRepetitionLevel);

        await sql`
          UPDATE youtube_video_reviews
          SET
            difficulty = ${difficulty},
            repetition_level = ${newRepetitionLevel},
            next_review_at = ${nextReviewAt ? nextReviewAt.toISOString() : null},
            last_watched_at = NOW(),
            total_watch_count = total_watch_count + 1,
            total_watch_seconds = total_watch_seconds + ${duration_seconds},
            updated_at = NOW()
          WHERE video_id = ${video_id}
        `;
      } else {
        const nextReviewAt = calculateNextReviewDate(difficulty, 0);

        await sql`
          INSERT INTO youtube_video_reviews (
            video_id, video_title, channel_id, channel_name, thumbnail_url,
            video_duration_seconds, difficulty, repetition_level, next_review_at,
            last_watched_at, total_watch_count, total_watch_seconds
          ) VALUES (
            ${video_id},
            ${video_title},
            ${channel_id || null},
            ${channel_name || null},
            ${thumbnail_url || null},
            ${video_duration_seconds || null},
            ${difficulty},
            ${0},
            ${nextReviewAt ? nextReviewAt.toISOString() : null},
            NOW(),
            ${1},
            ${duration_seconds}
          )
        `;
      }
    }

    return res.json({ success: true, data: result[0] });
  } catch (error: any) {
    console.error('Error saving learning log:', error);
    return res.status(500).json({ error: 'Failed to save learning log', success: false });
  }
});

app.get('/api/youtube/learning-logs', async (req, res) => {
  try {
    const { start_date, end_date, limit = '100' } = req.query;
    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) {
      return res.status(500).json({ error: 'Database not configured', success: false });
    }
    const sql = neon(databaseUrl);
    const limitNum = parseInt(limit as string, 10) || 100;
    let result;
    if (start_date && end_date) {
      result = await sql`
        SELECT * FROM youtube_learning_logs
        WHERE started_at >= ${start_date as string} AND started_at <= ${end_date as string}
        ORDER BY started_at DESC LIMIT ${limitNum}
      `;
    } else {
      result = await sql`SELECT * FROM youtube_learning_logs ORDER BY started_at DESC LIMIT ${limitNum}`;
    }
    return res.json({ success: true, data: result });
  } catch (error: any) {
    console.error('Error fetching learning logs:', error);
    return res.status(500).json({ error: 'Failed to fetch learning logs', success: false });
  }
});

app.get('/api/youtube/learning-logs/stats', async (req, res) => {
  try {
    const { start_date, end_date } = req.query;
    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) {
      return res.status(500).json({ error: 'Database not configured', success: false });
    }
    const sql = neon(databaseUrl);
    let totalResult, sessionCountResult, uniqueVideosResult, dailyStatsResult;

    if (start_date && end_date) {
      totalResult = await sql`
        SELECT COALESCE(SUM(duration_seconds), 0) as total_seconds
        FROM youtube_learning_logs
        WHERE started_at >= ${start_date as string} AND started_at <= ${end_date as string}
      `;
      sessionCountResult = await sql`
        SELECT COUNT(*) as count
        FROM youtube_learning_logs
        WHERE started_at >= ${start_date as string} AND started_at <= ${end_date as string}
      `;
      uniqueVideosResult = await sql`
        SELECT COUNT(DISTINCT video_id) as count
        FROM youtube_learning_logs
        WHERE started_at >= ${start_date as string} AND started_at <= ${end_date as string}
      `;
      dailyStatsResult = await sql`
        SELECT
          DATE(started_at AT TIME ZONE 'Asia/Tokyo') as date,
          SUM(duration_seconds) as total_seconds,
          COUNT(*) as session_count
        FROM youtube_learning_logs
        WHERE started_at >= ${start_date as string} AND started_at <= ${end_date as string}
        GROUP BY DATE(started_at AT TIME ZONE 'Asia/Tokyo')
        ORDER BY date DESC
      `;
    } else {
      totalResult = await sql`
        SELECT COALESCE(SUM(duration_seconds), 0) as total_seconds
        FROM youtube_learning_logs
      `;
      sessionCountResult = await sql`
        SELECT COUNT(*) as count
        FROM youtube_learning_logs
      `;
      uniqueVideosResult = await sql`
        SELECT COUNT(DISTINCT video_id) as count
        FROM youtube_learning_logs
      `;
      dailyStatsResult = await sql`
        SELECT
          DATE(started_at AT TIME ZONE 'Asia/Tokyo') as date,
          SUM(duration_seconds) as total_seconds,
          COUNT(*) as session_count
        FROM youtube_learning_logs
        GROUP BY DATE(started_at AT TIME ZONE 'Asia/Tokyo')
        ORDER BY date DESC
        LIMIT 30
      `;
    }

    const totalSeconds = parseInt(totalResult[0].total_seconds as string, 10);
    const sessionCount = parseInt(sessionCountResult[0].count as string, 10);
    const uniqueVideos = parseInt(uniqueVideosResult[0].count as string, 10);

    return res.json({
      success: true,
      totalSeconds,
      totalMinutes: Math.round(totalSeconds / 60),
      totalHours: Math.round(totalSeconds / 3600 * 10) / 10,
      sessionCount,
      uniqueVideos,
      dailyStats: dailyStatsResult.map((row: any) => ({
        date: row.date,
        totalSeconds: parseInt(row.total_seconds as string, 10),
        sessionCount: parseInt(row.session_count as string, 10),
      })),
    });
  } catch (error: any) {
    console.error('Error fetching learning stats:', error);
    return res.status(500).json({ error: 'Failed to fetch learning stats', success: false });
  }
});

// ============================================
// YouTube Video Reviews API
// ============================================

app.get('/api/youtube/reviews', async (req, res) => {
  try {
    const { difficulty, limit = '100' } = req.query;

    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) {
      return res.status(500).json({ error: 'Database not configured', success: false });
    }

    const sql = neon(databaseUrl);
    const limitNum = parseInt(limit as string, 10) || 100;

    let result;
    if (difficulty && ['easy', 'normal', 'difficult'].includes(difficulty as string)) {
      result = await sql`
        SELECT * FROM youtube_video_reviews
        WHERE difficulty = ${difficulty as string}
        ORDER BY last_watched_at DESC
        LIMIT ${limitNum}
      `;
    } else {
      result = await sql`
        SELECT * FROM youtube_video_reviews
        ORDER BY last_watched_at DESC
        LIMIT ${limitNum}
      `;
    }

    return res.json({ success: true, data: result });
  } catch (error: any) {
    console.error('Error fetching reviews:', error);
    return res.status(500).json({ error: 'Failed to fetch reviews', success: false });
  }
});

app.get('/api/youtube/reviews/recommended', async (req, res) => {
  try {
    const { limit = '20' } = req.query;

    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) {
      return res.status(500).json({ error: 'Database not configured', success: false });
    }

    const sql = neon(databaseUrl);
    const limitNum = parseInt(limit as string, 10) || 20;

    const result = await sql`
      SELECT * FROM youtube_video_reviews
      WHERE next_review_at IS NOT NULL
        AND next_review_at <= NOW()
        AND difficulty IN ('normal', 'difficult')
      ORDER BY next_review_at ASC
      LIMIT ${limitNum}
    `;

    return res.json({ success: true, data: result });
  } catch (error: any) {
    console.error('Error fetching recommended reviews:', error);
    return res.status(500).json({ error: 'Failed to fetch recommended reviews', success: false });
  }
});

app.get('/api/youtube/reviews/stats', async (req, res) => {
  try {
    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) {
      return res.status(500).json({ error: 'Database not configured', success: false });
    }

    const sql = neon(databaseUrl);

    const easyCount = await sql`SELECT COUNT(*) as count FROM youtube_video_reviews WHERE difficulty = 'easy'`;
    const normalCount = await sql`SELECT COUNT(*) as count FROM youtube_video_reviews WHERE difficulty = 'normal'`;
    const difficultCount = await sql`SELECT COUNT(*) as count FROM youtube_video_reviews WHERE difficulty = 'difficult'`;

    const dueCount = await sql`
      SELECT COUNT(*) as count FROM youtube_video_reviews
      WHERE next_review_at IS NOT NULL
        AND next_review_at <= NOW()
        AND difficulty IN ('normal', 'difficult')
    `;

    const totalWatchTime = await sql`
      SELECT COALESCE(SUM(total_watch_seconds), 0) as total_seconds FROM youtube_video_reviews
    `;

    return res.json({
      success: true,
      easy: parseInt(easyCount[0].count as string, 10),
      normal: parseInt(normalCount[0].count as string, 10),
      difficult: parseInt(difficultCount[0].count as string, 10),
      dueForReview: parseInt(dueCount[0].count as string, 10),
      totalWatchSeconds: parseInt(totalWatchTime[0].total_seconds as string, 10),
    });
  } catch (error: any) {
    console.error('Error fetching review stats:', error);
    return res.status(500).json({ error: 'Failed to fetch review stats', success: false });
  }
});

// ============================================
// Error Handler
// ============================================

app.use((err: Error, _req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Unhandled error:', err);
  if (!res.headersSent) {
    res.status(500).json({ error: 'An unexpected error occurred.' });
  }
  next(err);
});

export default app;
