import * as http from 'http';
import * as vscode from 'vscode';
import axios from 'axios';
import { getCookie } from './provider/http';
import { resolvePlayUrl } from './provider';
import { Platform } from './types';

let server: http.Server | null = null;
let port = 0;

export function getAudioServerPort(): number {
  return port;
}

export function startAudioServer(): Promise<number> {
  if (server) {return Promise.resolve(port);}

  return new Promise((resolve) => {
    server = http.createServer(async (req, res) => {
      const match = (req.url || '').match(/^\/(song|audio)\/(\w+)/);
      if (!match) {
        res.writeHead(404);
        res.end('Not found');
        return;
      }

      const trackId = match[2];

      try {
        const { url, cookie } = await resolvePlayUrl(trackId);
        if (!url) {
          res.writeHead(404, { 'Content-Type': 'audio/*' });
          res.end();
          return;
        }

        // 流式代理音频
        const headers: Record<string, string> = {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        };
        if (cookie) { headers['Cookie'] = cookie; }
        if (url.includes('bilibili') || url.includes('bilivideo')) {
          headers['Referer'] = 'https://www.bilibili.com/';
        }
        // 转发 Range 头（支持进度拖拽）
        if (req.headers.range) { headers['Range'] = req.headers.range; }

        const response = await axios.get(url, {
          responseType: 'stream',
          headers,
          timeout: 30000,
          validateStatus: (status) => status < 400,
        });

        res.writeHead(response.status, {
          'Content-Type': String(response.headers['content-type'] || 'audio/mpeg'),
          'Content-Length': String(response.headers['content-length'] || ''),
          'Accept-Ranges': 'bytes',
          'Access-Control-Allow-Origin': '*',
        });
        response.data.pipe(res);
      } catch (e: any) {
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end('Error: ' + e.message);
      }
    });

    server.listen(0, '127.0.0.1', () => {
      const addr = server!.address();
      if (addr && typeof addr === 'object') {
        port = addr.port;
      }
      resolve(port);
    });
  });
}

export function getAudioUrl(trackId: string): string {
  return `http://localhost:${port}/song/${trackId}`;
}
