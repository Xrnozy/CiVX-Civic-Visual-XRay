Create documentation files only. Do not create app code. Do not modify other folders.

Create these two files only:

1. description/spec.md
2. techstack/techstack.md

Project name:
CiVX – Civic Visual X-Ray

Improved title:
CiVX – Civic Visual X-Ray: AI-Powered Civic Intelligence and Community Response Platform

Project story:
CiVX acts like an X-ray for the city. It helps reveal problems that are usually ignored, delayed, or scattered across social media reports. The platform helps citizens, volunteers, community groups, street sweepers, public drivers, and LGU staff detect, report, organize, and resolve city issues such as garbage, potholes, broken roads, dirty canals, flooding, clogged drainage, broken sidewalks, illegal dumping, road obstructions, unsafe public areas, and other visible community problems.

The goal is to build smarter, safer, cleaner, and more inclusive communities by combining citizen reporting, passive video collection, AI-assisted issue detection, duplicate report merging, community cleanup events, volunteer attendance tracking, and LGU response management.

Important:
The system should be described as an industry-style civic platform, not just a simple reporting app.

Main platforms:
1. Community Website
2. LGU Website / Dashboard
3. Mobile App

Main users:
- Citizens / community members
- Volunteers
- Community groups / organizers
- LGU staff
- Street sweepers
- Public drivers
- Barangay workers
- Garbage collectors
- Police patrols or LGU vehicles

Write description/spec.md as a complete product specification.

The spec.md must include:

# 1. Project Overview
Explain what CiVX is, why it exists, and what problem it solves.

# 2. Problem Statement
Explain that communities often suffer from garbage piles, potholes, broken roads, dirty rivers/canals, flooding, clogged drainage, broken sidewalks, illegal dumping, and unsafe public spaces. Current reporting methods are slow, manual, scattered, duplicated, and hard for LGUs to manage.

# 3. Proposed Solution
Explain that CiVX combines:
- citizen photo reporting
- mobile community map
- public community website map
- LGU dashboard
- passive video detection
- duplicate incident merging
- cleanup event coordination
- volunteer registration
- QR/GPS attendance tracking
- EcoQuest / LGU-sponsored community micro-tasks
- incident status tracking

# 4. Core Concept
Use this idea:
CiVX helps the city see what is broken, dirty, unsafe, or needs attention, then connects the community and LGU to fix it faster.

# 5. Main Modules

## A. Community Website
The Community Website is public-facing. It should show a city map with visible community issues and cleanup events.

Features:
- Public Community Map
- Map markers for garbage, potholes, broken roads, dirty canals/rivers, flooding, clogged drainage, broken sidewalks, broken streetlights, open manholes, illegal dumping areas, fallen trees, road obstructions, unsafe public areas, and cleanup events
- Filters by issue type
- Filters by status: pending, verified, assigned, ongoing, resolved
- Cleanup event listings
- Volunteer registration for cleanup drives
- Before-and-after gallery
- Community impact dashboard
- Top barangays / top volunteers / cleanup statistics
- Public transparency page showing resolved reports and ongoing actions

The Community Map should include both problems and solutions. It should not only show dirty or broken places, but also show upcoming and approved cleanup events.

## B. LGU Website / Dashboard
The LGU Dashboard is for authorized government users.

Features:
- LGU incident map
- Incoming report queue
- AI-assisted issue classification
- Severity score
- Duplicate report merging
- Report verification
- Department assignment
- Dispatch system
- Cleanup event approval
- Volunteer monitoring
- Attendance monitoring
- EcoQuest task creation and verification
- Incident status tracking
- Analytics dashboard
- Heatmap of problem areas
- Reports by barangay
- Response time tracking
- Resolved issue history

Incident status flow:
Detected → Pending Review → Verified → Assigned → Ongoing → Resolved → Archived

LGU cleanup event approval flow:
Community group creates cleanup event → LGU reviews → LGU approves/rejects/requests changes → volunteers register → attendance is tracked → event is completed → before/after proof is uploaded.

## C. Mobile App
The mobile app is used by citizens, volunteers, street sweepers, public drivers, and LGU field users.

The mobile app must also have a Community Map.

Mobile App features:
- Login/signup using Firebase Authentication
- Citizen photo report
- Auto GPS location
- AI-assisted issue detection
- Optional short description
- Report status tracking
- Mobile Community Map
- View nearby garbage, potholes, broken roads, dirty canals, flooding, cleanup events, and other issues
- Confirm/support an existing report instead of creating a duplicate
- Join cleanup events
- Volunteer registration
- QR code attendance check-in
- GPS-based attendance validation
- Optional selfie check-in for volunteer verification
- Volunteer history
- Service hours tracking
- EcoQuest task list
- EcoQuest task verification using before photo, after photo, GPS, QR validation, and LGU approval
- Passive street sweeper mode
- Passive driver mode

The mobile Community Map should be simpler than the website map. It should focus on:
- nearby issues
- nearby cleanup events
- report checking
- quick reporting
- joining volunteer activities
- checking report status

