import * as http from 'http';
import axios from 'axios';
import { resolvePlayUrl } from './provider';

let server: http.Server | null = null;
let port = 0;

// URL 缓存：避免重复调用 resolvePlayUrl（参照 vsc-netease-music 的 state[type][id] 缓存）
const urlCache = new Map<string, { url: string; cookie: string; time: number }>();
const URL_CACHE_TTL = 5 * 60 * 1000; // 5 分钟

function getCachedUrl(trackId: string): { url: string; cookie: string } | null {
  const cached = urlCache.get(trackId);
  if (cached && Date.now() - cached.time < URL_CACHE_TTL) {
    return { url: cached.url, cookie: cached.cookie };
  }
  urlCache.delete(trackId);
  return null;
}

function setCachedUrl(trackId: string, url: string, cookie: string): void {
  urlCache.set(trackId, { url, cookie, time: Date.now() });
}

/**
 * 流式代理：获取 CDN URL 后直接 pipe 给客户端（参照 vsc-netease-music 的 AssistServer）
 * 不做本地缓存，透传 CDN 响应头，转发 Range 请求
 */
async function proxyTrack(trackId: string, req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
  // 获取 CDN URL（优先缓存）
  const cached = getCachedUrl(trackId);
  let url: string;
  let cookie: string;
  if (cached) {
    url = cached.url;
    cookie = cached.cookie;
  } else {
    const result = await resolvePlayUrl(trackId);
    if (!result.url) {
      res.writeHead(404, { 'Content-Type': 'audio/*' });
      res.end();
      return;
    }
    url = result.url;
    cookie = result.cookie;
    setCachedUrl(trackId, url, cookie);
  }

  // 构造转发请求头（参照 vsc-netease-music 的 headers 处理）
  const headers: Record<string, string> = {};
  // 透传 Range 请求头（关键：让 CDN 处理 Range）
  if (req.headers.range) {
    headers['Range'] = req.headers.range;
  }
  // 透传其他必要头
  if (cookie) {
    headers['Cookie'] = cookie;
  }
  // B站 CDN 需要 Referer
  if (url.includes('bilibili') || url.includes('bilivideo') || url.includes('akamaized') || url.includes('bdurl')) {
    headers['Referer'] = 'https://www.bilibili.com/';
  }

  console.log(`[audio-server] proxy: ${trackId} → ${url}`);

  try {
    const response = await axios.get(url, {
      responseType: 'stream',
      headers,
      timeout: 60000,
      maxContentLength: 100 * 1024 * 1024,
    });

    console.log(`[audio-server] CDN response: ${response.status} ${response.headers['content-type']} ${response.headers['content-length']}`);

    // 透传 CDN 响应头（参照 vsc-netease-music 的 res.writeHead(response.statusCode, response.headers)）
    const respHeaders: Record<string, string> = {};
    for (const [key, value] of Object.entries(response.headers)) {
      if (value !== undefined) {
        respHeaders[key] = Array.isArray(value) ? value.join(', ') : String(value);
      }
    }
    res.writeHead(response.status, respHeaders);

    // 流式管道直传（不落盘）
    response.data.pipe(res);
  } catch (e: any) {
    console.error(`[audio-server] proxy failed: ${e.message}, code=${e.response?.status}`);
    if (!res.headersSent) {
      res.writeHead(502, { 'Content-Type': 'text/plain' });
      res.end(`CDN error: ${e.message}`);
    }
  }
}

export function startAudioServer(): Promise<number> {
  if (server) {return Promise.resolve(port);}

  return new Promise((resolve) => {
    server = http.createServer(async (req, res) => {
      // CORS 头（参照 vsc-netease-music 的 access-control-allow-origin: *）
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Range');
      res.setHeader('Access-Control-Expose-Headers', 'Content-Range, Content-Length, Accept-Ranges');

      if (req.method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
      }

      // 诊断端点
      if (req.url === '/ping') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true, port }));
        return;
      }

      const match = (req.url || '').match(/^\/song\/(.+)/);
      if (!match) {
        res.writeHead(404);
        res.end('Not found');
        return;
      }

      const trackId = decodeURIComponent(match[1]);
      // 只允许字母数字和下划线/中划线
      if (!/^[a-zA-Z0-9_-]+$/.test(trackId)) {
        res.writeHead(400);
        res.end('Bad request');
        return;
      }

      try {
        await proxyTrack(trackId, req, res);
      } catch (e: any) {
        console.error(`[audio-server] error: ${trackId} - ${e.message}`);
        res.writeHead(502, { 'Content-Type': 'text/plain' });
        res.end(`Proxy error: ${e.message}`);
      }
    });

    server.listen(0, '127.0.0.1', () => {
      const addr = server!.address();
      if (addr && typeof addr === 'object') {
        port = addr.port;
      }
      console.log(`[audio-server] started on http://127.0.0.1:${port}`);
      resolve(port);
    });
  });
}

export function getAudioUrl(trackId: string): string {
  return `http://localhost:${port}/song/${trackId}`;
}

export function stopAudioServer(): void {
  if (server) { server.close(); server = null; port = 0; }
  urlCache.clear();
}
