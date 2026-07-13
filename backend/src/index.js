import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import multer from 'multer';
import { pool, query, initDb } from './db.js';

const app = express();
const PORT = parseInt(process.env.PORT || '3001', 10);
const JWT_SECRET = process.env.JWT_SECRET || 'change-me-in-production-please';
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 12 * 1024 * 1024 } });

app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '2mb' }));
app.use(cookieParser());

// ---------- auth helpers ----------
function signToken(user) {
  return jwt.sign({ id: user.id, username: user.username, role: user.role }, JWT_SECRET, {
    expiresIn: '30d',
  });
}

function getToken(req) {
  if (req.cookies && req.cookies.token) return req.cookies.token;
  const h = req.headers.authorization || '';
  if (h.startsWith('Bearer ')) return h.slice(7);
  return null;
}

function authRequired(req, res, next) {
  const token = getToken(req);
  if (!token) return res.status(401).json({ error: 'Not authenticated' });
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid session' });
  }
}

function adminRequired(req, res, next) {
  if (!req.user || req.user.role !== 'admin')
    return res.status(403).json({ error: 'Admin only' });
  next();
}

const cookieOpts = {
  httpOnly: true,
  sameSite: 'lax',
  secure: process.env.NODE_ENV === 'production',
  maxAge: 30 * 24 * 60 * 60 * 1000,
};

// ---------- auth routes ----------

// Whether any user exists yet (drives first-run admin setup on the login page).
app.get('/api/auth/status', async (_req, res) => {
  const { rows } = await query('SELECT COUNT(*)::int AS c FROM users');
  res.json({ setupComplete: rows[0].c > 0 });
});

// Register. If no users exist, the first one becomes admin (open).
// After that, only an authenticated admin can create accounts.
app.post('/api/auth/register', async (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password || password.length < 6)
    return res.status(400).json({ error: 'Username and a password of 6+ characters are required' });

  const { rows: countRows } = await query('SELECT COUNT(*)::int AS c FROM users');
  const isFirstUser = countRows[0].c === 0;

  let role = 'editor';
  if (isFirstUser) {
    role = 'admin';
  } else {
    // must be an authenticated admin
    const token = getToken(req);
    if (!token) return res.status(401).json({ error: 'Account creation is closed. Ask an admin to invite you.' });
    try {
      const u = jwt.verify(token, JWT_SECRET);
      if (u.role !== 'admin') return res.status(403).json({ error: 'Only an admin can create accounts' });
    } catch {
      return res.status(401).json({ error: 'Invalid session' });
    }
    role = req.body.role === 'admin' ? 'admin' : 'editor';
  }

  try {
    const hash = await bcrypt.hash(password, 10);
    const { rows } = await query(
      'INSERT INTO users (username, password_hash, role) VALUES ($1,$2,$3) RETURNING id, username, role',
      [username.trim(), hash, role]
    );
    const user = rows[0];
    // Log the first admin in immediately; admin-created accounts do not auto-login the admin.
    if (isFirstUser) {
      const token = signToken(user);
      res.cookie('token', token, cookieOpts);
      return res.json({ user, token });
    }
    return res.json({ user });
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'That username is taken' });
    console.error(err);
    return res.status(500).json({ error: 'Could not create account' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) return res.status(400).json({ error: 'Missing credentials' });
  const { rows } = await query('SELECT * FROM users WHERE username = $1', [username.trim()]);
  const user = rows[0];
  if (!user) return res.status(401).json({ error: 'Wrong username or password' });
  const ok = await bcrypt.compare(password, user.password_hash);
  if (!ok) return res.status(401).json({ error: 'Wrong username or password' });
  const safe = { id: user.id, username: user.username, role: user.role };
  const token = signToken(safe);
  res.cookie('token', token, cookieOpts);
  res.json({ user: safe, token });
});

app.post('/api/auth/logout', (_req, res) => {
  res.clearCookie('token', cookieOpts);
  res.json({ ok: true });
});

app.get('/api/auth/me', authRequired, (req, res) => {
  res.json({ user: { id: req.user.id, username: req.user.username, role: req.user.role } });
});

// ---------- user management (admin) ----------
app.get('/api/users', authRequired, adminRequired, async (_req, res) => {
  const { rows } = await query('SELECT id, username, role, created_at FROM users ORDER BY id');
  res.json(rows);
});

app.delete('/api/users/:id', authRequired, adminRequired, async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (id === req.user.id) return res.status(400).json({ error: 'You cannot delete yourself' });
  await query('DELETE FROM users WHERE id = $1', [id]);
  res.json({ ok: true });
});

// ---------- content blocks ----------
app.get('/api/content', async (_req, res) => {
  const { rows } = await query('SELECT key, value FROM content_blocks');
  const map = {};
  for (const r of rows) map[r.key] = r.value;
  res.json(map);
});

app.put('/api/content/:key', authRequired, async (req, res) => {
  const { key } = req.params;
  const value = (req.body && req.body.value) || '';
  await query(
    `INSERT INTO content_blocks (key, value, updated_at) VALUES ($1,$2,now())
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()`,
    [key, value]
  );
  res.json({ key, value });
});

