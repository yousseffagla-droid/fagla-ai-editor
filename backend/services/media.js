import { spawn } from 'node:child_process';
import { mkdir, unlink } from 'node:fs/promises';
import path from 'node:path';
import ffmpegPath from 'ffmpeg-static';

export async function extractWav16k(inputPath, outputPath) {
  await mkdir(path.dirname(outputPath), { recursive: true });

  await new Promise((resolve, reject) => {
    const args = [
      '-hide_banner',
      '-loglevel', 'error',
      '-y',
      '-i', inputPath,
      '-vn',
      '-ac', '1',
      '-ar', '16000',
      '-c:a', 'pcm_s16le',
      outputPath
    ];

    const child = spawn(ffmpegPath, args);
    let stderr = '';

    child.stderr.on('data', chunk => {
      stderr += chunk.toString();
    });

    child.on('error', reject);
    child.on('close', code => {
      if (code === 0) return resolve();
      reject(new Error(stderr.trim() || `FFmpeg exited with code ${code}`));
    });
  });
}

export async function safeUnlink(filePath) {
  try {
    await unlink(filePath);
  } catch {
    // Cleanup is best-effort.
  }
}
