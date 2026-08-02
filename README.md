# ListenCode

> ⚠️ **项目状态：搁置** — 核心功能（音频播放）无法实现，详见 [docs/postmortem.md](docs/postmortem.md)

---

## 项目简介

ListenCode 是 [Listen1](https://github.com/listen1/listen1_chrome_extension) 的 VS Code 扩展移植版，聚合网易云/QQ/酷狗/B站音乐平台，提供搜索、播放、自建歌单功能。

**目标用户**: 写代码时不想开浏览器切窗口的人。

## 当前状态

| 功能 | 状态 |
|------|------|
| 多平台聚合搜索 | ✅ 完成 |
| B站二维码登录 | ✅ 完成 |
| 歌单管理（CRUD/拖拽/导入导出） | ✅ 完成 |
| 搜索历史 | ✅ 完成 |
| 播放控制（播放/暂停/上/下/进度/音量） | ✅ UI 完成 |
| **音频播放** | ❌ **核心功能不通** |

## 技术栈

- TypeScript + 原生 HTML/CSS/JS（WebView UI）
- VS Code Extension API
- axios（HTTP 客户端）
- Howler.js（音频播放）
- qrcode（二维码登录）
- node-forge（AES/RSA/MD5 加密）

## 项目结构

```
src/
  extension.ts          扩展入口、WebView、消息处理
  audio-server.ts       本地 HTTP 音频代理服务器
  cookie.ts             Cookie 管理（SecretStorage）
  playlist.ts           歌单管理（globalState 持久化）
  search.ts             聚合搜索
  search-history.ts     搜索历史
  settings.ts           音源配置
  types.ts              公共类型
  provider/             平台 API 层
    http.ts             HTTP 客户端 + cookie 注入
    crypto.ts           加密工具（AES/RSA/MD5）
    index.ts            平台路由 + URL 解析
    netease.ts          网易云 API
    qq.ts               QQ 音乐 API
    kugou.ts            酷狗 API
    bilibili.ts         B站 API
media/                  WebView UI
  webview.html/css/js   主界面
  howler.core.min.js    音频库
  login.html            二维码登录页
```

## 快速开始

```bash
# 安装依赖
npm install

# 编译
npm run compile

# 运行单元测试
npm test

# 启动扩展调试
# 在 VS Code 中按 F5
```

## 音频播放问题

**核心问题**: Bilibili CDN URL 具有时间敏感（几分钟过期）和 IP 绑定特性，无法通过本地代理服务器转发给 WebView 播放。

已尝试的方案（均失败）:
- 原生 `<audio>` 元素
- Howler.js（Listen1 同款方案）
- 本地 HTTP 代理（vsc-netease-music 同款方案）
- 流式转发、Range 请求、CORS 头修正

详见 [docs/postmortem.md](docs/postmortem.md) 中的完整排查记录。

## 参考项目

- [listen1_chrome_extension](references/listen1_chrome_extension-master/) — 浏览器扩展版 Listen1
- [vsc-netease-music](references/vsc-netease-music-master/) — VS Code 网易云扩展
- [music_player](references/music-player-master/) — 另一音乐播放器参考

## 文档

- [docs/design.md](docs/design.md) — 产品设计方案
- [docs/dev-rules.md](docs/dev-rules.md) — 开发规范
- [docs/code-review.md](docs/code-review.md) — 代码审查报告
- [docs/test-report.md](docs/test-report.md) — 测试报告
- [docs/postmortem.md](docs/postmortem.md) — 战败总结与经验教训

## 许可证

MIT
