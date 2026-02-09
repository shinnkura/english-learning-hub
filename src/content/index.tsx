/// <reference types="chrome" />

import React from 'react';
import ReactDOM from 'react-dom/client';
import { TimerOverlay } from './timer/TimerOverlay';
import { WordPanel } from './word-capture/WordPanel';
import { SubtitleOverlay } from './subtitle-overlay/SubtitleOverlay';
import { onMessage } from '@/lib/chrome-messaging';
import type { Message, TimerState } from '@/types';

// Create root element for the extension UI
const ROOT_ID = 'elh-extension-root';

function createRoot() {
  let root = document.getElementById(ROOT_ID);
  if (!root) {
    root = document.createElement('div');
    root.id = ROOT_ID;
    document.body.appendChild(root);
  }
  return root;
}

// State management
let timerState: TimerState = {
  isRunning: false,
  startTime: null,
  endTime: null,
  duration: null,
  currentUrl: null,
  pageTitle: null,
};
let isTimerVisible = true;
let reactRoot: ReactDOM.Root | null = null;

// Word panel state
let wordPanelState: {
  isOpen: boolean;
  word: string;
  position: { x: number; y: number };
} = {
  isOpen: false,
  word: '',
  position: { x: 0, y: 0 },
};

// Subtitle overlay state
let isSubtitleVisible = false;

function renderApp() {
  const rootElement = createRoot();

  if (!reactRoot) {
    reactRoot = ReactDOM.createRoot(rootElement);
  }

  reactRoot.render(
    <React.StrictMode>
      <>
        <TimerOverlay
          timerState={timerState}
          isVisible={isTimerVisible}
          onToggleVisibility={() => {
            isTimerVisible = !isTimerVisible;
            renderApp();
          }}
        />
        {wordPanelState.isOpen && (
          <WordPanel
            word={wordPanelState.word}
            position={wordPanelState.position}
            onClose={() => {
              wordPanelState.isOpen = false;
              renderApp();
            }}
          />
        )}
        <SubtitleOverlay
          isVisible={isSubtitleVisible}
          onClose={() => {
            isSubtitleVisible = false;
            renderApp();
          }}
        />
      </>
    </React.StrictMode>
  );
}

// Open word panel with selected text
function openWordPanel(word: string, x: number, y: number) {
  wordPanelState = {
    isOpen: true,
    word: word.trim(),
    position: { x, y },
  };
  renderApp();
}

// Initialize
async function init() {
  // Get initial timer state
  try {
    const response = await chrome.runtime.sendMessage({ type: 'GET_TIMER_STATE' });
    if (response?.success && response.state) {
      timerState = response.state;
    }
  } catch {
    // Background script might not be ready yet
  }

  // Initial render
  renderApp();

  // Listen for double-click to open word panel
  document.addEventListener('dblclick', (e) => {
    const selection = window.getSelection();
    const selectedText = selection?.toString().trim();

    if (selectedText && selectedText.length > 0 && selectedText.length < 100) {
      openWordPanel(selectedText, e.clientX, e.clientY);
    }
  });

  // Listen for messages from background script
  onMessage((message: Message) => {
    switch (message.type) {
      case 'TIMER_STARTED':
        if ('state' in message) {
          timerState = message.state;
          isTimerVisible = true;
          renderApp();
        }
        break;

      case 'TIMER_STOPPED':
        timerState = {
          isRunning: false,
          startTime: null,
          endTime: null,
          duration: null,
          currentUrl: null,
          pageTitle: null,
        };
        renderApp();
        break;

      case 'TIMER_FINISHED':
        // Show notification in the UI
        timerState = { ...timerState, isRunning: false };
        renderApp();
        break;

      case 'TOGGLE_TIMER_DISPLAY':
        isTimerVisible = !isTimerVisible;
        renderApp();
        break;

      case 'START_TIMER_FROM_SHORTCUT':
        // Start timer with default duration (25 minutes)
        chrome.runtime.sendMessage({ type: 'START_TIMER', duration: 25 * 60 * 1000 });
        break;

      case 'LOOKUP_WORD':
        if ('word' in message) {
          // Get mouse position from selection or use center of screen
          const selection = window.getSelection();
          let x = window.innerWidth / 2;
          let y = window.innerHeight / 3;

          if (selection && selection.rangeCount > 0) {
            const range = selection.getRangeAt(0);
            const rect = range.getBoundingClientRect();
            x = rect.left + rect.width / 2;
            y = rect.bottom;
          }

          openWordPanel(message.word, x, y);
        }
        break;

      case 'TOGGLE_SUBTITLES':
        isSubtitleVisible = !isSubtitleVisible;
        renderApp();
        break;
    }
    return false;
  });
}

// Start when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
