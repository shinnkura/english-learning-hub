// Timer types
export interface TimerState {
  isRunning: boolean;
  startTime: number | null;
  endTime: number | null;
  duration: number | null;
  currentUrl: string | null;
  pageTitle: string | null;
}

// Study log types
export interface StudyLog {
  id?: string;
  url: string;
  domain?: string;
  pageTitle: string;
  duration: number; // in seconds
  startedAt: string;
  endedAt: string;
  notes?: string;
  createdAt?: string;
}

// Word capture types
export interface WordCapture {
  word: string;
  context: string;
  url: string;
  timestamp: number;
}

export interface DictionaryResult {
  word: string;
  phonetic?: string;
  meanings: {
    partOfSpeech: string;
    definitions: {
      definition: string;
      example?: string;
    }[];
  }[];
}

export interface TranslationResult {
  original: string;
  translated: string;
  sourceLang: string;
  targetLang: string;
}

// Subtitle types
export interface SubtitleCue {
  id: string;
  startTime: number;
  endTime: number;
  text: string;
}

export interface SubtitleTrack {
  id: string;
  language: string;
  label: string;
  cues: SubtitleCue[];
}

// Settings types
export interface Settings {
  apiBaseUrl: string;
  defaultTimerDuration: number;
  showTimerOnPage: boolean;
  enableNotifications: boolean;
}

// Message types for chrome.runtime.sendMessage
export type Message =
  | { type: 'START_TIMER'; duration: number }
  | { type: 'STOP_TIMER' }
  | { type: 'GET_TIMER_STATE' }
  | { type: 'TIMER_STARTED'; state: TimerState }
  | { type: 'TIMER_STOPPED' }
  | { type: 'TIMER_FINISHED' }
  | { type: 'TOGGLE_TIMER_DISPLAY' }
  | { type: 'START_TIMER_FROM_SHORTCUT' }
  | { type: 'TOGGLE_SUBTITLES' }
  | { type: 'LOOKUP_WORD'; word: string }
  | { type: 'SAVE_STUDY_LOG'; data: Omit<StudyLog, 'id' | 'createdAt'> }
  | { type: 'GET_SETTINGS' }
  | { type: 'UPDATE_SETTINGS'; settings: Partial<Settings> };

export type MessageResponse<T = unknown> =
  | { success: true; data?: T; state?: TimerState }
  | { success: false; error: string };
