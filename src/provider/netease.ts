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

interface NeteasePlaylistSong {
  id: number;
  name: string;
  ar: Array<{ id: number; name: string }>;
  al: { id: number; name: string; picUrl: string };
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

function mapPlaylistSong(song: NeteasePlaylistSong): Track {
  return {
    id: `netrack_${song.id}`,
    title: song.name,
    artist: song.ar[0]?.name ?? '未知歌手',
    album: song.al.name,
    source: 'netease',
    albumCover: song.al.picUrl,
  };
}

export interface PlaylistSummary {
  id: string;
  title: string;
  cover?: string;
  count: number;
}

interface NeteaseUserResponse {
  account: { id: number; userName: string } | null;
  profile: { nickname: string; avatarUrl: string };
}

interface NeteaseUserPlaylistResponse {
  playlist: Array<{
    id: number;
    name: string;
    coverImgUrl: string;
    trackCount: number;
    subscribed: boolean;
  }>;
}

interface NeteasePlaylistDetailResponse {
  playlist: {
    coverImgUrl: string;
    name: string;
    trackIds: Array<{ id: number }>;
  };
}

interface NeteaseSongDetailResponse {
  songs: NeteasePlaylistSong[];
}

export async function search(keyword: string, limit = 20): Promise<Track[]> {
  // 用公开搜索接口（和 Listen1 一致），不走 weapi
  const url = 'https://music.163.com/api/search/pc';
  const response = await client.post<NeteaseSearchResponse>(url, new URLSearchParams({
    s: keyword,
    offset: '0',
    limit: String(limit),
    type: '1',
  }).toString(), {
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

export async function getUserPlaylists(): Promise<PlaylistSummary[]> {
  // 1. 获取当前登录用户 uid
  const accountUrl = 'https://music.163.com/api/nuser/account/get';
  const accountData = weapi({});
  const accountResp = await client.post<NeteaseUserResponse>(
    accountUrl,
    new URLSearchParams(accountData).toString(),
    { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
  );

  const userId = accountResp.data.account?.id;
  if (!userId) {return [];}

  // 2. 获取用户创建的歌单
  const playlistUrl = 'https://music.163.com/api/user/playlist';
  const playlistData = weapi({
    uid: userId,
    limit: 1000,
    offset: 0,
    includeVideo: true,
  });
  const playlistResp = await client.post<NeteaseUserPlaylistResponse>(
    playlistUrl,
    new URLSearchParams(playlistData).toString(),
    { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
  );

  return playlistResp.data.playlist
    .filter((item) => item.subscribed === false)
    .map((item) => ({
      id: `neplaylist_${item.id}`,
      title: item.name,
      cover: item.coverImgUrl,
      count: item.trackCount,
    }));
}

export async function getPlaylistTracks(playlistId: string): Promise<{ info: any; tracks: Track[] }> {
  const listId = playlistId.replace('neplaylist_', '');

  // 1. 获取歌单详情（歌曲 id 列表）
  const detailUrl = 'https://music.163.com/weapi/v3/playlist/detail';
  const detailData = weapi({
    id: listId,
    offset: 0,
    total: true,
    limit: 1000,
    n: 1000,
    csrf_token: '',
  });
  const detailResp = await client.post<NeteasePlaylistDetailResponse>(
    detailUrl,
    new URLSearchParams(detailData).toString(),
    { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
  );

  const playlist = detailResp.data.playlist;
  const info = {
    id: `neplaylist_${listId}`,
    cover_img_url: playlist.coverImgUrl,
    title: playlist.name,
    source_url: `https://music.163.com/#/playlist?id=${listId}`,
  };

  // 2. 分批获取歌曲详情（每批最多 1000）
  const trackIds = playlist.trackIds.map((t) => t.id);
  const chunks: number[][] = [];
  for (let i = 0; i < trackIds.length; i += 1000) {
    chunks.push(trackIds.slice(i, i + 1000));
  }

  const songDetailUrl = 'https://music.163.com/weapi/v3/song/detail';
  const allSongs: NeteasePlaylistSong[] = [];
  for (const chunk of chunks) {
    const d = {
      c: `[${chunk.map((id) => `{"id":${id}}`).join(',')}]`,
      ids: `[${chunk.join(',')}]`,
    };
    const data = weapi(d);
    const resp = await client.post<NeteaseSongDetailResponse>(
      songDetailUrl,
      new URLSearchParams(data).toString(),
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
    );
    allSongs.push(...resp.data.songs);
  }

  return { info, tracks: allSongs.map(mapPlaylistSong) };
}
