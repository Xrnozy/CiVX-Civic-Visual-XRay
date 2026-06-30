# CiVX API Keys and Local Runbook

This guide explains what you need in `infra/.env`, where to get each value, and how to run the app locally.

Do not commit real secrets. Keep real values in `infra/.env` only. Commit example placeholders in `.env.example` files.

## What You Need

- Python 3.11 or newer
- Node.js 20 or newer
- FFmpeg on your PATH
- A Supabase project with PostGIS enabled
- A Firebase project
- A Google Cloud project with billing enabled for Google Maps
- Optional: Ollama, Caddy, and Cloudflare Tunnel for public/local demo hosting

## Env File Location

Use this local file for your real values:

```text
infra/.env
```

The Vite web app reads `infra/.env`. The FastAPI backend may read `.env` from its current working directory, depending on how it is launched. If backend env values are not loading, copy the same values into `backend/.env` or start the backend with those variables loaded in your shell.

## Env Template

Create or update `infra/.env` with this shape:

```env
# Supabase
SUPABASE_URL=https://your-project-ref.supabase.co
SUPABASE_ANON_KEY=your-supabase-anon-or-publishable-key
SUPABASE_SERVICE_KEY=your-supabase-service-role-secret-key

# Firebase Admin / Backend
FIREBASE_PROJECT_ID=your-firebase-project-id
GOOGLE_APPLICATION_CREDENTIALS=./infra/firebase-service-account.json

# Google Maps
GOOGLE_MAPS_API_KEY=your-google-maps-browser-key

# Backend
API_HOST=0.0.0.0
API_PORT=8000
CORS_ORIGINS=http://localhost:5173,http://localhost:3000,https://civx.xrnozy.me
JWT_SECRET=replace-with-a-long-random-secret

# AI Worker
YOLO_MODEL=yolov8n.pt
YOLO_CONFIDENCE=0.35
FFMPEG_PATH=ffmpeg

# Optional LLM summaries
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=llama3.2

# Web (Vite)
VITE_API_URL=
VITE_FIREBASE_API_KEY=your-firebase-web-api-key
VITE_FIREBASE_AUTH_DOMAIN=your-project-id.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project-id
VITE_GOOGLE_MAPS_API_KEY=your-google-maps-browser-key

# Mobile (Expo), if used
EXPO_PUBLIC_API_URL=http://localhost:8000
EXPO_PUBLIC_FIREBASE_API_KEY=your-firebase-web-api-key
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=your-project-id.firebaseapp.com
EXPO_PUBLIC_FIREBASE_PROJECT_ID=your-project-id
```

## Which Keys Are Secret

Never expose these in frontend code, screenshots, commits, or public docs:

- `SUPABASE_SERVICE_KEY`
- `JWT_SECRET`
- `GOOGLE_APPLICATION_CREDENTIALS` JSON file contents
- Any private key, `.pem`, `.p12`, service account JSON, OAuth client secret, or database dump

These are allowed in browser/mobile apps, but still restrict them in the provider console:

- `VITE_FIREBASE_API_KEY`
- `EXPO_PUBLIC_FIREBASE_API_KEY`
- `VITE_GOOGLE_MAPS_API_KEY`
- `GOOGLE_MAPS_API_KEY`, if it is only used as a browser Maps key
- `SUPABASE_ANON_KEY`, if Row Level Security is configured correctly

## Supabase Values

