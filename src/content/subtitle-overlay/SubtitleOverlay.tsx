import { useState, useEffect, useRef, useCallback } from 'react';
import { X, Upload, Settings, Plus, Minus, Move } from 'lucide-react';
import { parseSubtitle, findCurrentCue, applyTimeOffset } from '@/lib/subtitle-parser';
import type { SubtitleCue } from '@/types';

interface SubtitleOverlayProps {
  isVisible: boolean;
  onClose: () => void;
}

interface SubtitleState {
  cues: SubtitleCue[];
  currentCue: SubtitleCue | null;
  timeOffset: number;
  fontSize: number;
  position: { bottom: number };
}

export function SubtitleOverlay({ isVisible, onClose }: SubtitleOverlayProps) {
  const [state, setState] = useState<SubtitleState>({
    cues: [],
    currentCue: null,
    timeOffset: 0,
    fontSize: 18,
    position: { bottom: 80 },
  });
  const [showSettings, setShowSettings] = useState(false);
  const [videoElement, setVideoElement] = useState<HTMLVideoElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const animationFrameRef = useRef<number>();

  // Find video element on the page
  useEffect(() => {
    const findVideo = () => {
      // Try to find YouTube player first
      const ytPlayer = document.querySelector('video.html5-main-video') as HTMLVideoElement;
      if (ytPlayer) {
        setVideoElement(ytPlayer);
        return;
      }

      // Try Netflix
      const netflixPlayer = document.querySelector('video[src*="netflix"]') as HTMLVideoElement;
      if (netflixPlayer) {
        setVideoElement(netflixPlayer);
        return;
      }

      // Generic video element
      const genericVideo = document.querySelector('video') as HTMLVideoElement;
      if (genericVideo) {
        setVideoElement(genericVideo);
      }
    };

    findVideo();

    // Re-check periodically for dynamically loaded videos
    const interval = setInterval(findVideo, 2000);
    return () => clearInterval(interval);
  }, []);

  // Sync with video time
  useEffect(() => {
    if (!videoElement || state.cues.length === 0) return;

    const updateSubtitle = () => {
      const currentTime = videoElement.currentTime;
      const adjustedCues = applyTimeOffset(state.cues, state.timeOffset);
      const cue = findCurrentCue(adjustedCues, currentTime);

      if (cue?.id !== state.currentCue?.id) {
        setState((prev) => ({ ...prev, currentCue: cue }));
      }

      animationFrameRef.current = requestAnimationFrame(updateSubtitle);
    };

    animationFrameRef.current = requestAnimationFrame(updateSubtitle);

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [videoElement, state.cues, state.timeOffset, state.currentCue?.id]);

  const handleFileUpload = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (e) => {
        const content = e.target?.result as string;
        const cues = parseSubtitle(content, file.name);
        setState((prev) => ({
          ...prev,
          cues,
          currentCue: null,
          timeOffset: 0,
        }));
      };
      reader.readAsText(file);
    },
    []
  );

  const adjustTimeOffset = (delta: number) => {
    setState((prev) => ({
      ...prev,
      timeOffset: prev.timeOffset + delta,
    }));
  };

  const adjustFontSize = (delta: number) => {
    setState((prev) => ({
      ...prev,
      fontSize: Math.max(12, Math.min(32, prev.fontSize + delta)),
    }));
  };

  const adjustPosition = (delta: number) => {
    setState((prev) => ({
      ...prev,
      position: {
        bottom: Math.max(20, Math.min(200, prev.position.bottom + delta)),
      },
    }));
  };

  if (!isVisible) return null;

  return (
    <>
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".srt,.vtt"
        onChange={handleFileUpload}
        style={{ display: 'none' }}
      />

      {/* Subtitle display */}
      {state.currentCue && (
        <div
          className="elh-subtitle-display"
          style={{
            bottom: `${state.position.bottom}px`,
            fontSize: `${state.fontSize}px`,
          }}
        >
          {state.currentCue.text.split('\n').map((line, idx) => (
            <div key={idx}>{line}</div>
          ))}
        </div>
      )}

      {/* Control bar */}
      <div className="elh-subtitle-controls">
        {/* Upload button */}
        <button
          className="elh-subtitle-btn"
          onClick={() => fileInputRef.current?.click()}
          title="Load subtitle file (SRT/VTT)"
        >
          <Upload size={16} />
          <span>Load</span>
        </button>

        {/* Settings toggle */}
        <button
          className={`elh-subtitle-btn ${showSettings ? 'active' : ''}`}
          onClick={() => setShowSettings(!showSettings)}
          title="Settings"
        >
          <Settings size={16} />
        </button>

        {/* Status */}
        <div className="elh-subtitle-status">
          {state.cues.length > 0
            ? `${state.cues.length} cues loaded`
            : 'No subtitles'}
        </div>

        {/* Close button */}
        <button className="elh-subtitle-btn close" onClick={onClose} title="Close">
          <X size={16} />
        </button>
      </div>

      {/* Settings panel */}
      {showSettings && (
        <div className="elh-subtitle-settings">
          {/* Time offset */}
          <div className="elh-setting-row">
            <span className="elh-setting-label">Time Offset</span>
            <div className="elh-setting-controls">
              <button onClick={() => adjustTimeOffset(-0.5)}>
                <Minus size={14} />
              </button>
              <span className="elh-setting-value">
                {state.timeOffset > 0 ? '+' : ''}
                {state.timeOffset.toFixed(1)}s
              </span>
              <button onClick={() => adjustTimeOffset(0.5)}>
                <Plus size={14} />
              </button>
            </div>
          </div>

          {/* Font size */}
          <div className="elh-setting-row">
            <span className="elh-setting-label">Font Size</span>
            <div className="elh-setting-controls">
              <button onClick={() => adjustFontSize(-2)}>
                <Minus size={14} />
              </button>
              <span className="elh-setting-value">{state.fontSize}px</span>
              <button onClick={() => adjustFontSize(2)}>
                <Plus size={14} />
              </button>
            </div>
          </div>

          {/* Position */}
          <div className="elh-setting-row">
            <span className="elh-setting-label">Position</span>
            <div className="elh-setting-controls">
              <button onClick={() => adjustPosition(-10)}>
                <Move size={14} style={{ transform: 'rotate(180deg)' }} />
              </button>
              <span className="elh-setting-value">{state.position.bottom}px</span>
              <button onClick={() => adjustPosition(10)}>
                <Move size={14} />
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
