# CiVX – Civic Visual X-Ray

AI-powered civic intelligence and community response platform for detecting, reporting, organizing, and resolving visible city problems.

## Architecture

```
React Web / Expo Mobile
        ↓
Firebase Auth
        ↓
FastAPI Backend (localhost:8000)
        ↓
Supabase PostgreSQL + PostGIS + Storage
        ↓
YOLO + OpenCV/FFmpeg AI Worker
        ↓
Google Maps visualization
```

Public demo: `civx.xrnozy.me` via Cloudflare Tunnel.

## Project Structure

| Path | Description |
|------|-------------|
| `backend/` | FastAPI API + 8 agent modules |
| `ai-worker/` | YOLO detection, FFmpeg, privacy blur, similarity |
| `web/` | React community site + LGU dashboard |
| `mobile/` | Expo app (report, map, passive, driver, EcoQuest) |
| `supabase/migrations/` | PostGIS schema |
| `shared/` | Issue categories and constants |
| `infra/` | Caddy, Cloudflare Tunnel, `.env.example` |
| `spec/` | Product specification and design docs |

## Prerequisites

- Python 3.11+
- Node.js 20+
- FFmpeg on PATH
- Supabase project with PostGIS enabled
- Firebase project (Email auth)
- Google Maps API key
- Cloudflare Tunnel (optional, for public demo)

## Setup

### 1. Environment

```bash
# Env file lives at infra/.env (loaded automatically by the backend)
cp infra/.env.example infra/.env
# Fill in Supabase, Firebase, Google Maps keys
```

### 2. Database

Run `supabase/migrations/001_initial_schema.sql` in your Supabase SQL editor.

Create storage buckets: `report-photos`, `video-chunks`.

Under **API restrictions**, allow at least **Identity Toolkit API** (and Firebase-related APIs). Wait up to 5 minutes after saving.

### 2b. Roles and registration

Run `supabase/migrations/002_registration_invites.sql` in Supabase after the initial schema.

Set in `infra/.env`:

```
DEMO_LGU_AUTO_ROLE=false
PUBLIC_WEB_URL=http://localhost:5173
```

**Account types at `/register`:**

| Type | Role | How |
|------|------|-----|
| Community member | `citizen` | Self-register with phone + barangay |
| Community leader (NGO) | `organizer` | Self-register with organization name; create cleanup drives at `/organizer` |
| Public Workers | `street_sweeper` | LGU issues QR at `/lgu/worker-invites`; worker scans link with `?invite=TOKEN` |

There is no self-register path for LGU staff. Promote accounts manually:

**Option A — Supabase (first LGU admin, one-time bootstrap)**

1. Register normally at `/register` (Community member is fine).
2. In [Supabase](https://supabase.com/dashboard) → **SQL Editor**, run (use your sign-in email):

```sql
UPDATE users
SET role = 'lgu_admin', registration_completed_at = COALESCE(registration_completed_at, now())
WHERE email = 'you@example.com';
```

3. Sign out and sign back in. You should see **LGU** in the nav and access `/lgu`.

**Option B — LGU dashboard (after you are `lgu_admin`)**

1. Open **LGU → Staff access** (`/lgu/staff`).
2. Search the person’s **email** (they must have registered at `/register` first).
3. Set their role to **LGU staff** or **Field worker**.
4. Ask them to sign out and sign back in.

**Option C — API** (for scripts or integrations)

```http
POST /api/users/{user_uuid}/role
Authorization: Bearer <firebase-id-token>
Content-Type: application/json

{"role": "lgu_staff"}
```

Only an existing `lgu_admin` can call this.

### 2c. Firebase Authentication (email + Google)

In [Firebase Console](https://console.firebase.google.com/) → your project → **Authentication** → **Sign-in method**:

1. Enable **Email/Password**
2. Enable **Google** and set a support email
3. Under **Settings → Authorized domains**, ensure `localhost` is listed (for local dev)

Copy your Web app config into `infra/.env`:

```
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=civx-d53ad.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=civx-d53ad
```

Restart `npm run dev` after changing env vars.

### 2d. Google Maps

Your Firebase project (`civx-d53ad`) is also a Google Cloud project. The map needs **Maps JavaScript API** enabled:

1. Open [Maps JavaScript API](https://console.cloud.google.com/apis/library/maps-backend.googleapis.com) (select project **civx-d53ad**)
2. Click **Enable** (billing must be enabled on the project, free tier is fine)
3. Go to **APIs & Services → Credentials** → your browser API key
4. Under **Application restrictions**, choose **HTTP referrers** and add:
   - `http://localhost:5173/*`
   - `https://civx.xrnozy.me/*` (for production)
5. Put the key in `infra/.env` as `VITE_GOOGLE_MAPS_API_KEY`

If you see `ApiNotActivatedMapError`, the API is not enabled yet. `ERR_BLOCKED_BY_CLIENT` is usually an ad blocker.

### 3. Backend

```bash
cd backend
python -m venv venv
venv\Scripts\activate   # Windows
pip install -r requirements.txt
uvicorn app.main:app --host 0.0.0.0 --port 8000
```

### 4. Web

```bash
cd web
npm install
npm run dev
```

Open http://localhost:5173

### 5. Mobile

```bash
cd mobile
npm install
npx expo start
```

Set `EXPO_PUBLIC_API_URL` to your machine IP for device testing.

### 6. YOLO test

```bash
python test.py path/to/image.jpg
```

## API Highlights

- `POST /api/reports` – Citizen photo report with AI + duplicate merge
- `GET /api/incidents/public` – Sanitized public map data
- `GET /api/maps/markers` – Map markers + cleanup events
- `POST /api/passive/sessions/{id}/chunks` – 10s video chunk upload
- `POST /api/driver/sensor-events` – Driver mode bump detection
- `WS /ws/dashboard` – Live LGU queue updates

## LGU Roles

Set user role via `POST /api/users/{id}/role?role=lgu_admin` (admin only).

## Hosting (Local PC + Cloudflare)

1. Run Caddy: `caddy run --config infra/Caddyfile`
2. Run tunnel: `cloudflared tunnel run --config infra/cloudflared-config.yml civx`

## Hackathon Demo Flow

1. Citizen reports garbage via mobile
2. Report appears on maps + LGU queue
3. Second nearby report merges into one incident
4. Community creates cleanup event → LGU approves
5. Volunteers QR/GPS check-in
6. Street sweeper passive mode uploads 10s chunk
7. YOLO detects issue → LGU dispatches → resolved

## License

See LICENSE file.
