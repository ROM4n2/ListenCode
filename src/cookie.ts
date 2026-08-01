import * as vscode from 'vscode';
import { Platform, ALL_PLATFORMS } from './types';

export class CookieManager {
  private cookies: Record<string, string> = {};
  private context: vscode.ExtensionContext;

  constructor(context: vscode.ExtensionContext) {
    this.context = context;
    this.load();
  }

  private async load(): Promise<void> {
    const stored = await this.context.secrets.get('listencode.cookies');
    if (stored) {
      try {
        this.cookies = JSON.parse(stored);
      } catch {
        this.cookies = {};
      }
    }
  }

  private async save(): Promise<void> {
    await this.context.secrets.store('listencode.cookies', JSON.stringify(this.cookies));
  }

  async importCookie(platform: Platform, rawCookie: string): Promise<void> {
    if (!rawCookie.trim()) {
      throw new Error('Cookie 不能为空');
    }
    this.cookies[platform] = rawCookie.trim();
    await this.save();
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

  async remove(platform: string): Promise<void> {
    delete this.cookies[platform];
    await this.save();
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