Needed env vars:

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_KEY`

How to get them:

1. Open the Supabase dashboard: https://supabase.com/dashboard
2. Select your project.
3. Go to `Project Settings` then `API`.
4. Copy the project URL into `SUPABASE_URL`.
5. Copy the public anon/publishable key into `SUPABASE_ANON_KEY`.
6. Copy the service role secret key into `SUPABASE_SERVICE_KEY`.

Important:

- The service role key bypasses Row Level Security. Use it only in the backend.
- The anon/publishable key can be used by clients only if your RLS policies are correct.
- Run `supabase/migrations/001_initial_schema.sql` in the Supabase SQL editor.
- Enable PostGIS before or inside the migration with `CREATE EXTENSION IF NOT EXISTS postgis;`.
- Create storage buckets used by the app, such as `report-photos` and `video-chunks`.

## Firebase Web App Values

Needed env vars:

- `VITE_FIREBASE_API_KEY`
- `VITE_FIREBASE_AUTH_DOMAIN`
- `VITE_FIREBASE_PROJECT_ID`
- `EXPO_PUBLIC_FIREBASE_API_KEY`
- `EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN`
- `EXPO_PUBLIC_FIREBASE_PROJECT_ID`

How to get them:

1. Open Firebase Console: https://console.firebase.google.com/
2. Select your project.
3. Go to `Project settings` then `General`.
4. Under `Your apps`, create or open a Web app.
5. Copy values from the Firebase config object:
   - `apiKey` goes to `VITE_FIREBASE_API_KEY` and `EXPO_PUBLIC_FIREBASE_API_KEY`
   - `authDomain` goes to `VITE_FIREBASE_AUTH_DOMAIN` and `EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN`
   - `projectId` goes to `VITE_FIREBASE_PROJECT_ID`, `EXPO_PUBLIC_FIREBASE_PROJECT_ID`, and `FIREBASE_PROJECT_ID`

Enable email login:

1. In Firebase Console, go to `Authentication`.
2. Open `Sign-in method`.
3. Enable `Email/Password`.
4. Save.

For Google sign-in:

1. In `Authentication` then `Sign-in method`, enable `Google`.
2. In `Authentication` then `Settings` then `Authorized domains`, add domains you use:
   - `localhost`
   - `civx.xrnozy.me`

## Firebase Admin Service Account

Needed env vars/files:

- `FIREBASE_PROJECT_ID`
- `GOOGLE_APPLICATION_CREDENTIALS=./infra/firebase-service-account.json`
- `infra/firebase-service-account.json`

How to get it:

1. Open Firebase Console: https://console.firebase.google.com/
2. Select your project.
3. Go to `Project settings`.
4. Open the `Service accounts` tab.
5. Click `Generate new private key`.
6. Save the downloaded JSON file as:

```text
infra/firebase-service-account.json
```

Important:

- Never commit this JSON file.
- If it was ever committed or shared, delete that key in Firebase/Google Cloud and generate a new one.

## Google Maps API Key

Needed env vars:

- `GOOGLE_MAPS_API_KEY`
- `VITE_GOOGLE_MAPS_API_KEY`

How to get it:

1. Open Google Cloud Console: https://console.cloud.google.com/
2. Select the same project, for example `civx-d53ad`.
3. Go to `APIs & Services` then `Library`.
4. Search for `Maps JavaScript API`.
5. Open it and click `Enable`.
6. Go to `APIs & Services` then `Credentials`.
7. Open your browser key or create a new API key.
8. Under `Application restrictions`, choose `Websites`.
9. Add HTTP referrers:

```text
http://localhost:5173/*
http://127.0.0.1:5173/*
https://civx.xrnozy.me/*
```

10. Under `API restrictions`, restrict the key to `Maps JavaScript API`.
11. Save, then put the key in `GOOGLE_MAPS_API_KEY` and `VITE_GOOGLE_MAPS_API_KEY`.

If you see `ApiNotActivatedMapError`, the key exists but `Maps JavaScript API` is not enabled for the selected Google Cloud project.

If you see `ERR_BLOCKED_BY_CLIENT`, temporarily disable browser ad blockers or privacy extensions for localhost.

## JWT Secret

Needed env var:

- `JWT_SECRET`

Generate a local secret in PowerShell:

```powershell
[Convert]::ToBase64String((1..32 | ForEach-Object { Get-Random -Maximum 256 }))
```

Paste the output into:

```env
JWT_SECRET=the-generated-value
```

Use a different value for production.

## AI Worker and Ollama Values

Needed env vars:

- `YOLO_MODEL`
- `YOLO_CONFIDENCE`
- `FFMPEG_PATH`
- `OLLAMA_BASE_URL`
- `OLLAMA_MODEL`

Defaults are usually fine:

```env
YOLO_MODEL=yolov8n.pt
YOLO_CONFIDENCE=0.35
FFMPEG_PATH=ffmpeg
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=llama3.2
```

Install FFmpeg and make sure this works:

```powershell
ffmpeg -version
```

Ollama is optional unless you use local LLM summaries.

## Install Dependencies

From the repo root:

```powershell
cd "C:\Users\MY PC\Documents\Hackathon testing\CiVX"
```

Backend:

```powershell
cd backend
python -m venv venv
.\venv\Scripts\Activate.ps1
pip install -r requirements.txt
cd ..
```

Web:

```powershell
cd web
npm install
cd ..
```

Mobile:

```powershell
cd mobile
npm install
cd ..
```

Functions or Genkit, if used:

```powershell
cd functions
npm install
cd ..
```

## Run the Database Setup

1. Open Supabase SQL editor.
2. Paste and run:

```text
supabase/migrations/001_initial_schema.sql
```

3. Create storage buckets:

```text
report-photos
video-chunks
```

## Run the Backend

From the repo root:

```powershell
cd backend
.\venv\Scripts\Activate.ps1
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

