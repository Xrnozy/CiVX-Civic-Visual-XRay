# CiVX - Civic Visual X-Ray: AI-Powered Civic Intelligence and Community Response Platform

## 1. Project Overview

CiVX, short for Civic Visual X-Ray, is an industry-style civic intelligence and community response platform for detecting, reporting, organizing, and resolving visible city problems. It acts like an X-ray for the city: it helps reveal issues that are usually ignored, delayed, duplicated, or scattered across social media, group chats, phone calls, and paper-based reports.

The platform is designed for citizens, volunteers, community groups, street sweepers, public drivers, barangay workers, garbage collectors, police patrols, LGU staff, and other public service teams. It combines citizen reporting, passive video collection, AI-assisted issue detection, duplicate incident merging, cleanup event coordination, volunteer attendance tracking, EcoQuest micro-tasks, and LGU response management.

CiVX exists to help communities become smarter, safer, cleaner, and more inclusive by connecting local problems with the people and agencies who can fix them.

## 2. Problem Statement

Many communities suffer from visible civic problems such as garbage piles, potholes, broken roads, dirty rivers and canals, flooding, clogged drainage, broken sidewalks, illegal dumping, road obstructions, unsafe public spaces, broken streetlights, open manholes, and fallen trees.

Current reporting methods are often slow and difficult to manage. Reports may arrive through social media posts, private messages, calls, paper forms, or informal word of mouth. The same issue may be reported many times by different people, while other serious issues may never reach the right department. LGUs may struggle to verify reports, avoid duplicates, assign responsibility, track response time, coordinate volunteers, and show the public what has already been resolved.

The result is a gap between what the city experiences and what the city can efficiently respond to.

## 3. Proposed Solution

CiVX combines community reporting, civic maps, AI-assisted detection, and LGU operations into one coordinated platform.

The solution includes:

- Citizen photo reporting with GPS location.
- A mobile community map for nearby issues and cleanup events.
- A public community website map for transparency and participation.
- An LGU dashboard for verification, assignment, analytics, and response tracking.
- Passive video detection from street sweepers, public drivers, garbage trucks, barangay vehicles, LGU vehicles, and patrols.
- Duplicate incident merging using location, issue type, time, image similarity, road segment, status, and AI confidence.
- Cleanup event coordination for community groups and LGU-approved activities.
- Volunteer registration and service hour tracking.
- QR and GPS attendance tracking for cleanup events.
- EcoQuest, an LGU-sponsored community micro-task system.
- Incident status tracking from detection to resolution.

## 4. Core Concept

CiVX helps the city see what is broken, dirty, unsafe, or needs attention, then connects the community and LGU to fix it faster.

## 5. Main Modules

### A. Community Website

The Community Website is the public-facing transparency and participation portal. It shows a city map with visible community issues and cleanup events.

Features:

- Public Community Map.
- Map markers for garbage, potholes, broken roads, dirty canals and rivers, flooding, clogged drainage, broken sidewalks, broken streetlights, open manholes, illegal dumping areas, fallen trees, road obstructions, unsafe public areas, and cleanup events.
- Filters by issue type.
- Filters by status: pending, verified, assigned, ongoing, resolved.
- Cleanup event listings.
- Volunteer registration for cleanup drives.
- Before-and-after gallery.
- Community impact dashboard.
- Top barangays, top volunteers, and cleanup statistics.
- Public transparency page showing resolved reports and ongoing actions.

The Community Map should show both problems and solutions. It should not only show dirty or broken places; it should also show upcoming and approved cleanup events.

### B. LGU Website / Dashboard

The LGU Dashboard is for authorized government users. It gives LGU teams the operational tools needed to verify reports, assign departments, monitor volunteers, and track outcomes.

Features:

- LGU incident map.
- Incoming report queue.
- AI-assisted issue classification.
- Severity score.
- Duplicate report merging.
- Report verification.
- Department assignment.
- Dispatch system.
- Cleanup event approval.
- Volunteer monitoring.
- Attendance monitoring.
- EcoQuest task creation and verification.
- Incident status tracking.
- Analytics dashboard.
- Heatmap of problem areas.
- Reports by barangay.
- Response time tracking.
- Resolved issue history.

