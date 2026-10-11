# YouTube Audio Only

A tiny Chrome extension (no build step, no dependencies, no network calls of its own)
that toggles YouTube into **audio-only streaming** per tab. In audio-only mode the
video track is never downloaded and never decoded — only the audio stream (usually
Opus, ~130–160 kbps) is fetched.

## Install

1. Open `chrome://extensions`, turn on **Developer mode** (top right).
2. Click **Load unpacked** and pick this folder.
3. Pin the headphones icon to the toolbar (puzzle-piece menu → pin).

## Use

- Click the icon (or press **Alt+Shift+A**) on a YouTube tab. The badge shows **ON**.
- The current video reloads in place at the same timestamp, now audio only; the
  thumbnail is shown where the video was, with an "Audio only" label.
- It stays on for that tab across videos, playlists, autoplay, and reloads. Other tabs
  are unaffected. Click again to bring the video back.

## How it works

YouTube's player has a built-in audio-only mode (used by its Cast / audio devices):
when a video's *player vars* contain `audio_only`, the SABR streaming client asks the
server for audio formats only. YouTube's web UI never sets it, so `src/main.js`
(injected into the page at `document_start`) defines a non-enumerable
`Object.prototype.audio_only` getter that returns `'1'` while the tab's toggle is on.
Every player-vars object inherits it, so every load path picks it up.

The per-tab state lives in the tab's `sessionStorage` — which is per tab by design —
and the background worker only flips it and mirrors it on the toolbar badge.

Older audio-only extensions stopped working because YouTube moved to SABR
(server-side adaptive bitrate) streaming: there are no longer separate per-format
`videoplayback` URLs to grab and play directly.

## Permissions

- `scripting` + `https://www.youtube.com/*` — to read/flip the per-tab toggle.
  Nothing runs on any other site, and nothing is sent anywhere.

## Limitations

- Only `www.youtube.com` (not `music.youtube.com`, `m.youtube.com` or embeds on other sites).
- Relies on an undocumented player variable; if YouTube renames it, the toggle will
  simply stop having an effect (videos keep playing normally).
