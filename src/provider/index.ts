import { Track, Platform } from '../types';
import * as netease from './netease';
import * as qq from './qq';
import * as kugou from './kugou';
import * as bilibili from './bilibili';
import { PlaylistSummary } from './netease';

interface Provider {
  search(keyword: string, limit?: number): Promise<Track[]>;
  getPlayUrl(trackId: string): Promise<string | null>;
}

const PROVIDERS: Record<Platform, Provider> = {
  netease,
  qq,
  kugou,
  bilibili,
};

export function getProvider(platform: Platform): Provider {
  return PROVIDERS[platform];
}

export async function getUserPlaylists(platform: Platform): Promise<PlaylistSummary[]> {
  switch (platform) {
    case 'netease':
      return netease.getUserPlaylists();
    case 'qq':
      return qq.getUserPlaylists();
    case 'kugou':
      return kugou.getUserPlaylists();
    case 'bilibili':
      return bilibili.getUserPlaylists();
    default:
      return [];
  }
}

export async function getPlaylistTracks(platform: Platform, playlistId: string): Promise<Track[]> {
  let result: { info: any; tracks: Track[] };
  switch (platform) {
    case 'netease':
      result = await netease.getPlaylistTracks(playlistId);
      break;
    case 'qq':
      result = await qq.getPlaylistTracks(playlistId);
      break;
    case 'kugou':
      result = await kugou.getPlaylistTracks(playlistId);
      break;
    case 'bilibili':
      result = await bilibili.getPlaylistTracks(playlistId);
      break;
    default:
      result = { info: {}, tracks: [] };
  }
  return result.tracks;
}

export function getProviderByTrackId(trackId: string): Platform | null {
  if (trackId.startsWith('netrack_')) {return 'netease';}
  if (trackId.startsWith('qqtrack_')) {return 'qq';}
  if (trackId.startsWith('kghash_')) {return 'kugou';}
  if (trackId.startsWith('bibvid_')) {return 'bilibili';}
  return null;
}

export async function searchPlatform(platform: Platform, keyword: string): Promise<Track[]> {
  return PROVIDERS[platform].search(keyword);
}

export async function resolvePlayUrl(trackId: string): Promise<string | null> {
  const platform = getProviderByTrackId(trackId);
  if (!platform) {return null;}
  return PROVIDERS[platform].getPlayUrl(trackId);
}

export async function preCheckPlayable(tracks: Track[]): Promise<Map<string, boolean>> {
  const results = await Promise.allSettled(
    tracks.map(async (track) => {
      const url = await resolvePlayUrl(track.id);
      return [track.id, url !== null && url !== ''] as [string, boolean];
    })
  );
  const map = new Map<string, boolean>();
  for (const r of results) {
    if (r.status === 'fulfilled') {
      const [id, playable] = r.value;
      map.set(id, playable);
    }
  }
  return map;
}

export type { Provider };
