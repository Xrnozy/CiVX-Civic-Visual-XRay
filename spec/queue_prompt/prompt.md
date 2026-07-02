You are helping me implement a backend feature into my existing CivX system.

CivX is a civic issue reporting system for public workers. The app already has a backend and report system. I do not want you to create a new mobile app, redesign the frontend, or replace my current project. I only want you to implement the backend flow for passive automated reporting using queued video/image analysis.

The feature is called Passive Incident Detection.

Goal:
Implement a backend pipeline where short passive video clips are uploaded, checked for authenticity/trust, queued, filtered, analyzed by YOLO, optionally verified by LocateAnything, deduplicated, and then converted into automatic incident reports for public issues such as garbage, trash, potholes, road cracks, flooding, clogged drainage, and road obstruction.

Current assumed stack:
- FastAPI backend
- Supabase/Postgres database
- Existing report creation API/table
- Firebase authentication may already exist
- Google Maps dashboard already exists
- Local PC hosting through Cloudflare Tunnel
- Local GPU machine with RTX 5060 Ti 16GB
- No paid subscription services
- Use Redis locally for queueing
- Use local filesystem for storing uploaded clips and extracted frames

Do not create:
- A new mobile app
- A new full dashboard
- A new unrelated architecture
- A paid cloud setup
- A fake AI implementation that runs inside the upload request
- A system that trusts one image/video immediately

Important architecture:
The upload endpoint must only save the clip, create authenticity metadata, and enqueue a job. It must return immediately. AI processing must happen in background workers.

Main flow:

1. Client starts a passive capture session.
2. Backend creates a `session_id` and server-generated `nonce`.
3. Client records a short passive clip.
4. Client uploads the clip with GPS, timestamp, device_id, session_id, and nonce.
5. Backend saves the video locally.
6. Backend calculates file hash and initial trust metadata.
7. Backend pushes a job to Redis Stream `clip_jobs`.
8. CPU prefilter worker reads from `clip_jobs`.
9. Prefilter worker extracts only useful frames.
10. It skips blurry frames, static frames, and near-duplicates.
11. Selected frames are pushed to Redis Stream `yolo_jobs`.
12. A single GPU YOLO worker reads frames from `yolo_jobs` in batches.
13. YOLO detects issues such as pothole, road crack, garbage, trash, overflowing bin, flooding, and road obstruction.
14. Confidence + trust router decides:
    - High AI confidence + high evidence trust: create incident candidate.
    - High AI confidence + medium evidence trust: create pending candidate or review item.
    - Medium AI confidence + high evidence trust: send to LocateAnything.
    - Medium AI confidence + low evidence trust: send to manual review.
    - Low AI confidence + low evidence trust: discard.
15. LocateAnything worker only processes `locate_jobs`, not all frames.
16. Confirmed detections become incident candidates.
17. Incident worker deduplicates candidates.
18. If a similar report exists nearby, merge evidence into the existing report.
19. If no duplicate exists, create a new auto-generated report in the existing database/report system.

Use these Redis Streams:

- `clip_jobs`
- `yolo_jobs`
- `locate_jobs`
- `incident_candidates`
- `review_jobs`
- `failed_jobs`

Add or implement these backend files depending on the current project structure:

- passive upload router
- passive session router
- queue helper/service
- trust/authenticity service
- prefilter worker
- YOLO worker
- LocateAnything worker
- incident candidate/dedup worker
- AI result parser
- config file for thresholds, queue limits, and trust settings

Do not hardcode everything in one giant file. Keep it clean and modular.

Required API endpoints:

1. `POST /api/passive/session/start`

Creates a short-lived passive capture session.

Request:
- device_id
- optional user_id if available

Behavior:
- Generate `session_id`
- Generate secure random `nonce`
- Store session with expiration time
- Return session data to the client

Response:
{
  "ok": true,
  "session_id": "...",
  "nonce": "...",
  "expires_at": "..."
}

2. `POST /api/passive/upload`

Receives:
- video file
- lat
- lng
- gps_accuracy if available
- device_id
- session_id
- nonce
- client_timestamp
- capture_mode

Behavior:
- Validate input
- Verify session_id and nonce
- Save video to `storage/clips`
- Calculate SHA256 hash
- Store authenticity metadata
- Create a job id
- Push metadata to Redis Stream `clip_jobs`
- Return immediately

