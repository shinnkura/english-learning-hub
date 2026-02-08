import { useState, useEffect, useRef } from 'react';
import { X, Volume2, Send, Loader2, RefreshCw } from 'lucide-react';
import { lookupWord, type DictionaryResult } from '@/lib/api/dictionary';
import { translateToJapanese } from '@/lib/api/translate';
import { searchImage } from '@/lib/api/server';
import { addNoteAuto, checkConnection } from '@/lib/api/anki-connect';
import { syncStorage } from '@/lib/chrome-storage';

interface WordPanelProps {
  word: string;
  position: { x: number; y: number };
  onClose: () => void;
}

interface Settings {
  ankiDeckName: string;
}

interface PanelState {
  isLoading: boolean;
  dictionary: DictionaryResult | null;
  translation: { original: string; translated: string } | null;
  imageUrl: string | null;
  error: string | null;
  ankiStatus: 'idle' | 'sending' | 'success' | 'error';
  ankiConnected: boolean;
}

export function WordPanel({ word, position, onClose }: WordPanelProps) {
  const [state, setState] = useState<PanelState>({
    isLoading: true,
    dictionary: null,
    translation: null,
    imageUrl: null,
    error: null,
    ankiStatus: 'idle',
    ankiConnected: false,
  });
  const panelRef = useRef<HTMLDivElement>(null);

  // Determine if it's a phrase or single word
  const isPhrase = word.trim().includes(' ');

  useEffect(() => {
    fetchWordData();
    checkAnkiConnection();
  }, [word]);

  // Close on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  // Close on Escape
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [onClose]);

  const checkAnkiConnection = async () => {
    const connected = await checkConnection();
    setState(prev => ({ ...prev, ankiConnected: connected }));
  };

  const fetchWordData = async () => {
    setState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      // Fetch dictionary or translation based on input type
      if (isPhrase) {
        // Fetch translation for phrases (direct API call)
        const result = await translateToJapanese(word);
        if (result.success) {
          setState(prev => ({
            ...prev,
            translation: {
              original: word,
              translated: result.translatedText,
            },
          }));
        }
      } else {
        // Fetch dictionary for single words (direct API call)
        const result = await lookupWord(word);
        if (result.success) {
          setState(prev => ({
            ...prev,
            dictionary: result,
          }));
        }

        // Also fetch translation for single words
        const translateResult = await translateToJapanese(word);
        if (translateResult.success) {
          setState(prev => ({
            ...prev,
            translation: {
              original: word,
              translated: translateResult.translatedText,
            },
          }));
        }
      }

      // Fetch image (via server - needs API key)
      const imageResult = await searchImage(word.split(' ')[0]);
      if (imageResult.success && imageResult.imageUrl) {
        setState(prev => ({ ...prev, imageUrl: imageResult.imageUrl! }));
      }
    } catch (error) {
      console.error('Error fetching word data:', error);
      setState(prev => ({ ...prev, error: 'Failed to fetch data' }));
    } finally {
      setState(prev => ({ ...prev, isLoading: false }));
    }
  };

  const refreshImage = async () => {
    try {
      // Add timestamp to bypass cache
      const imageResult = await searchImage(`${word.split(' ')[0]} ${Date.now()}`);
      if (imageResult.success && imageResult.imageUrl) {
        setState(prev => ({ ...prev, imageUrl: imageResult.imageUrl! }));
      }
    } catch (error) {
      console.error('Error refreshing image:', error);
    }
  };

  const sendToAnki = async () => {
    setState(prev => ({ ...prev, ankiStatus: 'sending' }));

    try {
      // Get deck name from settings
      const settings = await syncStorage.get<Settings>('settings');
      const deckName = settings?.ankiDeckName || 'English';

      // Build meaning text
      let meaning = '';
      if (state.translation) {
        meaning = state.translation.translated;
      }
      if (state.dictionary && state.dictionary.meanings.length > 0) {
        const firstMeaning = state.dictionary.meanings[0];
        const firstDef = firstMeaning.definitions[0];
        if (firstDef) {
          meaning = meaning
            ? `${meaning}\n\n${firstMeaning.partOfSpeech}: ${firstDef.definition}`
            : `${firstMeaning.partOfSpeech}: ${firstDef.definition}`;
        }
      }

      // Direct call to AnkiConnect
      const result = await addNoteAuto({
        deckName,
        word,
        meaning,
        imageUrl: state.imageUrl || undefined,
        audioUrl: state.dictionary?.audioUrl,
      });

      if (result.success) {
        setState(prev => ({ ...prev, ankiStatus: 'success' }));
        setTimeout(() => {
          setState(prev => ({ ...prev, ankiStatus: 'idle' }));
        }, 2000);
      } else {
        throw new Error(result.error || 'Failed to send to Anki');
      }
    } catch (error) {
      console.error('Error sending to Anki:', error);
      setState(prev => ({ ...prev, ankiStatus: 'error' }));
      setTimeout(() => {
        setState(prev => ({ ...prev, ankiStatus: 'idle' }));
      }, 3000);
    }
  };

  const playPronunciation = () => {
    // Try to use audio from dictionary first
    if (state.dictionary?.audioUrl) {
      const audio = new Audio(state.dictionary.audioUrl);
      audio.play().catch(() => {
        // Fallback to speech synthesis
        useSpeechSynthesis();
      });
    } else {
      useSpeechSynthesis();
    }
  };

  const useSpeechSynthesis = () => {
    const utterance = new SpeechSynthesisUtterance(word);
    utterance.lang = 'en-US';
    speechSynthesis.speak(utterance);
  };

  // Calculate panel position to stay within viewport
  const getPanelStyle = () => {
    const panelWidth = 360;
    const panelHeight = 400;
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
    <div
      ref={panelRef}
      className="elh-word-panel"
      style={getPanelStyle()}
    >
      {/* Header */}
      <div className="elh-word-panel-header">
        <div className="elh-word-panel-title">
          <span className="elh-word-text">{word}</span>
          {state.dictionary?.phonetic && (
            <span className="elh-word-phonetic">/{state.dictionary.phonetic}/</span>
          )}
          <button
            className="elh-word-btn"
            onClick={playPronunciation}
            title="Play pronunciation"
          >
            <Volume2 size={16} />
          </button>
        </div>
        <button className="elh-word-btn elh-close-btn" onClick={onClose}>
          <X size={18} />
        </button>
      </div>

      {/* Content */}
      <div className="elh-word-panel-content">
        {state.isLoading ? (
          <div className="elh-word-loading">
            <Loader2 className="elh-spinner" size={24} />
            <span>Loading...</span>
          </div>
        ) : state.error ? (
          <div className="elh-word-error">{state.error}</div>
        ) : (
          <>
            {/* Translation */}
            {state.translation && (
              <div className="elh-word-translation">
                <div className="elh-translation-label">Japanese</div>
                <div className="elh-translation-text">{state.translation.translated}</div>
              </div>
            )}

            {/* Dictionary definitions */}
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

            {/* Image */}
            {state.imageUrl && (
              <div className="elh-word-image">
                <img src={state.imageUrl} alt={word} />
                <button
                  className="elh-image-refresh"
                  onClick={refreshImage}
                  title="Get new image"
                >
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
          className={`elh-anki-btn ${state.ankiStatus}`}
          onClick={sendToAnki}
          disabled={state.ankiStatus === 'sending' || state.isLoading || !state.ankiConnected}
          title={!state.ankiConnected ? 'Anki is not running' : undefined}
        >
          {state.ankiStatus === 'sending' ? (
            <>
              <Loader2 className="elh-spinner" size={16} />
              Sending...
            </>
          ) : state.ankiStatus === 'success' ? (
            'Added to Anki!'
          ) : state.ankiStatus === 'error' ? (
            'Failed - Try again'
          ) : !state.ankiConnected ? (
            'Anki not connected'
          ) : (
            <>
              <Send size={16} />
              Add to Anki
            </>
          )}
        </button>
      </div>
    </div>
  );
}
