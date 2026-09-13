# Fagla AI Editor

Arabic-first AI video editor MVP.

## Current architecture

- Frontend: HTML, CSS, JavaScript
- Backend: Node.js + Express
- Uploads: Multer
- Media processing: FFmpeg via `ffmpeg-static`
- First pipeline stage: video upload → WAV 16 kHz mono extraction

## Run locally

Run these commands from the repository root, not from `backend/`:

```bash
npm install
npm start
```

Then open `http://localhost:3000`.

### 1. Health check

```bash
curl -i http://localhost:3000/api/health
```

Expected response: HTTP 200 with JSON containing `"ok": true`.

### 2. Upload test

From the repository root, with a small test video available:

```bash
curl -i -X POST -F "video=@test.mp4" http://localhost:3000/api/upload
```

A successful response is HTTP 201 and includes a job ID plus WAV metadata:

- WAV
- 16,000 Hz
- mono
- PCM signed 16-bit

The generated files are kept under `storage/uploads/` and `storage/audio/` locally. They are ignored by Git.

### 3. Browser end-to-end test

Open the app through `http://localhost:3000`, upload a small real video, and press **ابدأ AI Auto Edit**.

The UI now calls `/api/upload`, so this test verifies the actual browser → backend → FFmpeg audio extraction path. The current UI stops after successful audio preparation; Whisper and silence detection are intentionally not connected yet.

## CORS

The frontend is served by the same Express server and calls `/api/upload` with a relative URL. Therefore CORS middleware is not required for the current architecture. If the frontend is later hosted on another origin or port, add an explicit CORS policy at that point.

## Pipeline roadmap

1. Upload video
2. Extract audio
3. Arabic Whisper transcription with timestamps
4. FFmpeg `silencedetect`
5. Merge speech + silence into an Edit Decision List (EDL)
6. Apply cuts with FFmpeg
7. Export final MP4
8. Add Arabic captions, smart reframe, subject tracking, and background removal

> The current release does **not** claim Whisper, silence removal, or AI background removal are implemented yet. Those are the next pipeline stages.
