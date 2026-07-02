# LAR - Ping - CiVX – Civic Visual X-Ray

AI-powered civic intelligence and community response platform for detecting, reporting, organizing, and resolving visible city problems.

## Project Brief

CiVX acts like an X-ray for the city. It helps reveal problems that are usually ignored, delayed, duplicated, or scattered across social media, group chats, and informal reports — then connects citizens, volunteers, and LGU staff to fix them faster.

### Problem

Communities face visible civic issues every day: garbage piles, potholes, broken roads, dirty canals, flooding, clogged drainage, illegal dumping, and unsafe public spaces. Current reporting is slow, fragmented, and hard for LGUs to verify, deduplicate, assign, and track to resolution.

### Solution

CiVX combines citizen reporting, passive video collection, AI-assisted detection, geospatial duplicate merging, cleanup event coordination, volunteer attendance, and LGU response management into one coordinated platform.

**Core concept:** Help the city see what is broken, dirty, unsafe, or needs attention — then connect the community and LGU to resolve it.

### Main Platforms

| Platform | Users | Purpose |
|----------|-------|---------|
| **Community Website** | Citizens, volunteers, public | Public map, cleanup events, transparency, volunteer registration |
| **LGU Dashboard** | LGU admin, staff, field workers | Report queue, verification, assignment, analytics, attendance |
| **Mobile App** | Citizens, sweepers, drivers, volunteers | Photo reports, community map, passive/driver modes, EcoQuest, QR/GPS attendance |

### Key Capabilities

- **Citizen photo reporting** with auto GPS and AI-assisted issue classification (YOLO)
- **Public & LGU maps** with markers, filters, heatmaps, and clustering
- **Duplicate incident merging** using location, issue type, time, and AI confidence
- **Passive video pipeline** — 10-second chunks from street sweepers and drivers, processed by FFmpeg + YOLO
- **Driver Mode** — accelerometer/gyroscope bump detection linked to video chunks
- **Cleanup events** — community creation, LGU approval, volunteer registration, before/after proof
- **EcoQuest** — LGU-sponsored micro-tasks with photo/GPS verification
- **Attendance tracking** — QR and GPS check-in for cleanup volunteers
- **Incident lifecycle** — Detected → Pending Review → Verified → Assigned → Ongoing → Resolved → Archived

### Project Structure

| Path | Description |
|------|-------------|
| `backend/` | FastAPI API + 8 agent modules |
| `ai-worker/` | YOLO detection, FFmpeg, privacy blur, similarity |
| `web/` | React community site + LGU dashboard |
| `mobile/` | Expo app (report, map, passive, driver, EcoQuest) |
| `supabase/migrations/` | PostGIS schema |
| `shared/` | Issue categories and constants |
| `infra/` | Caddy, Cloudflare Tunnel, env files |
| `functions/` | Firebase Cloud Functions + Genkit AI flows |
| `dataconnect/` | Firebase Data Connect schema and connectors |
| `genkit/` | Python Cloud Functions scaffold |
| `spec/` | Product specification and design docs |

### Architecture

```text
React Web / Expo Mobile
        │
        ▼
Firebase Authentication
        │
        ▼
FastAPI Backend (via Cloudflare Tunnel)
        │
        ├── Supabase PostgreSQL + PostGIS + Storage
        ├── AI Worker (YOLO + OpenCV + FFmpeg)
        └── Firebase Cloud Functions + Genkit
        │
        ▼
Google Maps (web) / React Native Maps (mobile)
```

## LAR - Ping

- Antido, Gabriel C.
- Casinto, Dominic G.
- Detablan, Jewel Rey F.
- Honrado, Wade Austine L.

## Google Technologies

| Technology | Where Used | Role in CiVX |
|------------|------------|--------------|
| **Firebase Authentication** | Web, mobile, backend | Email/password sign-in; ID tokens verified by FastAPI and linked to Supabase user profiles |
| **Firebase Admin SDK** | `backend/app/auth/firebase.py` | Server-side token verification and user provisioning |
| **Google Maps JavaScript API** | `web/src/components/map/CivicMap.tsx` | Community and LGU maps with custom styling, markers, heatmaps, and location picking |
| **Google Maps Marker Clusterer** | Web map component | Groups dense incident and cleanup markers for readable map views |
| **React Native Maps** | `mobile/app/map.tsx` | Mobile community map showing nearby incidents and cleanup events |
| **Firebase Data Connect** | `dataconnect/`, generated SDKs in web/mobile | GraphQL-style data layer with type-safe React hooks for tasks and related data |
| **Cloud SQL for PostgreSQL** | Data Connect backend (`asia-southeast2`) | Managed Postgres instance backing Firebase Data Connect |
| **Firebase Cloud Functions** | `functions/` | Serverless endpoints for AI and backend workflows |
| **Genkit** | `functions/src/genkit-sample.ts` | AI flow framework integrated with Firebase for LLM-powered features |
| **Google AI (Gemini)** | Genkit flows | LLM-assisted suggestions and future LGU triage/summarization |
| **Firestore** | `firestore.rules`, `firestore.indexes.json` | Document database with security rules for client-side data |

This project was developed for **SparkFest 2026**.
