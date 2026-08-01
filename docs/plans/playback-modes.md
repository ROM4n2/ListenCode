# 播放模式

## 目标

支持三种播放模式：
- **列表循环**：播完最后一首回到第一首（默认）
- **单曲循环**：当前歌曲播完重播
- **随机播放**：下一首随机选

## 改动

### 1. `src/extension.ts` 或 `media/webview.js`

播放逻辑在 WebView 的 `playNext()` / `playPrev()` 里，模式状态放 WebView：
```javascript
let playMode = 'list'; // 'list' | 'single' | 'shuffle'
```

### 2. `media/webview.css`
- 播放模式按钮样式
- 当前模式高亮

### 3. `media/webview.html`
- 播放控制栏加模式切换按钮
- 按钮图标：列表循环 🔁 / 单曲循环 🔂 / 随机 🔀

### 4. `media/webview.js`
- `setMode(mode)` 函数
- `playNext()` 根据模式决定下一首：
  - list: `(index + 1) % length`
  - single: 重播当前
  - shuffle: `Math.floor(Math.random() * length)`
- 模式持久化：`vscode.postMessage({ type: 'mode:set', mode })` 存 globalState