Response:
{
  "ok": true,
  "job_id": "...",
  "message": "Clip queued for analysis"
}

3. `GET /api/passive/job/{job_id}`

Returns job status if implemented.

Possible statuses:
- queued
- trust_checking
- prefiltering
- yolo_processing
- locate_verifying
- candidate_created
- report_created
- needs_review
- discarded
- failed

4. `GET /api/system/queue-status`

Returns queue lengths:
- clip_jobs
- yolo_jobs
- locate_jobs
- incident_candidates
- review_jobs
- failed_jobs

Also return processing mode:
- normal
- busy
- overloaded

Dynamic processing rules:

Normal mode:
- yolo_jobs < 500
- locate_jobs < 100
- sample 2 FPS
- allow LocateAnything
- YOLO batch size 16-32

Busy mode:
- yolo_jobs >= 500 or locate_jobs >= 100
- sample 1 FPS
- LocateAnything only for important categories
- YOLO batch size 32

Overloaded mode:
- yolo_jobs >= 2000 or locate_jobs >= 300
- sample 0.5 FPS
- disable LocateAnything for low-priority issues
- only process high-confidence or high-risk detections
- aggressively skip duplicates

Anti-fake and evidence trust system:

Do not trust a single uploaded image or clip as final proof. Every passive report must pass authenticity and trust checks before being auto-created.

Evidence trust levels:

1. Trusted Passive Evidence
- Captured from in-app passive camera flow
- Has valid session_id and nonce
- Has GPS, timestamp, device_id, and session_id
- Contains multiple usable frames
- Has realistic frame continuity
- Passes duplicate and replay checks

2. Semi-Trusted Evidence
- Uploaded through the app but has weak metadata
- GPS or timestamp is missing or inaccurate
- Only one usable frame
- Session metadata is incomplete
- Needs AI verification or manual review

3. Untrusted Evidence
- Gallery upload
- Screenshot
- Edited image
- Duplicate or replayed clip
- Suspicious GPS/time mismatch
- Must not create auto-report directly

Capture mode rules:

Auto-report is only allowed for:
- passive_camera
- in_app_camera

Auto-report is not allowed for:
- gallery_upload
- screenshot
- unknown_source

Gallery uploads and screenshots may still be stored as evidence, but their verification_status must be `needs_review`.

Trust checks to implement:

1. Session validation
- Check if session_id exists.
- Check if nonce matches.
- Check if session is not expired.
- If session is invalid, mark evidence as suspicious.

2. File hash check
- Calculate SHA256 hash of uploaded clip.
- Store hash.
- If same hash already exists, mark as duplicate/replay.

3. Perceptual similarity check
- Generate perceptual hash for extracted frames if possible.
- Detect visually similar repeated uploads.
- If highly similar to existing evidence, merge or mark duplicate.

4. GPS and timestamp consistency
- Check if GPS exists.
- Check GPS accuracy if provided.
- Check if client timestamp is too old.
- Check if device location jump is impossible.
- If device appears to move unrealistically fast, mark suspicious.

5. Multi-frame requirement
- Auto-report only if the issue appears in 2 or more frames from the same clip.
- If only one frame contains the issue, route to review unless the issue is high-risk.

6. Device/user trust score
- New or unknown devices start with lower trust.
- Verified public-worker accounts have higher trust.
- Devices with many accepted reports increase trust over time.
- Devices with rejected/fake reports decrease trust over time.

Suggested suspicion flags:
- gallery_upload
- screenshot_upload
- invalid_session
- expired_session
- nonce_mismatch
- missing_gps
- inaccurate_gps
- old_timestamp
- duplicate_hash
- perceptual_duplicate
- impossible_travel_speed
- single_frame_only
- low_device_trust
- edited_media_suspected

Trust scoring example:

Start with trust_score = 1.0.

Subtract:
- invalid session: -0.40
- missing GPS: -0.25
- old timestamp: -0.20
- duplicate hash: -0.50
- perceptual duplicate: -0.35
- gallery upload: -0.50
- single usable frame only: -0.20
- low device trust: -0.20
- impossible travel speed: -0.40

Clamp trust_score between 0.0 and 1.0.

Suggested routing:
- trust_score >= 0.75: trusted
- trust_score 0.45 to 0.74: semi_trusted
- trust_score < 0.45: untrusted

Confidence + trust router:

High confidence:
- YOLO confidence >= 0.85
- Same issue appears in 2 or more frames
- Trust score >= 0.75
- Create incident candidate

