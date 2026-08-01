import { Track, Platform } from './types';
import { searchPlatform } from './provider';

export async function searchAll(
  keyword: string,
  platforms: Platform[]
): Promise<Track[]> {
  const validPlatforms = platforms.filter(p => p);
  if (validPlatforms.length === 0) {return [];}

  const results = await Promise.allSettled(
    validPlatforms.map(p => searchPlatform(p, keyword))
  );

  const tracks: Track[] = [];
  for (const result of results) {
    if (result.status === 'fulfilled') {
      tracks.push(...result.value);
    }
  }
  return tracks;
}
