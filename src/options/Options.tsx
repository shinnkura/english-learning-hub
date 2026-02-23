import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import {
  Settings,
  Timer,
  BookOpen,
  Subtitles,
  Database,
  Keyboard,
  History,
  Trash2,
  ExternalLink,
} from 'lucide-react';
import { storage, syncStorage } from '@/lib/chrome-storage';
import { getFlashcardStats } from '@/lib/api/server';

interface Settings {
  // API Settings
  apiBaseUrl: string;

  // Timer Settings
  defaultTimerDuration: number;
  showTimerOnPage: boolean;
  enableNotifications: boolean;

  // Subtitle Settings
  defaultFontSize: number;
  defaultPosition: number;
}

interface StudyLog {
  id: string;
  url: string;
  domain: string;
  pageTitle: string;
  duration: number;
  startedAt: string;
}

interface FlashcardStats {
  total: number;
  dueForReview: number;
  mastered: number;
  learning: number;
}

const defaultSettings: Settings = {
  apiBaseUrl: 'http://localhost:3001',
  defaultTimerDuration: 25,
  showTimerOnPage: true,
  enableNotifications: true,
  defaultFontSize: 18,
  defaultPosition: 80,
};

export function Options() {
  const [settings, setSettings] = useState<Settings>(defaultSettings);
  const [saved, setSaved] = useState(false);
  const [activeTab, setActiveTab] = useState<'general' | 'flashcards' | 'history'>('general');
  const [studyLogs, setStudyLogs] = useState<StudyLog[]>([]);
  const [isLoadingLogs, setIsLoadingLogs] = useState(false);
  const [flashcardStats, setFlashcardStats] = useState<FlashcardStats | null>(null);
  const [isLoadingStats, setIsLoadingStats] = useState(false);

  // Detect if running on Mac
  const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;

  useEffect(() => {
    const loadSettings = async () => {
      const stored = await syncStorage.get<Settings>('settings');
      if (stored) {
        setSettings({ ...defaultSettings, ...stored });
      }
    };
    loadSettings();
  }, []);

  useEffect(() => {
    if (activeTab === 'history') {
      loadStudyLogs();
    } else if (activeTab === 'flashcards') {
      loadFlashcardStats();
    }
  }, [activeTab]);

  const loadStudyLogs = async () => {
    setIsLoadingLogs(true);
    try {
      const response = await fetch(`${settings.apiBaseUrl}/api/study-logs`);
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setStudyLogs(data.data || []);
        }
      }
    } catch (error) {
      console.error('Failed to load study logs:', error);
    } finally {
      setIsLoadingLogs(false);
    }
  };

  const loadFlashcardStats = async () => {
    setIsLoadingStats(true);
    try {
      const result = await getFlashcardStats();
      if (result.success && result.stats) {
        setFlashcardStats(result.stats);
      }
    } catch (error) {
      console.error('Failed to load flashcard stats:', error);
    } finally {
      setIsLoadingStats(false);
    }
  };

  const handleSave = async () => {
    await syncStorage.set('settings', settings);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleClearData = async () => {
    if (confirm('Are you sure you want to clear all local data? This cannot be undone.')) {
      await storage.clear();
      alert('Local data cleared.');
    }
  };

  const formatDuration = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    if (hours > 0) {
      return `${hours}h ${mins}m`;
    }
    return `${mins}m`;
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('ja-JP', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b border-border bg-card">
        <div className="max-w-4xl mx-auto px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary rounded-lg flex items-center justify-center">
              <span className="text-primary-foreground font-bold">E</span>
            </div>
            <div>
              <h1 className="text-xl font-bold text-foreground">English Learning Hub</h1>
              <p className="text-sm text-muted-foreground">Extension Settings</p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-6">
        {/* Tab Navigation */}
        <div className="flex gap-2 mb-6">
          <Button
            variant={activeTab === 'general' ? 'default' : 'outline'}
            onClick={() => setActiveTab('general')}
            className="flex items-center gap-2"
          >
            <Settings className="h-4 w-4" />
            General
          </Button>
          <Button
            variant={activeTab === 'flashcards' ? 'default' : 'outline'}
            onClick={() => setActiveTab('flashcards')}
            className="flex items-center gap-2"
          >
            <BookOpen className="h-4 w-4" />
            Flashcards
          </Button>
          <Button
            variant={activeTab === 'history' ? 'default' : 'outline'}
            onClick={() => setActiveTab('history')}
            className="flex items-center gap-2"
          >
            <History className="h-4 w-4" />
            Study History
          </Button>
        </div>

        {/* General Settings */}
        {activeTab === 'general' && (
          <div className="space-y-6">
            {/* Timer Settings */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Timer className="h-5 w-5" />
                  Timer Settings
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2">
                    Default Duration (minutes)
                  </label>
                  <input
                    type="number"
                    value={settings.defaultTimerDuration}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        defaultTimerDuration: parseInt(e.target.value) || 25,
                      })
                    }
                    className="w-24 px-3 py-2 border border-input rounded-md bg-background"
                    min="1"
                    max="120"
                  />
                </div>
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    id="showTimerOnPage"
                    checked={settings.showTimerOnPage}
                    onChange={(e) =>
                      setSettings({ ...settings, showTimerOnPage: e.target.checked })
                    }
                    className="rounded"
                  />
                  <label htmlFor="showTimerOnPage" className="text-sm">
                    Show timer overlay on page
                  </label>
                </div>
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    id="enableNotifications"
                    checked={settings.enableNotifications}
                    onChange={(e) =>
                      setSettings({ ...settings, enableNotifications: e.target.checked })
                    }
                    className="rounded"
                  />
                  <label htmlFor="enableNotifications" className="text-sm">
                    Enable timer notifications
                  </label>
                </div>
              </CardContent>
            </Card>

            {/* Subtitle Settings */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Subtitles className="h-5 w-5" />
                  Subtitle Settings
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2">
                    Default Font Size (px)
                  </label>
                  <input
                    type="number"
                    value={settings.defaultFontSize}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        defaultFontSize: parseInt(e.target.value) || 18,
                      })
                    }
                    className="w-24 px-3 py-2 border border-input rounded-md bg-background"
                    min="12"
                    max="32"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">
                    Default Position (px from bottom)
                  </label>
                  <input
                    type="number"
                    value={settings.defaultPosition}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        defaultPosition: parseInt(e.target.value) || 80,
                      })
                    }
                    className="w-24 px-3 py-2 border border-input rounded-md bg-background"
                    min="20"
                    max="200"
                  />
                </div>
              </CardContent>
            </Card>

            {/* API Settings */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Database className="h-5 w-5" />
                  API Settings
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2">
                    Server URL
                  </label>
                  <input
                    type="text"
                    value={settings.apiBaseUrl}
                    onChange={(e) =>
                      setSettings({ ...settings, apiBaseUrl: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-input rounded-md bg-background"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Used for study logs, flashcards, and other server-side features
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Keyboard Shortcuts */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Keyboard className="h-5 w-5" />
                  Keyboard Shortcuts
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex justify-between items-center py-2 border-b border-border">
                    <span className="text-sm">Toggle Timer Display</span>
                    <kbd className="px-3 py-1 bg-muted rounded text-sm font-mono">
                      {isMac ? '⌃⇧T' : 'Alt+Shift+T'}
                    </kbd>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b border-border">
                    <span className="text-sm">Start Timer</span>
                    <kbd className="px-3 py-1 bg-muted rounded text-sm font-mono">
                      {isMac ? '⌃⇧S' : 'Alt+Shift+S'}
                    </kbd>
                  </div>
                  <div className="flex justify-between items-center py-2">
                    <span className="text-sm">Toggle Subtitle Overlay</span>
                    <kbd className="px-3 py-1 bg-muted rounded text-sm font-mono">
                      {isMac ? '⌃⇧C' : 'Alt+Shift+C'}
                    </kbd>
                  </div>
                </div>
                {isMac && (
                  <div className="mt-4 p-3 bg-muted/50 rounded-lg">
                    <p className="text-xs text-muted-foreground">
                      <strong>Mac Key Legend:</strong><br />
                      ⌃ = Control key<br />
                      ⇧ = Shift key
                    </p>
                  </div>
                )}
                <p className="text-xs text-muted-foreground mt-4">
                  To customize shortcuts, go to chrome://extensions/shortcuts
                </p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Flashcards Tab */}
        {activeTab === 'flashcards' && (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <BookOpen className="h-5 w-5" />
                  Flashcard Statistics
                </CardTitle>
              </CardHeader>
              <CardContent>
                {isLoadingStats ? (
                  <div className="text-center py-8 text-muted-foreground">
                    Loading...
                  </div>
                ) : flashcardStats ? (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="p-4 bg-muted/50 rounded-lg text-center">
                      <div className="text-3xl font-bold text-primary">
                        {flashcardStats.total}
                      </div>
                      <div className="text-sm text-muted-foreground">Total Cards</div>
                    </div>
                    <div className="p-4 bg-orange-50 rounded-lg text-center">
                      <div className="text-3xl font-bold text-orange-600">
                        {flashcardStats.dueForReview}
                      </div>
                      <div className="text-sm text-muted-foreground">Due for Review</div>
                    </div>
                    <div className="p-4 bg-blue-50 rounded-lg text-center">
                      <div className="text-3xl font-bold text-blue-600">
                        {flashcardStats.learning}
                      </div>
                      <div className="text-sm text-muted-foreground">Learning</div>
                    </div>
                    <div className="p-4 bg-green-50 rounded-lg text-center">
                      <div className="text-3xl font-bold text-green-600">
                        {flashcardStats.mastered}
                      </div>
                      <div className="text-sm text-muted-foreground">Mastered</div>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    No flashcard data available.
                    <br />
                    Make sure the server is running.
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Review Flashcards</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-4">
                  Open the flashcard review app to study your saved vocabulary using spaced repetition.
                </p>
                <Button
                  onClick={() => {
                    window.open(`${settings.apiBaseUrl}/flashcards`, '_blank');
                  }}
                  className="flex items-center gap-2"
                >
                  <ExternalLink className="h-4 w-4" />
                  Open Flashcard Review
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">How to Add Words</CardTitle>
              </CardHeader>
              <CardContent>
                <ol className="list-decimal list-inside space-y-2 text-sm text-muted-foreground">
                  <li>Select any English text on a webpage</li>
                  <li>Right-click and choose "Look up word" or "Translate phrase"</li>
                  <li>Click "Save to Flashcards" in the popup panel</li>
                  <li>You can also use "Manual Input" mode to add custom words</li>
                </ol>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Study History */}
        {activeTab === 'history' && (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <History className="h-5 w-5" />
                  Recent Study Sessions
                </CardTitle>
              </CardHeader>
              <CardContent>
                {isLoadingLogs ? (
                  <div className="text-center py-8 text-muted-foreground">
                    Loading...
                  </div>
                ) : studyLogs.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    No study sessions recorded yet.
                    <br />
                    Start a timer to track your learning!
                  </div>
                ) : (
                  <div className="space-y-3">
                    {studyLogs.slice(0, 20).map((log) => (
                      <div
                        key={log.id}
                        className="flex items-center justify-between py-3 border-b border-border last:border-0"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium truncate">
                            {log.pageTitle || log.domain || 'Unknown page'}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {log.domain} • {formatDate(log.startedAt)}
                          </div>
                        </div>
                        <div className="text-sm font-medium text-primary ml-4">
                          {formatDuration(log.duration)}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg text-destructive">
                  <Trash2 className="h-5 w-5" />
                  Danger Zone
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-4">
                  Clear all locally stored data including settings and cached information.
                </p>
                <Button variant="destructive" onClick={handleClearData}>
                  Clear Local Data
                </Button>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Save Button */}
        {activeTab === 'general' && (
          <div className="flex items-center gap-4 mt-6">
            <Button onClick={handleSave}>Save Settings</Button>
            {saved && (
              <span className="text-sm text-green-600">Settings saved!</span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
