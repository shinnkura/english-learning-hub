/// <reference types="chrome" />

import type { Message, MessageResponse } from '@/types';

/**
 * Send a message to the background script
 */
export async function sendMessage<T = unknown>(message: Message): Promise<MessageResponse<T>> {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage(message, (response: MessageResponse<T>) => {
      if (chrome.runtime.lastError) {
        resolve({ success: false, error: chrome.runtime.lastError.message || 'Unknown error' });
      } else {
        resolve(response);
      }
    });
  });
}

/**
 * Send a message to a specific tab's content script
 */
export async function sendMessageToTab<T = unknown>(
  tabId: number,
  message: Message
): Promise<MessageResponse<T>> {
  return new Promise((resolve) => {
    chrome.tabs.sendMessage(tabId, message, (response: MessageResponse<T>) => {
      if (chrome.runtime.lastError) {
        resolve({ success: false, error: chrome.runtime.lastError.message || 'Unknown error' });
      } else {
        resolve(response);
      }
    });
  });
}

/**
 * Subscribe to messages from background script or other parts of the extension
 */
export function onMessage(
  callback: (
    message: Message,
    sender: chrome.runtime.MessageSender,
    sendResponse: (response: MessageResponse) => void
  ) => boolean | void
): () => void {
  const listener = (
    message: Message,
    sender: chrome.runtime.MessageSender,
    sendResponse: (response: MessageResponse) => void
  ) => {
    return callback(message, sender, sendResponse);
  };

  chrome.runtime.onMessage.addListener(listener);

  return () => {
    chrome.runtime.onMessage.removeListener(listener);
  };
}

/**
 * Get the current active tab
 */
export async function getCurrentTab(): Promise<chrome.tabs.Tab | undefined> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

/**
 * Send a message to all tabs
 */
export async function broadcastToAllTabs(message: Message): Promise<void> {
  const tabs = await chrome.tabs.query({});
  for (const tab of tabs) {
    if (tab.id) {
      chrome.tabs.sendMessage(tab.id, message).catch(() => {
        // Tab might not have content script loaded
      });
    }
  }
}
