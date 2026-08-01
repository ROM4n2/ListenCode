import * as vscode from 'vscode';
import { Platform, ALL_PLATFORMS } from './types';

const COOKIE_KEY = 'listencode.cookies';

export class CookieManager {
  private cookies: Record<string, string> = {};
  private context: vscode.ExtensionContext;

  constructor(context: vscode.ExtensionContext) {
    this.context = context;
    this.load();
  }

  private load(): void {
    const stored = this.context.globalState.get<Record<string, string>>(COOKIE_KEY, {});
    this.cookies = stored;
  }

  private save(): void {
    this.context.globalState.update(COOKIE_KEY, this.cookies);
  }

  importCookie(platform: Platform, rawCookie: string): void {
    if (!rawCookie.trim()) {
      throw new Error('Cookie 不能为空');
    }
    this.cookies[platform] = rawCookie.trim();
    this.save();
  }

  getCookieHeader(platform: string): string {
    return this.cookies[platform] || '';
  }

  hasCookie(platform: string): boolean {
    return !!this.cookies[platform];
  }

  getActivePlatforms(): Platform[] {
    return ALL_PLATFORMS.filter(p => this.hasCookie(p));
  }

  getAllStatus(): Record<string, boolean> {
    const result: Record<string, boolean> = {};
    for (const p of ALL_PLATFORMS) {
      result[p] = this.hasCookie(p);
    }
    return result;
  }

  remove(platform: string): void {
    delete this.cookies[platform];
    this.save();
  }
}

export function parseCookieInput(raw: string): string {
  raw = raw.trim();
  if (!raw) {return '';}

  // 已经是 name=value; 格式（没有 tab，不是 JSON）
  if (raw.includes('=') && !raw.includes('\t') && !raw.startsWith('{')) {
    return raw;
  }

  // DevTools 表格格式（Tab 分隔，可能有表头）
  if (raw.includes('\t')) {
    const lines = raw.split('\n').filter(l => l.trim());
    const cookies: string[] = [];
    for (const line of lines) {
      const parts = line.split('\t');
      if (parts.length >= 2 && parts[0] && parts[1]) {
        // 跳过表头
        if (parts[0].toLowerCase() === 'name' && parts[1].toLowerCase() === 'value') {
          continue;
        }
        cookies.push(`${parts[0].trim()}=${parts[1].trim()}`);
      }
    }
    return cookies.join('; ');
  }

  // JSON 格式 [{name, value}, ...]
  if (raw.startsWith('[') || raw.startsWith('{')) {
    try {
      const parsed = JSON.parse(raw);
      const arr = Array.isArray(parsed) ? parsed : [parsed];
      const cookies = arr
        .filter((c: any) => c.name && c.value)
        .map((c: any) => `${c.name}=${c.value}`);
      if (cookies.length > 0) {return cookies.join('; ');}
    } catch {
      // 解析失败原样返回
    }
  }

  return raw;
}
