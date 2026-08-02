# ListenCode 项目战败总结

**日期:** 2026-08-02
**状态:** 暂停 / 搁置
**原因:** 核心功能（音频播放）无法实现

---

## 1. 项目回顾

### 目标
VS Code 扩展版 Listen1，聚合网易/QQ/酷狗/B站音乐平台，提供搜索、播放、自建歌单。

### 完成度：~65%

| 功能 | 状态 | 备注 |
|------|------|------|
| 多平台聚合搜索 | ✅ 完成 | B站/QQ/酷狗正常，网易云 -462 风控 |
| B站二维码登录 | ✅ 完成 | 扫码+轮询+Cookie 存储 |
| 歌单 CRUD | ✅ 完成 | 创建/删除/拖拽排序/导入导出 JSON |
| 搜索历史 | ✅ 完成 | 下拉/去重/单条删除 |
| 播放队列 | ✅ 完成 | 列表循环/单曲/随机 |
| 音源管理设置 | ✅ 完成 | 启用/禁用/优先级 |
| 代码审查修复 | ✅ 完成 | 16 个问题全部修复 |
| 单元测试 | ✅ 完成 | 20/20 通过 |
| **音频播放** | ❌ **失败** | B站/QQ/酷狗/网易云均无法播放 |

### 代码规模
- 源码：~2000 行（TypeScript + JS + CSS）
- 提交：~40 个 commit
- 依赖：axios, qrcode, node-forge, howler

---

## 2. 核心问题：音频播放

### 2.1 现象
所有平台的音频播放均失败。主要测试平台为 Bilibili（其他平台依赖的 CDN 机制类似）。

### 2.2 根因分析

**Bilibili CDN URL 的两个致命特性：**

1. **时间敏感** — URL 包含 `deadline` 参数，通常几分钟内过期
2. **IP 绑定** — URL 与请求者 IP 绑定，换 IP 返回 403

**当前架构的缺陷：**
```
resolvePlayUrl() → 获取 CDN URL → 本地代理服务器 → WebView → <audio>/Howl
      ↑                    ↑              ↑              ↑
   扩展主机              URL 可能过期    IP 可能不同    WebView 源
```

中间环节太多，每一步都可能导致 URL 失效。

### 2.3 尝试过的方案（按时间顺序）

| # | 方案 | 结果 | 失败原因 |
|---|------|------|----------|
| 1 | `<audio>` + `fnval=1` MP4 | 无声 | durl 返回无音轨视频流 |
| 2 | `<audio>` + `fnval=16` DASH 音频 | SRC_NOT_SUPPORTED | 编码不支持 |
| 3 | 加 Range/CORS 头 | 无效 | 非头信息问题 |
| 4 | 下载到磁盘再服务 | 无效 | 文件内容问题 |
| 5 | 流式代理（vsc-netease-music 模式） | 无效 | URL 过期/IP 绑定 |
| 6 | ftyp 魔数校验 | 无效 | 文件有效但编码不支持 |
| 7 | Howler.js（Listen1 模式） | 无效 | 底层仍是 `<audio>` |
| 8 | CSP 修正 + `media-src *` | 无效 | 非 CSP 问题 |
| 9 | 选择 AAC-LC 编码流 | 无效 | URL 已过期 |
| 10 | `crossorigin="anonymous"` | 无效 | 非 CORS 问题 |

### 2.4 关键发现

1. **Howler.js 加载成功** — 通过 `webview.asWebviewUri()` 引用后解决
2. **CSP 不是主因** — 修正后仍然无法播放
3. **CDN URL 确实有效** — 服务器端能获取 206 响应，ftyp 校验通过
4. **问题出在 WebView 加载时** — URL 可能在代理转发过程中过期

---

## 3. 参考项目对比

### Listen1（浏览器扩展）
- **架构**: 浏览器直接访问 CDN URL，无中间代理
- **播放**: Howler.js + `html5: true` + `format: ['mp3']`
- **为何能跑通**: 浏览器扩展无 WebView 隔离，URL 直接传给 `<audio>`

