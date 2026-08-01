# 内嵌登录页实现计划

## 方案

WebView 整体导航到外部登录页（不是 iframe），登录完成后当前页 JS 能读到 `document.cookie`。

### 流程
```
1. 用户点击"登录网易云"
2. 扩展创建新 WebviewPanel，HTML 为本地 login.html
3. login.html 内 JS 执行 window.location.href = "https://music.163.com/login"
4. WebView 整体变成网易云登录页
5. 用户在 WebView 内登录
6. 登录成功后页面跳转回 music.163.com
7. login.html 的 JS 持续监听 URL 变化
8. 检测到登录成功 → 读 document.cookie → 通过 acquireVsCodeApi 发回扩展
9. 扩展存 cookie → 关闭面板 → 提示"登录成功"
```

### 关键技术

**WebView 加载外部 URL：**
```javascript
// login.html 中
window.location.href = 'https://music.163.com/login';
```

**捕获 cookie：**
```javascript
// 持续监听，检测到登录成功后
const cookies = document.cookie;
vscode.postMessage({ type: 'login:success', cookie: cookies });
```

**VS Code 端：**
```typescript
const panel = vscode.window.createWebviewPanel(
  'listencode.login',
  '登录网易云',
  vscode.ViewColumn.One,
  { enableScripts: true }
);
panel.webview.html = getLoginHtml('netease');
panel.webview.onDidReceiveMessage(msg => {
  if (msg.type === 'login:success') {
    cookieManager.importCookie('netease', msg.cookie);
    panel.dispose();
  }
});
```

### 实现文件

1. **`media/login.html`** — 登录页 HTML（加载外部 URL + 监听 + 回传 cookie）
2. **`src/extension.ts`** — 新增 `listencode.login` 命令
3. **`package.json`** — 注册命令
4. **`media/webview.js`** — 主面板加"登录"按钮

### 验证

1. Ctrl+Shift+P → "ListenCode: 登录网易云"
2. 面板打开，自动跳转到网易云登录页
3. 在面板内完成登录
4. 自动捕获 cookie → 面板关闭 → 提示成功
5. 搜索播放测试
