import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// Server-side voice API proxy plugin ensuring API keys are never exposed to browser
function voiceApiProxyPlugin(env: Record<string, string>) {
  return {
    name: 'voice-api-proxy',
    configureServer(server: any) {
      server.middlewares.use(async (req: any, res: any, next: any) => {
        if (req.url === '/api/voice/health') {
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ status: 'ok', hasSarvamKey: Boolean(env.SARVAM_API_KEY) }));
          return;
        }

        if (req.url === '/api/voice/sarvam/tts' && req.method === 'POST') {
          const sarvamKey = env.SARVAM_API_KEY;
          if (!sarvamKey) {
            res.statusCode = 503;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ error: 'SARVAM_API_KEY not configured on server' }));
            return;
          }

          let body = '';
          req.on('data', (chunk: any) => { body += chunk; });
          req.on('end', async () => {
            try {
              const fetchRes = await fetch('https://api.sarvam.ai/text-to-speech', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'api-subscription-key': sarvamKey,
                },
                body,
              });
              const data = await fetchRes.text();
              res.setHeader('Content-Type', 'application/json');
              res.statusCode = fetchRes.status;
              res.end(data);
            } catch (err: any) {
              res.statusCode = 500;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ error: err.message }));
            }
          });
          return;
        }

        next();
      });
    }
  };
}

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    return {
      server: {
        port: 3000,
        host: '0.0.0.0',
      },
      plugins: [react(), voiceApiProxyPlugin(env)],
      define: {
        'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY)
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      }
    };
});

