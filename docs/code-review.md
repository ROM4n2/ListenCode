# ListenCode Code Review

**审查日期:** 2026-08-01
**审查范围:** `src/` 全部模块 + `media/` WebView + 配置
**审查方式:** 全量静态阅读，未修改任何源文件

---

## 总体评价

项目架构清晰，Provider 层 / Storage 层 / Cookie 层 / WebView 层职责划分合理，从 Listen1 移植的代码结构保持了良好的模块化。通信协议用 TypeScript 联合类型定义，类型安全。但存在若干**安全漏洞**和**功能性 bug**需要优先修复，尤其是 Cookie 跨重启失效和 HTTP 服务器路径遍历。

评级：🟡 **中等 — 可运行，但需修复高优先级问题后再发布**

---

## 🔴 严重 (Critical)

### C-1. 音频服务器存在路径遍历漏洞
**文件:** `src/audio-server.ts:56`
```ts
const trackId = decodeURIComponent(match[1]);
const cacheFile = path.join(cacheDir, `${trackId}${ext}`);
```
`trackId` 直接来自 URL 解码后拼入文件路径。`path.join` 会规范化 `../`，攻击者通过构造 URL（如 `/song/..%2F..%2F..%2Fetc%2Fcron.d%2Ffoo`）可向 `cacheDir` 之外写入或读取文件。

虽然服务器仅监听 `127.0.0.1`，但 WebView 内任意脚本均可发起请求；若未来引入外部链接或 WebView 被 XSS 注入，可被利用。

**修复建议:**
```ts
const trackId = decodeURIComponent(match[1]);
// 只允许字母数字和下划线/中划线
if (!/^[a-zA-Z0-9_-]+$/.test(trackId)) {
  res.writeHead(400); res.end('Bad request'); return;
}
const cacheFile = path.join(cacheDir, `${trackId}${ext}`);
// 二次校验解析后的路径仍在 cacheDir 内
if (!cacheFile.startsWith(path.resolve(cacheDir))) {
  res.writeHead(400); res.end('Bad request'); return;
}
```

### C-2. WebView 缺少 Content Security Policy
**文件:** `src/extension.ts:278`, `media/webview.html`
`getWebviewHtml` 生成的 HTML 未注入 CSP meta 标签。VS Code WebView 最佳实践要求显式 CSP，以防范 XSS 和限制资源加载。当前 WebView 加载外部音频 URL、显示外部图片，无 CSP 意味着注入脚本可外发数据。

**修复建议:** 在 `getWebviewHtml` 的 `<head>` 中注入:
```html
<meta http-equiv="Content-Security-Policy"
  content="default-src 'none';
           script-src 'unsafe-inline' vscode-resource:;
           style-src 'unsafe-inline' vscode-resource:;
           img-src https: vscode-resource:;
           media-src https: http: vscode-resource:;
           connect-src https: http:;">
```
（`'unsafe-inline'` 因现有内联脚本/样式需要，后续可迁移到外部文件以收紧。）

---

## 🟠 高优先级 (High)

### H-1. Cookie 跨重启失效（功能性 bug）
**文件:** `src/cookie.ts:16` vs `src/http.ts:20-25`

两套独立的 Cookie 存储：
- `CookieManager`（cookie.ts）— 持久化到 `globalState`，启动时 `load()`
- `cookieStore`（http.ts）— 纯内存模块变量，初始全空

`updateCookie()` 在用户手动导入时会同步写入两边。但 **VS Code 重启后**，`http.ts` 的 `cookieStore` 不会被 `CookieManager` 的数据填充。结果：用户导入一次 Cookie，重启 VS Code 后所有需要 Cookie 的功能（网易云搜索/播放、B站、QQ 用户歌单）静默失效，仅网易云公开搜索仍能工作。

**修复建议:** 让 `http.ts` 的 `getCookie` 直接以 `CookieManager` 为唯一数据源，或在 `activate()` 中从 `globalState` 重新 `updateCookie` 所有平台。推荐前者——消除双源真相。

