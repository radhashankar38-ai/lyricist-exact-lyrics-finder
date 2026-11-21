
export interface GroundingSource {
  title: string;
  uri: string;
}

export interface User {
  username: string;
  email?: string;
  avatarColor: string;
  joinedDate: string;
  provider: 'local' | 'google' | 'supabase';
  profileImage?: string;
  id?: string;
}

export interface LyricsMetadata {
  album?: string;
  movie?: string;
  image?: string;
  title?: string;
  artist?: string;
  relatedSongs?: string[];
  matchedSnippet?: string;
  youtubeId?: string;
  syncSource?: string;
  syncConfidence?: number;
  isCollection?: boolean;
  collectionType?: 'movie' | 'album';
}

export interface TimedLyricLine {
  startTime: number; // in seconds
  text: string;
}

export interface LyricsResult {
  text: string;
  sources: GroundingSource[];
  metadata?: LyricsMetadata;
  timedLyrics?: TimedLyricLine[];
}

export interface SearchState {
  status: 'idle' | 'loading' | 'success' | 'error';
  data: LyricsResult | null;
  error: string | null;
}

// Configuration Types
export type AccentKey = 'sky' | 'purple' | 'green' | 'orange' | 'rose' | 'amber' | 'teal' | 'indigo' | 'pink' | 'red' | 'custom';
export type FontStyle = 'sans' | 'serif' | 'mono';
export type BgPattern = 'none' | 'grid' | 'dots';
export type LayoutWidth = 'narrow' | 'standard' | 'wide';
export type CardStyle = 'glass' | 'solid' | 'liquid-glass';
export type BlurStrength = 'low' | 'medium' | 'high';
export type UiScale = 90 | 95 | 100 | 105 | 110;
export type AnimSpeed = 'slow' | 'normal' | 'fast';
export type EntranceAnim = 'cinematic' | 'simple';
export type BgAnimStyle = 'rich' | 'calm' | 'minimal';
export type LoaderStyle = 'equalizer' | 'orbit';
export type BorderRadius = 'round' | 'soft' | 'sharp';
export type ContentAlign = 'center' | 'left';
export type SearchBarStyle = 'floating' | 'docked' | 'minimal';
export type FavSortOrder = 'newest' | 'oldest' | 'az' | 'za';
export type FeedbackType = 'tap' | 'success' | 'error' | 'toggle' | 'gamewin' | 'light';
export type SyncStatus = 'idle' | 'host' | 'guest';

export interface SyncState {
  roomCode: string | null;
  status: SyncStatus;
  isFocusMode: boolean;
  currentStanzaIndex: number;
  currentLineIndex: number;
  songTitle: string | null;
  artist: string | null;
  lyrics: string | null;
  chordsEnabled: boolean;
  participantCount?: number;
}

export interface SyncEvent {
  type: 'scroll' | 'song_change' | 'focus_toggle' | 'chord_toggle' | 'line_change';
  payload: any;
}
