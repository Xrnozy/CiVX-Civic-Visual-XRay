# CiVX Technical Stack

## 1. Stack Overview

CiVX should use a hackathon-ready stack that supports web dashboards, a mobile app, geospatial data, media uploads, AI-assisted computer vision, and local PC hosting through Cloudflare Tunnel.

The recommended AI/ML approach is:

- Start with a pre-trained YOLO object detection model for demo-ready civic issue detection.
- Fine-tune later on local civic images for garbage, potholes, flooding, dirty canals, clogged drainage, road obstructions, broken roads, and related categories.
- Use OpenCV and FFmpeg for frame extraction, image preprocessing, and video chunk processing.
- Use geospatial rules and image similarity for duplicate incident merging.
- Keep human LGU review in the loop for verification, assignment, and final status changes.

This gives the project a realistic AI backbone without requiring a large custom model during the MVP.

## 2. Frontend Web

Planned stack:

- React.
- React Router, or Next.js if server-side routing becomes useful.
- Tailwind CSS.
- Google Maps JavaScript API with custom map styling.
- Map markers, heatmaps, filters, and issue clustering.

Main web surfaces:

- Public Community Website.
- LGU Website / Dashboard.
- Incident map.
- Cleanup event map.
- Analytics dashboard.
- Report queue and review views.

## 3. Mobile App

Planned stack:

- React Native.
- Expo if helpful for faster development.
- Firebase Authentication.
- Camera access.
- GPS/location access.
- QR scanner for attendance.
- Background upload queue for passive video chunks.
- Mobile community map using Google Maps SDK or React Native Maps.
- Accelerometer and gyroscope access for Driver Mode.

The mobile app should support citizen reporting, volunteer participation, EcoQuest tasks, QR/GPS attendance, Passive Mode, and Driver Mode.

## 4. Backend

Planned stack:

- Python.
- FastAPI.
- Uvicorn.
- REST API.
- WebSocket or polling for live dashboard updates.
- Background worker for video processing and AI jobs.
- FFmpeg/OpenCV for extracting frames from videos.
- YOLO or similar object detection model for AI-assisted detection.

Backend responsibilities:

- Accept reports, media uploads, route sessions, GPS telemetry, and cleanup event data.
- Verify Firebase users and connect them to Supabase user profiles.
- Run duplicate incident checks.
- Create and update incident records.
- Manage status transitions.
- Queue AI processing jobs.
- Expose dashboard and map APIs.

## 5. Database

Planned stack:

- Supabase PostgreSQL.
- PostGIS for geospatial queries.

Suggested tables:

- users
- reports
- incidents
- cleanup_events
- volunteer_registrations
- attendance_records
- passive_route_sessions
- video_chunks
- detection_results
- ecoquest_tasks
- departments
- department_assignments
- audit_logs

PostGIS should be used for distance checks, nearby issue search, map filtering, heatmaps, and duplicate detection by location.

## 6. Storage

Planned stack:

- Supabase Storage for uploaded images, video chunks, extracted frames, and proof photos.

Media should not be stored directly inside the database. The database should store metadata and storage URLs only.

Storage categories:

- Citizen report photos.
- Passive video chunks.
- Extracted detection frames.
- Cleanup event before/after photos.
- EcoQuest proof photos.
- Optional attendance selfie check-ins.

## 7. Authentication and Roles

Planned stack:

- Firebase Authentication.
- Email/password login.
- Google login optional.
- Role-based access stored in Supabase.
- Firebase UID linked to Supabase user profile.

Roles:

- citizen
- volunteer
- organizer
- LGU admin
- LGU staff
- field worker
- driver
- street sweeper

Firebase should handle identity. Supabase should store civic profile data, role assignments, barangay information, and app permissions.

## 8. Maps

Planned stack:

- Google Maps API.
- Custom styling.
- Issue markers.
- Cleanup event markers.
- Heatmaps.
- Clustering.
- Directions link for cleanup events.
- Map filters by issue type and status.