Incident status flow:

`Detected -> Pending Review -> Verified -> Assigned -> Ongoing -> Resolved -> Archived`

LGU cleanup event approval flow:

`Community group creates cleanup event -> LGU reviews -> LGU approves, rejects, or requests changes -> volunteers register -> attendance is tracked -> event is completed -> before/after proof is uploaded`

### C. Mobile App

The mobile app is used by citizens, volunteers, street sweepers, public drivers, and LGU field users. It also includes a simplified Community Map focused on nearby issues, nearby cleanup events, quick reporting, joining volunteer activities, and checking report status.

Features:

- Login and signup using Firebase Authentication.
- Citizen photo report.
- Auto GPS location.
- AI-assisted issue detection.
- Optional short description.
- Report status tracking.
- Mobile Community Map.
- View nearby garbage, potholes, broken roads, dirty canals, flooding, cleanup events, and other issues.
- Confirm or support an existing report instead of creating a duplicate.
- Join cleanup events.
- Volunteer registration.
- QR code attendance check-in.
- GPS-based attendance validation.
- Optional selfie check-in for volunteer verification.
- Volunteer history.
- Service hours tracking.
- EcoQuest task list.
- EcoQuest task verification using before photo, after photo, GPS, QR validation, and LGU approval.
- Passive street sweeper mode.
- Passive driver mode.

## 6. Issue Categories

CiVX should support these map and report categories:

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

## 7. Passive Detection System

Passive detection is designed for street sweepers, public drivers, garbage trucks, LGU vehicles, barangay vehicles, and police patrols. CiVX uses a segmented passive video ingestion pipeline so field users can capture civic issues during normal routes.

Passive video flow:

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

CiVX does not upload one huge long video and does not stream raw full video 24/7. It uses short video chunks to reduce bandwidth, battery usage, processing cost, and upload failure risk.

Offline behavior:

- If internet is weak, the mobile app stores video chunks locally.
- The app retries uploads when a stable connection becomes available.
- Route session metadata and GPS telemetry should remain linked to each chunk.

## 8. Driver Mode

Driver Mode uses the phone camera, GPS, accelerometer, and gyroscope to detect possible road problems while public drivers or LGU field workers move through the city.

Driver Mode can detect possible:

- Potholes
- Rough roads
- Uneven roads
- Broken road sections
- Speed bumps
- Road vibration hotspots

Flow:

`Phone detects sudden bump, drop, or wobble -> app marks timestamp -> relevant video chunk is uploaded -> backend checks frames around the event -> AI confirms if pothole or broken road exists -> report is created or merged`

## 9. Citizen Reporting Flow

Citizen reporting flow:

`Citizen opens app -> taps report -> takes photo -> app gets GPS -> AI suggests issue type -> user submits -> backend checks duplicate -> report becomes pending review -> appears on map and LGU dashboard`

The flow should be fast enough for casual public use while still producing structured data that LGUs can review.

## 10. Duplicate Report Merging

Many users may report the same pothole, garbage pile, clogged drainage, or unsafe area. CiVX should merge similar reports into one incident to prevent duplicate workload for LGU staff.

Duplicate detection should use:

- GPS distance
- Issue type
- Timestamp
- Image similarity
- Road segment
- Status
- AI confidence

Example:

If a pothole report already exists within 10 to 25 meters and is not resolved, the new report is merged into the same incident instead of creating a new one.

## 11. Volunteer and Cleanup Event System

CiVX supports community-led cleanup and response activities.

Features:

- Community groups can create cleanup events.
- Events appear on the community map.
- LGU can approve, reject, or request changes to events.
- Citizens can register as volunteers.
- Volunteers provide name, phone number, barangay or area, emergency contact, and agreement to safety guidelines.
- Face photo should not be required all the time.
- QR check-in, GPS check-in, and optional selfie check-in can be used during the event.
- Attendance can be verified using QR code, GPS location, organizer confirmation, before/after photos, and LGU validation.

## 12. Attendance Tracker

The attendance tracker should support:

