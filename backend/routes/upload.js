import { Router } from 'express';
import multer from 'multer';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { extractWav16k } from '../services/media.js';

const router = Router();
const uploadDir = path.resolve('storage/uploads');
const audioDir = path.resolve('storage/audio');

await mkdir(uploadDir, { recursive: true });
await mkdir(audioDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase() || '.mp4';
    cb(null, `${crypto.randomUUID()}${ext}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 500 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith('video/')) return cb(null, true);
    cb(new Error('Only video files are allowed'));
  }
});

router.post('/upload', upload.single('video'), async (req, res, next) => {
  if (!req.file) return res.status(400).json({ error: 'No video file uploaded' });

  const audioPath = path.join(audioDir, `${path.parse(req.file.filename).name}.wav`);

  try {
    await extractWav16k(req.file.path, audioPath);

    res.status(201).json({
      ok: true,
      job: {
        id: path.parse(req.file.filename).name,
        originalName: req.file.originalname,
        videoPath: req.file.path,
        audioPath,
        audio: {
          format: 'wav',
          sampleRate: 16000,
          channels: 1,
          codec: 'pcm_s16le'
        },
        next: 'whisper'
      }
    });
  } catch (error) {
    next(error);
  }
});

export default router;
