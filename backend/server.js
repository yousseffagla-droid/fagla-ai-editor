import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import uploadRouter from './routes/upload.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();
const PORT = Number(process.env.PORT || 3000);

app.disable('x-powered-by');
app.use(express.json({ limit: '1mb' }));

app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    service: 'fagla-ai-editor-backend',
    version: '0.2.0'
  });
});

app.use('/api', uploadRouter);

const frontendRoot = path.resolve(__dirname, '..');
app.use(express.static(frontendRoot));

app.use((error, _req, res, _next) => {
  console.error(error);
  const status = error.code === 'LIMIT_FILE_SIZE' ? 413 : 500;
  res.status(status).json({
    error: status === 413 ? 'Video is larger than the 500 MB limit' : error.message || 'Internal server error'
  });
});

app.listen(PORT, () => {
  console.log(`Fagla AI Editor backend running on http://localhost:${PORT}`);
});