# 6. Issue Categories
Include the following map/report categories:
- Garbage pile
- Scattered trash
- Overflowing trash bin
- Illegal dumping
- Pothole
- Broken road
- Road crack
- Uneven road
- Flooding
- Dirty canal
- Dirty river
- Clogged drainage
- Broken sidewalk
- Broken streetlight
- Open manhole / missing cover
- Fallen tree
- Road obstruction
- Damaged traffic sign
- Unsafe public area
- Cleanup event

# 7. Passive Detection System
Explain that passive detection is for street sweepers, public drivers, garbage trucks, LGU vehicles, barangay vehicles, and police patrols.

Use industry-standard wording:
CiVX uses a segmented passive video ingestion pipeline.

Explain the passive video flow:
1. User starts Passive Mode in the mobile app.
2. The app creates a route session.
3. The phone camera, webcam, or connected bodycam records short video chunks.
4. Each chunk is around 10 seconds.
5. While the app records the next 10-second chunk, the previous chunk uploads in the background.
6. The app also records GPS telemetry with timestamps.
7. The backend receives the video chunk and metadata.
8. The backend stores the video in object storage.
9. A processing job is created.
10. The AI worker extracts frames from the video.
11. The AI checks frames for garbage, potholes, broken roads, flooding, dirty canals, clogged drainage, road obstruction, or other visible issues.
12. The detected frame timestamp is matched with GPS data.
13. The Incident Intelligence Engine checks if the issue is a duplicate.
14. If duplicate, it merges the report into an existing incident.
15. If new, it creates a new incident.
16. The incident appears on the LGU dashboard, community website map, and mobile map.

Explain that CiVX does not upload one huge long video and does not stream raw full video 24/7. It uses short video chunks to reduce bandwidth, battery usage, processing cost, and upload failure risk.

Also include offline behavior:
If internet is weak, the mobile app stores video chunks locally and uploads them later when connection becomes available.

# 8. Driver Mode
Explain that driver mode uses:
- camera
- GPS
- accelerometer
- gyroscope

Driver mode can detect possible:
- potholes
- rough roads
- uneven roads
- broken road sections
- speed bumps
- road vibration hotspots

Flow:
Phone detects sudden bump/drop/wobble → app marks timestamp → relevant video chunk is uploaded → backend checks frames around the event → AI confirms if pothole or broken road exists → report is created or merged.

# 9. Citizen Reporting Flow
Write the full flow:
Citizen opens app → taps report → takes photo → app gets GPS → AI suggests issue type → user submits → backend checks duplicate → report becomes pending review → appears on map and LGU dashboard.

# 10. Duplicate Report Merging
Explain that many users may report the same pothole or garbage pile. CiVX should merge similar reports into one incident.

Duplicate detection should use:
- GPS distance
- issue type
- timestamp
- image similarity
- road segment
- status
- AI confidence

Example:
If a pothole report already exists within 10–25 meters and is not resolved, the new report is merged into the same incident instead of creating a new one.

# 11. Volunteer and Cleanup Event System
Include:
- Community groups can create cleanup events.
- Events appear on the community map.
- LGU can approve or reject events.
- Citizens can register as volunteers.
- Volunteers provide name, phone number, barangay/area, emergency contact, and agreement to safety guidelines.
- Face photo should not be required all the time. Use QR check-in + GPS check-in + optional selfie during event instead.
- Attendance can be verified using QR code, GPS location, organizer confirmation, before/after photos, and LGU validation.

# 12. Attendance Tracker
The attendance tracker should support:
- QR code check-in
- GPS location validation
- check-in and check-out time
- organizer verification
- LGU validation
- volunteer hours calculation
- attendance status: registered, checked-in, checked-out, verified, rejected
- certificate or service hour record generation

# 13. EcoQuest
EcoQuest is an LGU-sponsored community micro-task system, similar to small public service tasks.

Examples:
- Clean sidewalk
- Collect trash in assigned area
- Clean canal area
- Plant trees
- Remove posters
- Report verified illegal dumping
- Assist in cleanup drives

Verification:
- GPS check-in
- before photo
- after photo
- QR validation
- group leader approval
- LGU approval
- optional valid ID only if rewards/money are involved

# 14. Data Models
Include basic suggested data models:
- User
- Report
- Incident
- CleanupEvent
- VolunteerRegistration
- AttendanceRecord
- EcoQuestTask
- PassiveRouteSession
- VideoChunk
- DetectionResult
- DepartmentAssignment

Each model should include important fields.

# 15. MVP Scope
The hackathon MVP should include:
- Community map on website
- Mobile community map
- Citizen photo report with GPS
- AI-assisted classification demo
- Duplicate report merging
- LGU dashboard incident list/map
- Cleanup event creation
- Volunteer registration
- QR attendance tracker
- Passive video chunking demo using 10-second videos
- Status tracking

