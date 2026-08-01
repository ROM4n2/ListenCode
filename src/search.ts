import { Track, Platform } from './types';
import { searchPlatform, preCheckPlayable } from './provider';
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

export async function searchWithPreCheck(
  keyword: string,
  platforms: Platform[]
): Promise<{ tracks: Track[]; preCheck: Map<string, boolean> }> {
  const tracks = await searchAll(keyword, platforms);
  const preCheck = await preCheckPlayable(tracks.slice(0, 10));
  return { tracks, preCheck };
}
