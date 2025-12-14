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
    async create(data: { category_id: string; channel_id: string; channel_name: string }) {
      const result = await sql`
        INSERT INTO channels (category_id, channel_id, channel_name)
        VALUES (${data.category_id}, ${data.channel_id}, ${data.channel_name})
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
  }
};
