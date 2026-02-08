import { useState, useEffect, useRef, useCallback } from 'react';
import { Play, Pause, Square, Minimize2, Maximize2 } from 'lucide-react';
import type { TimerState } from '@/types';

interface TimerOverlayProps {
  timerState: TimerState;
  isVisible: boolean;
  onToggleVisibility: () => void;
}

export function TimerOverlay({ timerState, isVisible, onToggleVisibility: _onToggleVisibility }: TimerOverlayProps) {
  const [remainingTime, setRemainingTime] = useState<number>(0);
  const [isMinimized, setIsMinimized] = useState(false);
  const [position, setPosition] = useState({ x: 20, y: 20 });
  const [isDragging, setIsDragging] = useState(false);
  const [isFinished, setIsFinished] = useState(false);
  const dragRef = useRef<{ startX: number; startY: number; startPosX: number; startPosY: number } | null>(null);
  const overlayRef = useRef<HTMLDivElement>(null);

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

        {/* Minimize/Maximize button */}
        <button
          className="elh-timer-btn"
          onClick={() => setIsMinimized(!isMinimized)}
          title={isMinimized ? 'Expand' : 'Minimize'}
        >
          {isMinimized ? <Maximize2 size={16} /> : <Minimize2 size={16} />}
        </button>
      </div>
    </div>
  );
}
