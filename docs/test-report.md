# ListenCode 测试报告

**日期**: 2026-08-01
**测试范围**: 编译、单元测试、网络 API 测试

---

## 1. 编译测试

| 项目 | 结果 |
|------|------|
| `npx tsc -p ./` | ✅ 通过 (exit code 0) |

TypeScript 编译无错误，生成 `out/` 目录。

---

## 2. 单元测试（无需网络）

### 2.1 PlaylistManager
| 测试项 | 结果 |
|--------|------|
| `create()` 创建歌单 | ✅ |
| `addTrack()` 添加歌曲 | ✅ |
| `addTrack()` 重复添加拒绝 | ✅ |
| `reorderTrack()` 重新排序 | ✅ |
| `getById()` 查找 | ✅ |
| `removeTrack()` 删除歌曲 | ✅ |
| `remove()` 删除歌单 | ✅ |
| 持久化（新实例加载） | ✅ |

### 2.2 CookieManager + parseCookieInput
| 测试项 | 结果 |
|--------|------|
| 原始 `name=value` 格式 | ✅ |
| Tab 分隔 DevTools 格式 | ✅ |
| Tab + 表头（跳过表头） | ✅ |
| JSON 数组格式 | ✅ |
| 空字符串 | ✅ |
| `importCookie` / `hasCookie` / `getCookieHeader` | ✅ |
| `getActivePlatforms` | ✅ |
| `getAllStatus` | ✅ |
| `remove` | ✅ |

### 2.3 SearchHistory
| 测试项 | 结果 |
|--------|------|
| 初始为空 | ✅ |
| 添加关键词 | ✅ |
| 去重（重复关键词移到最前） | ✅ |
| 溢出保护（最多 10 条） | ✅ |

### 2.4 类型模块
| 测试项 | 结果 |
|--------|------|
| `types.js` 加载 | ✅ |
| `ALL_PLATFORMS` / `PLATFORM_LABELS` 导出 | ✅ |

### 2.5 getProviderByTrackId
| 输入 | 结果 |
|------|------|
| `netrack_123` | ✅ → `netease` |
| `qqtrack_abc` | ✅ → `qq` |
| `kghash_abc` | ✅ → `kugou` |
| `bibvid_abc` | ✅ → `bilibili` |
| `unknown_123` | ✅ → `null` |

---

## 3. 网络 API 测试

### 3.1 各平台搜索

| 平台 | 关键词 | 结果 | 备注 |
|------|--------|------|------|
| QQ音乐 | 周杰伦 | ✅ 20 首 | 正常工作 |
| 酷狗音乐 | 周杰伦 | ✅ 20 首 | 正常工作 |
| B站 | 音乐 | ✅ 20 首 | 正常工作 |
| **网易云音乐** | 周杰伦 | ❌ 0 首 | ⚠️ API 返回 `-462`（需绑定手机） |

### 3.2 二维码登录

| 平台 | 接口 | 结果 | 备注 |
|------|------|------|------|
| B站 | `getQRCodeKey` | ✅ | 正常返回 key + url |
| **网易云音乐** | `getQRCodeKey` | ⚠️ | 返回 `undefined`（API 返回 code=400 参数错误） |
| 通用 | `generateQRDataUrl` | ✅ | 正常生成 PNG Data URL |

### 3.3 音频服务器

| 测试项 | 结果 |
|--------|------|
| `startAudioServer()` 启动 | ✅ 随机端口 |
| 重复调用返回缓存端口 | ✅ |
| `getAudioServerPort()` | ✅ |
| `getAudioUrl()` 生成 URL | ✅ |
| 未知路由返回 404 | ✅ |
| `/song/:id` 不可播放返回 404 | ✅（无登录 cookie 时预期行为） |

---

## 4. 发现的问题

### 🔴 严重：网易云音乐 API 被风控

**现象**: `https://music.163.com/api/search/pc` 返回：
```json
{"code":-462,"message":"请绑定手机后再试哦~"}
```

**原因**: 网易云音乐对未登录 + 无手机绑定的请求增加了反爬限制，`api/search/pc` 接口现在需要登录态。

**影响**:
- 搜索返回空列表
- 二维码登录 `getQRCodeKey()` 返回 `undefined`（weapi 参数加密可能失效）

**建议**:
1. 需要登录后才能使用网易云搜索（通过 Cookie 导入）
2. 考虑切换到需要 Cookie 的搜索接口（如 `/api/search/get/web`）
3. weapi 参数加密可能需要更新（当前返回 400 参数错误）

### 🟡 次要：酷狗歌曲 ID 前缀不匹配

`getPlaylistTracks()` 生成的 ID 前缀是 `kgtrack_`，但 `getProviderByTrackId()` 只识别 `kghash_` 前缀。如果通过歌单加载的歌曲，`resolvePlayUrl` 会找不到对应平台。

**位置**: `provider/kugou.ts:111` 使用了 `kgtrack_` 前缀，而 `search()` 使用 `kghash_` 前缀。

---

## 5. 测试总结

| 类别 | 通过 | 失败 | 警告 |
|------|------|------|------|
| 编译 | 1 | 0 | 0 |
| 单元测试 | 15 | 0 | 0 |
| 网络 API | 5 | 1 | 2 |

**结论**: 核心逻辑（播放列表、Cookie、历史、音频服务、类型系统）全部正确。
网易云音乐 API 因第三方平台风控不可用，其他三个平台（QQ/酷狗/B站）均正常。
