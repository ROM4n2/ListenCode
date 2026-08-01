import axios, { AxiosInstance } from 'axios';
import { Platform } from '../types';
import { CookieManager } from '../cookie';

const PLATFORM_DOMAINS: Record<Platform, string> = {
  netease: 'music.163.com',
  qq: 'y.qq.com',
  kugou: 'www.kugou.com',
  bilibili: 'www.bilibili.com',
};

const REFERER_MAP: Record<Platform, string> = {
  netease: 'https://music.163.com/',
  qq: 'https://y.qq.com/',
  kugou: 'https://www.kugou.com/',
  bilibili: 'https://www.bilibili.com/',
};

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

let cookieManager: CookieManager | null = null;

export function initCookieStore(manager: CookieManager): void {
  cookieManager = manager;
}

export async function updateCookie(platform: Platform, cookie: string): Promise<void> {
  if (cookieManager) {
    await cookieManager.importCookie(platform, cookie);
  }
}

export function getCookie(platform: Platform): string {
  return cookieManager?.getCookieHeader(platform) || '';
}

function getCookieHeader(platform: Platform): string {
  return getCookie(platform);
}

export function createHttpClient(platform: Platform): AxiosInstance {
  const instance = axios.create({
    timeout: 15000,
    headers: {
      'User-Agent': UA,
      'Referer': REFERER_MAP[platform],
      'Origin': REFERER_MAP[platform].replace(/\/$/, ''),
    },
  });

  instance.interceptors.request.use((config) => {
    const cookie = getCookieHeader(platform);
    if (cookie) {
      config.headers.set('Cookie', cookie);
    }
    return config;
  });

  return instance;
}

export function getDomain(platform: Platform): string {
  return PLATFORM_DOMAINS[platform];
}

export { UA };
