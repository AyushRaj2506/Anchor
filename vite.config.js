import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import dotenv from 'dotenv';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

dotenv.config({ path: ['.env.local', '.env'], quiet: true });

const endpoints = new Set([
  '/api/ai/analyze', '/api/ai/analyze-url', '/api/ai/analyze-resource', '/api/ai/ask',
  '/api/storage/create-upload-url', '/api/storage/create-download-url', '/api/storage/delete-file',
]);

const apiMiddleware = (req, res, next) => {
  const pathname = req.url?.split('?')[0];
  if (!pathname?.startsWith('/api/')) return next();
  res.setHeader('Content-Type', 'application/json');
  const json = (status, error) => { if (!res.writableEnded) { res.statusCode = status; res.end(JSON.stringify({ success: false, error })); } };
  if (!endpoints.has(pathname)) return json(404, 'API endpoint not found.');
  if (req.method !== 'POST') return json(405, 'Method not allowed.');
  let bytes = 0;
  const chunks = [];
  req.on('data', chunk => {
    bytes += chunk.length;
    if (bytes > 1024 * 1024) { chunks.length = 0; json(413, 'Request is too large.'); }
    else if (!res.writableEnded) chunks.push(chunk);
  });
  req.on('error', () => json(400, 'Could not read request.'));
  req.on('end', async () => {
    if (res.writableEnded) return;
    let body;
    try { body = JSON.parse(Buffer.concat(chunks).toString('utf8')); }
    catch { return json(400, 'A valid JSON body is required.'); }
    try {
      const handlerPath = path.resolve(process.cwd(), '.' + pathname + '.js');
      const { default: handler } = await import(pathToFileURL(handlerPath).href);
      const response = {
        status(code) { res.statusCode = code; return response; },
        json(data) { res.end(JSON.stringify(data)); return response; },
      };
      await handler({ method: req.method, headers: req.headers, body }, response);
    } catch (error) {
      console.error('Local API request failed:', error.message);
      json(500, 'The request could not be completed. Please try again.');
    }
  });
};

const localApiPlugin = () => ({
  name: 'local-api',
  configureServer(server) { server.middlewares.use(apiMiddleware); },
  configurePreviewServer(server) { server.middlewares.use(apiMiddleware); },
});

export default defineConfig({
  plugins: [react(), localApiPlugin()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/__tests__/setup.js'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/**/*.{js,jsx}', 'api/**/*.js', 'server/**/*.js'],
      exclude: ['src/**/*.test.{js,jsx}', 'src/main.jsx'],
    },
  },
});
