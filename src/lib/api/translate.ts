/**
 * Translation API Client
 * MyMemory Translation API を直接呼び出し
 */

const MYMEMORY_API_URL = 'https://api.mymemory.translated.net/get';

export interface TranslationResult {
  success: boolean;
  originalText: string;
  translatedText: string;
  from: string;
  to: string;
  error?: string;
}

/**
 * テキストを翻訳
 * @param text 翻訳するテキスト
 * @param from 元の言語コード (default: 'en')
 * @param to 翻訳先の言語コード (default: 'ja')
 */
export async function translate(
  text: string,
  from: string = 'en',
  to: string = 'ja'
): Promise<TranslationResult> {
  try {
    const params = new URLSearchParams({
      q: text,
      langpair: `${from}|${to}`,
    });

    const response = await fetch(`${MYMEMORY_API_URL}?${params}`);

    if (!response.ok) {
      throw new Error(`Translation API error: ${response.status}`);
    }

    const data = await response.json();

    if (data.responseStatus !== 200) {
      throw new Error(data.responseDetails || 'Translation failed');
    }

    return {
      success: true,
      originalText: text,
      translatedText: data.responseData.translatedText,
      from,
      to,
    };
  } catch (error) {
    return {
      success: false,
      originalText: text,
      translatedText: '',
      from,
      to,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * 英語から日本語に翻訳（ショートカット）
 */
export async function translateToJapanese(text: string): Promise<TranslationResult> {
  return translate(text, 'en', 'ja');
}

/**
 * 日本語から英語に翻訳（ショートカット）
 */
export async function translateToEnglish(text: string): Promise<TranslationResult> {
  return translate(text, 'ja', 'en');
}
