/**
 * AnkiConnect API Client
 * 直接 localhost:8765 に接続
 */

const ANKI_CONNECT_URL = 'http://127.0.0.1:8765';

interface AnkiConnectRequest {
  action: string;
  version: number;
  params?: Record<string, unknown>;
}

interface AnkiConnectResponse<T = unknown> {
  result: T;
  error: string | null;
}

async function invoke<T>(action: string, params?: Record<string, unknown>): Promise<T> {
  const request: AnkiConnectRequest = {
    action,
    version: 6,
    params,
  };

  const response = await fetch(ANKI_CONNECT_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    throw new Error(`AnkiConnect request failed: ${response.status}`);
  }

  const data: AnkiConnectResponse<T> = await response.json();

  if (data.error) {
    throw new Error(`AnkiConnect error: ${data.error}`);
  }

  return data.result;
}

/**
 * AnkiConnectの接続確認
 */
export async function checkConnection(): Promise<boolean> {
  try {
    await invoke<number>('version');
    return true;
  } catch {
    return false;
  }
}

/**
 * 利用可能なデッキ一覧を取得
 */
export async function getDeckNames(): Promise<string[]> {
  return invoke<string[]>('deckNames');
}

/**
 * 利用可能なノートタイプ一覧を取得
 */
export async function getModelNames(): Promise<string[]> {
  return invoke<string[]>('modelNames');
}

/**
 * ノートタイプのフィールド名を取得
 */
export async function getModelFieldNames(modelName: string): Promise<string[]> {
  return invoke<string[]>('modelFieldNames', { modelName });
}

/**
 * メディアファイル（画像）を保存
 */
export async function storeMediaFile(
  filename: string,
  data: string // base64
): Promise<string> {
  return invoke<string>('storeMediaFile', { filename, data });
}

/**
 * ノートを追加
 */
export async function addNote(params: {
  deckName: string;
  modelName: string;
  fields: Record<string, string>;
  tags?: string[];
  audio?: Array<{
    url: string;
    filename: string;
    fields: string[];
  }>;
}): Promise<number> {
  return invoke<number>('addNote', {
    note: {
      deckName: params.deckName,
      modelName: params.modelName,
      fields: params.fields,
      tags: params.tags || [],
      audio: params.audio || [],
      options: {
        allowDuplicate: false,
        duplicateScope: 'deck',
      },
    },
  });
}

/**
 * 適切なノートタイプとフィールドを自動検出してノートを追加
 */
export async function addNoteAuto(params: {
  deckName: string;
  word: string;
  meaning: string;
  imageUrl?: string;
  audioUrl?: string;
}): Promise<{ success: boolean; noteId?: number; error?: string }> {
  try {
    // 利用可能なノートタイプを取得
    const modelNames = await getModelNames();

    // 優先するノートタイプを探す
    const preferredModels = ['Basic', 'Basic (and reversed card)', 'Cloze'];
    let selectedModel = modelNames.find(m => preferredModels.includes(m)) || modelNames[0];

    if (!selectedModel) {
      return { success: false, error: 'No note types available' };
    }

    // フィールド名を取得
    const fieldNames = await getModelFieldNames(selectedModel);

    // フィールドをマッピング
    const fields: Record<string, string> = {};

    // Front/Sentence フィールドを探す
    const frontField = fieldNames.find(f =>
      /^(front|sentence|word|expression|question)$/i.test(f)
    ) || fieldNames[0];

    // Back/Meaning フィールドを探す
    const backField = fieldNames.find(f =>
      /^(back|meaning|definition|answer|japanese)$/i.test(f)
    ) || fieldNames[1];

    if (frontField) fields[frontField] = params.word;
    if (backField) fields[backField] = params.meaning;

    // 画像フィールドを探す
    if (params.imageUrl) {
      const imageField = fieldNames.find(f => /^(image|picture|photo)$/i.test(f));
      if (imageField) {
        // 画像をダウンロードしてbase64に変換
        try {
          const imageResponse = await fetch(params.imageUrl);
          const blob = await imageResponse.blob();
          const base64 = await blobToBase64(blob);
          const filename = `elh_${Date.now()}.jpg`;
          await storeMediaFile(filename, base64.split(',')[1]);
          fields[imageField] = `<img src="${filename}">`;
        } catch (e) {
          console.warn('Failed to add image:', e);
        }
      }
    }

    // ノートを追加
    const noteId = await addNote({
      deckName: params.deckName,
      modelName: selectedModel,
      fields,
      tags: ['english-learning-hub'],
      audio: params.audioUrl ? [{
        url: params.audioUrl,
        filename: `elh_audio_${Date.now()}.mp3`,
        fields: [frontField],
      }] : undefined,
    });

    return { success: true, noteId };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}
