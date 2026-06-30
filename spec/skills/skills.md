# CiVX Skills Plan

## 1. Purpose

This document defines the main project skills and capabilities needed to build CiVX. These are implementation and product capability areas, not necessarily Codex skills or chatbot plugins.

The project should be planned around small, testable skill areas so the team can divide work cleanly during a hackathon.

## 2. Product Skills

### Civic Reporting

Capabilities:

- Create photo reports with GPS.
- Select or auto-suggest issue type.
- Add optional description.
- Track report status.
- Confirm or support an existing nearby report.

### Community Mapping

Capabilities:

- Show public issue markers.
- Show cleanup event markers.
- Filter by issue type.
- Filter by status.
- Cluster nearby markers.
- Show before/after community impact.

### LGU Operations

Capabilities:

- Review incoming reports.
- Verify or reject reports.
- Merge duplicate reports.
- Assign incidents to departments.
- Update incident status.
- View response time and barangay analytics.

### Cleanup Events

Capabilities:

- Create cleanup event proposals.
- Submit events for LGU approval.
- Register volunteers.
- Display approved events on maps.
- Upload before/after proof.

### Volunteer Attendance

Capabilities:

- Generate QR check-in codes.
- Validate GPS location.
- Track check-in and check-out.
- Calculate volunteer hours.
- Support organizer and LGU validation.

### EcoQuest Micro-Tasks

Capabilities:

- Create LGU-sponsored public service tasks.
- Let users join or submit task proof.
- Verify before/after photos.
- Validate GPS and QR evidence.
- Record service hours or reward eligibility.

## 3. AI / ML Skills

### Image Classification and Object Detection

Recommended tools:

- YOLO for object detection.
- OpenCV for preprocessing.

Capabilities:

- Detect garbage, potholes, broken roads, flooding, dirty canals, clogged drainage, and road obstructions.
- Return issue type, confidence, bounding box, and severity.
- Let LGU users correct wrong AI suggestions.

### Passive Video Analysis

Recommended tools:

- FFmpeg for video frame extraction.
- OpenCV for frame handling.
- YOLO for frame-level detection.

Capabilities:

- Process 10-second video chunks.
- Extract frames at a controlled interval.
- Detect civic issues from selected frames.
- Match detection timestamps to GPS telemetry.
- Create or merge incidents.

### Duplicate Incident Merging

Recommended tools:

- PostGIS distance queries.
- Rule-based scoring for MVP.
- Optional CLIP/image embeddings later.

Capabilities:

- Compare issue type, GPS distance, timestamp, road segment, status, image similarity, and AI confidence.
- Merge reports into active nearby incidents.
- Keep resolved incidents from absorbing new unrelated reports unless explicitly reopened.

### Severity Scoring

Recommended tools:

- Rule-based scoring for MVP.
- AI confidence and report count as supporting signals.

Capabilities:

- Estimate severity from issue type, report count, location, and AI result.
- Prioritize urgent issues for LGU review.
- Mark low-confidence detections for manual review.

## 4. Technical Skills

### Web Development

Stack:

- React.
- Tailwind CSS.
- React Router or Next.js if needed.
- Google Maps JavaScript API.

Key outputs:

- Community Website.
- LGU Dashboard.
- Public map.
- Incident queue.
- Cleanup event pages.

### Mobile Development

Stack:

- React Native.
- Expo if helpful.
- Firebase Authentication.
- React Native Maps or Google Maps SDK.

Key outputs:

- Citizen reporting.
- Mobile map.
- QR attendance scanner.
- Passive Mode.
- Driver Mode.

### Backend Development

Stack:

- Python.
- FastAPI.
- Uvicorn.
- Background workers.

Key outputs:

- REST API.
- Auth verification.
- Incident engine.
- Media upload handling.
- AI job queue.
- Dashboard data endpoints.

### Data and Storage

Stack:

- Supabase PostgreSQL.
- PostGIS.
- Supabase Storage.

Key outputs:

- Geospatial incident queries.
- Structured civic records.
- Media object storage.
- Audit logs.

### Local Hosting and Demo Operations

Stack:

- Local PC hosting.
- Cloudflare Tunnel.
- Domain `xrnozy.me`.
- Subdomain `civx.xrnozy.me`.
- Optional local Nginx or Caddy reverse proxy.

Key outputs:

- Public hackathon demo URL.
- Local FastAPI backend exposure.
- Local web app or reverse proxy routing.

## 5. MVP Skill Priorities

Build these first:

- Citizen photo reporting with GPS.
- AI-assisted issue suggestion using YOLO demo.
- Duplicate merge logic using GPS radius and issue type.
- Community Website map.
- Mobile Community Map.
- LGU dashboard incident queue and map.
- Cleanup event creation and approval.
- Volunteer registration.
- QR/GPS attendance tracking.
- Passive 10-second video chunk demo.

Defer these:

- Production-grade model fine-tuning.
- Automated face and plate blurring.
- Full offline sync for every app feature.
- Complex reward or payment flows.
- Advanced fraud detection.
