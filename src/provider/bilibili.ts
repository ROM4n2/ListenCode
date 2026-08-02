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
    dash?: {
      audio: Array<{
        id: number;
        baseUrl: string;
        backupUrl: string[];
        bandwidth: number;
        mimeType: string;
        codecs: string;
      }>;
    };
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

// B站二维码登录：获取二维码信息（返回 key 和 URL）
export async function getQRCodeKey(): Promise<{ key: string; url: string }> {
  const res = await client.get<{ data: { url: string; qrcode_key: string } }>(
    'https://passport.bilibili.com/x/passport-login/web/qrcode/generate'
  );
  return { key: res.data.data.qrcode_key, url: res.data.data.url };
}

// B站二维码登录：轮询扫码状态
export async function pollQRCodeStatus(qrcodeKey: string): Promise<{code: number, cookies?: string[], message?: string}> {
  const res = await client.get<{
    code: number;
    data: { url: string; code: number; message?: string };
  }>(
    'https://passport.bilibili.com/x/passport-login/web/qrcode/poll',
    { params: { qrcode_key: qrcodeKey } }
  );
  // data.code: 0=成功, 86101=未扫码, 86090=已扫码待确认, 86038=过期
  return {
    code: res.data.data.code,
    cookies: res.headers['set-cookie'],
    message: res.data.data.message,
  };
}

export async function getPlayUrl(trackId: string): Promise<string | null> {
  const bvid = trackId.replace('bibvid_', '');

  const infoResp = await client.get<{ data: { cid: number } }>(
    'https://api.bilibili.com/x/web-interface/view',
    { params: { bvid } }
  );
  const cid = infoResp.data.data?.cid;
  if (!cid) {return null;}

  // fnval=16 返回 DASH 格式，dash.audio 包含独立音频流（m4a/AAC），与 Listen1 一致
  const playResp = await client.get<BiliPlayResponse>(
    'https://api.bilibili.com/x/player/playurl',
    { params: { bvid, cid, fnval: 16, qn: 0 } }
  );

  const dash = playResp.data.data?.dash;
  if (dash?.audio?.length) {
    // 优先选择标准 AAC-LC (mp4a.40.2) 编码，Chromium 原生支持
    // 避免 HE-AAC / Hi-Res 等编码导致 FFmpegDemuxer 无法解码
    const aac = dash.audio.find(a => a.codecs === 'mp4a.40.2');
    if (aac) { return aac.baseUrl; }
    // 无标准 AAC 时取最低质量（通常兼容性最好）
    const sorted = [...dash.audio].sort((a, b) => a.bandwidth - b.bandwidth);
    return sorted[0].baseUrl;
  }

  // 回退：旧版 durl MP4（音视频合并）
  const durl = playResp.data.data?.durl;
  if (durl?.length) {
    return durl[0].url;
  }

  return null;
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
