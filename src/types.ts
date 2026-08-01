export interface Track {
  id: string;
  title: string;
  artist: string;
  album: string;
  source: string;
  albumCover?: string;
  url?: string;
}

export interface Playlist {
  id: string;
  name: string;
  tracks: Track[];
}

export type Platform = 'netease' | 'qq' | 'kugou' | 'bilibili';

export const ALL_PLATFORMS: Platform[] = ['netease', 'qq', 'kugou', 'bilibili'];

export const PLATFORM_LABELS: Record<Platform, string> = {
  netease: '网易云音乐',
  qq: 'QQ音乐',
  kugou: '酷狗音乐',
  bilibili: 'B站',
};

// WebView → Extension Host
export type WebviewRequest =
  | { type: 'search'; keyword: string; sources: string[] }
  | { type: 'play'; track: Track }
  | { type: 'control'; action: 'pause' | 'next' | 'prev' | 'seek' | 'volume'; value?: number }
  | { type: 'playlist:create'; name: string }
  | { type: 'playlist:add'; playlistId: string; track: Track }
  | { type: 'playlist:remove'; playlistId: string; trackId?: string }
  | { type: 'playlist:load' }
  | { type: 'cookie:import'; platform: string; raw: string }
  | { type: 'player:state'; playing: boolean; track: Track | null }
  | { type: 'search:loadHistory' }
  | { type: 'mode:set'; mode: string }
  | { type: 'mode:get' };

// Extension Host → WebView
export type WebviewResponse =
  | { type: 'search:result'; tracks: Track[] }
  | { type: 'player:status'; playing: boolean; currentTrack: Track | null; currentTime: number; duration: number; volume: number }
  | { type: 'player:resolve'; url: string | null; track: Track }
  | { type: 'playlist:list'; playlists: Playlist[] }
  | { type: 'cookie:status'; platform: string; valid: boolean }
  | { type: 'playable:status'; status: Record<string, boolean> }
  | { type: 'search:history'; history: string[] }
  | { type: 'mode:current'; mode: string }
  | { type: 'error'; message: string };
