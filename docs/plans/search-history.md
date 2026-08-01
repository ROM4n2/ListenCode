# 搜索历史

## 目标

保存最近 10 次搜索关键词，输入框聚焦时下拉展示，点击直接搜索。

## 改动

### 1. `src/search-history.ts`（新文件）
```typescript
const HISTORY_KEY = 'listencode.searchHistory';
const MAX_HISTORY = 10;

export function getHistory(): string[] { ... }
export function addHistory(keyword: string) { ... }  // 去重 + 限长
```

### 2. `src/extension.ts`
- 搜索成功后调 `addHistory(keyword)`
- 面板打开时发 `search:history` 消息给 WebView

### 3. `media/webview.js`
- 输入框 focus 时发 `search:loadHistory`
- 收到 `search:history` 渲染下拉列表
- 点击历史项 → 填充搜索框 + 触发搜索
- 下拉失焦隐藏

### 4. `src/types.ts`
- 新增消息类型：`search:history`, `search:loadHistory`

### 5. `media/webview.css`
- `.search-history-dropdown` 样式
