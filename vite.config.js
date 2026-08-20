import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import dotenv from 'dotenv'
import fs from 'fs'
import path from 'path'
import { pathToFileURL } from 'url'

// Load environment variables for local backend simulation
if (fs.existsSync('.env.local')) {
  dotenv.config({ path: '.env.local' });
} else {
  dotenv.config({ path: '.env.example' });
}

// A simple Vite plugin to mock/run our Vercel Serverless Function locally
const localApiPlugin = () => ({
  name: 'local-api',
  configureServer(server) {
    server.middlewares.use(async (req, res, next) => {
      if (req.url.startsWith('/api/') && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => { body += chunk; });
        req.on('end', async () => {
          try {
            const parsedBody = body ? JSON.parse(body) : {};
            const mockReq = { method: 'POST', body: parsedBody, headers: req.headers };
            
            // Map the request URL path directly to local serverless handler file
            // e.g. /api/storage/create-upload-url -> api/storage/create-upload-url.js
            const relativePath = req.url.split('?')[0].replace(/^\//, '') + '.js';
            const absolutePath = path.resolve(process.cwd(), relativePath);
            
            // Append cache buster to prevent ESM import caching in Node during development
            const handlerModule = await import(pathToFileURL(absolutePath).href + '?t=' + Date.now());
            const handler = handlerModule.default;

            const mockRes = {
              status(code) {
                res.statusCode = code;
                return mockRes;
              },
              json(data) {
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify(data));
                return mockRes;
              }
            };

            await handler(mockReq, mockRes);
          } catch (err) {
            res.statusCode = 500;
            res.end(JSON.stringify({ success: false, error: err.message }));
          }
        });
      } else {
        next();
      }
    });
  }
});

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), localApiPlugin()],
})
