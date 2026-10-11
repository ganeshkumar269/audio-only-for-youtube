// Toolbar button / Alt+Shift+A toggles audio-only for the clicked tab only.
// The state lives in the tab's own sessionStorage, which is per tab and survives
// reloads and in-tab navigation; the badge just mirrors it.

const STORAGE_KEY = 'yt-audio-only';
const SET_EVENT = 'yt-audio-only:set';

chrome.action.setBadgeBackgroundColor({ color: '#cc0000' });

const isYouTube = (url) => /^https:\/\/(www|music)\.youtube\.com\//.test(url ?? '');

async function showState(tabId, on) {
  await chrome.action.setBadgeText({ tabId, text: on ? 'ON' : '' });
  await chrome.action.setTitle({
    tabId,
    title: on ? 'Audio only: ON (click to bring video back)' : 'Audio only: OFF (click to stop the video stream)',
  });
}

// Injected into the page (isolated world): flips the flag and tells main.js.
function toggleInPage(key, eventName) {
  const on = sessionStorage.getItem(key) !== '1';
  if (on) sessionStorage.setItem(key, '1');
  else sessionStorage.removeItem(key);
  document.dispatchEvent(new CustomEvent(eventName, { detail: on }));
  return on;
}

function readInPage(key) {
  return sessionStorage.getItem(key) === '1';
}

chrome.action.onClicked.addListener(async (tab) => {
  if (!isYouTube(tab.url)) return;
  // Content scripts only reach pages loaded after install; make sure it's there.
  await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    files: ['src/main.js'],
    world: 'MAIN',
  });
  const [{ result: on }] = await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: toggleInPage,
    args: [STORAGE_KEY, SET_EVENT],
  });
  await showState(tab.id, on);
});

// Re-sync the badge after every page load (tab.url is only visible to us on YouTube).
chrome.tabs.onUpdated.addListener(async (tabId, info, tab) => {
  if (info.status !== 'complete') return;
  if (!isYouTube(tab.url)) return showState(tabId, false);
  try {
    const [{ result: on }] = await chrome.scripting.executeScript({
      target: { tabId },
      func: readInPage,
      args: [STORAGE_KEY],
    });
    await showState(tabId, on);
  } catch {
    // Tab closed or navigated away mid-check.
  }
});
