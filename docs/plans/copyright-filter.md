# 版权过滤计划（方案 C：混合预检）

## 目标

聚合搜索返回全量结果，后台预检前 10 首播放地址，标记"版权受限"歌曲。用户点击非预检歌曲时实时获取地址。

## 流程

```
搜索 → 立即返回全部结果 → WebView 渲染（全部可点）
     ↓ 后台并行预检前 10 首
     ↓ 返回 { trackId: playable: boolean }
     ↓
     → WebView 更新：不可播放标灰 + "版权受限"
```

用户点击时：
- 已预检且可播 → 直接获取地址播放
- 已预检且不可播 → 提示"版权受限"
- 未预检 → 实时获取地址，成功则播放，失败则提示

## 改动文件

### 1. `src/provider/index.ts`
新增 `preCheckPlayable(tracks: Track[]): Promise<Map<string, boolean>>`
- 接收 track 数组
- 并行调各平台 `getPlayUrl()`
- 返回 Map<trackId, isPlayable>

### 2. `src/search.ts`
新增 `searchWithPreCheck(keyword, sources): Promise<{tracks: Track[], preCheck: Map<string, boolean>}>`

### 3. `src/extension.ts`
- 搜索消息处理：返回结果后，后台调 `preCheckPlayable`
- 预检完成后发 `{ type: 'playable:status', status: Record<string, boolean> }`
- 播放消息处理：若 trackId 已知不可播，直接返回错误

### 4. `media/webview.js`
- 新增 `playableStatus` 状态对象
- `renderTracks` 时根据状态给不可播项加 `.unplayable` class
- 点击播放时检查状态：
  - `false` → 提示"该歌曲因版权原因无法播放"
  - `true` / `undefined` → 正常请求播放
- 接收 `playable:status` 消息更新 UI

### 5. `media/webview.css`
- `.track.unplayable` → opacity 0.4, cursor not-allowed
- `.track.unplayable::after` → "版权受限" 标签

## 验证

1. 搜索周杰伦 → 前 10 首预检，不可播的标灰
2. 搜索独立音乐人 → 全部可播
3. 点击未预检歌曲 → 实时获取，成功则播
4. 点击已知不可播 → 提示版权受限
