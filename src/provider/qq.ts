import { Track } from '../types';
import { createHttpClient, getCookie } from './http';
import { PlaylistSummary } from './netease';

const client = createHttpClient('qq');

const GUID = Math.floor(Math.random() * 1000000000);

interface QQSinger {
  id: number;
  mid: string;
  name: string;
}

interface QQSong {
  songid: number;
  songmid: string;
  songname: string;
  singer: QQSinger[];
  albummid: string;
  albumname: string;
  alertid: number;
  pay: { payplay: number };
}

interface QQSearchResponse {
  code: number;
  data: {
    song: {
      list: QQSong[];
      totalnum: number;
    };
  };
}

interface QQVkeyResponse {
  code: number;
  req_0: {
    data: {
      midurlinfo: Array<{ purl: string }>;
    };
  };
}

function mapSong(item: QQSong): Track {
  return {
    id: `qqtrack_${item.songmid}`,
    title: item.songname,
    artist: item.singer[0]?.name ?? '未知歌手',
    album: item.albumname,
    source: 'qq',
  };
}

export async function search(keyword: string, limit = 20): Promise<Track[]> {
  const url = 'https://c.y.qq.com/soso/fcgi-bin/client_search_cp';
  const params = {
    format: 'json',
    p: 1,
    n: limit,
    w: keyword,
    cr: 1,
    g_tk: 5381,
    loginUin: 0,
    hostUin: 0,
    inCharset: 'utf8',
    outCharset: 'utf-8',
    notice: 0,
    platform: 'yqq',
    needNewCode: 0,
  };

  const response = await client.get<QQSearchResponse>(url, { params });
  const list = response.data.data?.song?.list ?? [];
  return list.map(mapSong);
}

export async function getPlayUrl(trackId: string): Promise<string | null> {
  const songMid = trackId.replace('qqtrack_', '');
  const vkeyUrl = 'https://u.y.qq.com/cgi-bin/musicu.fcg';
  const vkeyData = {
    req_0: {
      module: 'vkey.GetVkeyServer',
      method: 'CgiGetVkey',
      param: {
        guid: String(GUID),
        songmid: [songMid],
        songtype: [0],
        uin: '0',
        loginflag: 1,
        platform: '20',
      },
    },
  };

  const vkeyResp = await client.post<QQVkeyResponse>(vkeyUrl, vkeyData);
  const purl = vkeyResp.data.req_0?.data?.midurlinfo?.[0]?.purl;
  if (!purl) {return null;}

  return `http://ws.stream.qqmusic.qq.com/${purl}`;
}

interface QQUserPlaylistResponse {
  code: number;
  data: {
    disslist: Array<{
      tid: number;
      diss_name: string;
      diss_cover: string;
      dir_show: number;
    }>;
  };
}

interface QQPlaylistDetailResponse {
  code: number;
  cdlist: Array<{
    logo: string;
    dissname: string;
    songlist: Array<{
      songmid: string;
      songname: string;
      singer: QQSinger[];
      albummid: string;
      albumname: string;
    }>;
  }>;
}

function parseUinFromCookie(): string | null {
  const cookie = getCookie('qq');
  // uin 格式: uin=o12345678 或 uin=12345678
  const uinMatch = cookie.match(/(?:^|;\s*)uin=(?:o)?(\d+)/);
  if (uinMatch) {
    return uinMatch[1];
  }
  const wxuinMatch = cookie.match(/(?:^|;\s*)wxuin=(?:o)?(\d+)/);
  if (wxuinMatch) {
    // wxuin 前缀 o 替换为 1
    return `1${wxuinMatch[1].replace(/^o/, '')}`;
  }
  return null;
}

export async function getUserPlaylists(): Promise<PlaylistSummary[]> {
  const uin = parseUinFromCookie();
  if (!uin) {return [];}

  const url = 'https://c.y.qq.com/rsc/fcgi-bin/fcg_user_created_diss';
  const params = {
    cv: 4747474,
    ct: 24,
    format: 'json',
    inCharset: 'utf-8',
    outCharset: 'utf-8',
    notice: 0,
    platform: 'yqq.json',
    needNewCode: 1,
    uin,
    hostuin: uin,
    sin: 0,
    size: 100,
  };

  const resp = await client.get<QQUserPlaylistResponse>(url, { params });
  const playlists: PlaylistSummary[] = [];

  for (const item of resp.data.data?.disslist ?? []) {
    if (item.dir_show === 0) {
      if (item.tid === 0) {continue;}
      if (item.diss_name === '我喜欢') {
        playlists.push({
          id: `qqplaylist_${item.tid}`,
          title: item.diss_name,
          cover: 'https://y.gtimg.cn/mediastyle/y/img/cover_love_300.jpg',
          count: 0,
        });
      }
    } else {
      playlists.push({
        id: `qqplaylist_${item.tid}`,
        title: item.diss_name,
        cover: item.diss_cover,
        count: 0,
      });
    }
  }

  return playlists;
}

export async function getPlaylistTracks(playlistId: string): Promise<{ info: any; tracks: Track[] }> {
  const listId = playlistId.replace('qqplaylist_', '');

  const url = 'https://i.y.qq.com/qzone-music/fcg-bin/fcg_ucc_getcdinfo_byids_cp.fcg';
  const params = {
    type: 1,
    json: 1,
    utf8: 1,
    onlysong: 0,
    nosign: 1,
    disstid: listId,
    g_tk: 5381,
    loginUin: 0,
    hostUin: 0,
    format: 'json',
    inCharset: 'GB2312',
    outCharset: 'utf-8',
    notice: 0,
    platform: 'yqq',
    needNewCode: 0,
  };

  const resp = await client.get<QQPlaylistDetailResponse>(url, { params });
  const cd = resp.data.cdlist?.[0];
  if (!cd) {return { info: {}, tracks: [] };}

  const info = {
    id: `qqplaylist_${listId}`,
    cover_img_url: cd.logo,
    title: cd.dissname,
    source_url: `https://y.qq.com/n/ryqq/playlist/${listId}`,
  };

  const tracks = (cd.songlist ?? []).map((item) => ({
    id: `qqtrack_${item.songmid}`,
    title: item.songname,
    artist: item.singer[0]?.name ?? '未知歌手',
    album: item.albumname,
    source: 'qq' as const,
  }));

  return { info, tracks };
}
