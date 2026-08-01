import { Track } from '../types';
import { createHttpClient, UA, getCookie } from './http';
import { PlaylistSummary } from './netease';

const client = createHttpClient('bilibili');

interface BiliSearchResponse {
  code: number;
  data: {
    result: Array<{
      type: 'video';
      bvid: string;
      title: string;
      author: string;
      pic: string;
    }>;
  };
}

interface BiliPlayResponse {
  code: number;
  data: {
    durl?: Array<{ url: string; order: number; length: number; size: number }>;
  };
}

function stripHtmlTags(text: string): string {
  return text.replace(/<[^>]+>/g, '');
}

function mapSong(item: BiliSearchResponse['data']['result'][0]): Track {
  return {
    id: `bibvid_${item.bvid}`,
    title: stripHtmlTags(item.title),
    artist: item.author,
    album: '',
    source: 'bilibili',
    albumCover: item.pic.startsWith('//') ? `https:${item.pic}` : item.pic,
  };
}

export async function search(keyword: string, limit = 20): Promise<Track[]> {
  const url = 'https://api.bilibili.com/x/web-interface/search/type';
  const params = {
    search_type: 'video',
    keyword,
    page: 1,
    pagesize: limit,
  };

  const response = await client.get<BiliSearchResponse>(url, {
    params,
    headers: {
      'User-Agent': UA,
      'Referer': 'https://search.bilibili.com/',
      'Origin': 'https://search.bilibili.com',
      'Accept': 'application/json, text/plain, */*',
      'Accept-Language': 'zh-CN,zh;q=0.9',
    },
  });
  const results = response.data.data?.result ?? [];
  return results.filter(r => r.type === 'video').map(mapSong);
}

export async function getPlayUrl(trackId: string): Promise<string | null> {
  const bvid = trackId.replace('bibvid_', '');

  const infoResp = await client.get<{ data: { cid: number } }>(
    'https://api.bilibili.com/x/web-interface/view',
    { params: { bvid } }
  );
  const cid = infoResp.data.data?.cid;
  if (!cid) {return null;}

  // fnval=1 返回 MP4 直接链接（音视频合并），<audio> 可直接播放
  const playResp = await client.get<BiliPlayResponse>(
    'https://api.bilibili.com/x/player/playurl',
    { params: { bvid, cid, fnval: 1, qn: 0 } }
  );

  const durl = playResp.data.data?.durl;
  if (!durl || durl.length === 0) {return null;}

  return durl[0].url;
}

interface BiliFavFolderResponse {
  code: number;
  data: {
    list: Array<{
      id: number;
      title: string;
      cover: string;
      media_count: number;
    }>;
  };
}

interface BiliFavResourceResponse {
  code: number;
  data: {
    medias: Array<{
      id: number;
      title: string;
      cover: string;
      upper: { mid: number; name: string };
      bvid: string;
    }> | null;
  };
}

function parseMidFromCookie(): string | null {
  const cookie = getCookie('bilibili');
  const match = cookie.match(/(?:^|;\s*)DedeUserID=(\d+)/);
  return match ? match[1] : null;
}

export async function getUserPlaylists(): Promise<PlaylistSummary[]> {
  const mid = parseMidFromCookie();
  if (!mid) {return [];}

  const url = 'https://api.bilibili.com/x/v3/fav/folder/created/list-all';
  const resp = await client.get<BiliFavFolderResponse>(url, { params: { up_mid: mid } });

  const list = resp.data.data?.list ?? [];
  return list.map((item) => ({
    id: `bifav_${item.id}`,
    title: item.title,
    cover: item.cover,
    count: item.media_count,
  }));
}

export async function getPlaylistTracks(playlistId: string): Promise<{ info: any; tracks: Track[] }> {
  const mediaId = playlistId.replace('bifav_', '');
  const url = 'https://api.bilibili.com/x/v3/fav/resource/list';
  const resp = await client.get<BiliFavResourceResponse>(url, {
    params: { media_id: mediaId, pn: 1, ps: 100 },
  });

  const medias = resp.data.data?.medias ?? [];
  const tracks = medias
    .filter((m) => m.bvid)
    .map((m) => ({
      id: `bibvid_${m.bvid}`,
      title: stripHtmlTags(m.title),
      artist: m.upper?.name ?? '未知up主',
      album: '',
      source: 'bilibili' as const,
      albumCover: m.cover?.startsWith('//') ? `https:${m.cover}` : m.cover,
    }));

  return {
    info: { id: `bifav_${mediaId}`, title: '' },
    tracks,
  };
}