// ---------- journal posts ----------
app.get('/api/posts', async (_req, res) => {
  const { rows } = await query(
    'SELECT id, title, body, published_at FROM posts ORDER BY published_at DESC, id DESC'
  );
  res.json(rows);
});

app.post('/api/posts', authRequired, async (req, res) => {
  const { title = '', body = '', published_at } = req.body || {};
  const { rows } = await query(
    'INSERT INTO posts (title, body, published_at) VALUES ($1,$2,COALESCE($3, now())) RETURNING *',
    [title, body, published_at || null]
  );
  res.json(rows[0]);
});

app.put('/api/posts/:id', authRequired, async (req, res) => {
  const id = parseInt(req.params.id, 10);
  const { title = '', body = '', published_at } = req.body || {};
  const { rows } = await query(
    'UPDATE posts SET title=$1, body=$2, published_at=COALESCE($3, published_at) WHERE id=$4 RETURNING *',
    [title, body, published_at || null, id]
  );
  if (!rows[0]) return res.status(404).json({ error: 'Not found' });
  res.json(rows[0]);
});

app.delete('/api/posts/:id', authRequired, async (req, res) => {
  await query('DELETE FROM posts WHERE id=$1', [parseInt(req.params.id, 10)]);
  res.json({ ok: true });
});

// ---------- shows ----------
app.get('/api/shows', async (_req, res) => {
  const { rows } = await query(
    'SELECT id, show_date, venue, city, ticket_url, sort_key FROM shows ORDER BY sort_key ASC, id ASC'
  );
  res.json(rows);
});

app.post('/api/shows', authRequired, async (req, res) => {
  const { show_date = '', venue = '', city = '', ticket_url = '', sort_key = '' } = req.body || {};
  const { rows } = await query(
    'INSERT INTO shows (show_date, venue, city, ticket_url, sort_key) VALUES ($1,$2,$3,$4,$5) RETURNING *',
    [show_date, venue, city, ticket_url, sort_key]
  );
  res.json(rows[0]);
});

app.put('/api/shows/:id', authRequired, async (req, res) => {
  const id = parseInt(req.params.id, 10);
  const { show_date = '', venue = '', city = '', ticket_url = '', sort_key = '' } = req.body || {};
  const { rows } = await query(
    'UPDATE shows SET show_date=$1, venue=$2, city=$3, ticket_url=$4, sort_key=$5 WHERE id=$6 RETURNING *',
    [show_date, venue, city, ticket_url, sort_key, id]
  );
  if (!rows[0]) return res.status(404).json({ error: 'Not found' });
  res.json(rows[0]);
});

app.delete('/api/shows/:id', authRequired, async (req, res) => {
  await query('DELETE FROM shows WHERE id=$1', [parseInt(req.params.id, 10)]);
  res.json({ ok: true });
});

// ---------- photos / gallery ----------
app.get('/api/photos', async (_req, res) => {
  const { rows } = await query(
    'SELECT id, caption, mime, sort_key FROM photos ORDER BY sort_key ASC, id ASC'
  );
  res.json(rows);
});

// Serve raw image bytes with long cache.
app.get('/api/photos/:id/raw', async (req, res) => {
  const { rows } = await query('SELECT mime, data FROM photos WHERE id=$1', [
    parseInt(req.params.id, 10),
  ]);
  if (!rows[0]) return res.status(404).end();
  res.set('Content-Type', rows[0].mime);
  res.set('Cache-Control', 'public, max-age=86400');
  res.send(rows[0].data);
});

app.post('/api/photos', authRequired, upload.single('image'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No image uploaded' });
  const caption = (req.body && req.body.caption) || '';
  const { rows: maxRows } = await query('SELECT COALESCE(MAX(sort_key),0)+1 AS n FROM photos');
  const { rows } = await query(
    'INSERT INTO photos (caption, mime, data, sort_key) VALUES ($1,$2,$3,$4) RETURNING id, caption, mime, sort_key',
    [caption, req.file.mimetype || 'image/jpeg', req.file.buffer, maxRows[0].n]
  );
  res.json(rows[0]);
});

app.put('/api/photos/:id', authRequired, async (req, res) => {
  const id = parseInt(req.params.id, 10);
  const { caption = '', sort_key } = req.body || {};
  const { rows } = await query(
    'UPDATE photos SET caption=$1, sort_key=COALESCE($2, sort_key) WHERE id=$3 RETURNING id, caption, mime, sort_key',
    [caption, sort_key, id]
  );
  if (!rows[0]) return res.status(404).json({ error: 'Not found' });
  res.json(rows[0]);
});

app.delete('/api/photos/:id', authRequired, async (req, res) => {
  await query('DELETE FROM photos WHERE id=$1', [parseInt(req.params.id, 10)]);
  res.json({ ok: true });
});

// ---------- health ----------
app.get('/api/health', (_req, res) => res.json({ ok: true }));

initDb()
  .then(() => {
    app.listen(PORT, () => console.log(`Dogcatcher API listening on :${PORT}`));
  })
  .catch((err) => {
    console.error('Failed to start:', err);
    process.exit(1);
  });