Map data should be served from FastAPI endpoints backed by PostGIS queries. The Community Website should show public-safe incident and event data. The LGU Dashboard should show richer operational details for authorized users.

## 9. AI / Computer Vision

Recommended AI/ML components:

- YOLO model for object detection.
- OpenCV for image preprocessing and frame analysis.
- FFmpeg for video chunk frame extraction.
- Optional CLIP or image embedding model later for image similarity.
- Rule-based geospatial scoring for duplicate merging.

Target detections:

- Garbage
- Pothole
- Broken road
- Flooding
- Dirty canal
- Clogged drainage
- Road obstruction
- Illegal dumping
- Unsafe visible area

AI worker output:

- issue_type
- confidence_score
- bounding_box
- severity_score
- frame_timestamp
- matched_gps_location
- source_media_id

Recommended MVP path:

1. Use a pre-trained YOLO model for general object detection and a small custom label mapping demo.
2. Add a lightweight manual override in the LGU dashboard for correcting AI suggestions.
3. Store all corrections as future training data.
4. Fine-tune YOLO after collecting enough civic issue samples.

## 10. Passive Video Pipeline

Pipeline:

1. Mobile records 10-second chunks.
2. The app uploads the previous chunk while recording the next chunk.
3. The app saves chunks locally if offline.
4. Backend stores the chunk in Supabase Storage.
5. Backend creates a processing job.
6. AI worker extracts frames with FFmpeg/OpenCV.
7. YOLO checks frames for civic issues.
8. Detection result is matched with GPS telemetry.
9. Incident engine creates or merges incident.
10. Maps and dashboards update after review or according to MVP visibility rules.

This segmented pipeline reduces upload failure risk, bandwidth usage, battery usage, and processing cost.

## 11. Hosting

The user does not want paid cloud hosting.

Planned hosting:

- Backend runs on the user's PC.
- Frontend can run locally or be deployed to free hosting if needed.
- Public access through Cloudflare Tunnel.
- Domain: `xrnozy.me`.
- Tunnel subdomain: `civx.xrnozy.me`.

`civx.xrnozy.me` will point to the local PC backend through Cloudflare Tunnel. This is useful for hackathon demos because judges and teammates can access the live backend without paid hosting. For production, the system should later move to a real VPS or cloud environment if usage grows.

Suggested local setup:

- FastAPI backend running on `localhost:8000`.
- React web app running on `localhost:3000` or `localhost:5173`.
- Cloudflare Tunnel routes `civx.xrnozy.me` to the backend or local reverse proxy.
- Optional Nginx or Caddy reverse proxy locally.
- Supabase and Firebase still used as managed free-tier services.

## 12. Development Tools

Recommended tools:

- GitHub.
- VS Code.
- Postman or Insomnia.
- Python virtual environment.
- npm.
- Docker optional.
- Cloudflare Tunnel.
- FFmpeg installed locally.

## 13. Architecture Diagram

```text
React Website / React Native App
        |
        v
Firebase Auth
        |
        v
FastAPI Backend via civx.xrnozy.me
        |
        v
Supabase PostgreSQL + Supabase Storage
        |
        v
AI Worker with YOLO + OpenCV/FFmpeg
        |
        v
Google Maps frontend visualization
```

## 14. MVP Technical Priorities

For the hackathon MVP, prioritize:

- FastAPI API for reports, incidents, events, attendance, and passive chunks.
- Supabase PostgreSQL with PostGIS for location queries.
- Supabase Storage for media.
- Firebase Authentication for login.
- React web maps and LGU dashboard.
- React Native or Expo mobile reporting flow.
- YOLO/OpenCV demo worker for photo and 10-second video chunks.
- Duplicate merging based on issue type, GPS radius, active status, and AI confidence.

Advanced model fine-tuning, production-grade streaming, large-scale monitoring, and paid hosting should be deferred until after the MVP.
