import { Track, Platform } from './types';
import { searchPlatform } from './provider';
import { getEnabledSources } from './settings';

export async function searchAll(
  keyword: string,
  platforms?: Platform[]
): Promise<Track[]> {
  const enabledPlatforms = platforms?.length ? platforms : getEnabledSources() as Platform[];
  const validPlatforms = enabledPlatforms.filter(p => p);
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
