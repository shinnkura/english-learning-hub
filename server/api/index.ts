/**
 * Vercel Serverless Function Entry Point
 *
 * このファイルはVercelのサーバーレス関数として動作し、
 * src/index.tsで定義されたExpressアプリを再エクスポートします。
 */

// Express app (Vercel will handle this as serverless function)
import express from 'express';
import cors from 'cors';
import Keyv from 'keyv';
import rateLimit from 'express-rate-limit';
import { neon } from '@neondatabase/serverless';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getSubtitles } from 'youtube-captions-scraper';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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

// Study Logs API
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

// Flashcards API
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

// Unsplash Image Search API
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

// Cambridge Dictionary API
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

// YouTube Captions API (using youtube-captions-scraper for serverless)
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
      const subtitles = await getSubtitles({
        videoID: videoId,
        lang: lang as string,
      });

      if (!subtitles || subtitles.length === 0) {
        throw new Error('No captions found');
      }

      // Convert to standard format
      const captions = subtitles.map((sub: { start: string; dur: string; text: string }) => ({
        start: parseFloat(sub.start),
        duration: parseFloat(sub.dur),
        end: parseFloat(sub.start) + parseFloat(sub.dur),
        text: sub.text,
      }));

      const response = { captions, languageCode: lang as string };
      await cache.set(cacheKey, response);
      return res.json(response);
    } catch (error: any) {
      console.error('Error fetching captions:', error.message);

      if (error.message?.includes('No captions found') || error.message?.includes('Could not find')) {
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

// YouTube Channels API
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

app.get('/api/youtube/videos', async (req, res) => {
  try {
    const { limit = '10' } = req.query;
    const limitNum = Math.min(parseInt(limit as string, 10) || 10, 50);
    const apiKey = process.env.YOUTUBE_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: 'YouTube API key not configured', success: false });
    }
    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) {
      return res.status(500).json({ error: 'Database not configured', success: false });
    }
    const sql = neon(databaseUrl);
    const channels = await sql`SELECT channel_id, channel_name FROM youtube_channels`;
    if (channels.length === 0) {
      return res.json({ success: true, data: [], message: 'No channels registered' });
    }
    const cacheKey = 'youtube:videos:all';
    let cachedVideos = await cache.get(cacheKey) as any[] | undefined;
    if (!cachedVideos) {
      const allVideos: any[] = [];
      for (const channel of channels) {
        try {
          const searchUrl = `https://www.googleapis.com/youtube/v3/search?part=snippet&channelId=${channel.channel_id}&type=video&order=date&maxResults=20&key=${apiKey}`;
          const searchResponse = await fetch(searchUrl);
          const searchData = await searchResponse.json() as any;
          if (searchData.items) {
            const videoIds = searchData.items.map((item: any) => item.id.videoId).join(',');
            const detailsUrl = `https://www.googleapis.com/youtube/v3/videos?part=contentDetails,snippet&id=${videoIds}&key=${apiKey}`;
            const detailsResponse = await fetch(detailsUrl);
            const detailsData = await detailsResponse.json() as any;
            if (detailsData.items) {
              for (const video of detailsData.items) {
                const durationMatch = video.contentDetails.duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
                const hours = parseInt(durationMatch?.[1] || '0', 10);
                const minutes = parseInt(durationMatch?.[2] || '0', 10);
                const seconds = parseInt(durationMatch?.[3] || '0', 10);
                const durationSeconds = hours * 3600 + minutes * 60 + seconds;
                allVideos.push({
                  videoId: video.id, title: video.snippet.title,
                  thumbnail: video.snippet.thumbnails?.medium?.url || video.snippet.thumbnails?.default?.url,
                  channelId: channel.channel_id, channelName: channel.channel_name,
                  publishedAt: video.snippet.publishedAt, durationSeconds,
                  duration: `${hours > 0 ? hours + ':' : ''}${minutes.toString().padStart(hours > 0 ? 2 : 1, '0')}:${seconds.toString().padStart(2, '0')}`,
                });
              }
            }
          }
        } catch (error) {
          console.error(`Error fetching videos for channel ${channel.channel_id}:`, error);
        }
      }
      cachedVideos = allVideos;
      await cache.set(cacheKey, allVideos, 60 * 60 * 1000);
    }
    const shuffled = [...cachedVideos].sort(() => Math.random() - 0.5);
    return res.json({ success: true, data: shuffled.slice(0, limitNum) });
  } catch (error: any) {
    console.error('Error fetching videos:', error);
    return res.status(500).json({ error: 'Failed to fetch videos', success: false });
  }
});

