import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';

const { Pool } = pg;

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const pool = new Pool({
  host: process.env.DB_HOST || 'postgres',
  port: parseInt(process.env.DB_PORT || '5432', 10),
  user: process.env.DB_USER || 'dogcatcher',
  password: process.env.DB_PASSWORD || 'dogcatcher',
  database: process.env.DB_NAME || 'dogcatcher',
});

export async function query(text, params) {
  return pool.query(text, params);
}

// Retry loop so we don't crash while postgres is still coming up.
async function waitForDb(retries = 30) {
  for (let i = 0; i < retries; i++) {
    try {
      await pool.query('SELECT 1');
      return;
    } catch (err) {
      console.log(`Waiting for database... (${i + 1}/${retries})`);
      await new Promise((r) => setTimeout(r, 2000));
    }
  }
  throw new Error('Database did not become available in time');
}

const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'editor',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS content_blocks (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL DEFAULT '',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS posts (
  id SERIAL PRIMARY KEY,
  title TEXT NOT NULL DEFAULT '',
  body TEXT NOT NULL DEFAULT '',
  published_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS shows (
  id SERIAL PRIMARY KEY,
  show_date TEXT NOT NULL DEFAULT '',
  venue TEXT NOT NULL DEFAULT '',
  city TEXT NOT NULL DEFAULT '',
  ticket_url TEXT NOT NULL DEFAULT '',
  sort_key TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS photos (
  id SERIAL PRIMARY KEY,
  caption TEXT NOT NULL DEFAULT '',
  mime TEXT NOT NULL DEFAULT 'image/jpeg',
  data BYTEA NOT NULL,
  sort_key INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Singleton-ish uploaded assets, keyed by name ('logo' today). Stores
-- width/height captured client-side at upload time so the public site
-- can set <img width height> and reserve layout space before the image
-- loads -- no fade-in, no JS, just correct aspect ratio up front.
CREATE TABLE IF NOT EXISTS site_assets (
  key TEXT PRIMARY KEY,
  mime TEXT NOT NULL DEFAULT 'image/png',
  data BYTEA NOT NULL,
  width INTEGER,
  height INTEGER,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
`;

async function seedIfEmpty() {
  // NOTE: we intentionally do NOT seed placeholder text, journal posts, or
  // shows. Those are editor-set values — visitors should never see stand-in
  // copy. Sections stay empty until the band fills them in from /backstage.
  // The only thing seeded is the band's real photos.

  const { rows: photoRows } = await pool.query('SELECT COUNT(*)::int AS c FROM photos');
  if (photoRows[0].c === 0) {
    const seedDir = path.join(__dirname, '..', 'seed');
    const seeds = [
      { file: 'photo1.jpg', caption: '' },
      { file: 'photo2.jpg', caption: '' },
      { file: 'photo3.jpg', caption: '' },
    ];
    let i = 0;
    for (const s of seeds) {
      const p = path.join(seedDir, s.file);
      if (fs.existsSync(p)) {
        const buf = fs.readFileSync(p);
        await pool.query(
          'INSERT INTO photos (caption, mime, data, sort_key) VALUES ($1, $2, $3, $4)',
          [s.caption, 'image/jpeg', buf, i++]
        );
      }
    }
    console.log(`Seeded ${i} photos.`);
  }
}

export async function initDb() {
  await waitForDb();
  await pool.query(SCHEMA);
  await seedIfEmpty();
  console.log('Database ready.');
}
