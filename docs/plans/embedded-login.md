# 内嵌登录页（WebView 认证）

## 目标

在扩展 WebView 内直接登录音乐平台，自动捕获 cookie，无需用户手动复制粘贴。

## 当前状态

- **临时方案：** 手动导入 cookie（从浏览器 DevTools 复制）
- **问题：** 用户体验差，cookie 过期需重新导入
- **目标方案：** WebView 内嵌登录页

## 技术方案

### 流程
```
用户点击"登录网易云"
    ↓
WebView 导航到 music.163.com/login
    ↓
用户在 WebView 内完成登录（账号密码/扫码）
    ↓
监听 webview 的 http 响应头 Set-Cookie
    ↓
提取 cookie → 存 globalState → 注入 http 拦截器
    ↓
后续请求自动带 cookie
```

### 关键技术点

1. **WebView 导航外部 URL**
   - `WebviewPanel` 可以加载外部网页
   - 需要 `localResourceRoots` 允许（但外部 URL 可能需要额外配置）

2. **捕获 cookie**
   - 方案 A：监听 `onDidReceiveMessage`，让登录页 JS 把 cookie 发回来
   - 方案 B：VS Code 的 `Webview` 不直接暴露 cookie，需要通过 `asWebviewUri` + 注入 JS 读取 `document.cookie`
   - 方案 C：使用 `vscode.window.withProgress` + 自定义 WebView 拦截请求头

3. **持久化**
   - cookie 存 `globalState`（已做）
   - http 拦截器自动注入（已做）

### 难点

- VS Code WebView 对外部 URL 有限制（CSP、CORS）
- 部分平台登录页有验证码/CAPTCHA，WebView 内可能无法通过
- 扫码登录需要调起手机 App，WebView 内嵌可能体验不好
- 不同平台登录流程差异大

### 实现步骤

1. **调研 VS Code WebView 加载外部 URL 的能力**
2. **设计登录面板 UI**（选择平台 → 加载登录页 → 登录成功提示）
3. **实现 cookie 捕获逻辑**
4. **逐个平台接入**（网易 → QQ → B站 → 酷狗）
5. **过期检测 + 自动提示重新登录**

## 优先级

- 当前：手动导入（已实现）
- 未来：内嵌登录（待实现）
