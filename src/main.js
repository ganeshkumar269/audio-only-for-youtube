// Runs in YouTube's own JS world at document_start, before the player boots.
//
// YouTube's player has a built-in audio-only mode: when the per-video "player vars"
// object has `audio_only` set, the SABR stream requests audio formats only and the
// video element never receives a video track. YouTube's own UI never sets it, so we
// provide it through Object.prototype — every player-vars object inherits it, which
// covers the initial load, in-app navigation, playlists, autoplay and ads alike.
(() => {
  'use strict';

  // The background worker also injects this file on click (for tabs opened before
  // the extension was installed), so it may run twice in one page.
  if (Object.getOwnPropertyDescriptor(Object.prototype, 'audio_only')) return;

  const STORAGE_KEY = 'yt-audio-only'; // sessionStorage is per tab, so the toggle is too
  const SET_EVENT = 'yt-audio-only:set'; // dispatched by the background worker on toggle
  const ROOT_CLASS = 'yt-audio-only';
  const PLAYING = 1;
  const BUFFERING = 3;

  let enabled = false;
  try {
    enabled = sessionStorage.getItem(STORAGE_KEY) === '1';
  } catch {}

  Object.defineProperty(Object.prototype, 'audio_only', {
    configurable: true,
    enumerable: false,
    get() {
      return enabled ? '1' : undefined;
    },
    // Keep plain assignments (`vars.audio_only = x`) working as own properties.
    set(value) {
      Object.defineProperty(this, 'audio_only', {
        value,
        writable: true,
        enumerable: true,
        configurable: true,
      });
    },
  });

  // Same artwork as icons/*.png, inlined because this script can't reach extension files.
  const ICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
    <defs><linearGradient id="g" x2="1" y2="1">
      <stop offset="0" stop-color="#816CFA"/><stop offset="1" stop-color="#4338CA"/>
    </linearGradient></defs>
    <rect width="100" height="100" rx="22" fill="url(#g)"/>
    <path d="M20 57V56a30 30 0 0 1 60 0v1" fill="none" stroke="#fff" stroke-width="9"/>
    <g fill="#fff">
      <rect x="15" y="53" width="14" height="26" rx="5"/>
      <rect x="71" y="53" width="14" height="26" rx="5"/>
      <rect x="36.5" y="57.5" width="7" height="16.8" rx="3.5"/>
      <rect x="46.5" y="51.5" width="7" height="25.2" rx="3.5"/>
      <rect x="56.5" y="55.5" width="7" height="19.6" rx="3.5"/>
    </g>
  </svg>`;
  const ICON_URL = `data:image/svg+xml,${encodeURIComponent(ICON_SVG)}`;

  // With no video track the player is just black, so show the thumbnail instead,
  // labelled so it isn't mistaken for a paused video.
  const style = document.createElement('style');
  style.textContent = `
    html.${ROOT_CLASS} #movie_player video { opacity: 0 !important; }
    html.${ROOT_CLASS} #movie_player {
      background: #000 var(--yt-audio-only-thumb, none) center / contain no-repeat !important;
    }
    html.${ROOT_CLASS} #movie_player::after {
      content: 'Audio only';
      position: absolute;
      top: 12px;
      left: 12px;
      padding: 4px 10px 4px 32px;
      border-radius: 12px;
      background: rgba(0, 0, 0, 0.7) url("${ICON_URL}") no-repeat 8px center / 18px 18px;
      color: #fff;
      font: 500 13px/1.4 Roboto, Arial, sans-serif;
      pointer-events: none;
    }
  `;
  document.documentElement.append(style);

  const player = () => document.getElementById('movie_player');

  function currentVideoId() {
    const id = player()?.getVideoData?.()?.video_id || new URLSearchParams(location.search).get('v');
    return /^[\w-]{11}$/.test(id ?? '') ? id : null;
  }

  function render() {
    const root = document.documentElement;
    root.classList.toggle(ROOT_CLASS, enabled);
    const id = enabled && currentVideoId();
    root.style.setProperty('--yt-audio-only-thumb', id ? `url("https://i.ytimg.com/vi/${id}/hqdefault.jpg")` : 'none');
  }

  // The flag is only read when a video loads, so reload the current one in place.
  function reloadCurrentVideo() {
    const p = player();
    const data = p?.getVideoData?.();
    if (!data?.video_id) return;
    const args = { videoId: data.video_id };
    if (!data.isLive) args.startSeconds = p.getCurrentTime();
    const state = p.getPlayerState();
    if (state === PLAYING || state === BUFFERING) p.loadVideoById(args);
    else p.cueVideoById(args);
  }

  document.addEventListener(SET_EVENT, (e) => {
    enabled = e.detail === true;
    reloadCurrentVideo();
    render();
  });
  document.addEventListener('yt-navigate-finish', render);
  // Media events don't bubble; capture catches every video change (autoplay, ads).
  document.addEventListener('loadstart', render, true);
  render();
})();
