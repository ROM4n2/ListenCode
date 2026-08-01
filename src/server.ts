import * as http from 'http';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

let server: http.Server | null = null;
let port = 0;

const MIME: Record<string, string> = {
  '.mp3': 'audio/mpeg',
  '.mp4': 'video/mp4',
  '.m4a': 'audio/mp4',
  '.flac': 'audio/flac',
  '.ogg': 'audio/ogg',
  '.webm': 'video/webm',
};

export function getLocalServerUrl(): string {
  return `http://127.0.0.1:${port}`;
}

export function startLocalServer(): Promise<string> {
  if (server) {return Promise.resolve(getLocalServerUrl());}

  return new Promise((resolve) => {
    server = http.createServer((req, res) => {
      const filePath = path.join(os.tmpdir(), 'listencode', decodeURIComponent(req.url || ''));
      if (!fs.existsSync(filePath)) {
        res.writeHead(404);
        res.end('Not found');
        return;
      }
      const ext = path.extname(filePath).toLowerCase();
      const contentType = MIME[ext] || 'application/octet-stream';
      const stat = fs.statSync(filePath);
      res.writeHead(200, {
        'Content-Type': contentType,
        'Content-Length': stat.size,
        'Accept-Ranges': 'bytes',
        'Access-Control-Allow-Origin': '*',
      });
      fs.createReadStream(filePath).pipe(res);
    });

    server.listen(0, '127.0.0.1', () => {
      const addr = server!.address();
      if (addr && typeof addr === 'object') {
        port = addr.port;
      }
      resolve(getLocalServerUrl());
    });
  });
}