High confidence but medium trust:
- YOLO confidence >= 0.85
- Trust score between 0.45 and 0.74
- Create pending candidate or send to review

Medium confidence:
- YOLO confidence between 0.50 and 0.85
- If trust score >= 0.75 and locate queue is not overloaded, send to LocateAnything
- If trust score < 0.75, send to review

Low confidence:
- YOLO confidence < 0.50
- Discard unless category is high-risk

High-risk categories:
- open manhole
- fallen tree
- road obstruction
- flooding
- damaged traffic sign
- unsafe public area

For high-risk categories:
- If AI confidence is high but trust is medium, create urgent_unverified candidate.
- If confirmed by another device or reviewed by staff, upgrade to verified.
- Do not fully auto-confirm serious reports from one low-trust source.

MVP categories:
- pothole
- road crack
- garbage pile
- scattered trash
- overflowing trash bin
- flooding
- clogged drainage
- road obstruction

LocateAnything should be used only as a verifier for unclear cases, especially:
- dirty canal
- clogged drainage
- illegal dumping
- broken streetlight
- unsafe public area
- unclear garbage/trash issue
- unclear road damage issue

Use these LocateAnything prompt examples:
- trash floating in canal
- drainage canal blocked by garbage
- dirty stagnant canal water
- garbage pile on public road
- scattered trash on sidewalk
- overflowing trash bin
- large pothole on road
- road crack
- fallen tree blocking road
- road obstruction
- damaged traffic sign
- open manhole on street

Deduplication rule:

Before creating a new report, check if there is an existing open/pending report with:
- same or similar category
- within 20 to 50 meters
- recently seen
- not fixed/resolved

If duplicate exists:
- Do not create a new report.
- Add evidence image/frame.
- Increase evidence_count.
- Update last_seen_at.
- Optionally update confidence.
- If confirmation comes from a different trusted device, increase verification strength.

If no duplicate exists:
- Create a new report using the existing report system/table.

Suggested database/report fields to add or map:

Reports:
- id
- category
- description
- lat
- lng
- status
- confidence
- source
- evidence_image_url
- evidence_count
- first_seen_at
- last_seen_at
- device_id
- created_by
- is_auto_generated
- verification_status
- raw_ai_result
- trust_score

Evidence:
- id
- report_id
- job_id
- evidence_type
- capture_mode
- session_id
- device_id
- user_id
- file_path
- frame_path
- sha256_hash
- perceptual_hash
- lat
- lng
- gps_accuracy
- client_timestamp
- server_received_at
- ai_label
- ai_confidence
- trust_score
- suspicion_flags
- is_gallery_upload
- is_replay_suspected
- verification_status
- raw_ai_result

Suggested values:

source:
- yolo
- locate_anything
- manual_review

verification_status:
- auto_confirmed
- ai_verified
- needs_review
- urgent_unverified
- rejected

capture_mode:
- passive_camera
- in_app_camera
- gallery_upload
- screenshot
- unknown_source

Important performance requirements:
- Do not process full video frame-by-frame.
- Do not run YOLO directly inside the upload route.
- Do not call LocateAnything for every frame.
- Use batch inference for YOLO.
- Use one GPU worker for one GPU.
- Use many CPU workers if needed.
- Queue metadata only, not entire video bytes.
- Save files locally and pass file paths through the queue.
- Retry failed jobs up to 3 times.
- Move failed jobs to `failed_jobs`.
- Do not auto-report from a single untrusted image.
- Do not auto-confirm duplicate/replayed media.

Implementation style:
- Inspect my existing backend structure first.
- Reuse existing report creation logic if available.
- Keep changes minimal and compatible with the current app.
- Add clear config variables for thresholds.
- Add basic logging.
- Make workers runnable from terminal.
- Add comments only where needed.
- Do not remove existing features.

Expected result:
After implementation, my current CivX backend should be able to receive passive clips, validate authenticity metadata, queue them, process them asynchronously, detect garbage/pothole-related issues, verify uncertain cases, prevent fake/replayed evidence, deduplicate incidents, and create automatic reports that can appear on my existing map/dashboard.

Core principle:
Image/video uploaded does not automatically mean report created.

The correct flow is:
uploaded media
→ evidence
→ trust check
→ AI detection
→ confidence + trust routing
→ deduplication
→ report candidate
→ verified or pending report