### vsc-netease-music-master（VS Code 扩展）
- **架构**: 本地 HTTP 代理服务器，`response.pipe(res)` 流式转发
- **播放**: `<audio src="http://localhost:16363/song/id">`
- **为何能跑通**: 网易云 CDN URL 无严格 IP 绑定，且 URL 有效期较长

### 关键差异
- 网易云 CDN 对代理友好（URL 有效期长、无严格 IP 绑定）
- Bilibili CDN 对代理不友好（URL 几分钟过期、严格 IP 绑定）

---

## 4. 未来重启建议

### 4.1 如果继续做 Bilibili

**唯一可行路径**: WebView 直接访问 CDN URL（跳过代理）

```
resolvePlayUrl() → CDN URL → 直接发给 WebView → <audio src="CDN_URL">
```

需要解决的问题:
1. CDN 是否允许 `vscode-resource://` 来源的 CORS 请求？
2. URL 过期 — 每次播放前实时解析（不能用缓存）
3. VS Code WebView 的安全策略是否允许？

### 4.2 如果换平台

网易云/QQ/酷狗可能更容易（CDN 限制较少），但:
- 网易云搜索被风控（-462）
- QQ/酷狗的 API 也可能随时变更

### 4.3 如果换架构

考虑放弃 WebView 代理模式，改用:
- VS Code 的 `WebviewView`（侧边栏 WebView）
- 或者干脆做成独立的 Electron 应用（无 WebView 限制）

---

## 5. 保留的资产

### 5.1 可复用代码
- `src/provider/` — 各平台 API 层（搜索/URL 解析/加密）
- `src/cookie.ts` — Cookie 管理（SecretStorage）
- `src/playlist.ts` — 歌单管理（globalState 持久化）
- `src/search.ts` / `search-history.ts` — 搜索与历史
- `media/webview.html/css/js` — UI 层（只需改播放部分）

### 5.2 参考项目
- `references/listen1_chrome_extension-master/` — 浏览器扩展版 Listen1
- `references/vsc-netease-music-master/` — VS Code 网易云扩展
- `references/music-player-master/` — 另一音乐播放器参考

### 5.3 文档
- `docs/code-review.md` — 代码审查报告
- `docs/test-report.md` — 测试报告
- `docs/design.md` — 产品设计方案
- `docs/dev-rules.md` — 开发规范

---

## 6. 教训

1. **先验证核心可行性** — 在投入大量代码前，应该先做一个最小原型验证"能不能播"
2. **CDN 限制是客观存在的** — 不是代码能解决的问题，是平台的反爬策略
3. **不要在一个无解的问题上反复尝试** — 应该更早停下来重新评估架构
4. **参考实现有其上下文** — Listen1 能跑通是因为浏览器扩展的上下文，VS Code WebView 完全不同

---

## 7. 项目结构快照

```
src/
  extension.ts          入口、命令、WebView、消息处理
  audio-server.ts       本地 HTTP 代理服务器（流式代理模式）
  cookie.ts             Cookie 管理（SecretStorage）
  playlist.ts           歌单管理（globalState）
  search.ts             聚合搜索
  search-history.ts     搜索历史
  settings.ts           音源配置
  types.ts              公共类型
  provider/
    http.ts             Axios 客户端 + cookie 注入
    crypto.ts           AES/RSA/MD5（网易云 WeAPI）
    index.ts            平台路由 + URL 解析
    netease.ts          网易云 API
    qq.ts               QQ 音乐 API
    kugou.ts            酷狗 API
    bilibili.ts         B站 API（DASH 音频）
media/
  webview.html          主 UI 结构
  webview.css           VS Code 主题样式
  webview.js            UI 交互 + Howler.js 播放
  howler.core.min.js    Howler.js 库
  login.html            二维码登录页
```

---

## 8. 环境信息

- **Node.js**: 18+
- **VS Code**: ^1.87.0
- **TypeScript**: ^5.3.3
- **关键依赖**: axios, qrcode, node-forge, howler
- **测试**: `npm test`（20 个单元测试）
- **调试**: F5 启动扩展调试
