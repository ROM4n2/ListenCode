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
  | { type: 'playlist:create'; name: string }
  | { type: 'playlist:add'; playlistId: string; track: Track }
  | { type: 'playlist:createAndAdd'; name: string; track: Track }
  | { type: 'playlist:remove'; playlistId: string; trackId?: string }
  | { type: 'playlist:reorder'; playlistId: string; fromIndex: number; toIndex: number }
  | { type: 'playlist:load' }
  | { type: 'playlists:export' }
  | { type: 'playlists:import' }
  | { type: 'cookie:import'; platform: string; raw: string }
  | { type: 'login:openUrl'; url: string; platform: string }
  | { type: 'login:paste'; platform: string }
  | { type: 'player:state'; playing: boolean; track: Track | null }
  | { type: 'search:loadHistory' }
  | { type: 'mode:set'; mode: string }
  | { type: 'mode:get' }
  | { type: 'userplaylists:get'; platform: string }
  | { type: 'open:login' }
  | { type: 'playlist:syncLoad'; platform: string; playlistId: string }
  | { type: 'login:start' }
  | { type: 'login:poll'; unikey: string };

// Extension Host → WebView
export type WebviewResponse =
  | { type: 'search:result'; tracks: Track[] }
  | { type: 'player:status'; playing: boolean; currentTrack: Track | null; currentTime: number; duration: number; volume: number }
  | { type: 'player:resolve'; url: string | null; cookie: string; track: Track }
  | { type: 'playlist:list'; playlists: Playlist[] }
  | { type: 'cookie:status'; platform: string; valid: boolean }
  | { type: 'playable:status'; status: Record<string, boolean> }
  | { type: 'search:history'; history: string[] }
  | { type: 'mode:current'; mode: string }
  | { type: 'userplaylists:list'; platform: string; playlists: Array<{id: string, title: string, cover?: string, count: number}> }
  | { type: 'playlist:tracks'; tracks: Track[] }
  | { type: 'login:qrcode'; url: string }
  | { type: 'login:status'; status: {code: number, message?: string} }
  | { type: 'error'; message: string };
