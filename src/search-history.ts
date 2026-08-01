import * as vscode from 'vscode';
const HISTORY_KEY = 'listencode.searchHistory';
const MAX_HISTORY = 10;

export function getHistory(context: vscode.ExtensionContext): string[] {
  return context.globalState.get<string[]>(HISTORY_KEY, []);
}

export function addHistory(context: vscode.ExtensionContext, keyword: string): void {
  let history = getHistory(context);
  history = history.filter(h => h !== keyword);  // 去重
  history.unshift(keyword);                       // 最新在前
  history = history.slice(0, MAX_HISTORY);        // 限长
  context.globalState.update(HISTORY_KEY, history);
}

export function removeHistory(context: vscode.ExtensionContext, index: number): void {
  const history = getHistory(context);
  if (index >= 0 && index < history.length) {
    history.splice(index, 1);
    context.globalState.update(HISTORY_KEY, history);
  }
}
