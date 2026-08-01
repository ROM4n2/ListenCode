# 命令面板快速播放 + 状态栏显示

## 目标

1. **命令面板快速播放**：`Ctrl+Shift+P` → "ListenCode: 快速播放" → 输入歌名 → 直接播放第一首可播歌曲，不开面板
2. **状态栏显示**：底部状态栏显示当前播放歌曲，点击可暂停/播放

## 改动

### 1. `src/extension.ts`

**快速播放命令：**
- 注册 `listencode.quickPlay`
- 流程：`showInputBox` 输入歌名 → `searchAll` 搜索全部平台 → `preCheckPlayable` 找第一首可播 → 获取播放地址 → 内部播放
- 播放通过隐藏的 WebView 或直接用 `<audio>` 不可行（WebView 必须挂面板），改用**后台播放方案**：
  - 创建隐藏 WebView 加载 audio 标签
  - 或者：状态栏命令只搜索，找到后自动打开面板播放
  - **简化方案**：快速播放 = 打开面板 + 自动搜索 + 自动播放第一首

**状态栏：**
- `vscode.window.createStatusBarItem`
- 显示 `♪ 歌曲名 - 歌手`
- 点击命令：`listencode.togglePlay`（暂停/播放）
- 播放时更新，停止时隐藏
- 需要跟踪播放状态（模块级变量 `isPlaying`, `currentTrack`）

### 2. `package.json`
- 新增命令 `listencode.quickPlay`、`listencode.togglePlay`
- 状态栏 item（代码创建，非 package.json）

### 3. `media/webview.js`
- 播放开始/暂停时通知扩展主机更新状态栏
- 新增消息类型 `{ type: 'player:state', playing: boolean, track: Track }`

### 4. `src/types.ts`
- `WebviewRequest` 新增 `{ type: 'player:state', playing: boolean; track: Track }`

## 验证

1. `Ctrl+Shift+P` → "ListenCode: 快速播放" → 输入歌名 → 面板打开且自动播放
2. 播放时底部状态栏显示歌曲名
3. 点击状态栏 → 暂停/播放切换
4. 停止后状态栏隐藏
