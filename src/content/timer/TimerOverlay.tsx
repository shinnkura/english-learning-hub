import { useState, useEffect, useRef, useCallback } from 'react';
import { Play, Pause, Square, Minimize2, Maximize2, BookOpen, Search, X, Loader2, Save, Check, Volume2, RefreshCw } from 'lucide-react';
import type { TimerState } from '@/types';
import { lookupWord, type DictionaryResult } from '@/lib/api/dictionary';
import { translateToJapanese } from '@/lib/api/translate';
import { saveFlashcard, searchImage } from '@/lib/api/server';

interface TimerOverlayProps {
  timerState: TimerState;
  isVisible: boolean;
  onToggleVisibility: () => void;
}

interface LookupState {
  isOpen: boolean;
  searchQuery: string;
  isLoading: boolean;
  dictionary: DictionaryResult | null;
  translation: string | null;
  imageUrl: string | null;
  saveStatus: 'idle' | 'saving' | 'success' | 'error';
}

export function TimerOverlay({ timerState, isVisible, onToggleVisibility: _onToggleVisibility }: TimerOverlayProps) {
  const [remainingTime, setRemainingTime] = useState<number>(0);
  const [isMinimized, setIsMinimized] = useState(false);
  const [position, setPosition] = useState({ x: 20, y: 20 });
  const [isDragging, setIsDragging] = useState(false);
  const [isFinished, setIsFinished] = useState(false);
  const [lookup, setLookup] = useState<LookupState>({
    isOpen: false,
    searchQuery: '',
    isLoading: false,
    dictionary: null,
    translation: null,
    imageUrl: null,
    saveStatus: 'idle',
  });
  const dragRef = useRef<{ startX: number; startY: number; startPosX: number; startPosY: number } | null>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Update remaining time every second
  useEffect(() => {
    if (!timerState.isRunning || !timerState.endTime) {
      setRemainingTime(0);
      return;
    }

    const updateTime = () => {
      const remaining = Math.max(0, timerState.endTime! - Date.now());
      setRemainingTime(remaining);

      if (remaining === 0 && timerState.isRunning) {
        setIsFinished(true);
      } else {
        setIsFinished(false);
      }
    };

    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, [timerState]);

  // Format time as MM:SS
  const formatTime = (ms: number) => {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  // Dragging handlers
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('button')) return;

    setIsDragging(true);
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      startPosX: position.x,
      startPosY: position.y,
    };
  }, [position]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging || !dragRef.current) return;

      const deltaX = e.clientX - dragRef.current.startX;
      const deltaY = e.clientY - dragRef.current.startY;

      // Calculate new position (from bottom-right)
      const newX = Math.max(0, dragRef.current.startPosX - deltaX);
      const newY = Math.max(0, dragRef.current.startPosY - deltaY);

      // Clamp to viewport
      const maxX = window.innerWidth - (overlayRef.current?.offsetWidth || 200);
      const maxY = window.innerHeight - (overlayRef.current?.offsetHeight || 60);

      setPosition({
        x: Math.min(newX, maxX),
        y: Math.min(newY, maxY),
      });
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      dragRef.current = null;
    };

    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging]);

  // Timer control handlers
  const handleStartPause = () => {
    if (timerState.isRunning) {
      chrome.runtime.sendMessage({ type: 'STOP_TIMER' });
    } else {
      // Start with default 25 minutes
      chrome.runtime.sendMessage({ type: 'START_TIMER', duration: 25 * 60 * 1000 });
    }
  };

  const handleStop = () => {
    chrome.runtime.sendMessage({ type: 'STOP_TIMER' });
    setIsFinished(false);
  };

  const handleContinue = () => {
    // Continue with 15 more minutes
    chrome.runtime.sendMessage({ type: 'START_TIMER', duration: 15 * 60 * 1000 });
    setIsFinished(false);
  };

  // Word lookup handlers
  const handleOpenLookup = () => {
    setLookup(prev => ({ ...prev, isOpen: true }));
    setTimeout(() => searchInputRef.current?.focus(), 100);
  };

  const handleCloseLookup = () => {
    setLookup({
      isOpen: false,
      searchQuery: '',
      isLoading: false,
      dictionary: null,
      translation: null,
      imageUrl: null,
      saveStatus: 'idle',
    });
  };

  const handleSearch = async () => {
    const query = lookup.searchQuery.trim();
    if (!query) return;

    setLookup(prev => ({ ...prev, isLoading: true, dictionary: null, translation: null, imageUrl: null }));

    try {
      // Lookup word in dictionary
      const dictResult = await lookupWord(query);
      if (dictResult.success) {
        setLookup(prev => ({ ...prev, dictionary: dictResult }));
      }

      // Get translation
      const transResult = await translateToJapanese(query);
      if (transResult.success) {
        setLookup(prev => ({ ...prev, translation: transResult.translatedText }));
      }

      // Get image
      const imageResult = await searchImage(query);
      if (imageResult.success && imageResult.imageUrl) {
        setLookup(prev => ({ ...prev, imageUrl: imageResult.imageUrl! }));
      }
    } catch (error) {
      console.error('Lookup error:', error);
    } finally {
      setLookup(prev => ({ ...prev, isLoading: false }));
    }
  };

  const handleRefreshImage = async () => {
    const query = lookup.searchQuery.trim();
    if (!query) return;

    try {
      const imageResult = await searchImage(`${query} ${Date.now()}`);
      if (imageResult.success && imageResult.imageUrl) {
        setLookup(prev => ({ ...prev, imageUrl: imageResult.imageUrl! }));
      }
    } catch (error) {
      console.error('Image refresh error:', error);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch();
    } else if (e.key === 'Escape') {
      handleCloseLookup();
    }
  };

  const handleSaveToFlashcards = async () => {
    if (!lookup.searchQuery.trim()) return;

    setLookup(prev => ({ ...prev, saveStatus: 'saving' }));

    try {
      let meaning = lookup.translation || '';
      let definition = '';
      let example = '';

      if (lookup.dictionary && lookup.dictionary.meanings.length > 0) {
        const firstMeaning = lookup.dictionary.meanings[0];
        const firstDef = firstMeaning.definitions[0];
        if (firstDef) {
          definition = `${firstMeaning.partOfSpeech}: ${firstDef.definition}`;
          example = firstDef.example || '';
        }
      }

      const result = await saveFlashcard({
        word: lookup.searchQuery.trim(),
        meaning: meaning || definition || lookup.searchQuery,
        definition,
        example,
        phonetic: lookup.dictionary?.phonetic,
        image_url: lookup.imageUrl || undefined,
        source_url: window.location.href,
      });

      if (result.success) {
        setLookup(prev => ({ ...prev, saveStatus: 'success' }));
        setTimeout(() => setLookup(prev => ({ ...prev, saveStatus: 'idle' })), 2000);
      } else {
        throw new Error(result.error);
      }
    } catch (error) {
      console.error('Save error:', error);
      setLookup(prev => ({ ...prev, saveStatus: 'error' }));
      setTimeout(() => setLookup(prev => ({ ...prev, saveStatus: 'idle' })), 2000);
    }
  };

  const playPronunciation = () => {
    if (lookup.dictionary?.audioUrl) {
      const audio = new Audio(lookup.dictionary.audioUrl);
      audio.play().catch(() => {
        const utterance = new SpeechSynthesisUtterance(lookup.searchQuery);
        utterance.lang = 'en-US';
        speechSynthesis.speak(utterance);
      });
    } else {
      const utterance = new SpeechSynthesisUtterance(lookup.searchQuery);
      utterance.lang = 'en-US';
      speechSynthesis.speak(utterance);
    }
  };

  if (!isVisible) return null;

  return (
    <div
      ref={overlayRef}
      className="elh-timer-overlay elh-interactive"
      style={{
        right: `${position.x}px`,
        bottom: `${position.y}px`,
      }}
    >
      <div
        className={`elh-timer-card ${isDragging ? 'dragging' : ''} ${isMinimized ? 'elh-timer-minimized' : ''} ${isFinished ? 'elh-timer-finished' : ''}`}
        onMouseDown={handleMouseDown}
      >
        {/* Timer display */}
        <div className="elh-timer-time">
          {timerState.isRunning ? formatTime(remainingTime) : '25:00'}
        </div>

        {!isMinimized && (
          <div className="elh-timer-controls">
            {isFinished ? (
              <>
                <button
                  className="elh-timer-btn"
                  onClick={handleContinue}
                  title="Continue (+15 min)"
                >
                  <Play size={18} />
                </button>
                <button
                  className="elh-timer-btn stop"
                  onClick={handleStop}
                  title="End session"
                >
                  <Square size={18} />
                </button>
              </>
            ) : (
              <>
                <button
                  className={`elh-timer-btn ${timerState.isRunning ? 'active' : ''}`}
                  onClick={handleStartPause}
                  title={timerState.isRunning ? 'Pause' : 'Start'}
                >
                  {timerState.isRunning ? <Pause size={18} /> : <Play size={18} />}
                </button>
                {timerState.isRunning && (
                  <button
                    className="elh-timer-btn stop"
                    onClick={handleStop}
                    title="Stop timer"
                  >
                    <Square size={18} />
                  </button>
                )}
              </>
            )}
          </div>
        )}

        {/* Word lookup button */}
        {!isMinimized && (
          <button
            className="elh-timer-btn"
            onClick={handleOpenLookup}
            title="単語検索"
          >
            <BookOpen size={16} />
          </button>
        )}

        {/* Minimize/Maximize button */}
        <button
          className="elh-timer-btn"
          onClick={() => setIsMinimized(!isMinimized)}
          title={isMinimized ? 'Expand' : 'Minimize'}
        >
          {isMinimized ? <Maximize2 size={16} /> : <Minimize2 size={16} />}
        </button>
      </div>

      {/* Word Lookup Panel */}
      {lookup.isOpen && (
        <div className="elh-lookup-panel">
          <div className="elh-lookup-header">
            <span className="elh-lookup-title">単語検索</span>
            <button className="elh-timer-btn" onClick={handleCloseLookup}>
              <X size={16} />
            </button>
          </div>

          <div className="elh-lookup-search">
            <input
              ref={searchInputRef}
              type="text"
              value={lookup.searchQuery}
              onChange={(e) => setLookup(prev => ({ ...prev, searchQuery: e.target.value }))}
              onKeyDown={handleKeyDown}
              placeholder="単語を入力..."
              className="elh-lookup-input"
            />
            <button
              className="elh-lookup-search-btn"
              onClick={handleSearch}
              disabled={lookup.isLoading || !lookup.searchQuery.trim()}
            >
              {lookup.isLoading ? <Loader2 size={16} className="elh-spinner" /> : <Search size={16} />}
            </button>
          </div>

          {/* Results */}
          <div className="elh-lookup-results">
            {lookup.isLoading ? (
              <div className="elh-lookup-loading">
                <Loader2 size={20} className="elh-spinner" />
                <span>検索中...</span>
              </div>
            ) : lookup.translation || lookup.dictionary ? (
              <>
                {/* Word with pronunciation */}
                {lookup.dictionary && (
                  <div className="elh-lookup-word-header">
                    <span className="elh-lookup-word">{lookup.searchQuery}</span>
                    {lookup.dictionary.phonetic && (
                      <span className="elh-lookup-phonetic">/{lookup.dictionary.phonetic}/</span>
                    )}
                    <button className="elh-timer-btn" onClick={playPronunciation} title="発音">
                      <Volume2 size={14} />
                    </button>
                  </div>
                )}

                {/* Translation */}
                {lookup.translation && (
                  <div className="elh-lookup-translation">
                    <span className="elh-lookup-label">日本語</span>
                    <span className="elh-lookup-trans-text">{lookup.translation}</span>
                  </div>
                )}

                {/* Definition */}
                {lookup.dictionary && lookup.dictionary.meanings.length > 0 && (
                  <div className="elh-lookup-definition">
                    <span className="elh-lookup-pos">
                      {lookup.dictionary.meanings[0].partOfSpeech}
                    </span>
                    <p className="elh-lookup-def-text">
                      {lookup.dictionary.meanings[0].definitions[0]?.definition}
                    </p>
                    {lookup.dictionary.meanings[0].definitions[0]?.example && (
                      <p className="elh-lookup-example">
                        "{lookup.dictionary.meanings[0].definitions[0].example}"
                      </p>
                    )}
                  </div>
                )}

                {/* Image */}
                {lookup.imageUrl && (
                  <div className="elh-lookup-image">
                    <img src={lookup.imageUrl} alt={lookup.searchQuery} />
                    <button
                      className="elh-lookup-image-refresh"
                      onClick={handleRefreshImage}
                      title="別の画像"
                    >
                      <RefreshCw size={14} />
                    </button>
                  </div>
                )}

                {/* Save button */}
                <button
                  className={`elh-lookup-save-btn ${lookup.saveStatus}`}
                  onClick={handleSaveToFlashcards}
                  disabled={lookup.saveStatus === 'saving'}
                >
                  {lookup.saveStatus === 'saving' ? (
                    <><Loader2 size={14} className="elh-spinner" /> 保存中...</>
                  ) : lookup.saveStatus === 'success' ? (
                    <><Check size={14} /> 保存しました</>
                  ) : lookup.saveStatus === 'error' ? (
                    '保存失敗'
                  ) : (
                    <><Save size={14} /> 単語帳に保存</>
                  )}
                </button>
              </>
            ) : lookup.searchQuery.trim() ? (
              <div className="elh-lookup-empty">
                Enterキーまたは検索ボタンで検索
              </div>
            ) : (
              <div className="elh-lookup-empty">
                単語を入力して検索してください
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
