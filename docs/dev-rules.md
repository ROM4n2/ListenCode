# ListenCode 开发规范

## 1. 工作模式

**混合模式：**
- 明显问题（根因明确、改动 < 50 行）→ 直接修复，记录 commit
- 复杂任务（新功能、架构变更、bug 根因不明）→ 走 superpowers 流程：
  1. 检查适用 skill（brainstorming / systematic-debugging / writing-plans）
  2. 制定计划
  3. 优先派子代理执行
  4. 主对话保持上下文 ≤500K

## 2. 记录要求

**每步操作必须：**
- 文字记录：改了什么、为什么、结果如何
- Git 提交：原子 commit，message 清晰

**Commit 规范：**
```
<type>: <description>

type:
  feat     新功能
  fix      修复 bug
  refactor 重构
  docs     文档
  chore    构建/工具
  test     测试

示例:
  feat: add kugou provider play URL resolution
  fix: kugou bootstrap_track use wrong API endpoint
```

## 3. 上下文管理

- 主对话 token 上限 500K
- 大文件探索、代码搜索 → 派 Explore 子代理
- 并行独立任务 → 派多个子代理
- 长会话定期 `/compact`

## 4. 复杂任务流程

1. **调研** — 先查 references/ 和 GitHub 有无现成实现，吸取经验
2. **理解** — 读相关代码，明确需求
3. **计划** — 写设计方案到 `docs/plans/`
4. **执行** — 子代理或本对话写代码
5. **验证** — 编译通过、功能可测试
6. **记录** — git commit + 文字总结

## 5. 代码规范

- TypeScript strict mode
- 文件名 kebab-case（`cookie.ts` 非 `CookieManager.ts`）
- 模块职责单一
- Provider 层平台无关逻辑抽到 `http.ts` / `crypto.ts`
- WebView 不直接调 Node API，全部走 postMessage

## 6. 文件结构约定

```
docs/               文档
  design.md         产品设计方案
  dev-rules.md      本文件
  plans/            复杂任务计划
src/                源码
  extension.ts      入口
  types.ts          公共类型
  cookie.ts         Cookie 管理
  playlist.ts       歌单管理
  search.ts         搜索服务
  provider/         平台 API
    http.ts         HTTP 客户端 + cookie 注入
    crypto.ts       加密工具（AES/RSA/MD5）
    index.ts        平台路由
    netease.ts      网易云
    qq.ts           QQ音乐
    kugou.ts        酷狗
    bilibili.ts     B站
media/              WebView UI
  webview.html
  webview.css
  webview.js
references/         参考项目（gitignored）
```

## 7. 用户角色

- 用户 = 甲方（提需求、审阅关键节点）
- Claude = 产品经理 + 开发者（出方案、写代码、维护）
- 用户只做关键审阅，代码由 Claude 撰写
