import { useState, useEffect, useRef } from 'react';
import { X, Volume2, Save, Loader2, RefreshCw, Check, Plus, ChevronDown, ChevronUp } from 'lucide-react';
import { lookupWord, type DictionaryResult } from '@/lib/api/dictionary';
import { translateToJapanese } from '@/lib/api/translate';
import { searchImage, saveFlashcard } from '@/lib/api/server';

interface WordPanelProps {
  word: string;
  position: { x: number; y: number };
  onClose: () => void;
}

interface PanelState {
  isLoading: boolean;
  dictionary: DictionaryResult | null;
  translation: { original: string; translated: string } | null;
  imageUrl: string | null;
  error: string | null;
  saveStatus: 'idle' | 'saving' | 'success' | 'error' | 'exists';
}

export function WordPanel({ word, position, onClose }: WordPanelProps) {
  const [state, setState] = useState<PanelState>({
    isLoading: true,
    dictionary: null,
    translation: null,
    imageUrl: null,
    error: null,
    saveStatus: 'idle',
  });
  const [isMinimized, setIsMinimized] = useState(false);
  const [manualMode, setManualMode] = useState(false);
  const [manualWord, setManualWord] = useState('');
  const [manualMeaning, setManualMeaning] = useState('');
  const panelRef = useRef<HTMLDivElement>(null);

  const isPhrase = word.trim().includes(' ');

  useEffect(() => {
    if (word) {
      fetchWordData();
    }
  }, [word]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [onClose]);

  const fetchWordData = async () => {
    setState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      if (isPhrase) {
        const result = await translateToJapanese(word);
        if (result.success) {
          setState(prev => ({
            ...prev,
            translation: { original: word, translated: result.translatedText },
          }));
        }
      } else {
        const result = await lookupWord(word);
        if (result.success) {
          setState(prev => ({ ...prev, dictionary: result }));
        }

        const translateResult = await translateToJapanese(word);
        if (translateResult.success) {
          setState(prev => ({
            ...prev,
            translation: { original: word, translated: translateResult.translatedText },
          }));
        }
      }

      const imageResult = await searchImage(word.split(' ')[0]);
      if (imageResult.success && imageResult.imageUrl) {
        setState(prev => ({ ...prev, imageUrl: imageResult.imageUrl! }));
      }
    } catch (error) {
      console.error('Error fetching word data:', error);
      setState(prev => ({ ...prev, error: 'データの取得に失敗しました' }));
    } finally {
      setState(prev => ({ ...prev, isLoading: false }));
    }
  };

  const refreshImage = async () => {
    try {
      const imageResult = await searchImage(`${word.split(' ')[0]} ${Date.now()}`);
      if (imageResult.success && imageResult.imageUrl) {
        setState(prev => ({ ...prev, imageUrl: imageResult.imageUrl! }));
      }
    } catch (error) {
      console.error('Error refreshing image:', error);
    }
  };

  const saveToFlashcards = async () => {
    setState(prev => ({ ...prev, saveStatus: 'saving' }));

    try {
      let meaning = '';
      let definition = '';
      let example = '';

      if (state.translation) {
        meaning = state.translation.translated;
      }
      if (state.dictionary && state.dictionary.meanings.length > 0) {
        const firstMeaning = state.dictionary.meanings[0];
        const firstDef = firstMeaning.definitions[0];
        if (firstDef) {
          definition = `${firstMeaning.partOfSpeech}: ${firstDef.definition}`;
          example = firstDef.example || '';
        }
      }

      const result = await saveFlashcard({
        word,
        meaning: meaning || definition,
        definition,
        example,
        phonetic: state.dictionary?.phonetic,
        image_url: state.imageUrl || undefined,
        source_url: window.location.href,
      });

      if (result.success) {
        setState(prev => ({ ...prev, saveStatus: 'success' }));
        setTimeout(() => setState(prev => ({ ...prev, saveStatus: 'idle' })), 2000);
      } else if (result.exists) {
        setState(prev => ({ ...prev, saveStatus: 'exists' }));
        setTimeout(() => setState(prev => ({ ...prev, saveStatus: 'idle' })), 2000);
      } else {
        throw new Error(result.error);
      }
    } catch (error) {
      console.error('Error saving flashcard:', error);
      setState(prev => ({ ...prev, saveStatus: 'error' }));
      setTimeout(() => setState(prev => ({ ...prev, saveStatus: 'idle' })), 3000);
    }
  };

  const saveManualFlashcard = async () => {
    if (!manualWord.trim() || !manualMeaning.trim()) return;

    setState(prev => ({ ...prev, saveStatus: 'saving' }));

    try {
      const result = await saveFlashcard({
        word: manualWord.trim(),
        meaning: manualMeaning.trim(),
        source_url: window.location.href,
      });

      if (result.success) {
        setState(prev => ({ ...prev, saveStatus: 'success' }));
        setManualWord('');
        setManualMeaning('');
        setTimeout(() => setState(prev => ({ ...prev, saveStatus: 'idle' })), 2000);
      } else if (result.exists) {
        setState(prev => ({ ...prev, saveStatus: 'exists' }));
        setTimeout(() => setState(prev => ({ ...prev, saveStatus: 'idle' })), 2000);
      } else {
        throw new Error(result.error);
      }
    } catch (error) {
      console.error('Error saving manual flashcard:', error);
      setState(prev => ({ ...prev, saveStatus: 'error' }));
      setTimeout(() => setState(prev => ({ ...prev, saveStatus: 'idle' })), 3000);
    }
  };

  const playPronunciation = () => {
    if (state.dictionary?.audioUrl) {
      const audio = new Audio(state.dictionary.audioUrl);
      audio.play().catch(() => useSpeechSynthesis());
    } else {
      useSpeechSynthesis();
    }
  };

  const useSpeechSynthesis = () => {
    const utterance = new SpeechSynthesisUtterance(word);
    utterance.lang = 'en-US';
    speechSynthesis.speak(utterance);
  };

  const getPanelStyle = () => {
    const panelWidth = 360;
    const panelHeight = isMinimized ? 50 : 450;
    let x = position.x;
    let y = position.y + 10;

    if (x + panelWidth > window.innerWidth) {
      x = window.innerWidth - panelWidth - 20;
    }
    if (y + panelHeight > window.innerHeight) {
      y = position.y - panelHeight - 10;
    }

    return {
      left: `${Math.max(10, x)}px`,
      top: `${Math.max(10, y)}px`,
    };
  };

  return (
    <div ref={panelRef} className="elh-word-panel" style={getPanelStyle()}>
      {/* Header */}
      <div className="elh-word-panel-header">
        <div className="elh-word-panel-title">
          {manualMode ? (
            <span className="elh-word-text">手動入力</span>
          ) : (
            <>
              <span className="elh-word-text">{word}</span>
              {state.dictionary?.phonetic && (
                <span className="elh-word-phonetic">/{state.dictionary.phonetic}/</span>
              )}
              <button className="elh-word-btn" onClick={playPronunciation} title="発音">
                <Volume2 size={16} />
              </button>
            </>
          )}
        </div>
        <div className="elh-header-actions">
          <button
            className="elh-word-btn"
            onClick={() => setIsMinimized(!isMinimized)}
            title={isMinimized ? '展開' : '最小化'}
          >
            {isMinimized ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
          <button className="elh-word-btn elh-close-btn" onClick={onClose}>
            <X size={18} />
          </button>
        </div>
      </div>

      {!isMinimized && (
        <>
          {/* Mode Toggle */}
          <div className="elh-mode-toggle">
            <button
              className={`elh-mode-btn ${!manualMode ? 'active' : ''}`}
              onClick={() => setManualMode(false)}
            >
              検索結果
            </button>
            <button
              className={`elh-mode-btn ${manualMode ? 'active' : ''}`}
              onClick={() => setManualMode(true)}
            >
              <Plus size={14} /> 手動入力
            </button>
          </div>

          {/* Content */}
          <div className="elh-word-panel-content">
            {manualMode ? (
              <div className="elh-manual-input">
                <div className="elh-input-group">
                  <label>単語・フレーズ</label>
                  <input
                    type="text"
                    value={manualWord}
                    onChange={(e) => setManualWord(e.target.value)}
                    placeholder="apple, take it easy..."
                  />
                </div>
                <div className="elh-input-group">
                  <label>意味・訳</label>
                  <textarea
                    value={manualMeaning}
                    onChange={(e) => setManualMeaning(e.target.value)}
                    placeholder="りんご、気楽にいこう..."
                    rows={3}
                  />
                </div>
              </div>
            ) : state.isLoading ? (
              <div className="elh-word-loading">
                <Loader2 className="elh-spinner" size={24} />
                <span>読み込み中...</span>
              </div>
            ) : state.error ? (
              <div className="elh-word-error">{state.error}</div>
            ) : (
              <>
                {state.translation && (
                  <div className="elh-word-translation">
                    <div className="elh-translation-label">日本語</div>
                    <div className="elh-translation-text">{state.translation.translated}</div>
                  </div>
                )}

                {state.dictionary && state.dictionary.meanings.length > 0 && (
                  <div className="elh-word-definitions">
                    {state.dictionary.meanings.slice(0, 2).map((meaning, idx) => (
                      <div key={idx} className="elh-word-meaning">
                        <span className="elh-pos">{meaning.partOfSpeech}</span>
                        <ul>
                          {meaning.definitions.slice(0, 2).map((def, defIdx) => (
                            <li key={defIdx}>
                              {def.definition}
                              {def.example && (
                                <div className="elh-example">"{def.example}"</div>
                              )}
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                )}

                {state.imageUrl && (
                  <div className="elh-word-image">
                    <img src={state.imageUrl} alt={word} />
                    <button className="elh-image-refresh" onClick={refreshImage} title="別の画像">
                      <RefreshCw size={14} />
                    </button>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Footer */}
          <div className="elh-word-panel-footer">
            <button
              className={`elh-save-btn ${state.saveStatus}`}
              onClick={manualMode ? saveManualFlashcard : saveToFlashcards}
              disabled={
                state.saveStatus === 'saving' ||
                (manualMode ? !manualWord.trim() || !manualMeaning.trim() : state.isLoading)
              }
            >
              {state.saveStatus === 'saving' ? (
                <>
                  <Loader2 className="elh-spinner" size={16} />
                  保存中...
                </>
              ) : state.saveStatus === 'success' ? (
                <>
                  <Check size={16} />
                  保存しました
                </>
              ) : state.saveStatus === 'exists' ? (
                '既に登録済み'
              ) : state.saveStatus === 'error' ? (
                '保存失敗'
              ) : (
                <>
                  <Save size={16} />
                  単語帳に保存
                </>
              )}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
