# Discord Music Bot

A small Discord slash-command music bot using `discord.js`, `discord-player`, `@discord-player/extractor`, and `discord-player-youtube`.

## Setup

1. Create a Discord application and bot in the Discord Developer Portal.
2. Copy `.env.example` to `.env` and fill in `DISCORD_TOKEN`, `CLIENT_ID`, and a development `GUILD_ID`.
3. Invite the bot to your server with the `bot` and `applications.commands` scopes. Give it at least View Channels, Send Messages, Connect, and Speak.
4. Install dependencies:

```bash
npm install
```

5. Register slash commands:

```bash
npm run register
```

When `GUILD_ID` is set, registration replaces that server's commands and clears global commands from this Discord application. This removes old slash commands left by earlier bot scripts. If you register global commands and still see old server-only commands, set `CLEAR_GUILD_IDS` to the affected server ID and run `npm run register` once.

6. Start the bot:

```bash
npm start
```

## Commands

- `/play query:<song, URL, or playlist>` queues music in your voice channel.
- `/nowplaying` shows the active track.
- `/queue` shows the current track and the next tracks.
- `/pause` toggles pause/resume.
- `/skip` skips the current track.
- `/previous` returns to the previous track when history is available.
- `/shuffle` shuffles queued tracks.
- `/autoplay enabled:<true|false>` toggles related tracks when the queue ends.
- `/loop mode:<off|track|queue|autoplay>` changes repeat behavior.
- `/volume level:<0-100>` changes player volume.
- `/stop` stops playback and leaves voice.

Bot messages suppress link embeds, so YouTube and playlist URLs do not expand into large web previews.

Examples:

```text
/play query:https://www.youtube.com/watch?v=VIDEO_ID
/play query:https://music.youtube.com/watch?v=VIDEO_ID
/play query:artist song name
```

## Supported Sources

This uses Discord Player's official default extractors plus the community `discord-player-youtube` extractor. Out of the box that covers YouTube URLs/searches, local/raw audio URLs, SoundCloud, Vimeo, Reverbnation, Spotify search, and Apple Music search where the extractor can resolve or bridge playback.

YouTube playback is unofficial and can be brittle when YouTube changes its clients. The extractor works without auth, but its README recommends adding `YOUTUBE_COOKIE` for better stability. Use a throwaway YouTube account cookie and check the source platform's terms before using it beyond private testing.

## YouTube Sign-In Errors

If you see `You must be signed in to perform this operation`, add `YOUTUBE_COOKIE` to `.env` and restart the bot. Use the full cookie header string from a throwaway YouTube account browser session.

The Discord voice stack also needs `@snazzah/davey` for DAVE protocol support; it is included in this project.

The project uses `@ffmpeg-installer/ffmpeg` by default. If you prefer a system ffmpeg binary, set `FFMPEG_PATH` in `.env`.

## Known Audit Note

`npm audit` currently reports a moderate advisory through `@discord-player/extractor` -> `file-type`. The extractor package is already pinned to the latest release, and npm does not currently provide a non-breaking fix path, so this scaffold keeps the current library version unless the upstream package publishes a patched dependency path.
