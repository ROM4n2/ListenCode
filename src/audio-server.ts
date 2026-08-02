import * as http from 'http';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import axios from 'axios';
import { resolvePlayUrl } from './provider';

let server: http.Server | null = null;
let port = 0;

// 缓存目录
function getCacheDir(): string {
  const dir = path.join(os.tmpdir(), 'listencode_audio');
  if (!fs.existsSync(dir)) {fs.mkdirSync(dir, { recursive: true });}
  return dir;
}

// 清理旧文件（保留最近 50 个，每个最大 50MB）
function cleanupCache(): void {
  const dir = getCacheDir();
  const files = fs.readdirSync(dir)
    .map(f => {
      const p = path.join(dir, f);
      return { path: p, stat: fs.statSync(p) };
    })
    .sort((a, b) => b.stat.mtimeMs - a.stat.mtimeMs);

  // 删除超过 50 个的旧文件
  if (files.length > 50) {
    files.slice(50).forEach(f => {
      try { fs.unlinkSync(f.path); } catch { /* ignore */ }
    });
  }
}

export function startAudioServer(): Promise<number> {
  if (server) {return Promise.resolve(port);}

  return new Promise((resolve) => {
    server = http.createServer(async (req, res) => {
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
      const cacheDir = getCacheDir();
      // 从 trackId 推断扩展名：B站 DASH 音频为 m4a，其他为 mp3
      const ext = trackId.startsWith('bibvid_') ? '.m4a' : '.mp3';
      const cacheFile = path.join(cacheDir, `${trackId}${ext}`);
      // 二次校验解析后的路径仍在 cacheDir 内
      if (!cacheFile.startsWith(path.resolve(cacheDir))) {
        res.writeHead(400);
        res.end('Bad request');
        return;
      }

      try {
        // 如果缓存不存在，下载
        if (!fs.existsSync(cacheFile)) {
          const { url, cookie } = await resolvePlayUrl(trackId);
          if (!url) {
            res.writeHead(404, { 'Content-Type': 'audio/*' });
            res.end();
            return;
          }

          const headers: Record<string, string> = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Range': 'bytes=0-',
          };
          if (cookie) { headers['Cookie'] = cookie; }
          // B站 CDN (bilivideo/akamaized/szbdyd 等) 需要 Referer
          if (url.includes('bilibili') || url.includes('bilivideo') || url.includes('akamaized') || url.includes('bdurl')) {
            headers['Referer'] = 'https://www.bilibili.com/';
          }

          const response = await axios.get(url, {
            responseType: 'stream',
            headers,
            timeout: 60000,
            maxContentLength: 100 * 1024 * 1024, // 最大 100MB
          });

          // 检查响应状态，非 2xx/206 说明下载失败
          if (response.status !== 200 && response.status !== 206) {
            console.error(`[audio-server] download failed: HTTP ${response.status} for ${url}`);
            res.writeHead(502, { 'Content-Type': 'text/plain' });
            res.end(`Download failed: HTTP ${response.status}`);
            return;
          }

          const writer = fs.createWriteStream(cacheFile);
          response.data.pipe(writer);
          await new Promise<void>((res, rej) => {
            writer.on('finish', () => res());
            writer.on('error', rej);
          });

          // 校验下载的文件非空
          const stat = fs.statSync(cacheFile);
          if (stat.size === 0) {
            console.error(`[audio-server] downloaded file is empty: ${url}`);
            fs.unlinkSync(cacheFile);
            res.writeHead(502, { 'Content-Type': 'text/plain' });
            res.end('Downloaded file is empty');
            return;
          }

          console.log(`[audio-server] cached: ${trackId} (${stat.size} bytes)`);

          // 异步清理缓存
          cleanupCache();
        }

        // 服务本地文件（支持 Range 请求）
        const stat = fs.statSync(cacheFile);
        const fileSize = stat.size;
        const range = req.headers.range;

        if (range) {
          const parts = range.replace(/bytes=/, '').split('-');
          const start = parseInt(parts[0], 10);
          const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;

          // 校验数值合法性
          if (isNaN(start) || isNaN(end) || start > end || end >= fileSize || start < 0) {
            // 非法 Range，返回完整文件
            res.writeHead(200, {
              'Content-Length': fileSize,
              'Content-Type': ext === '.m4a' ? 'audio/mp4' : 'audio/mpeg',
              'Accept-Ranges': 'bytes',
            });
            fs.createReadStream(cacheFile).pipe(res);
            return;
          }

          const chunkSize = end - start + 1;

          res.writeHead(206, {
            'Content-Range': `bytes ${start}-${end}/${fileSize}`,
            'Accept-Ranges': 'bytes',
            'Content-Length': chunkSize,
            'Content-Type': ext === '.m4a' ? 'audio/mp4' : 'audio/mpeg',
          });
          fs.createReadStream(cacheFile, { start, end }).pipe(res);
        } else {
          res.writeHead(200, {
            'Content-Length': fileSize,
            'Content-Type': ext === '.m4a' ? 'audio/mp4' : 'audio/mpeg',
            'Accept-Ranges': 'bytes',
          });
          fs.createReadStream(cacheFile).pipe(res);
        }
      } catch (e: any) {
        // 下载失败，清理不完整文件
        try { fs.unlinkSync(cacheFile); } catch { /* ignore */ }
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

export function stopAudioServer(): void {
  if (server) { server.close(); server = null; port = 0; }
}
