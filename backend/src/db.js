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
`;

const DEFAULT_BLOCKS = {
  hero_tagline: 'a slow-burning racket from the back room. no algorithm, no rush — just follow the noise.',
  about_body:
    "Dogcatcher is a band that would rather be found than served up. We make loud, tender, blown-out songs somewhere between an alt-country basement and a death-metal flyer — pedal steel and fuzz, played for whoever wanders in.\n\nThis website is our back porch. No feed, no metrics, no autoplay. If you're here, you went looking, and that means a lot. Poke around, read the journal, come to a show. Take it slow.",
  journal_intro:
    "Field notes, half-finished thoughts, and whatever we felt like posting. Updated whenever the spirit moves us.",
  shows_intro: 'Come stand in a room with us. Bring a friend, or don\'t.',
  footer_text: 'Dogcatcher · made by hand · dgctchr.com',
};

async function seedIfEmpty() {
  // content blocks
  for (const [key, value] of Object.entries(DEFAULT_BLOCKS)) {
    await pool.query(
      'INSERT INTO content_blocks (key, value) VALUES ($1, $2) ON CONFLICT (key) DO NOTHING',
      [key, value]
    );
  }

  // photos
  const { rows: photoRows } = await pool.query('SELECT COUNT(*)::int AS c FROM photos');
  if (photoRows[0].c === 0) {
    const seedDir = path.join(__dirname, '..', 'seed');
    const seeds = [
      { file: 'photo1.jpg', caption: 'Live, somewhere loud' },
      { file: 'photo2.jpg', caption: 'Long exposure, longer night' },
      { file: 'photo3.jpg', caption: 'Pedal steel & fuzz' },
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

  // one welcome journal post
  const { rows: postRows } = await pool.query('SELECT COUNT(*)::int AS c FROM posts');
  if (postRows[0].c === 0) {
    await pool.query(
      'INSERT INTO posts (title, body) VALUES ($1, $2)',
      [
        'we made a website',
        "Against our better judgment, we made a website. It's a quiet corner of the internet — no ads, no feed telling you what to feel next. Just us, some photos, and a place to put words down when we have them.\n\nMore soon. Or later. We'll see.",
      ]
    );
  }

  // a couple of placeholder shows
  const { rows: showRows } = await pool.query('SELECT COUNT(*)::int AS c FROM shows');
  if (showRows[0].c === 0) {
    await pool.query(
      "INSERT INTO shows (show_date, venue, city, ticket_url, sort_key) VALUES ($1,$2,$3,$4,$5)",
      ['TBA', 'A basement, probably', 'Somewhere', '', '9999']
    );
  }
}

export async function initDb() {
  await waitForDb();
  await pool.query(SCHEMA);
  await seedIfEmpty();
  console.log('Database ready.');
}
