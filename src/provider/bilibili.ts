import { Track } from '../types';
import { createHttpClient } from './http';

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
    dash?: {
      audio: Array<{ baseUrl: string; url: Array<string> }>;
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
      'Accept': 'application/json, text/plain, */*',
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

  const playResp = await client.get<BiliPlayResponse>(
    'https://api.bilibili.com/x/player/playurl',
    { params: { bvid, cid, fnval: 16, qn: 0 } }
  );

  const audioList = playResp.data.data?.dash?.audio;
  if (!audioList || audioList.length === 0) {return null;}

  return audioList[0].baseUrl ?? audioList[0].url?.[0] ?? null;
}
