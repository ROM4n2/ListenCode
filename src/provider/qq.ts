import { Track } from '../types';
import { createHttpClient } from './http';

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