### H-2. 重复注册消息监听器导致副作用翻倍
**文件:** `src/extension.ts:37-39, 68-70`

`openPlayer` 和 `quickPlay` 命令都在 `createPlayerPanel` **之后** 注册 `panel.webview.onDidReceiveMessage(handleWebviewMessage)`。当面板已存在时（`activePanel` 复用），每次调用命令都会**叠加**一个新监听器。

后果：用户多次使用 Quick Play 后，一条 `play` 消息触发 N 次 `resolvePlayUrl`（重复网络请求）、N 次 `postMessage('player:resolve')`（WebView 收到 N 次响应，音频 src 被反复设置），`search` 消息发出 N 次 `search:result`。

**修复建议:** 将 `onDidReceiveMessage` 注册移入 `createPlayerPanel` 内部（仅注册一次），命令 handler 中不再重复注册。

### H-3. HTTP 服务器资源未释放 + 无防护
**文件:** `src/audio-server.ts:8-9, 128-134`, `src/extension.ts:477`

- `deactivate()` 为空，HTTP 服务器在扩展停用时从未关闭，端口持续占用。
- `playableStatus` Map 只增不减，长期使用后内存持续增长。
- 服务器无并发连接限制、无请求超时、无请求体/头大小限制。

**修复建议:**
```ts
export function deactivate() {
  if (server) { server.close(); server = null; port = 0; }
}
```
为 `playableStatus` 加 LRU 淘汰或按搜索会话清空；服务器加 `server.setTimeout(...)` 和连接数上限。

### H-4. 酷狗歌单歌曲 ID 前缀不一致导致无法播放
**文件:** `src/provider/kugou.ts:111` vs `src/provider/index.ts:80`

- `getPlaylistTracks` 生成的 track id 前缀为 `kgtrack_`
- `getProviderByTrackId` 仅识别 `kghash_` 前缀

→ 酷狗歌单里加载的歌曲点击播放时，`resolvePlayUrl` 返回 `{url: null, cookie: ''}`，被判定为不可播。

**修复建议:** 统一前缀为 `kghash_`（与搜索结果的 `mapSong` 一致），或在 `getProviderByTrackId` 增加 `kgtrack_` 识别。

---

## 🟡 中优先级 (Medium)

### M-1. 播放地址重复请求（性能浪费）
**文件:** `src/extension.ts:324-332, 344`

搜索后 `preCheckPlayable(top10)` 已调用 `resolvePlayUrl` 获取了 URL，但只保留布尔值；用户实际播放时再次调用 `resolvePlayUrl`。每首歌播放 = 2 次平台 API 请求（B站因 `getPlayUrl` 内部 2 次请求，实际 = 4 次）。

**修复建议:** 缓存 `resolvePlayUrl` 的 URL 结果（按 trackId + 时间 TTL），播放时优先读缓存。

### M-2. Range 请求解析无校验
**文件:** `src/audio-server.ts:100-103`
```ts
const start = parseInt(parts[0], 10);
const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
```
`parseInt` 可能返回 `NaN`；未校验 `start <= end`、`end < fileSize`。畸形 Range 头可导致 `createReadStream` 异常或 500。

**修复建议:** 校验数值合法性，非法时回退完整文件 200 响应。

### M-3. 导入歌单无数据校验
**文件:** `src/extension.ts:108-116`
`JSON.parse` 未包 `try/catch`；`data.playlists` 元素未校验结构。恶意/损坏的 JSON 文件可导致扩展崩溃。

**修复建议:** 包裹 `try/catch`，校验 `name`、`tracks` 为数组，单条失败不阻断整体。

### M-4. QQ 音乐播放地址使用明文 HTTP
**文件:** `src/provider/qq.ts:100`
```ts
return `http://ws.stream.qqmusic.qq.com/${purl}`;
```
明文 HTTP 音频流可被中间人篡改。应优先使用 `https://`（QQ 支持），或交由本地代理时保留 https。

