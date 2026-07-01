# CivX Passive Incident Detection Pipeline Spec

## Project Goal

CivX will support passive automated public-issue reporting. The system should receive short video clips or extracted frames from public-worker/mobile clients, analyze them locally using computer vision, and automatically create incident reports for civic issues such as garbage, potholes, and road/public-area hazards.

This feature is focused only on the backend AI pipeline and report automation. Do not build a new mobile app. Do not redesign the whole system. Integrate this into the current CivX backend and existing report system.

## Main Use Case

A user/public worker moves through public places while the app passively collects short clips. The backend analyzes the clips and automatically creates a report if it detects issues like:

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

For the MVP, prioritize:

- Pothole
- Road crack
- Garbage pile
- Scattered trash
- Overflowing trash bin
- Clogged drainage
- Flooding
- Road obstruction

## Non-Goals

The implementation must not:

- Create a new mobile app
- Replace the existing report system
- Require paid cloud GPU services
- Send every frame directly to LocateAnything
- Analyze full videos frame-by-frame without filtering
- Block the upload request while AI processing is running
- Create duplicate reports for the same issue and location

## Current System Assumptions

The existing system uses:

- FastAPI backend
- Supabase/Postgres for database
- Firebase authentication
- Google Maps dashboard
- Local PC hosting through Cloudflare Tunnel
- Local GPU machine with RTX 5060 Ti 16GB
- Existing report creation flow/API

This feature should be added as a backend pipeline.

## Recommended Local Stack

Use free/local infrastructure:

- FastAPI for API routes
- Redis Streams for job queues
- Local filesystem for video/frame storage
- YOLO for fast detection
- LocateAnything only for uncertain verification
- Supabase/Postgres for incident/report storage
- Background workers for CPU and GPU processing

## High-Level Flow

