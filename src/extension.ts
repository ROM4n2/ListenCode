import * as vscode from 'vscode';
import { CookieManager, parseCookieInput } from './cookie';
import { PlaylistManager } from './playlist';
import { searchAll } from './search';
import { resolvePlayUrl, preCheckPlayable, getUserPlaylists, getPlaylistTracks } from './provider';
import { updateCookie } from './provider/http';
import { WebviewRequest, Track, Playlist, Platform } from './types';
import { getHistory, addHistory } from './search-history';

let cookieManager: CookieManager;
let playlistManager: PlaylistManager;
const playableStatus = new Map<string, boolean>();
let extensionContext: vscode.ExtensionContext;

// 播放状态跟踪
let currentPlayingTrack: Track | null = null;
let isPlaying = false;
let activePanel: vscode.WebviewPanel | null = null;
let statusBarItem: vscode.StatusBarItem;

export function activate(context: vscode.ExtensionContext) {
  extensionContext = context;
  cookieManager = new CookieManager(context);
  playlistManager = new PlaylistManager(context);

  // 创建状态栏
  statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left);
  statusBarItem.command = 'listencode.togglePlay';
  context.subscriptions.push(statusBarItem);

  // 注册打开播放器命令
  const openPlayerCmd = vscode.commands.registerCommand('listencode.openPlayer', () => {
    const panel = createPlayerPanel(context);

    panel.webview.onDidReceiveMessage(async (msg: WebviewRequest) => {
      handleWebviewMessage(panel.webview, msg);
    });
  });

  // 注册快速播放命令
  const quickPlayCmd = vscode.commands.registerCommand('listencode.quickPlay', async () => {
    const keyword = await vscode.window.showInputBox({
      placeHolder: '输入歌名搜索歌曲',
      prompt: '快速播放',
    });
    if (!keyword) {return;}

    let tracks: Track[];
    try {
      tracks = await searchAll(keyword, ['netease', 'qq', 'kugou', 'bilibili']);
    } catch (e: any) {
      vscode.window.showErrorMessage(`搜索失败: ${e.message || e}`);
      return;
    }

    const playable = await preCheckPlayable(tracks);
    const firstPlayable = tracks.find((t) => playable.get(t.id));

    if (!firstPlayable) {
      vscode.window.showWarningMessage('未找到可播放的歌曲');
      return;
    }

    // 打开面板并通知自动播放
    const panel = createPlayerPanel(context);
    panel.webview.onDidReceiveMessage(async (msg: WebviewRequest) => {
      handleWebviewMessage(panel.webview, msg);
    });
    // 延迟发送，确保 WebView 已就绪
    setTimeout(() => {
      panel.webview.postMessage({ type: 'autoplay', track: firstPlayable });
    }, 500);
  });

  // 注册暂停/播放切换命令
  const togglePlayCmd = vscode.commands.registerCommand('listencode.togglePlay', () => {
    if (activePanel) {
      activePanel.webview.postMessage({ type: 'player:toggle' });
    }
  });

  // 注册导出歌单命令
  const exportPlaylistsCmd = vscode.commands.registerCommand('listencode.exportPlaylists', async () => {
    const uri = await vscode.window.showSaveDialog({
      defaultUri: vscode.Uri.file('listencode-playlists.json'),
      filters: { 'JSON': ['json'] }
    });
    if (!uri) {return;}
    const data = {
      version: 1,
      exportedAt: new Date().toISOString(),
      playlists: playlistManager.getAll()
    };
    await vscode.workspace.fs.writeFile(uri, Buffer.from(JSON.stringify(data, null, 2), 'utf-8'));
    vscode.window.showInformationMessage('歌单已导出');
  });

  // 注册导入歌单命令
  const importPlaylistsCmd = vscode.commands.registerCommand('listencode.importPlaylists', async () => {
    const uri = await vscode.window.showOpenDialog({
      canSelectFiles: true, canSelectFolders: false, canSelectMany: false,
      filters: { 'JSON': ['json'] }
    });
    if (!uri || uri.length === 0) {return;}
    const content = await vscode.workspace.fs.readFile(uri[0]);
    const data = JSON.parse(content.toString());
    if (data.playlists && Array.isArray(data.playlists)) {
      for (const pl of data.playlists) {
        const playlist = playlistManager.create(pl.name);
        for (const track of pl.tracks || []) {
          playlistManager.addTrack(playlist.id, track);
        }
      }
      vscode.window.showInformationMessage(`已导入 ${data.playlists.length} 个歌单`);
      if (activePanel) {
        activePanel.webview.postMessage({ type: 'playlist:list', playlists: playlistManager.getAll() });
      }
    }
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
      const parsed = parseCookieInput(raw);
      cookieManager.importCookie(platform.value as Platform, parsed);
      updateCookie(platform.value as Platform, parsed);
      vscode.window.showInformationMessage(`${platform.label} Cookie 导入成功`);
    } catch (e) {
      vscode.window.showErrorMessage(`导入失败: ${e}`);
    }
  });

  context.subscriptions.push(openPlayerCmd, quickPlayCmd, togglePlayCmd, importCookieCmd, exportPlaylistsCmd, importPlaylistsCmd);
}

