/// <reference types="chrome" />

import type { Message, TimerState } from '@/types';

// Timer state
let timerState: TimerState = {
  isRunning: false,
  startTime: null,
  endTime: null,
  duration: null,
  currentUrl: null,
  pageTitle: null,
};

// Initialize extension
chrome.runtime.onInstalled.addListener(() => {
  console.log('English Learning Hub extension installed');

  // Create context menu for word capture
  chrome.contextMenus.create({
    id: 'elh-lookup-word',
    title: 'Look up "%s" in dictionary',
    contexts: ['selection'],
  });
});

// Handle context menu clicks
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === 'elh-lookup-word' && info.selectionText && tab?.id) {
    chrome.tabs.sendMessage(tab.id, {
      type: 'LOOKUP_WORD',
      word: info.selectionText,
    });
  }
});

// Handle keyboard shortcuts
chrome.commands.onCommand.addListener(async (command) => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  if (!tab?.id) return;

  switch (command) {
    case 'toggle-timer':
      chrome.tabs.sendMessage(tab.id, { type: 'TOGGLE_TIMER_DISPLAY' });
      break;
    case 'start-timer':
      chrome.tabs.sendMessage(tab.id, { type: 'START_TIMER_FROM_SHORTCUT' });
      break;
    case 'toggle-subtitles':
      chrome.tabs.sendMessage(tab.id, { type: 'TOGGLE_SUBTITLES' });
      break;
  }
});

// Handle messages from popup and content scripts
chrome.runtime.onMessage.addListener((message: Message, sender, sendResponse) => {
  handleMessage(message, sender).then(sendResponse);
  return true; // Keep the message channel open for async response
});

async function handleMessage(message: Message, sender: chrome.runtime.MessageSender) {
  switch (message.type) {
    case 'START_TIMER':
      return startTimer(message.duration, sender);

    case 'STOP_TIMER':
      return stopTimer();

    case 'GET_TIMER_STATE':
      return { success: true, state: timerState };

    case 'SAVE_STUDY_LOG':
      return saveStudyLog(message.data);

    default:
      return { success: false, error: 'Unknown message type' };
  }
}

async function startTimer(duration: number, _sender: chrome.runtime.MessageSender) {
  const now = Date.now();

  // Get current tab info
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  timerState = {
    isRunning: true,
    startTime: now,
    endTime: now + duration,
    duration,
    currentUrl: tab?.url || null,
    pageTitle: tab?.title || null,
  };

  // Save state to storage
  await chrome.storage.local.set({ timerState });

  // Set alarm for timer end
  await chrome.alarms.create('studyTimer', {
    when: timerState.endTime!,
  });

  // Notify all tabs
  broadcastToTabs({ type: 'TIMER_STARTED', state: timerState });

  return { success: true, state: timerState };
}

async function stopTimer() {
  const wasRunning = timerState.isRunning;
  const studyDuration = timerState.startTime
    ? Date.now() - timerState.startTime
    : 0;

  // Save study log if timer was running
  if (wasRunning && timerState.startTime) {
    await saveStudyLog({
      url: timerState.currentUrl || '',
      pageTitle: timerState.pageTitle || '',
      duration: studyDuration,
      startedAt: new Date(timerState.startTime).toISOString(),
      endedAt: new Date().toISOString(),
    });
  }

  // Clear timer state
  timerState = {
    isRunning: false,
    startTime: null,
    endTime: null,
    duration: null,
    currentUrl: null,
    pageTitle: null,
  };

  await chrome.storage.local.set({ timerState });
  await chrome.alarms.clear('studyTimer');

  // Notify all tabs
  broadcastToTabs({ type: 'TIMER_STOPPED' });

  return { success: true };
}

async function saveStudyLog(data: {
  url: string;
  pageTitle: string;
  duration: number;
  startedAt: string;
  endedAt: string;
  notes?: string;
}) {
  try {
    // Get API base URL from settings (elh server runs on 3001, AnkiPocket on 3000)
    const { settings } = await chrome.storage.sync.get('settings');
    const apiBaseUrl = settings?.apiBaseUrl || 'http://localhost:3001';

    const response = await fetch(`${apiBaseUrl}/api/study-logs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url: data.url,
        domain: data.url ? new URL(data.url).hostname : null,
        page_title: data.pageTitle,
        duration: Math.floor(data.duration / 1000), // Convert to seconds
        started_at: data.startedAt,
        ended_at: data.endedAt,
        notes: data.notes || null,
      }),
    });

    if (!response.ok) {
      throw new Error(`Failed to save study log: ${response.status}`);
    }

    return { success: true };
  } catch (error) {
    console.error('Failed to save study log:', error);
    // Store locally for later sync
    const { pendingLogs = [] } = await chrome.storage.local.get('pendingLogs');
    pendingLogs.push(data);
    await chrome.storage.local.set({ pendingLogs });
    return { success: false, error: String(error) };
  }
}

// Handle alarm (timer finished)
chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === 'studyTimer') {
    // Show notification
    const { settings } = await chrome.storage.sync.get('settings');
    if (settings?.enableNotifications !== false) {
      chrome.notifications.create('timer-finished', {
        type: 'basic',
        iconUrl: 'icons/icon128.png',
        title: 'Study Timer Finished!',
        message: 'Great job! Your study session has ended.',
        buttons: [
          { title: 'Continue (+15 min)' },
          { title: 'End Session' },
        ],
        requireInteraction: true,
      });
    }

    // Notify all tabs
    broadcastToTabs({ type: 'TIMER_FINISHED' });
  }
});

// Handle notification button clicks
chrome.notifications.onButtonClicked.addListener(async (notificationId, buttonIndex) => {
  if (notificationId === 'timer-finished') {
    if (buttonIndex === 0) {
      // Continue with 15 more minutes
      await startTimer(15 * 60 * 1000, {} as chrome.runtime.MessageSender);
    } else {
      // End session
      await stopTimer();
    }
    chrome.notifications.clear(notificationId);
  }
});

async function broadcastToTabs(message: Message) {
  const tabs = await chrome.tabs.query({});
  for (const tab of tabs) {
    if (tab.id) {
      chrome.tabs.sendMessage(tab.id, message).catch(() => {
        // Tab might not have content script
      });
    }
  }
}

export {};