Open:

```text
http://localhost:8000/docs
```

If env values do not load, copy `infra/.env` to `backend/.env` for local development or load the variables before starting Uvicorn.

## Run the Web App

In a second terminal:

```powershell
cd web
npm run dev
```

Open:

```text
http://localhost:5173
```

If using Cloudflare Tunnel or a public demo domain, make sure `web/vite.config.ts` allows the host:

```ts
server: {
  allowedHosts: ['civx.xrnozy.me'],
}
```

## Run the Mobile App

In another terminal:

```powershell
cd mobile
npx expo start
```

For a real phone, `EXPO_PUBLIC_API_URL` should point to your computer's LAN IP, not `localhost`. Example:

```env
EXPO_PUBLIC_API_URL=http://192.168.1.25:8000
```

## Optional: Run Genkit

If you initialized Firebase Genkit:

```powershell
gcloud auth application-default login --project your-project-id
cd functions
npm run genkit:start
```

Genkit is only needed if you are running Firebase-hosted AI flows. The main CiVX backend can run without it.

## Optional: Public Demo With Caddy and Cloudflare

Run the backend and web app first. Then, if your infra files are configured:

```powershell
caddy run --config infra/Caddyfile
cloudflared tunnel run --config infra/cloudflared-config.yml civx
```

Also add these allowed origins and domains:

- `https://civx.xrnozy.me` in `CORS_ORIGINS`
- `civx.xrnozy.me` in Firebase Auth authorized domains
- `https://civx.xrnozy.me/*` in Google Maps API key HTTP referrers
- `civx.xrnozy.me` in Vite `server.allowedHosts` for dev server tunneling

## Quick Smoke Test

1. Backend docs open at `http://localhost:8000/docs`.
2. Web app opens at `http://localhost:5173`.
3. Register with email/password.
4. Login succeeds.
5. Map loads without `ApiNotActivatedMapError`.
6. Supabase tables exist and backend endpoints do not fail with missing table errors.
7. Upload/report workflows can reach Supabase Storage buckets.

## Official References

- Supabase API keys: https://supabase.com/docs/guides/api/api-keys
- Firebase web setup: https://firebase.google.com/docs/web/setup
- Firebase email/password auth: https://firebase.google.com/docs/auth/web/password-auth
- Firebase Admin setup: https://firebase.google.com/docs/admin/setup
- Google Maps JavaScript API key setup: https://developers.google.com/maps/documentation/javascript/get-api-key
- Google Maps JavaScript API errors: https://developers.google.com/maps/documentation/javascript/error-messages
- Cloudflare Tunnel docs: https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/
