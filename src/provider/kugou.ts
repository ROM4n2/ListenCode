import { Track } from '../types';
import { createHttpClient } from './http';

const client = createHttpClient('kugou');

interface KugouSearchResponse {
  status: number;
  data: {
    lists: Array<{
      FileHash: string;
      SongName: string;
      SingerName: string;
      AlbumName: string;
      AlbumID: number;
    }>;
    total: number;
  };
}

interface KugouSongInfoResponse {
  status: number;
  url: string;
  songName: string;
  singerName: string;
  album_img?: string;
  bitRate: number;
}

function mapSong(item: KugouSearchResponse['data']['lists'][0]): Track {
  return {
    id: `kghash_${item.FileHash}`,
    title: item.SongName,
    artist: item.SingerName,
    album: item.AlbumName,
    source: 'kugou',
  };
}

export async function search(keyword: string, limit = 20): Promise<Track[]> {
  const url = 'https://songsearch.kugou.com/song_search_v2';
  const params = {
    keyword,
    page: 1,
    pagesize: limit,
    userid: -1,
    clientver: '',
    platform: 'WebFilter',
    tag: 'em',
    filter: 2,
    iscorrection: 1,
    privilege_filter: 0,
  };

  const response = await client.get<KugouSearchResponse>(url, { params });
  if (response.data.status !== 1) {return [];}
  const lists = response.data.data?.lists ?? [];
  return lists.map(mapSong);
}

export async function getPlayUrl(trackId: string): Promise<string | null> {
  const hash = trackId.replace('kghash_', '');
  const url = `https://m.kugou.com/app/i/getSongInfo.php?cmd=playInfo&hash=${hash}`;

  const response = await client.get<KugouSongInfoResponse>(url);
  if (response.data.status !== 1) {return null;}
  return response.data.url || null;
}
