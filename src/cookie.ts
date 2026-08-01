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
