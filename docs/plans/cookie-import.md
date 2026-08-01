# Cookie 粘贴优化

## 目标

用户从浏览器 DevTools 复制的 cookie 格式多样，扩展应自动解析：
1. `document.cookie` 格式：`name=value; name2=value2`
2. DevTools 表格格式（Tab 分隔）：`name\tvalue\tdomain\t...`
3. JSON 格式（复制自导出）

## 改动

### 1. `src/cookie.ts` 新增解析函数
```typescript
export function parseCookieInput(raw: string): string {
  // 去掉首尾空白
  raw = raw.trim();
  if (!raw) {return '';}
  
  // 1. 已经是 name=value; name=value 格式
  if (raw.includes('=') && !raw.includes('\t') && !raw.startsWith('{')) {
    return raw;
  }
  
  // 2. DevTools 表格格式（Tab 分隔多列，第一行可能是表头）
  if (raw.includes('\t')) {
    const lines = raw.split('\n').filter(l => l.trim());
    const cookies: string[] = [];
    for (const line of lines) {
      const parts = line.split('\t');
      if (parts.length >= 2 && parts[0] && parts[1]) {
        // 跳过表头行（name 在第一列且第二列是 value）
        if (parts[0].toLowerCase() === 'name' && parts[1].toLowerCase() === 'value') {
          continue;
        }
        cookies.push(`${parts[0].trim()}=${parts[1].trim()}`);
      }
    }
    return cookies.join('; ');
  }
  
  // 3. JSON 格式
  if (raw.startsWith('{') || raw.startsWith('[')) {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        // [{name, value}, ...]
        return parsed.map((c: any) => `${c.name}=${c.value}`).join('; ');
      }
    } catch {
      // 解析失败，原样返回
    }
  }
  
  return raw;
}
```

### 2. `src/extension.ts`
- 导入 Cookie 命令：用 `parseCookieInput` 解析后存

### 3. `src/types.ts`
- `cookie:import` 消息处理中调解析

## 验证

1. 粘贴 `name=value; name2=value2` → 直接存
2. 粘贴 DevTools 表格（Tab 分隔）→ 自动提取 name=value
3. 粘贴 JSON 数组 → 自动提取