# 16. Demo Flow
Include a clear hackathon demo story:
1. Citizen reports garbage using mobile app.
2. Report appears on the mobile map, community website map, and LGU dashboard.
3. Another citizen reports the same garbage nearby.
4. System merges both into one incident.
5. Community group creates cleanup event for that location.
6. LGU approves the cleanup event.
7. Volunteers register.
8. Volunteers check in using QR code and GPS.
9. LGU sees attendance count.
10. Street sweeper passive mode uploads a 10-second video chunk.
11. Backend extracts frames and detects another issue.
12. LGU dispatches a team.
13. Issue status changes to resolved.

# 17. Security and Privacy
Include:
- Firebase Authentication
- Role-based access control
- User roles: citizen, volunteer, organizer, LGU admin, LGU staff, field worker, driver, street sweeper
- Public map does not expose private user data
- Sensitive images/videos are visible only to authorized LGU users
- Faces and plate numbers should be blurred or hidden when shown publicly
- Full volunteer personal info should only be visible to event organizers and LGU admins
- Audit logs for LGU actions
- Basic upload validation
- Rate limiting
- Report abuse prevention

# 18. Final Pitch
End spec.md with:
CiVX helps the city see what is broken, dirty, or unsafe and connects citizens, volunteers, and LGUs to fix problems faster.

Also include:
CiVX is not just a reporting app. It is a civic intelligence platform that uses citizen reports, passive video ingestion, GPS telemetry, duplicate incident merging, volunteer coordination, and LGU workflow management to improve public services and community response.

Now create techstack/techstack.md.

The techstack.md must describe the planned technical stack.

Use this planned stack:

Frontend Web:
- React
- React Router or Next.js if needed
- Tailwind CSS
- Google Maps JavaScript API with custom map styling
- Map markers, heatmaps, filters, and issue clustering

Mobile App:
- React Native
- Expo if helpful for faster development
- Firebase Authentication
- Camera access
- GPS/location access
- QR scanner for attendance
- Background upload queue for passive video chunks
- Mobile community map using Google Maps SDK or React Native Maps
- Accelerometer and gyroscope access for driver mode

Backend:
- Python
- FastAPI
- Uvicorn
- REST API
- WebSocket or polling for live dashboard updates
- Background worker for video processing and AI jobs
- FFmpeg/OpenCV for extracting frames from videos
- YOLO or similar object detection model for AI-assisted detection

Database:
- Supabase PostgreSQL
- PostGIS for geospatial queries
- Tables for users, reports, incidents, cleanup events, volunteers, attendance records, passive route sessions, video chunks, detection results, EcoQuest tasks, departments, audit logs

Storage:
- Supabase Storage for uploaded images, video chunks, extracted frames, and proof photos
- Do not store media directly inside the database

Authentication:
- Firebase Authentication
- Email/password login
- Google login optional
- Role-based access stored in Supabase
- Firebase UID linked to Supabase user profile

Maps:
- Google Maps API
- Custom styling
- Issue markers
- Cleanup event markers
- Heatmaps
- Clustering
- Directions link for cleanup events
- Map filters by issue type and status

AI / Computer Vision:
- YOLO model for garbage, pothole, broken road, flooding, dirty canal, clogged drainage, and obstruction detection
- OpenCV/FFmpeg for frame extraction
- Backend AI worker processes uploaded images and video chunks
- AI returns issue type, confidence score, bounding box, severity, and frame timestamp

Passive Video Pipeline:
- Mobile records 10-second chunks
- Uploads previous chunk while recording next chunk
- Saves chunks locally if offline
- Backend stores chunk
- Processing job is created
- AI worker extracts frames
- Detection result is matched with GPS telemetry
- Incident engine creates or merges incident

Hosting:
The user does not want paid cloud hosting.

Use local PC hosting:
- Backend runs on the user’s PC
- Frontend can run locally or be deployed to free hosting if needed
- Public access through Cloudflare Tunnel
- Domain: xrnozy.me
- Tunnel subdomain: civx.xrnozy.me

Explain that civx.xrnozy.me will point to the local PC backend through Cloudflare Tunnel. Mention that this is useful for hackathon demos but production should later move to a real VPS or cloud environment if the system scales.

Suggested local setup:
- FastAPI backend running on localhost:8000
- React web app running on localhost:3000 or 5173
- Cloudflare Tunnel routes civx.xrnozy.me to the backend or reverse proxy
- Optional Nginx/Caddy reverse proxy locally
- Supabase and Firebase still used as managed free-tier services

Development Tools:
- GitHub
- VS Code
- Postman or Insomnia
- Python virtual environment
- npm
- Docker optional
- Cloudflare Tunnel
- FFmpeg installed locally

Include architecture diagram using text, like:

React Website / React Native App
        ↓
Firebase Auth
        ↓
FastAPI Backend via civx.xrnozy.me
        ↓
Supabase PostgreSQL + Supabase Storage
        ↓
AI Worker with YOLO + OpenCV/FFmpeg
        ↓
Google Maps frontend visualization

Important writing style:
- Use clear markdown headings.
- Make the documentation detailed but easy to understand.
- Make it sound professional and hackathon-ready.
- Do not create implementation code.
- Do not create files outside description/spec.md and techstack/techstack.md.