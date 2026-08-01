import * as vscode from 'vscode';

export interface SourceConfig {
  enabled: boolean;
  priority: number;  // 数字越小优先级越高
}

export interface AppConfig {
  sources: Record<string, SourceConfig>;
  autoLogin: boolean;
}

const DEFAULT_SOURCES: Record<string, SourceConfig> = {
  netease: { enabled: true, priority: 1 },
  qq: { enabled: false, priority: 2 },
  kugou: { enabled: false, priority: 3 },
  bilibili: { enabled: false, priority: 4 },
};

export function getSettings(): AppConfig {
  const config = vscode.workspace.getConfiguration('listencode');
  return {
    sources: config.get<Record<string, SourceConfig>>('sources', DEFAULT_SOURCES),
    autoLogin: config.get<boolean>('autoLogin', true),
  };
}

export function getEnabledSources(): string[] {
  const { sources } = getSettings();
  return Object.entries(sources)
    .filter(([_, cfg]) => cfg.enabled)
    .sort(([a], [b]) => sources[a].priority - sources[b].priority)
    .map(([name]) => name);
}
