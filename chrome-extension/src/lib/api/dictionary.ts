/**
 * Dictionary API Client
 * 公開APIを直接呼び出し
 */

const DICTIONARY_API_URL = 'https://api.dictionaryapi.dev/api/v2/entries/en';

export interface Phonetic {
  text?: string;
  audio?: string;
}

export interface Definition {
  definition: string;
  example?: string;
  synonyms?: string[];
  antonyms?: string[];
}

export interface Meaning {
  partOfSpeech: string;
  definitions: Definition[];
}

export interface DictionaryEntry {
  word: string;
  phonetic?: string;
  phonetics: Phonetic[];
  meanings: Meaning[];
  sourceUrls?: string[];
}

export interface DictionaryResult {
  success: boolean;
  word: string;
  phonetic?: string;
  audioUrl?: string;
  meanings: Meaning[];
  error?: string;
}

/**
 * 単語を辞書で検索
 */
export async function lookupWord(word: string): Promise<DictionaryResult> {
  try {
    const response = await fetch(`${DICTIONARY_API_URL}/${encodeURIComponent(word.toLowerCase())}`);

    if (!response.ok) {
      if (response.status === 404) {
        return {
          success: false,
          word,
          meanings: [],
          error: 'Word not found',
        };
      }
      throw new Error(`Dictionary API error: ${response.status}`);
    }

    const data: DictionaryEntry[] = await response.json();
    const entry = data[0];

    // 音声URLを探す（米国英語優先）
    const audioUrl = entry.phonetics.find(p => p.audio && p.audio.includes('us'))?.audio
      || entry.phonetics.find(p => p.audio)?.audio;

    return {
      success: true,
      word: entry.word,
      phonetic: entry.phonetic || entry.phonetics.find(p => p.text)?.text,
      audioUrl: audioUrl || undefined,
      meanings: entry.meanings,
    };
  } catch (error) {
    return {
      success: false,
      word,
      meanings: [],
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * 簡易形式で定義を取得（最初の意味のみ）
 */
export async function getSimpleDefinition(word: string): Promise<{
  word: string;
  partOfSpeech?: string;
  definition?: string;
  example?: string;
  phonetic?: string;
  audioUrl?: string;
} | null> {
  const result = await lookupWord(word);

  if (!result.success || result.meanings.length === 0) {
    return null;
  }

  const firstMeaning = result.meanings[0];
  const firstDef = firstMeaning.definitions[0];

  return {
    word: result.word,
    partOfSpeech: firstMeaning.partOfSpeech,
    definition: firstDef?.definition,
    example: firstDef?.example,
    phonetic: result.phonetic,
    audioUrl: result.audioUrl,
  };
}
