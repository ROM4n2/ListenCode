import * as vscode from 'vscode';
import { Playlist, Track } from './types';

const PLAYLIST_KEY = 'listencode.playlists';

export class PlaylistManager {
  private playlists: Playlist[] = [];
  private context: vscode.ExtensionContext;

  constructor(context: vscode.ExtensionContext) {
    this.context = context;
    this.load();
  }

  private load(): void {
    const stored = this.context.globalState.get<Playlist[]>(PLAYLIST_KEY, []);
    this.playlists = stored;
  }

  private save(): void {
    this.context.globalState.update(PLAYLIST_KEY, this.playlists);
  }

  create(name: string): Playlist {
    const playlist: Playlist = {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      name,
      tracks: [],
    };
    this.playlists.push(playlist);
    this.save();
    return playlist;
  }

  remove(id: string): void {
    this.playlists = this.playlists.filter(p => p.id !== id);
    this.save();
  }

  addTrack(playlistId: string, track: Track): boolean {
    const playlist = this.playlists.find(p => p.id === playlistId);
    if (!playlist) {return false;}
    if (playlist.tracks.some(t => t.id === track.id)) {return false;}
    playlist.tracks.push(track);
    this.save();
    return true;
  }

  removeTrack(playlistId: string, trackId: string): boolean {
    const playlist = this.playlists.find(p => p.id === playlistId);
    if (!playlist) {return false;}
    playlist.tracks = playlist.tracks.filter(t => t.id !== trackId);
    this.save();
    return true;
  }

  getAll(): Playlist[] {
    return this.playlists;
  }

  getById(id: string): Playlist | undefined {
    return this.playlists.find(p => p.id === id);
  }
}
