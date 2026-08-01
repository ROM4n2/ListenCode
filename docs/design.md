# ListenCode 产品设计方案

## 1. 项目概述

**目标：** VS Code 移植版 Listen1，聚合网易/QQ/酷狗/B站音乐平台，提供搜索、播放、自建歌单。

**核心用户：** 写代码时不想开浏览器切窗口的人。

**范围：**
- ✅ 多平台聚合搜索
- ✅ 播放控制（播放/暂停/上/下/进度/音量）
- ✅ 平台切换（网易/QQ/酷狗/B站）
- ✅ 自建歌单（本地持久化）
- ❌ 登录/收藏同步（cookie 导入，不绑定账号）
- ❌ 歌词悬浮窗（VS Code 无全局窗口 API）
- ❌ 系统托盘/全局快捷键（VS Code 无此 API）
- ❌ 下载功能

## 2. 架构

```
┌─────────────────────────────────────────────────────┐
│  Extension Host (Node.js)                           │
│                                                      │
│  ┌──────────────┐  ┌──────────────┐  ┌────────────┐ │
│  │ Provider 层   │  │ Storage 层   │  │  Cookie 层 │ │
│  │ netease.js   │  │ globalState  │  │ 导入/缓存   │ │
│  │ qq.js        │  │ (歌单/设置)   │  │ (按平台)   │  │
│  │ kugou.js     │  └──────────────┘  └────────────┘ │
│  │ bilibili.js  │                                    │
│  └──────────────┘                                    │
│         ↑↓ axios (Node https)                        │
│  ┌──────────────┐                                    │
│  │ loweb.js     │ ← 平台路由/分发                     │
│  └──────────────┘                                    │
│         ↑↓ postMessage                               │
├─────────────────────────────────────────────────────┤
│  WebView (UI 层)                                     │
│  ┌──────────────┐  ┌──────────────┐  ┌────────────┐ │
│  │ 搜索/结果     │  │ 播放控制栏    │  │ 歌单管理   │ │
│  └──────────────┘  └──────────────┘  └────────────┘ │
│         ↑↓                                           │
│  ┌──────────────┐                                    │
│  │ <audio> 标签 │ ← HTML5 原生播放                   │
│  └──────────────┘                                    │
└─────────────────────────────────────────────────────┘
```

**关键决策：**
- Provider 层跑在扩展主机（Node.js），不走 WebView。原因：axios/cookie/加密逻辑需要 Node 环境，WebView 沙箱跑不了。
- UI 跑在 WebView。原因：VS Code 唯一推荐的 UI 方案，HTML/CSS/JS 自由度高。
- 播放用 `<audio>` 标签。原因：WebView 内原生支持、零依赖、够用（不需要 Howler 的音效处理）。

## 3. 技术选型

| 领域 | 选择 | 理由 |
|---|---|---|
| 语言 | TypeScript | VS Code 扩展标准语言，类型安全 |
| 构建 | `@vscode/test-electron` + tsc | 官方工具链，零配置 |
| UI | 原生 HTML/CSS/JS（WebView） | 零依赖，Angular 太重不需要 |
| HTTP | axios（已在 Listen1 使用） | 复用 provider 代码，浏览器/Node 双兼容 |
| 播放 | HTML5 `<audio>` | WebView 原生，零依赖 |
| 持久化 | `vscode.ExtensionContext.globalState` | VS Code 原生 API，无需 electron-store |
| Cookie | 自定义类（存 globalState） | 替代 chrome.cookies，用户手动导入 |
| 通信 | `webview.postMessage` + `onDidReceiveMessage` | VS Code WebView 标准通信模式 |

**不选的：**
- ❌ React/Vue/Angular — 杀鸡用牛刀，原生 DOM 够用
- ❌ Howler.js — `<audio>` 够用
- ❌ electron-store — globalState 替代
- ❌ lru-cache（歌单）— 歌单数量小，不需要缓存淘汰

## 4. 模块设计

### 4.1 扩展入口 (`src/extension.ts`)

- 注册命令 `listencode.openPlayer`
- 创建 `WebviewPanel`，加载 `media/webview.html`
- 注册 `CookieManager`、`PlaylistManager`、`SearchService`
- 处理 WebView 消息路由

### 4.2 Provider 层 (`src/provider/`)

从 `listen1_chrome_extension-master/js/provider/` 移植：

| 文件 | 移植内容 | 改动 |
|---|---|---|
| `netease.js` | 网易云搜索/播放地址获取 | axios 配置改 Node 适配 |
| `qq.js` | QQ 音乐搜索/播放地址获取 | 同上 |
| `kugou.js` | 酷狗搜索/播放地址获取 | 同上 |
| `bilibili.js` | B站搜索/播放地址获取 | 同上 |
| `loweb.js` | 平台注册/路由 | 几乎不改 |