app.post('/api/youtube/videos/refresh', async (_req, res) => {
  try {
    await cache.delete('youtube:videos:all');
    return res.json({ success: true, message: 'Video cache cleared' });
  } catch (error: any) {
    console.error('Error clearing cache:', error);
    return res.status(500).json({ error: 'Failed to clear cache', success: false });
  }
});

// YouTube Learning Logs API
app.post('/api/youtube/learning-logs', async (req, res) => {
  try {
    const { video_id, video_title, channel_id, channel_name, thumbnail_url, duration_seconds, video_duration_seconds, started_at, ended_at, notes } = req.body;
    if (!video_id || !video_title || !started_at || !ended_at || duration_seconds === undefined) {
      return res.status(400).json({ error: 'Missing required fields', success: false });
    }
    if (duration_seconds < 30) {
      return res.status(400).json({ error: 'Learning session must be at least 30 seconds', success: false });
    }
    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) {
      return res.status(500).json({ error: 'Database not configured', success: false });
    }
    const sql = neon(databaseUrl);
    const result = await sql`
      INSERT INTO youtube_learning_logs (video_id, video_title, channel_id, channel_name, thumbnail_url,
        duration_seconds, video_duration_seconds, started_at, ended_at, notes)
      VALUES (${video_id}, ${video_title}, ${channel_id || null}, ${channel_name || null}, ${thumbnail_url || null},
        ${duration_seconds}, ${video_duration_seconds || null}, ${started_at}, ${ended_at}, ${notes || null})
      RETURNING *
    `;
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
      totalResult = await sql`SELECT COALESCE(SUM(duration_seconds), 0) as total_seconds FROM youtube_learning_logs WHERE started_at >= ${start_date as string} AND started_at <= ${end_date as string}`;
      sessionCountResult = await sql`SELECT COUNT(*) as count FROM youtube_learning_logs WHERE started_at >= ${start_date as string} AND started_at <= ${end_date as string}`;
      uniqueVideosResult = await sql`SELECT COUNT(DISTINCT video_id) as count FROM youtube_learning_logs WHERE started_at >= ${start_date as string} AND started_at <= ${end_date as string}`;
      dailyStatsResult = await sql`SELECT DATE(started_at AT TIME ZONE 'Asia/Tokyo') as date, SUM(duration_seconds) as total_seconds, COUNT(*) as session_count FROM youtube_learning_logs WHERE started_at >= ${start_date as string} AND started_at <= ${end_date as string} GROUP BY DATE(started_at AT TIME ZONE 'Asia/Tokyo') ORDER BY date DESC`;
    } else {
      totalResult = await sql`SELECT COALESCE(SUM(duration_seconds), 0) as total_seconds FROM youtube_learning_logs`;
      sessionCountResult = await sql`SELECT COUNT(*) as count FROM youtube_learning_logs`;
      uniqueVideosResult = await sql`SELECT COUNT(DISTINCT video_id) as count FROM youtube_learning_logs`;
      dailyStatsResult = await sql`SELECT DATE(started_at AT TIME ZONE 'Asia/Tokyo') as date, SUM(duration_seconds) as total_seconds, COUNT(*) as session_count FROM youtube_learning_logs GROUP BY DATE(started_at AT TIME ZONE 'Asia/Tokyo') ORDER BY date DESC LIMIT 30`;
    }
    const totalSeconds = parseInt(totalResult[0].total_seconds as string, 10);
    return res.json({
      success: true, totalSeconds,
      totalMinutes: Math.round(totalSeconds / 60),
      totalHours: Math.round(totalSeconds / 3600 * 10) / 10,
      sessionCount: parseInt(sessionCountResult[0].count as string, 10),
      uniqueVideos: parseInt(uniqueVideosResult[0].count as string, 10),
      dailyStats: dailyStatsResult.map((row: any) => ({
        date: row.date, totalSeconds: parseInt(row.total_seconds as string, 10),
        sessionCount: parseInt(row.session_count as string, 10),
      })),
    });
  } catch (error: any) {
    console.error('Error fetching learning stats:', error);
    return res.status(500).json({ error: 'Failed to fetch learning stats', success: false });
  }
});

// Error Handler
app.use((err: Error, _req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Unhandled error:', err);
  if (!res.headersSent) {
    res.status(500).json({ error: 'An unexpected error occurred.' });
  }
  next(err);
});

export default app;
