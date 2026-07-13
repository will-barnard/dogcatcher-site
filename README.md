# Dogcatcher

A single-page, lo-fi band site for **Dogcatcher** (dgctchr.com) with a hidden
admin "backstage" and a small built-in CMS. Earthy 2000s-music-blog aesthetic:
hunter green, burgundy, ivory.

- **Frontend:** Vue 3 + Vite, one page with sections (home/about, journal,
  shows, photos). Served by nginx.
- **Backend:** Node + Express, JWT auth, image uploads.
- **Database:** Postgres (all content + uploaded photos live here, so nothing
  is lost on redeploy).

## How the admin works

1. Visit `/backstage` (it's unlinked — only a faint `·` in the footer points
   there).
2. **The very first account you create becomes the administrator** and is logged
   in automatically.
3. As admin, open the **Accounts** tab to create logins for bandmates
   (`editor` = can edit all content, `admin` = can also manage accounts).
4. Anyone logged in can edit page text, journal posts, shows, and photos.

After the first admin exists, public account creation is closed — only an admin
can add accounts.

## What's editable

- **Page Text** — header tagline, home/about copy, section intros, footer.
- **Journal** — dated blog posts.
- **Shows** — tour dates (sorted by a "sort key", e.g. `2026-08-14`).
- **Photos** — upload/caption/reorder gallery images.

## Local development

```bash
# backend (terminal 1) — needs a local postgres, or just use Docker below
cd backend && npm install && npm start

# frontend (terminal 2)
cd frontend && npm install && npm run dev   # http://localhost:5173
```

Or run the whole stack with Docker:

```bash
DB_PASSWORD=devpass JWT_SECRET=devsecret docker compose up --build
# then open http://localhost  (frontend is the public service on port 80)
```

## Deploying on Beachhead

1. Push this repo to the Git remote Beachhead deploys from.
2. In the Beachhead dashboard, set these as **global** env vars (no Target
   Service, so they're written to `.env` for Compose substitution):
   - `DB_PASSWORD` — a strong database password.
   - `JWT_SECRET` — a long random string (used to sign login sessions).
3. Deploy. `beachhead.json` already declares `frontend` as the public service on
   port 80 and `postgres` as a stateful service, so your data (accounts, posts,
   photos) survives redeploys.

## Pointing dgctchr.com at it (Cloudflare)

The domain is registered on Cloudflare. Once Beachhead gives you the deployment's
hostname/IP, add a DNS record in Cloudflare (an `A`/`AAAA` record to the IP, or a
`CNAME` to the Beachhead hostname) for `dgctchr.com` and `www`. Keep SSL/TLS on
"Full". You don't need to hand over your Cloudflare account — just add the record
Beachhead tells you to use.

## Assets

- `frontend/public/logo.png` — the "death metal" Dogcatcher logo (rendered on the
  green masthead with a screen blend so the black background drops out).
- `backend/seed/photo*.jpg` — the three live photos, seeded into the gallery on
  first run. Replace or remove them anytime from the Photos tab.
