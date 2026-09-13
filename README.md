# Fagla AI Editor

Arabic-first AI video editor MVP.

## Current architecture

- Frontend: HTML, CSS, JavaScript
- Backend: Node.js + Express
- Uploads: Multer
- Media processing: FFmpeg via `ffmpeg-static`
- First pipeline stage: video upload → WAV 16 kHz mono extraction

## Run locally

```bash
npm install
npm start
```

Then open `http://localhost:3000`.

Health check:

```text
GET /api/health
```

Upload endpoint:

```text
POST /api/upload
Content-Type: multipart/form-data
field: video
```

The upload endpoint stores the source video locally, extracts a 16 kHz mono PCM WAV file, and returns a job object containing the paths needed by the next pipeline stages.

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
