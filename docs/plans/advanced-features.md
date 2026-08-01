# 高级功能：歌单同步 / 导入导出 / 拖拽排序

## 功能 1：平台歌单同步

### 目标
用户导入 cookie 后，可以拉取自己在各平台创建/收藏的歌单，直接播放。

### 流程
1. WebView 加"同步歌单"按钮
2. 点击 → 选平台 → 调 `getUserPlaylists(platform)` → 展示歌单列表
3. 点击歌单 → 调 `getPlaylistTracks(platform, playlistId)` → 加入播放队列

### Provider API（从 Listen1 移植）

**网易云**：
- 用户歌单：`https://music.163.com/api/user/playlist` (POST, `{uid, limit, offset}`)
- 需要 cookie 中的 `MUSIC_U` 作为登录态
- 歌单详情：`https://music.163.com/weapi/v3/playlist/detail` (已有)

**QQ音乐**：
- 用户歌单：通过 cookie 中的 `uin` 和 `qm_keyst` 认证
- 接口：`https://c.y.qq.com/rsc/fcgi-bin/fcg_user_created_diss` (类似)

**酷狗**：
- 用户歌单：`https://m.kugou.com/plist/list/{plist_id}?json=true`

**B站**：
- 用户收藏夹：`https://api.bilibili.com/x/v3/fav/folder/created/list-all?up_mid={mid}`

### 实现文件
- `src/provider/netease.ts` — 新增 `getUserPlaylists()`, `getPlaylistTracks()`
- `src/provider/qq.ts` — 同上
- `src/provider/kugou.ts` — 同上
- `src/provider/bilibili.ts` — 同上
- `src/provider/index.ts` — 新增 `getUserPlaylists(platform)`, `getPlaylistTracks(platform, id)`
- `src/extension.ts` — 处理 `userplaylists:get` / `playlist:load` 消息
- `media/webview.html` — 加"同步歌单"按钮 + 歌单模态框
- `media/webview.js` — 同步流程 UI
- `src/types.ts` — 新增消息类型

## 功能 2：歌单导入导出 JSON

### 目标
- 导出：将所有歌单保存为 JSON 文件
- 导入：从 JSON 文件恢复歌单（合并/覆盖）

### 实现
- `src/extension.ts` 注册两个命令：
  - `listencode.exportPlaylists` → `showSaveDialog` → `JSON.stringify` → 写文件
  - `listencode.importPlaylists` → `showOpenDialog` → 读文件 → `JSON.parse` → 合并
- `package.json` 注册命令
- `media/webview.js` 加菜单按钮触发命令

### JSON 格式
```json
{
  "version": 1,
  "exportedAt": "2026-08-01T12:00:00Z",
  "playlists": [
    {
      "name": "我的歌单",
      "tracks": [{ "id": "netrack_xxx", "title": "...", "artist": "...", "source": "netease" }]
    }
  ]
}
```

## 功能 3：歌单内拖拽排序

### 目标
在播放队列/歌单中拖拽调整歌曲顺序。

### 实现（原生 HTML5 拖拽）
- `media/webview.js`：
  - 每个 `.queue-item` 加 `draggable="true"`
  - `dragstart` → 记录拖拽项 index
  - `dragover` → 阻止默认 + 显示放置指示
  - `drop` → 重排序数组 + 保存 + 重新渲染
  - `dragend` → 清理
- `src/playlist.ts` — 新增 `reorderTrack(playlistId, fromIndex, toIndex)`
- `media/webview.css` — `.dragging` / `.drag-over` 样式

## 验证

1. 导入网易 cookie → 同步歌单 → 看到自己的歌单列表 → 点击加载
2. 导出歌单 → JSON 文件下载 → 导入 → 歌单恢复
3. 拖拽队列项 → 顺序改变 → 关闭重开顺序保留