- QR code check-in
- GPS location validation
- Check-in and check-out time
- Organizer verification
- LGU validation
- Volunteer hours calculation
- Attendance status: registered, checked-in, checked-out, verified, rejected
- Certificate or service hour record generation

## 13. EcoQuest

EcoQuest is an LGU-sponsored community micro-task system for small public service tasks.

Example tasks:

- Clean sidewalk
- Collect trash in assigned area
- Clean canal area
- Plant trees
- Remove posters
- Report verified illegal dumping
- Assist in cleanup drives

Verification can include:

- GPS check-in
- Before photo
- After photo
- QR validation
- Group leader approval
- LGU approval
- Optional valid ID only if rewards or money are involved

## 14. Data Models

### User

- id
- firebase_uid
- full_name
- phone_number
- email
- role
- barangay
- profile_photo_url
- created_at
- status

### Report

- id
- reporter_user_id
- issue_type
- description
- latitude
- longitude
- address_text
- photo_url
- ai_suggested_type
- ai_confidence
- status
- created_at
- merged_incident_id

### Incident

- id
- primary_issue_type
- severity_score
- latitude
- longitude
- barangay
- status
- report_count
- source
- assigned_department_id
- created_at
- verified_at
- resolved_at

### CleanupEvent

- id
- organizer_user_id
- title
- description
- issue_or_incident_id
- latitude
- longitude
- barangay
- scheduled_start
- scheduled_end
- approval_status
- max_volunteers
- before_photo_url
- after_photo_url

### VolunteerRegistration

- id
- event_id
- user_id
- full_name
- phone_number
- barangay
- emergency_contact
- safety_agreement
- registration_status
- created_at

### AttendanceRecord

- id
- event_id
- user_id
- check_in_time
- check_out_time
- check_in_latitude
- check_in_longitude
- qr_code_id
- selfie_url
- organizer_status
- lgu_status
- calculated_hours

### EcoQuestTask

- id
- title
- description
- sponsor_department_id
- task_type
- latitude
- longitude
- barangay
- required_proof
- reward_type
- status
- created_at

### PassiveRouteSession

- id
- user_id
- mode
- started_at
- ended_at
- route_status
- device_id
- total_chunks

### VideoChunk

- id
- route_session_id
- storage_url
- chunk_index
- start_time
- end_time
- upload_status
- processing_status
- gps_trace_json

### DetectionResult

- id
- video_chunk_id
- detected_issue_type
- confidence
- severity_score
- bounding_box_json
- frame_timestamp
- matched_latitude
- matched_longitude
- incident_id

### DepartmentAssignment

- id
- incident_id
- department_id
- assigned_by_user_id
- assigned_to_user_id
- status
- notes
- assigned_at
- completed_at

## 15. MVP Scope

The hackathon MVP should include:

- Community map on website.
- Mobile community map.
- Citizen photo report with GPS.
- AI-assisted classification demo.
- Duplicate report merging.
- LGU dashboard incident list and map.
- Cleanup event creation.
- Volunteer registration.
- QR attendance tracker.
- Passive video chunking demo using 10-second videos.
- Status tracking.

## 16. Demo Flow

Hackathon demo story:

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

## 17. Security and Privacy

CiVX should include:

- Firebase Authentication.
- Role-based access control.
- User roles: citizen, volunteer, organizer, LGU admin, LGU staff, field worker, driver, street sweeper.
- Public map does not expose private user data.
- Sensitive images and videos are visible only to authorized LGU users.
- Faces and plate numbers should be blurred or hidden when shown publicly.
- Full volunteer personal info should only be visible to event organizers and LGU admins.
- Audit logs for LGU actions.
- Basic upload validation.
- Rate limiting.
- Report abuse prevention.

## 18. Final Pitch

CiVX helps the city see what is broken, dirty, or unsafe and connects citizens, volunteers, and LGUs to fix problems faster.

CiVX is not just a reporting app. It is a civic intelligence platform that uses citizen reports, passive video ingestion, GPS telemetry, duplicate incident merging, volunteer coordination, and LGU workflow management to improve public services and community response.