function createPlayerPanel(context: vscode.ExtensionContext): vscode.WebviewPanel {
  if (activePanel) {
    activePanel.reveal(vscode.ViewColumn.One);
    return activePanel;
  }

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

  activePanel = panel;

  panel.webview.html = getWebviewHtml(panel.webview, context.extensionUri);

  // 发送初始 cookie 状态
  panel.webview.postMessage({
    type: 'cookie:status',
    status: cookieManager.getAllStatus(),
  });

  // 发送搜索历史
  panel.webview.postMessage({
    type: 'search:history',
    history: getHistory(extensionContext),
  });

  panel.onDidDispose(() => {
    activePanel = null;
    currentPlayingTrack = null;
    isPlaying = false;
    statusBarItem.hide();
  });

  return panel;
}

function updateStatusBar(track: Track | null, playing: boolean) {
  if (!track) {
    statusBarItem.hide();
    return;
  }
  if (playing) {
    statusBarItem.text = '♪ ' + track.title + ' - ' + track.artist;
  } else {
    statusBarItem.text = '⏸ ' + track.title + ' - ' + track.artist;
  }
  statusBarItem.show();
}

async function handleWebviewMessage(webview: vscode.Webview, msg: WebviewRequest) {
  switch (msg.type) {
    case 'search': {
      try {
        addHistory(extensionContext, msg.keyword);
        const tracks = await searchAll(msg.keyword, msg.sources as any[]);
        webview.postMessage({ type: 'search:result', tracks });
        webview.postMessage({ type: 'search:history', history: getHistory(extensionContext) });
        // 后台预检前 10 首，完成后发送 playable:status
        const top10 = tracks.slice(0, 10);
        preCheckPlayable(top10).then((result) => {
          const status: Record<string, boolean> = {};
          result.forEach((playable, id) => {
            status[id] = playable;
            playableStatus.set(id, playable);
          });
          webview.postMessage({ type: 'playable:status', status });
        }).catch(() => {});
      } catch (e: any) {
        webview.postMessage({ type: 'error', message: e.message || '搜索失败' });
      }
      break;
    }
    case 'play': {
      // 已知不可播则直接拦截
      if (playableStatus.has(msg.track.id) && !playableStatus.get(msg.track.id)) {
        webview.postMessage({ type: 'error', message: '该歌曲因版权原因无法播放' });
        break;
      }
      const { url, cookie } = await resolvePlayUrl(msg.track.id);
      // 若获取不到地址，记录为不可播
      if (!url) {
        playableStatus.set(msg.track.id, false);
      }
      webview.postMessage({ type: 'player:resolve', url, cookie, track: msg.track });
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
    case 'playlist:reorder': {
      playlistManager.reorderTrack(msg.playlistId, msg.fromIndex, msg.toIndex);
      break;
    }
    case 'playlist:load': {
      webview.postMessage({ type: 'playlist:list', playlists: playlistManager.getAll() });
      break;
    }
    case 'playlists:export': {
      vscode.commands.executeCommand('listencode.exportPlaylists');
      break;
    }
    case 'playlists:import': {
      vscode.commands.executeCommand('listencode.importPlaylists');
      break;
    }
    case 'cookie:import': {
      try {
        const parsed = parseCookieInput(msg.raw);
        cookieManager.importCookie(msg.platform as any, parsed);
        updateCookie(msg.platform as any, parsed);
        webview.postMessage({ type: 'cookie:status', platform: msg.platform, valid: true });
      } catch (e: any) {
        webview.postMessage({ type: 'error', message: e.message });
      }
      break;
    }
    case 'player:state': {
      currentPlayingTrack = msg.track;
      isPlaying = msg.playing;
      updateStatusBar(msg.track, msg.playing);
      break;
    }
    case 'search:loadHistory': {
      webview.postMessage({ type: 'search:history', history: getHistory(extensionContext) });
      break;
    }
    case 'mode:set': {
      extensionContext.globalState.update('listencode.playMode', msg.mode);
      break;
    }
    case 'mode:get': {
      const mode = extensionContext.globalState.get<string>('listencode.playMode', 'list');
      webview.postMessage({ type: 'mode:current', mode });
      break;
    }
    case 'userplaylists:get': {
      try {
        const playlists = await getUserPlaylists(msg.platform as Platform);
        webview.postMessage({ type: 'userplaylists:list', platform: msg.platform, playlists });
      } catch (e: any) {
        webview.postMessage({ type: 'error', message: e.message || '获取歌单失败' });
      }
      break;
    }
    case 'playlist:syncLoad': {
      try {
        const tracks = await getPlaylistTracks(msg.platform as Platform, msg.playlistId);
        webview.postMessage({ type: 'playlist:tracks', tracks });
      } catch (e: any) {
        webview.postMessage({ type: 'error', message: e.message || '加载歌单歌曲失败' });
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
