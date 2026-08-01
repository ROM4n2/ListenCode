import { Track } from '../types';
import { createHttpClient } from './http';
import { weapi, eapi } from './crypto';

const client = createHttpClient('netease');

interface NeteaseSearchResponse {
  result: {
    songs?: NeteaseSong[];
    songCount?: number;
  };
}

interface NeteaseUrlResponse {
  data: Array<{ url: string | null; br: number }>;
}

interface NeteaseSong {
  id: number;
  name: string;
  artists: Array<{ id: number; name: string }>;
  album: { id: number; name: string; picUrl: string };
  fee: number;
}

function mapSong(song: NeteaseSong): Track {
  return {
    id: `netrack_${song.id}`,
    title: song.name,
    artist: song.artists[0]?.name ?? '未知歌手',
    album: song.album.name,
    source: 'netease',
    albumCover: song.album.picUrl,
  };
}

export async function search(keyword: string, limit = 20): Promise<Track[]> {
  const url = 'https://music.163.com/weapi/search/get';
  const data = weapi({
    s: keyword,
    offset: 0,
    limit,
    type: 1,
  });

  const response = await client.post<NeteaseSearchResponse>(url, new URLSearchParams(data).toString(), {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  });

  const songs = response.data.result?.songs;
  if (!songs) {return [];}
  return songs.map(mapSong);
}

export async function getPlayUrl(trackId: string): Promise<string | null> {
  const songId = trackId.replace('netrack_', '');
  const apiUrl = '/api/song/enhance/player/url';
  const targetUrl = 'https://interface3.music.163.com/eapi/song/enhance/player/url';
  const params = eapi(apiUrl, {
    ids: `[${songId}]`,
    br: 999000,
  });

  const response = await client.post<NeteaseUrlResponse>(
    targetUrl,
    new URLSearchParams({ params }).toString(),
    { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
  );

  return response.data.data?.[0]?.url ?? null;
}