**移植要点：**
- provider 用 axios 发请求 → axios 在 Node 能跑，但需处理 cookie 注入（手动设 header）
- provider 原来靠 `chrome.cookies` 自动带 cookie → 改为从 `CookieManager` 读取后手动拼 `Cookie` header
- provider 用 `forge` 加密（网易/QQ API 需要）→ forge 是纯 JS，Node 直接跑

### 4.3 Cookie 管理 (`src/cookie.ts`)

```typescript
class CookieManager {
  // 用户粘贴 cookie → 解析 → 存 globalState
  importCookie(platform: string, rawCookie: string): void
  
  // 发给 provider 用
  getCookieHeader(platform: string): string
  
  // 持久化
  private save(): void
  private load(): void
}
```

**用户流程：**
1. 用户从浏览器开发者工具复制某平台 cookie
2. VS Code 命令面板 → "ListenCode: 导入 Cookie" → 选平台 → 粘贴
3. Cookie 存 `globalState`，按平台 key 存储

### 4.4 歌单管理 (`src/playlist.ts`)

```typescript
interface Track {
  id: string;        // 平台前缀+歌曲ID，如 "ne123456"
  title: string;
  artist: string;
  album: string;
  source: string;    // "netease" | "qq" | "kugou" | "bilibili"
  albumCover?: string;
}

interface Playlist {
  id: string;
  name: string;
  tracks: Track[];
}

class PlaylistManager {
  create(name: string): void
  remove(id: string): void
  addTrack(playlistId: string, track: Track): void
  removeTrack(playlistId: string, trackId: string): void
  getAll(): Playlist[]
}
```

歌单存 `globalState`，纯本地，不同步平台。

### 4.5 搜索服务 (`src/search.ts`)

```typescript
class SearchService {
  async search(keyword: string, sources: string[]): Promise<Track[]>
  // 分发到各 provider.search()，聚合结果
}
```

### 4.6 WebView UI (`media/`)

| 文件 | 职责 |
|---|---|
| `webview.html` | UI 骨架：搜索栏 + 结果列表 + 播放栏 + 歌单面板 |
| `webview.css` | 样式（适配 VS Code 主题变量 `--vscode-*`） |
| `webview.js` | 用户交互逻辑 + 扩展通信 |

**UI 布局：**
```
┌─────────────────────────────────┐
│  [搜索框________] [平台选择▼]   │  ← 搜索栏
├─────────────────────────────────┤
│ 🔍 搜索结果                      │
│ ├─ 歌曲1 — 歌手 [+收藏] [▶播放] │
│ ├─ 歌曲2 — 歌手 [+收藏] [▶播放] │  ← 结果列表（可滚动）
│ └─ ...                          │
├─────────────────────────────────┤
│ 我的歌单 ▼                      │
│ ├─ 歌单A (12首)                 │  ← 歌单面板
│ └─ 歌单B (5首)                  │
├─────────────────────────────────┤
│ ◀◀  ▶/❚❚  ▶▶  ━━━━━━━○  🔊    │  ← 播放控制栏
│ 歌曲名 - 歌手        1:23 / 3:45 │
└─────────────────────────────────┘
```

### 4.7 通信协议

WebView ↔ 扩展主机消息格式：

```typescript
// WebView → 扩展主机
{ type: 'search', keyword: string, sources: string[] }
{ type: 'play', track: Track }
{ type: 'control', action: 'pause' | 'next' | 'prev' | 'seek' | 'volume', value?: number }
{ type: 'playlist:create', name: string }
{ type: 'playlist:add', playlistId: string, track: Track }
{ type: 'playlist:remove', playlistId: string, trackId?: string }
{ type: 'playlist:load' }
{ type: 'cookie:import', platform: string, raw: string }

// 扩展主机 → WebView
{ type: 'search:result', tracks: Track[] }
{ type: 'player:status', playing: boolean, currentTrack: Track | null, currentTime: number, duration: number, volume: number }
{ type: 'playlist:list', playlists: Playlist[] }
{ type: 'cookie:status', platform: string, valid: boolean }
```

## 5. 数据流

### 搜索流程
```
用户输入 → WebView postMessage(search)
         → 扩展主机 SearchService.search()
         → 并行调各 provider.search()（axios 发请求到平台 API）
         → 平台返回 → provider 解析 → 返回 Track[]
         → 扩展主机 postMessage(search:result) → WebView 渲染
```

