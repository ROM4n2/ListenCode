import { Track } from '../types';
import { createHttpClient } from './http';

const client = createHttpClient('qq');

const GUID = Math.floor(Math.random() * 1000000000);

interface QQSearchResponse {
  code: number;
  data: {
    song: {
      list: Array<{
        mid: string;
        name: string;
        singer: Array<{ mid: string; name: string }>;
        album: { mid: string; name: string };
      }>;
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

function mapSong(item: QQSearchResponse['data']['song']['list'][0]): Track {
  return {
    id: `qqtrack_${item.mid}`,
    title: item.name,
    artist: item.singer[0]?.name ?? '未知歌手',
    album: item.album.name,
    source: 'qq',
  };
}

export async function search(keyword: string, limit = 20): Promise<Track[]> {
  const url = 'https://c.y.qq.com/soso/fcgi-bin/client_search_cp';
  const params = {
    ct: 24,
    qqmusic_ver: 1298,
    new_json: 1,
    remoteplace: 'txt.yqq.song',
    searchid: GUID,
    t: 0,
    aggr: 1,
    cr: 1,
    catZhida: 1,
    lossless: 0,
    flag_qc: 0,
    p: 1,
    n: limit,
    w: keyword,
    format: 'json',
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
