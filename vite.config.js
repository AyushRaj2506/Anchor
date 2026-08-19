import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import dotenv from 'dotenv'
import fs from 'fs'

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
      if (req.url === '/api/ai/analyze' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => { body += chunk; });
        req.on('end', async () => {
          try {
            const parsedBody = JSON.parse(body);
            const mockReq = { method: 'POST', body: parsedBody };
            
            // Dynamically import the Vercel handler
            const handlerModule = await import('./api/ai/analyze.js');
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
