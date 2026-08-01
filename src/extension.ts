import * as vscode from 'vscode';
import { CookieManager } from './cookie';
import { PlaylistManager } from './playlist';
import { searchAll } from './search';
import { resolvePlayUrl } from './provider';
import { updateCookie } from './provider/http';
import { WebviewRequest, Track, Playlist, Platform } from './types';

let cookieManager: CookieManager;
let playlistManager: PlaylistManager;

export function activate(context: vscode.ExtensionContext) {
  cookieManager = new CookieManager(context);
  playlistManager = new PlaylistManager(context);

  // 注册打开播放器命令
  const openPlayerCmd = vscode.commands.registerCommand('listencode.openPlayer', () => {
    const panel = vscode.window.createWebviewPanel(
      'listencode.player',
      'ListenCode',
      vscode.ViewColumn.One,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [
          vscode.Uri.joinPath(context.extensionUri, 'media'),
        ],
      }
    );

    panel.webview.html = getWebviewHtml(panel.webview, context.extensionUri);

    // 发送初始 cookie 状态
    panel.webview.postMessage({
      type: 'cookie:status',
      status: cookieManager.getAllStatus(),
    });

    panel.webview.onDidReceiveMessage(async (msg: WebviewRequest) => {
      handleWebviewMessage(panel.webview, msg);
    });
  });

  // 注册导入 cookie 命令
  const importCookieCmd = vscode.commands.registerCommand('listencode.importCookie', async () => {
    const platform = await vscode.window.showQuickPick(
      [
        { label: '网易云音乐', value: 'netease' },
        { label: 'QQ音乐', value: 'qq' },
        { label: '酷狗音乐', value: 'kugou' },
        { label: 'B站', value: 'bilibili' },
      ],
      { placeHolder: '选择平台' }
    );
    if (!platform) {return;}

    const raw = await vscode.window.showInputBox({
      placeHolder: '粘贴 Cookie（从浏览器开发者工具复制）',
      prompt: `${platform.label} Cookie`,
    });
    if (!raw) {return;}

    try {
      cookieManager.importCookie(platform.value as Platform, raw);
      updateCookie(platform.value as Platform, raw);
      vscode.window.showInformationMessage(`${platform.label} Cookie 导入成功`);
    } catch (e) {
      vscode.window.showErrorMessage(`导入失败: ${e}`);
    }
  });

  context.subscriptions.push(openPlayerCmd, importCookieCmd);
}

async function handleWebviewMessage(webview: vscode.Webview, msg: WebviewRequest) {
  switch (msg.type) {
    case 'search': {
      try {
        const tracks = await searchAll(msg.keyword, msg.sources as any[]);
        webview.postMessage({ type: 'search:result', tracks });
      } catch (e: any) {
        webview.postMessage({ type: 'error', message: e.message || '搜索失败' });
      }
      break;
    }
    case 'play': {
      const url = await resolvePlayUrl(msg.track.id);
      webview.postMessage({ type: 'player:resolve', url, track: msg.track });
      break;
    }
    case 'playlist:create': {
      playlistManager.create(msg.name);
      webview.postMessage({ type: 'playlist:list', playlists: playlistManager.getAll() });
      break;
    }
    case 'playlist:add': {
      playlistManager.addTrack(msg.playlistId, msg.track);
      webview.postMessage({ type: 'playlist:list', playlists: playlistManager.getAll() });
      break;
    }
    case 'playlist:remove': {
      if (msg.trackId) {
        playlistManager.removeTrack(msg.playlistId, msg.trackId);
      } else {
        playlistManager.remove(msg.playlistId);
      }
      webview.postMessage({ type: 'playlist:list', playlists: playlistManager.getAll() });
      break;
    }
    case 'playlist:load': {
      webview.postMessage({ type: 'playlist:list', playlists: playlistManager.getAll() });
      break;
    }
    case 'cookie:import': {
      try {
        cookieManager.importCookie(msg.platform as any, msg.raw);
        updateCookie(msg.platform as any, msg.raw);
        webview.postMessage({ type: 'cookie:status', platform: msg.platform, valid: true });
      } catch (e: any) {
        webview.postMessage({ type: 'error', message: e.message });
      }
      break;
    }
  }
}

function getWebviewHtml(webview: vscode.Webview, extensionUri: vscode.Uri): string {
  const htmlPath = vscode.Uri.joinPath(extensionUri, 'media', 'webview.html');
  const html = require('fs').readFileSync(htmlPath.fsPath, 'utf8');

  return html
    .replace(
      'webview.css',
      webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, 'media', 'webview.css')).toString()
    )
    .replace(
      'webview.js',
      webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, 'media', 'webview.js')).toString()
    );
}

export function deactivate() {}
