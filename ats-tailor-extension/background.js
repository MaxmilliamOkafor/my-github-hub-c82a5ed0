// ATS Tailored CV & Cover Letter - Background Service Worker
// Minimal background script - just handles extension lifecycle

console.log('[ATS Tailor] Background service worker started');

// Handle extension installation
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    console.log('[ATS Tailor] Extension installed');
  } else if (details.reason === 'update') {
    console.log('[ATS Tailor] Extension updated to version', chrome.runtime.getManifest().version);
  }
});

// Keep service worker alive and handle popup open requests
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'keepAlive') {
    sendResponse({ status: 'alive' });
    return true;
  }
  
  // Open the extension popup when automation starts
  if (message.action === 'openPopup') {
    // Chrome doesn't allow programmatically opening popups directly,
    // but we can use action.openPopup() in Chrome 99+ with user gesture requirement
    // As a workaround, we'll set a badge to indicate automation is running
    chrome.action.setBadgeText({ text: '⚙️' });
    chrome.action.setBadgeBackgroundColor({ color: '#f59e0b' });
    sendResponse({ status: 'badge_set' });
    return true;
  }
  
  // Clear badge when automation completes
  if (message.action === 'clearBadge') {
    chrome.action.setBadgeText({ text: '' });
    sendResponse({ status: 'badge_cleared' });
    return true;
  }
});
