# CiVX Agent Plan

## 1. Purpose

This document defines the planned AI and workflow agents for CiVX. The agents are not separate chatbots by default; they are backend services or intelligent modules that help classify reports, merge duplicates, process passive video, support LGU review, and coordinate community action.

The recommended approach is to use deterministic backend logic for civic workflows and AI/ML only where it adds real value: computer vision, similarity matching, severity scoring, triage suggestions, and summarization.

## 2. Recommended AI/ML Choices

Use these AI/ML components for the project:

- YOLO object detection for civic issue detection from photos and extracted video frames.
- OpenCV and FFmpeg for frame extraction, preprocessing, and video chunk analysis.
- PostGIS geospatial scoring for nearby incident search and duplicate merging.
- Optional CLIP or image embeddings later for visual similarity between reports.
- Optional lightweight LLM later for LGU report summaries, not for final decisions.

For the hackathon MVP, the strongest choice is YOLO plus rule-based geospatial duplicate merging. It is practical, demo-friendly, and easy to explain.

## 3. Core Agents

### A. Report Intake Agent

Responsibilities:

- Receive citizen photo reports.
- Validate required fields such as image, GPS, issue category, and reporter identity.
- Ask the AI Detection Agent for issue suggestions.
- Send candidate duplicate checks to the Incident Intelligence Agent.
- Create a new report record and link it to an incident.

Inputs:

- User ID
- Photo
- GPS location
- Optional description
- Optional user-selected issue type

Outputs:

- Report record
- Suggested issue type
- Pending or merged incident state

### B. AI Detection Agent

Responsibilities:

- Process uploaded images and extracted video frames.
- Detect civic issues using YOLO.
- Return issue type, confidence, bounding box, severity, and timestamp.
- Store detection results for LGU review and future model improvement.

Inputs:

- Image file
- Extracted video frame
- Optional video frame timestamp

Outputs:

- Detected issue type
- Confidence score
- Bounding box
- Severity score
- Frame timestamp

### C. Incident Intelligence Agent

Responsibilities:

- Decide whether a new report or detection should create a new incident or merge into an existing one.
- Score possible duplicates using GPS distance, issue type, timestamp, image similarity, road segment, status, and AI confidence.
- Keep unresolved issues grouped under one incident.

Inputs:

- Report or detection result
- GPS location
- Issue type
- AI confidence
- Existing nearby incidents

Outputs:

- New incident recommendation
- Merge recommendation
- Duplicate confidence score
- Linked incident ID

### D. Passive Video Processing Agent

Responsibilities:

- Receive 10-second uploaded video chunks.
- Extract frames with FFmpeg/OpenCV.
- Send frames to the AI Detection Agent.
- Match detected frame timestamps with GPS telemetry.
- Send confirmed detections to the Incident Intelligence Agent.

Inputs:

- Video chunk
- Route session ID
- GPS telemetry
- Chunk start and end timestamps

Outputs:

- Detection results
- Matched GPS points
- New or merged incidents
- Processing status

### E. Driver Road Signal Agent

Responsibilities:

- Analyze accelerometer and gyroscope events from Driver Mode.
- Identify sudden bump, drop, wobble, or road vibration hotspots.
- Request frame checks around the event timestamp.
- Suggest possible pothole, uneven road, road crack, or broken road section.

Inputs:

- Sensor event
- GPS point
- Video chunk reference
- Timestamp

Outputs:

- Road anomaly event
- Candidate road issue
- AI confirmation request

### F. LGU Triage Agent

Responsibilities:

- Prioritize incoming incidents for LGU review.
- Suggest department assignment.
- Highlight high-severity or repeated reports.
- Provide response-time and status recommendations.

Inputs:

- Incident details
- Severity score
- Issue type
- Barangay
- Report count
- Status history

Outputs:

- Triage priority
- Suggested department
- Review notes
- Suggested next action

### G. Cleanup Coordination Agent

Responsibilities:

- Help match incidents with cleanup event proposals.
- Flag events that need LGU approval.
- Track volunteer registration and attendance summary.
- Connect before/after proof to related incidents.

Inputs:

- Cleanup event proposal
- Incident location
- Volunteer registrations
- Attendance records
- Proof photos

Outputs:

- Approval review package
- Attendance summary
- Completion recommendation

### H. EcoQuest Verification Agent

Responsibilities:

- Verify EcoQuest task submissions.
- Check before/after photos, GPS, QR validation, and approval chain.
- Recommend approval, rejection, or manual review.

Inputs:

- Task submission
- Before photo
- After photo
- GPS check-in
- QR validation
- Organizer approval

Outputs:

- Verification status recommendation
- Reason for review
- Service hour or reward eligibility flag

## 4. Human-in-the-Loop Rules

AI should assist, not replace LGU authority.

- AI can suggest issue type, severity, duplicate match, and department assignment.
- LGU users should confirm verification, assignment, rejection, and final resolution.
- Public map data should avoid exposing private reporter or volunteer details.
- AI confidence should be visible to LGU reviewers.
- Low-confidence detections should stay in manual review.

## 5. MVP Agent Scope

Build or simulate these first:

- Report Intake Agent.
- AI Detection Agent using YOLO demo inference.
- Incident Intelligence Agent using GPS radius, issue type, status, and confidence.
- Passive Video Processing Agent using 10-second video chunks.
- LGU Triage Agent with simple severity and department rules.

Defer these until after the MVP:

- CLIP/image embedding duplicate matching.
- LLM-generated summaries.
- Advanced EcoQuest fraud detection.
- Automated public-facing privacy blurring.
- Full production model retraining pipeline.