```text
Client uploads 10-second clip
→ Backend saves clip locally
→ Backend creates Redis queue job
→ CPU prefilter worker extracts useful frames
→ YOLO GPU worker runs batch detection
→ Confidence router decides what happens next
→ High-confidence detections become report candidates
→ Medium-confidence detections go to LocateAnything
→ Low-confidence detections are discarded or sent to review
→ Deduplication merges duplicate reports
→ Final incident is saved in database
→ Dashboard displays the incident on the map

## Anti-Fake and Abuse Prevention

The system must not trust a single uploaded image or clip as final proof. Every passive report must pass authenticity and trust checks before being auto-created.

### Evidence Trust Levels

Evidence should have trust levels:

1. Trusted Passive Evidence
   - Captured from in-app passive camera flow
   - Has GPS, timestamp, device_id, and session_id
   - Contains multiple frames
   - Has realistic motion/frame continuity
   - Passes duplicate and replay checks

2. Semi-Trusted Evidence
   - Uploaded through the app but has weak metadata
   - GPS or timestamp is missing
   - Only one frame is usable
   - Needs AI verification and possible manual review

3. Untrusted Evidence
   - Gallery upload
   - Screenshot
   - Edited image
   - Duplicate/replayed clip
   - Suspicious GPS/time mismatch
   - Must not create auto-report directly

Queue Design

Use Redis Streams.

Required streams:

clip_jobs
yolo_jobs
locate_jobs
incident_candidates
review_jobs
failed_jobs
clip_jobs

Stores uploaded video jobs waiting for prefiltering.

Example payload:

{
  "job_id": "uuid",
  "video_path": "storage/clips/job_id.mp4",
  "lat": "14.5500",
  "lng": "121.0300",
  "device_id": "device_123",
  "user_id": "firebase_uid",
  "created_at": "timestamp"
}
yolo_jobs

Stores extracted frame jobs waiting for YOLO.

Example payload:

{
  "job_id": "uuid",
  "frame_path": "storage/frames/job_id_120.jpg",
  "frame_index": "120",
  "lat": "14.5500",
  "lng": "121.0300",
  "device_id": "device_123",
  "user_id": "firebase_uid"
}
locate_jobs

Stores uncertain detections that need LocateAnything verification.

Example payload:

{
  "job_id": "uuid",
  "frame_path": "storage/frames/job_id_120.jpg",
  "yolo_label": "dirty_canal",
  "yolo_confidence": "0.67",
  "lat": "14.5500",
  "lng": "121.0300",
  "user_id": "firebase_uid"
}
incident_candidates

Stores likely reports before deduplication.

Example payload:

{
  "job_id": "uuid",
  "frame_path": "storage/frames/job_id_120.jpg",
  "category": "pothole",
  "confidence": "0.91",
  "source": "yolo",
  "lat": "14.5500",
  "lng": "121.0300",
  "user_id": "firebase_uid"
}
Backend API Routes

Add these routes to the existing FastAPI backend.

POST /api/passive/upload

Receives a passive video clip.

Request:

video: uploaded video file
lat: latitude
lng: longitude
device_id: device identifier
timestamp: optional client timestamp

Behavior:

Validate the file type.
Save the video to local storage.
Create a clip_jobs Redis job.
Immediately return job_id.
Do not run AI directly inside the request.

Response:

{
  "ok": true,
  "job_id": "uuid",
  "message": "Clip queued for analysis"
}
GET /api/passive/job/{job_id}

Returns processing status.

Possible statuses:

queued
prefiltering
yolo_processing
locate_verifying
candidate_created
report_created
discarded
failed
GET /api/system/queue-status

Returns queue length and processing mode.

Example response:

{
  "clip_jobs": 35,
  "yolo_jobs": 420,
  "locate_jobs": 24,
  "incident_candidates": 12,
  "mode": "normal"
}
Worker Design

Use separate worker scripts or background services.

Required workers:

prefilter_worker.py
yolo_worker.py
locate_worker.py
incident_worker.py
Prefilter Worker

The prefilter worker is CPU-based.

Responsibilities:

Read from clip_jobs.
Open the video.
Extract useful frames only.
Skip blurry frames.
Skip nearly duplicate frames.
Sample fewer frames when the queue is overloaded.
Push selected frames into yolo_jobs.

Do not extract every frame.

Recommended sampling:

Low backlog: 2 FPS
Medium backlog: 1 FPS
High backlog: 0.5 FPS

Blur detection:

Use variance of Laplacian.
Skip frames below blur threshold.

Duplicate detection:

Compare frame difference or perceptual hash.
Skip frames that are visually almost the same as the previous selected frame.
YOLO Worker

The YOLO worker is GPU-based.

Responsibilities:

Read frames from yolo_jobs.
Batch frames together.
Run YOLO detection.
Merge outputs from multiple YOLO models if available.
Route detections based on confidence.
Acknowledge successful jobs.

Recommended setup:

1 GPU worker only
Batch size: 16 to 64 frames
Image size: 640
FP16 inference enabled

Do not create multiple GPU workers for the same GPU. Instead, use one worker that batches frames.

YOLO Model Strategy

Use YOLO as the main detector.

Recommended model groups:

Road Damage Model:
- pothole
- road crack
- broken road
- uneven road
- broken sidewalk
- open manhole

Waste/Cleanliness Model:
- garbage pile
- scattered trash
- overflowing trash bin
- illegal dumping
- dirty canal
- clogged drainage

Safety/Obstruction Model:
- flooding
- fallen tree
- road obstruction
- damaged traffic sign
- broken streetlight
- unsafe public area

For MVP, one YOLO model is acceptable if it only detects:

pothole
road crack
garbage
trash
overflowing bin
flooding
road obstruction
Confidence Router

The confidence router decides whether to auto-report, verify, review, or discard.

Rules:

If YOLO confidence >= 0.85
AND same issue appears in at least 2 frames from the same clip:
    Create incident candidate

If YOLO confidence is between 0.50 and 0.85:
    Send to LocateAnything for verification

If YOLO confidence < 0.50:
    Discard unless issue is high-risk or repeatedly seen

High-risk categories:

open manhole
fallen tree
road obstruction
flooding
damaged traffic sign
unsafe public area

High-risk issues may be sent to review even with lower confidence.

LocateAnything Verification

LocateAnything must not be used on every frame.

Use it only for:

Medium-confidence YOLO detections
Context-heavy categories
Dirty canal
Clogged drainage
Illegal dumping
Broken streetlight
Unsafe public area

Recommended prompts for LocateAnything:

trash floating in canal
drainage canal blocked by garbage
dirty stagnant canal water
garbage pile on public road
overflowing trash bin
large pothole on road
road crack
fallen tree blocking road
open manhole on street
damaged traffic sign

If LocateAnything confirms the visual issue, create an incident_candidate.

If it is unsure, send the item to review_jobs.

Dynamic Queue Behavior

The system must adjust automatically depending on backlog.

Processing modes:

Normal Mode

Condition:

yolo_jobs < 500
locate_jobs < 100

Behavior:

Sample 2 FPS
Allow LocateAnything verification
YOLO batch size 16-32
Medium confidence range: 0.50 to 0.85
Busy Mode

Condition:

yolo_jobs >= 500
or locate_jobs >= 100

Behavior:

Sample 1 FPS
Allow LocateAnything only for important categories
YOLO batch size 32
Medium confidence range: 0.60 to 0.90
Overloaded Mode

Condition:

yolo_jobs >= 2000
or locate_jobs >= 300

Behavior:

Sample 0.5 FPS
Disable LocateAnything for low-priority issues
Only auto-report high-confidence YOLO detections
Send risky unclear issues to review
Drop duplicate/low-quality frames aggressively
Deduplication

Before creating a report, check if a similar incident already exists.

Duplicate rule:

Same category
Within 20 to 50 meters
Seen within recent time window
Status is still pending/open

If duplicate is found:

Do not create a new report.
Add the new frame as evidence.
Increase evidence count.
Update last seen timestamp.
Optionally increase confidence score.

If no duplicate exists:

Create a new incident report.
Suggested Database Fields

Add or reuse these fields in the existing report table.

id
category
description
lat
lng
status
confidence
source
evidence_image_url
evidence_count
first_seen_at
last_seen_at
device_id
created_by
is_auto_generated
verification_status
raw_ai_result

Suggested values:

source:
- yolo
- locate_anything
- manual_review

verification_status:
- auto_confirmed
- ai_verified
- needs_review
- rejected
Report Creation Behavior

Auto-generated reports should look like normal reports but include AI metadata.

Example generated report:

{
  "category": "pothole",
  "description": "Possible pothole detected from passive video collection. Detected in multiple frames with high confidence.",
  "lat": 14.5500,
  "lng": 121.0300,
  "confidence": 0.91,
  "source": "yolo",
  "is_auto_generated": true,
  "verification_status": "auto_confirmed",
  "evidence_count": 3
}
Error Handling

If a worker fails:

Retry job up to 3 times.
Move failed item to failed_jobs.
Store error message.
Do not crash the whole pipeline.
Performance Rules

The system must follow these rules:

Queue videos, not AI requests.
Batch frames, not clips.
Use YOLO as the main detector.
Use LocateAnything rarely.
Skip bad frames before GPU inference.
Deduplicate before saving reports.
Do not block upload requests.
Use dynamic sampling during high load.
Expected MVP Output

After implementation, the current system should support:

Uploading passive clips to the backend.
Queueing clips asynchronously.
Extracting useful frames.
Running YOLO on frames.
Routing uncertain detections to LocateAnything.
Creating auto-generated reports.
Merging duplicate incidents.
Showing reports in the existing dashboard/map.
Monitoring queue load.
Success Criteria

The implementation is successful if:

Upload requests return immediately.
Video clips are processed in the background.
YOLO runs in batches.
LocateAnything is not called for every frame.
The system creates reports only when confidence is strong.
Duplicate reports are merged.
Queue length can be monitored.
The app still works even when many clips are uploaded.