### 播放流程
```
用户点击播放 → WebView postMessage(play, track)
            → 扩展主机调 provider.getPlayUrl(track.id) 获取音频 URL
            → postMessage(play, audioUrl) → WebView <audio src=url> 播放
            → WebView 监听 <audio> timeupdate → postMessage(进度) → 扩展主机记录
```

### Cookie 导入流程
```
用户执行命令 → 选平台 → 输入 cookie
            → CookieManager.importCookie() → 存 globalState
            → provider 发请求时从 CookieManager 读 cookie 拼 header
```

## 6. 项目结构

```
ListenCode/
├── .vscode/
│   ├── launch.json
│   └── tasks.json
├── media/
│   ├── webview.html
│   ├── webview.css
│   └── webview.js
├── src/
│   ├── extension.ts          # 入口
│   ├── cookie.ts             # Cookie 管理
│   ├── playlist.ts           # 歌单管理
│   ├── search.ts             # 搜索服务
│   ├── provider/             # 平台 API（从 Listen1 移植）
│   │   ├── netease.ts
│   │   ├── qq.ts
│   │   ├── kugou.ts
│   │   ├── bilibili.ts
│   │   └── loweb.ts          # 平台路由
│   └── types.ts              # 公共类型定义
├── references/               # 参考项目（不打包）
│   ├── listen1_chrome_extension-master/
│   ├── listen1_desktop-master/
│   └── music-player-master/
├── package.json
├── tsconfig.json
└── README.md
```

## 7. 实施计划

### 阶段 1：脚手架（~1 天）
- [ ] `package.json` — 命令、视图容器、activationEvents
- [ ] `tsconfig.json`
- [ ] `src/extension.ts` — 打开 WebView 面板
- [ ] `media/webview.html` — 空白面板 + Hello World 通信测试
- [ ] 验证：F5 启动扩展 → 命令面板 → 打开面板 → WebView 能 postMessage

### 阶段 2：Provider 移植（~2-3 天）
- [ ] 移植 `netease.ts` — 搜索 + 播放地址获取
- [ ] 移植 `qq.ts`
- [ ] 移植 `kugou.ts`
- [ ] 移植 `bilibili.ts`
- [ ] 移植 `loweb.ts`（平台路由）
- [ ] 搭建 `CookieManager` — 手动注入 cookie 到 axios 请求
- [ ] 命令行测试：`node` 直接调 `search('test', ['netease'])` 能返回结果

### 阶段 3：UI 开发（~2 天）
- [ ] WebView 搜索栏 + 平台选择器
- [ ] 搜索结果列表渲染
- [ ] 播放控制栏（播放/暂停/上/下/进度条）
- [ ] `<audio>` 标签播放 + 状态同步
- [ ] 对接 `webview.js` ↔ `extension.ts` 通信

### 阶段 4：歌单 + Cookie 导入（~1-2 天）
- [ ] `PlaylistManager` CRUD
- [ ] WebView 歌单面板 UI
- [ ] Cookie 导入命令（命令面板 → 选平台 → 输入）
- [ ] Cookie 状态显示（哪个平台有效/过期）

### 阶段 5：打磨（~1 天）
- [ ] 错误处理（网络失败、cookie 过期提示）
- [ ] 加载状态（搜索中、播放中）
- [ ] 适配 VS Code 主题（亮色/暗色）
- [ ] 空状态引导（首次使用提示导入 cookie）

**总计：~7-9 天**

## 8. 风险与对策

| 风险 | 影响 | 对策 |
|---|---|---|
| 平台 API 变更 | provider 失效，搜索/播放不可用 | 模块化 provider，单平台修复不影响其他 |
| Cookie 过期 | 用户需反复手动导入 | 导入界面做友好提示；预留"自动刷新"扩展点 |
| 音频 URL 有时限 | `<audio>` src 可能过期 | 播放前实时获取 URL，不缓存 URL |
| VS Code WebView 限制 | 无背景播放（面板关闭=停止） | 接受限制，面板打开时才播放 |
| 平台反爬升级 | 加密算法变更 | 跟进 Listen1 上游更新，复用其修复 |

## 9. 验证标准

- [ ] `F5` 启动扩展，命令面板输入 "ListenCode" 能打开播放器面板
- [ ] 导入网易 cookie → 搜索歌曲 → 返回结果列表
- [ ] 点击播放 → 声音正常输出 → 进度条走动
- [ ] 上一首/下一首/暂停/进度拖拽 正常
- [ ] 创建歌单 → 添加歌曲 → 关闭 VS Code → 重开歌单仍在
- [ ] 四个平台都能搜索+播放（各自导入 cookie）
- [ ] 无 cookie 时友好提示，不崩溃
