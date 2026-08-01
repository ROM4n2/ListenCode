# 自动登录方案

## 目标

网易云音乐自动登录，无需用户手动复制粘贴 cookie。

## 方案：二维码登录

### 流程
```
1. 扩展调用网易云 API 获取二维码 key
2. 生成二维码图片 URL
3. 在 WebView 显示二维码
4. 用户用手机网易云 App 扫码
5. 扩展轮询扫码状态
6. 扫码成功后自动获取 cookie
7. 存 globalState，后续自动使用
```

### 网易云二维码登录 API

1. **获取二维码 key**
   ```
   POST https://music.163.com/weapi/login/qrcode/unikey
   {csrf_token: ""}
   → {unikey: "xxx-xxx-xxx-xxx", code: 200}
   ```

2. **生成二维码 URL**
   ```
   https://music.163.com/login?codekey={unikey}
   ```

3. **轮询扫码状态**
   ```
   POST https://music.163.com/weapi/login/qrcode/client/login
   {csrf_token: "", key: unikey, type: 1}
   → 801=等待扫码, 802=已扫码待确认, 803=登录成功(返回cookie), 800=过期
   ```

### 实现文件

- `src/provider/netease.ts` — 新增 `getQRCodeKey()`, `pollQRCodeStatus()`
- `media/login.html` — 二维码登录 UI
- `src/extension.ts` — 处理登录流程
- `src/settings.ts` — 音源管理设置

### 音源管理设置

```json
{
  "listencode.sources": {
    "netease": { "enabled": true, "priority": 1 },
    "qq": { "enabled": false, "priority": 2 },
    "kugou": { "enabled": false, "priority": 3 },
    "bilibili": { "enabled": false, "priority": 4 }
  },
  "listencode.autoLogin": true,
  "listencode.cookieExpiryHours": 168
}
```

### 优先级逻辑

搜索时按优先级排序启用平台，高优先级平台的结果排在前面。
