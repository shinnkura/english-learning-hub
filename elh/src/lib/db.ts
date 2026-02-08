import { neon } from '@neondatabase/serverless';

const databaseUrl = import.meta.env.VITE_DATABASE_URL;

if (!databaseUrl) {
  throw new Error('Missing VITE_DATABASE_URL environment variable');
}

export const sql = neon(databaseUrl);

// Database helper functions
export const db = {
  categories: {
    async findAll() {
      const result = await sql`SELECT * FROM categories ORDER BY created_at DESC`;
      return result;
    },
    async findById(id: string) {
      const result = await sql`SELECT * FROM categories WHERE id = ${id}`;
      return result[0];
    },
    async create(data: { name: string }) {
      const result = await sql`
        INSERT INTO categories (name)
        VALUES (${data.name})
        RETURNING *
      `;
      return result[0];
    },
    async update(id: string, data: { name: string }) {
      const result = await sql`
        UPDATE categories SET name = ${data.name}
        WHERE id = ${id}
        RETURNING *
      `;
      return result[0];
    },
    async delete(id: string) {
      await sql`DELETE FROM categories WHERE id = ${id}`;
    }
  },
  channels: {
    async findAll() {
      const result = await sql`SELECT * FROM channels ORDER BY created_at DESC`;
      return result;
    },
    async findByCategory(categoryId: string) {
      const result = await sql`
        SELECT * FROM channels
        WHERE category_id = ${categoryId}
        ORDER BY created_at DESC
      `;
      return result;
    },
    async findByCategoryAndChannelId(categoryId: string, channelId: string) {
      const result = await sql`
        SELECT * FROM channels
        WHERE category_id = ${categoryId} AND channel_id = ${channelId}
      `;
      return result;
    },
    async findFavorites() {
      const result = await sql`
        SELECT * FROM channels
        WHERE is_favorite = true
        ORDER BY created_at DESC
      `;
      return result;
    },
    async findActive() {
      const result = await sql`
        SELECT * FROM channels
        WHERE is_active = true
        LIMIT 1
      `;
      return result[0];
    },
    async create(data: { category_id: string; channel_id: string; channel_name: string; thumbnail_url?: string }) {
      const result = await sql`
        INSERT INTO channels (category_id, channel_id, channel_name, thumbnail_url, is_favorite)
        VALUES (${data.category_id}, ${data.channel_id}, ${data.channel_name}, ${data.thumbnail_url || null}, true)
        RETURNING *
      `;
      return result[0];
    },
    async setFavorite(id: string, isFavorite: boolean) {
      const result = await sql`
        UPDATE channels SET is_favorite = ${isFavorite}
        WHERE id = ${id}
        RETURNING *
      `;
      return result[0];
    },
    async setActive(id: string) {
      // まず全チャンネルのis_activeをfalseに
      await sql`UPDATE channels SET is_active = false`;
      // 指定したチャンネルをアクティブに
      const result = await sql`
        UPDATE channels SET is_active = true
        WHERE id = ${id}
        RETURNING *
      `;
      return result[0];
    },
    async clearActive() {
      await sql`UPDATE channels SET is_active = false`;
    },
    async markCompleted(id: string) {
      const result = await sql`
        UPDATE channels SET completed_at = now(), is_active = false
        WHERE id = ${id}
        RETURNING *
      `;
      return result[0];
    },
    async delete(id: string) {
      await sql`DELETE FROM channels WHERE id = ${id}`;
    }
  },
  savedWords: {
    async findForReview() {
      const result = await sql`
        SELECT * FROM saved_words
        WHERE remembered = false
        ORDER BY next_review_date ASC
      `;
      return result;
    },
    async findAll() {
      const result = await sql`SELECT * FROM saved_words ORDER BY created_at DESC`;
      return result;
    },
    async create(data: {
      word: string;
      context: string;
      video_id: string;
      url: string;
      meaning: string;
      next_review_date: string;
      remembered: boolean;
    }) {
      const result = await sql`
        INSERT INTO saved_words (word, context, video_id, url, meaning, next_review_date, remembered)
        VALUES (${data.word}, ${data.context}, ${data.video_id}, ${data.url}, ${data.meaning}, ${data.next_review_date}, ${data.remembered})
        RETURNING *
      `;
      return result[0];
    },
    async update(id: string, data: { remembered: boolean; next_review_date: string }) {
      const result = await sql`
        UPDATE saved_words
        SET remembered = ${data.remembered}, next_review_date = ${data.next_review_date}
        WHERE id = ${id}
        RETURNING *
      `;
      return result[0];
    },
    async delete(id: string) {
      await sql`DELETE FROM saved_words WHERE id = ${id}`;
    },
    async getActivityData(startDate: string, endDate: string) {
      const result = await sql`
        SELECT
          DATE(created_at) as date,
          COUNT(*) as words
        FROM saved_words
        WHERE created_at >= ${startDate} AND created_at <= ${endDate}
        GROUP BY DATE(created_at)
        ORDER BY date
      `;
      return result;
    },
    async getAllCreatedAt() {
      const result = await sql`SELECT created_at FROM saved_words`;
      return result;
    },
    async getAllWithVideoId() {
      const result = await sql`SELECT video_id, created_at FROM saved_words`;
      return result;
    },
    async getRememberedWords() {
      const result = await sql`SELECT created_at FROM saved_words WHERE remembered = true`;
      return result;
    }
  },
  videoProgress: {
    async findByChannel(channelId: string) {
      const result = await sql`
        SELECT * FROM video_progress
        WHERE channel_id = ${channelId}
        ORDER BY created_at DESC
      `;
      return result;
    },
    async findByVideoId(channelId: string, videoId: string) {
      const result = await sql`
        SELECT * FROM video_progress
        WHERE channel_id = ${channelId} AND video_id = ${videoId}
      `;
      return result[0];
    },
    async findForRetry() {
      const result = await sql`
        SELECT * FROM video_progress
        WHERE next_retry_date IS NOT NULL
          AND next_retry_date <= now()
          AND understood = false
        ORDER BY next_retry_date ASC
      `;
      return result;
    },
    async findCommuteZone() {
      const result = await sql`
        SELECT * FROM video_progress
        WHERE in_commute_zone = true
        ORDER BY added_to_commute_at DESC
      `;
      return result;
    },
    async create(data: {
      channel_id: string;
      video_id: string;
      video_title: string;
      thumbnail_url?: string;
      duration_seconds?: number;
    }) {
      const result = await sql`
        INSERT INTO video_progress (channel_id, video_id, video_title, thumbnail_url, duration_seconds)
        VALUES (${data.channel_id}, ${data.video_id}, ${data.video_title}, ${data.thumbnail_url || null}, ${data.duration_seconds || null})
        ON CONFLICT (channel_id, video_id) DO UPDATE SET
          video_title = EXCLUDED.video_title,
          thumbnail_url = EXCLUDED.thumbnail_url,
          updated_at = now()
        RETURNING *
      `;
      return result[0];
    },
    async incrementWatchCount(id: string) {
      const result = await sql`
        UPDATE video_progress
        SET watch_count = watch_count + 1, status = 'in_progress', updated_at = now()
        WHERE id = ${id}
        RETURNING *
      `;
      return result[0];
    },
    async markUnderstood(id: string) {
      const result = await sql`
        UPDATE video_progress
        SET understood = true,
            understood_at = now(),
            status = 'understood',
            in_commute_zone = true,
            added_to_commute_at = now(),
            next_retry_date = NULL,
            updated_at = now()
        WHERE id = ${id}
        RETURNING *
      `;
      return result[0];
    },
    async markNotUnderstood(id: string) {
      const result = await sql`
        UPDATE video_progress
        SET understood = false,
            retry_count = retry_count + 1,
            next_retry_date = now() + interval '2 days',
            status = 'in_progress',
            updated_at = now()
        WHERE id = ${id}
        RETURNING *
      `;
      return result[0];
    },
    async removeFromCommuteZone(id: string) {
      const result = await sql`
        UPDATE video_progress
        SET in_commute_zone = false, updated_at = now()
        WHERE id = ${id}
        RETURNING *
      `;
      return result[0];
    },
    async getStats(channelId: string) {
      const result = await sql`
        SELECT
          COUNT(*) as total,
          COUNT(*) FILTER (WHERE understood = true) as understood,
          COUNT(*) FILTER (WHERE in_commute_zone = true) as in_commute
        FROM video_progress
        WHERE channel_id = ${channelId}
      `;
      return result[0];
    }
  },
  savedPhrases: {
    async findAll() {
      const result = await sql`SELECT * FROM saved_phrases ORDER BY created_at DESC`;
      return result;
    },
    async findForReview() {
      const result = await sql`
        SELECT * FROM saved_phrases
        WHERE remembered = false
        ORDER BY next_review_date ASC
      `;
      return result;
    },
    async create(data: {
      phrase: string;
      translation?: string;
      video_id: string;
      video_title?: string;
      timestamp_start?: number;
      timestamp_end?: number;
      url: string;
      notes?: string;
    }) {
      const result = await sql`
        INSERT INTO saved_phrases (phrase, translation, video_id, video_title, timestamp_start, timestamp_end, url, notes)
        VALUES (${data.phrase}, ${data.translation || null}, ${data.video_id}, ${data.video_title || null}, ${data.timestamp_start || null}, ${data.timestamp_end || null}, ${data.url}, ${data.notes || null})
        RETURNING *
      `;
      return result[0];
    },
    async update(id: string, data: { remembered: boolean; next_review_date: string }) {
      const result = await sql`
        UPDATE saved_phrases
        SET remembered = ${data.remembered}, next_review_date = ${data.next_review_date}, review_count = review_count + 1
        WHERE id = ${id}
        RETURNING *
      `;
      return result[0];
    },
    async delete(id: string) {
      await sql`DELETE FROM saved_phrases WHERE id = ${id}`;
    }
  }
};
