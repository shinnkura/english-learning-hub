import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import {
  Timer,
  BookOpen,
  Subtitles,
  Settings,
  TrendingUp,
  Clock,
  Target,
} from 'lucide-react';
import { storage } from '@/lib/chrome-storage';
import { sendMessage, getCurrentTab, sendMessageToTab } from '@/lib/chrome-messaging';

interface Stats {
  todayStudyTime: number; // in seconds
  todayWords: number;
  weekStudyTime: number;
  streak: number;
}

export function Popup() {
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const [timerDuration, setTimerDuration] = useState(25);
  const [remainingTime, setRemainingTime] = useState<number | null>(null);
  const [stats, setStats] = useState<Stats>({
    todayStudyTime: 0,
    todayWords: 0,
    weekStudyTime: 0,
    streak: 0,
  });
  const [isSubtitleActive, setIsSubtitleActive] = useState(false);

  useEffect(() => {
    const loadData = async () => {
      // Load timer state
      const timerState = await storage.get<{
        isRunning: boolean;
        endTime: number | null;
      }>('timerState');

      if (timerState) {
        setIsTimerRunning(timerState.isRunning);
        if (timerState.endTime) {
          const remaining = Math.max(0, timerState.endTime - Date.now());
          setRemainingTime(remaining);
        }
      }

      // Load stats (mock data for now, will be fetched from API later)
      const storedStats = await storage.get<Stats>('stats');
      if (storedStats) {
        setStats(storedStats);
      }

      // Load subtitle state
      const subtitleState = await storage.get<boolean>('isSubtitleActive');
      setIsSubtitleActive(subtitleState || false);
    };

    loadData();

    // Update remaining time every second
    const interval = setInterval(async () => {
      const timerState = await storage.get<{
        isRunning: boolean;
        endTime: number | null;
      }>('timerState');

      if (timerState?.isRunning && timerState.endTime) {
        const remaining = Math.max(0, timerState.endTime - Date.now());
        setRemainingTime(remaining);
        if (remaining === 0) {
          setIsTimerRunning(false);
        }
      }
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  const handleStartTimer = async () => {
    const durationMs = timerDuration * 60 * 1000;
    await sendMessage({ type: 'START_TIMER', duration: durationMs });
    setIsTimerRunning(true);
  };

  const handleStopTimer = async () => {
    await sendMessage({ type: 'STOP_TIMER' });
    setIsTimerRunning(false);
    setRemainingTime(null);
  };

  const handleToggleSubtitles = async () => {
    const tab = await getCurrentTab();
    if (tab?.id) {
      await sendMessageToTab(tab.id, { type: 'TOGGLE_SUBTITLES' });
      const newState = !isSubtitleActive;
      setIsSubtitleActive(newState);
      await storage.set('isSubtitleActive', newState);
    }
  };

  const formatTime = (ms: number) => {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  const formatStudyTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    if (hours > 0) {
      return `${hours}h ${mins}m`;
    }
    return `${mins}m`;
  };

  const openOptions = () => {
    chrome.runtime.openOptionsPage();
  };

  return (
    <div className="w-80 bg-background">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-border">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
            <span className="text-primary-foreground font-bold text-sm">E</span>
          </div>
          <h1 className="text-base font-semibold text-foreground">English Learning Hub</h1>
        </div>
        <Button variant="ghost" size="icon" onClick={openOptions}>
          <Settings className="h-4 w-4" />
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 gap-2 p-3">
        <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3">
          <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400 mb-1">
            <Clock className="h-4 w-4" />
            <span className="text-xs font-medium">Today</span>
          </div>
          <div className="text-lg font-bold text-blue-700 dark:text-blue-300">
            {formatStudyTime(stats.todayStudyTime)}
          </div>
        </div>
        <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-3">
          <div className="flex items-center gap-2 text-green-600 dark:text-green-400 mb-1">
            <BookOpen className="h-4 w-4" />
            <span className="text-xs font-medium">Words</span>
          </div>
          <div className="text-lg font-bold text-green-700 dark:text-green-300">
            {stats.todayWords}
          </div>
        </div>
        <div className="bg-purple-50 dark:bg-purple-900/20 rounded-lg p-3">
          <div className="flex items-center gap-2 text-purple-600 dark:text-purple-400 mb-1">
            <TrendingUp className="h-4 w-4" />
            <span className="text-xs font-medium">This Week</span>
          </div>
          <div className="text-lg font-bold text-purple-700 dark:text-purple-300">
            {formatStudyTime(stats.weekStudyTime)}
          </div>
        </div>
        <div className="bg-orange-50 dark:bg-orange-900/20 rounded-lg p-3">
          <div className="flex items-center gap-2 text-orange-600 dark:text-orange-400 mb-1">
            <Target className="h-4 w-4" />
            <span className="text-xs font-medium">Streak</span>
          </div>
          <div className="text-lg font-bold text-orange-700 dark:text-orange-300">
            {stats.streak} days
          </div>
        </div>
      </div>

      {/* Timer Section */}
      <div className="p-3 border-t border-border">
        <div className="bg-card rounded-lg p-4 border border-border">
          <div className="flex items-center gap-2 mb-3">
            <Timer className="h-5 w-5 text-primary" />
            <span className="font-medium text-foreground">Study Timer</span>
          </div>

          {isTimerRunning && remainingTime !== null ? (
            <div className="text-center">
              <div className="text-4xl font-mono font-bold text-primary mb-4">
                {formatTime(remainingTime)}
              </div>
              <Button
                variant="destructive"
                onClick={handleStopTimer}
                className="w-full"
              >
                Stop Timer
              </Button>
            </div>
          ) : (
            <div>
              <div className="flex gap-2 mb-3">
                {[15, 25, 45, 60].map((min) => (
                  <Button
                    key={min}
                    variant={timerDuration === min ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setTimerDuration(min)}
                    className="flex-1"
                  >
                    {min}m
                  </Button>
                ))}
              </div>
              <Button onClick={handleStartTimer} className="w-full">
                Start Timer
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="p-3 pt-0">
        <div className="text-xs font-medium text-muted-foreground mb-2">
          Quick Actions
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Button
            variant={isSubtitleActive ? 'default' : 'outline'}
            className="flex items-center gap-2"
            onClick={handleToggleSubtitles}
          >
            <Subtitles className="h-4 w-4" />
            <span>Subtitles</span>
          </Button>
          <Button
            variant="outline"
            className="flex items-center gap-2"
            onClick={() => {
              chrome.tabs.create({ url: 'https://ankiweb.net' });
            }}
          >
            <BookOpen className="h-4 w-4" />
            <span>Anki Web</span>
          </Button>
        </div>
      </div>

      {/* Keyboard Shortcuts Hint */}
      <div className="p-3 pt-0">
        <div className="bg-muted/50 rounded-lg p-3 text-xs text-muted-foreground">
          <div className="font-medium mb-1">Keyboard Shortcuts</div>
          <div className="flex justify-between">
            <span>Toggle Timer</span>
            <kbd className="px-1.5 py-0.5 bg-background rounded text-[10px]">Alt+Shift+T</kbd>
          </div>
          <div className="flex justify-between mt-1">
            <span>Toggle Subtitles</span>
            <kbd className="px-1.5 py-0.5 bg-background rounded text-[10px]">Alt+Shift+C</kbd>
          </div>
        </div>
      </div>
    </div>
  );
}