### M-5. AES 密钥使用 `Math.random()` 生成
**文件:** `src/provider/crypto.ts:42-49`
`createSecretKey` 用 `Math.random()`，非密码学安全。网易云 API 的 `encSecKey` 虽为客户端加密（非真正安全通道），但使用 `crypto.randomBytes` 更规范，也与上游 Listen1 的改进方向一致。

### M-6. 同步缓存清理 + `maxContentLength` 对流不适用
**文件:** `src/audio-server.ts:85-92`
- `cleanupCache()` 在每次缓存写入时同步调用 `readdirSync` + `statSync`，应改为异步或低频触发。
- `maxContentLength: 100MB` 对 `responseType: 'stream'` 的 axios 不生效（该限制仅对非流响应体生效），100MB 上限形同虚设。

### M-7. 未使用的导出 / 死代码
- `search.ts:26` `searchWithPreCheck` — 从未被调用
- `audio-server.ts:36` `getAudioServerPort` — 从未被调用
- `types.ts:32` `control` 消息类型 — 定义了但 `handleWebviewMessage` 无对应 case，WebView 也不发送
- `extension.ts:464` 用 `require('fs')` 而顶部已 `import * as fs` — 不一致

---

## 🟢 低优先级 (Low)

### L-1. Cookie 明文持久化
Cookie 以明文存于 `globalState`（VS Code 的 `state.vscdb` SQLite）。若机器被他人访问，账号 Cookie 可被窃取。可考虑用 `vscode.SecretStorage`（依托系统密钥链）替代 `globalState` 存储敏感 Cookie。

### L-2. 无测试套件
`package.json` 有 `test` 脚本但 `src/` 中无任何 `*.test.ts`。建议至少为 `crypto.ts`、`cookie.ts`、`parseCookieInput` 等纯函数添加单元测试。

### L-3. `node-forge.d.ts` 类型声明不完整
`src/types/node-forge.d.ts` 是手写的 ambient 声明，与真实 node-forge API 可能有偏差。`skipLibCheck: true` 掩盖了问题。可考虑 `@types/node-forge`（如可用）或直接引用包类型。

### L-4. 用户体验细节
- `webview.js:308` `addToPlaylist` 始终加到第一个歌单，多歌单时无法选择目标。
- `webview.js:314` 新建歌单用 `prompt()`，体验一般但可接受。
- `search-history.ts` 无单条删除，仅能靠覆盖。
- `login.html` 的 `pollTimer` 在面板被外部关闭时可能继续 `setInterval`（调用 `postMessage` 到已 dispose 的 webview），建议面板 `visibilitychange` 时暂停轮询。

---

## 架构评价

| 维度 | 评分 | 说明 |
|---|---|---|
| 模块划分 | ⭐⭐⭐⭐ | Provider / Cookie / Playlist / Search / Audio 分层清晰 |
| 类型安全 | ⭐⭐⭐⭐ | 消息协议用联合类型，strict 模式开启 |
| 错误处理 | ⭐⭐⭐ | 主流程有 try/catch，但边界校验不足 |
| 安全性 | ⭐⭐ | 路径遍历、无 CSP、Cookie 明文、HTTP 明文 |
| 性能 | ⭐⭐⭐ | 流式传输合理，但重复请求和同步清理可优化 |
| 可维护性 | ⭐⭐⭐⭐ | 命名清晰，dev-rules.md 规范到位，死代码少 |

---

## 修复优先级建议

1. **立即修复（阻塞发布）:** C-1 路径遍历、C-2 CSP、H-1 Cookie 重启失效、H-2 重复监听器
2. **短期修复（首个版本前）:** H-3 资源释放、H-4 酷狗 ID 前缀、M-1 重复请求、M-3 导入校验
3. **中期改进:** M-2 Range 校验、M-4 HTTPS、M-5 CSPRNG、L-1 SecretStorage
4. **长期打磨:** L-2 测试、死代码清理、UX 细节
