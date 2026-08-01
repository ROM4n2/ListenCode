# 播放队列可视化

## 目标

显示当前播放列表 + 当前播放位置，可点击切歌。

## 改动

### 1. `media/webview.html`
在搜索结果区域上方或旁边加一个"当前播放队列"折叠面板：
```html
<div class="queue-panel" id="queuePanel">
  <div class="queue-header">
    <span>播放队列 (<span id="queueCount">0</span>)</span>
    <button id="clearQueueBtn" class="btn-small">清空</button>
  </div>
  <div class="queue-list" id="queueList"></div>
</div>
```

### 2. `media/webview.css`
- `.queue-panel` 样式（折叠面板，最大高度 150px 可滚动）
- `.queue-item` 样式（当前播放项高亮）

### 3. `media/webview.js`
- `renderQueue()` 函数渲染队列
- 点击队列项 → 切到该首
- `clearQueueBtn` → 清空队列
- 播放/切歌时更新队列高亮

### 4. `src/types.ts`
不需要改（队列状态在 WebView 管理）

### 5. `src/extension.ts`
不需要改
