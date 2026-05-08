# Asprisawi Discord Music Bot

A Discord slash-command music bot built with `discord.js`, `discord-player`, `@discord-player/extractor`, and `discord-player-youtube`.

![Asprisawi banner](img/banner.png)

## Features

- Slash commands for playback, queue control, loop modes, autoplay, shuffle, previous track, and volume.
- `?` prefix text commands are supported for the same bot commands, such as `?play`, `?stop`, and `?leave`.
- `/lyric` shows lyrics for the currently playing song using LRCLIB through Discord Player, without adding an API key.
- Music player messages include buttons for previous, pause/resume, skip, and stop.
- `/tts` can read user chat messages into a voice channel using Microsoft Edge TTS without a paid API key.
- `/sawi` lets users ask Sawi questions through Groq's OpenAI-compatible chat API.
- Plain text `/play` searches default to YouTube, and `/searchsource` can switch a server to Spotify or automatic search.
- Supports YouTube URLs/searches, YouTube Music URLs, Spotify track/album/playlist URLs, direct audio URLs, SoundCloud, Vimeo, Reverbnation, Spotify search, and Apple Music search where Discord Player can resolve playback.
- YouTube search and autoplay filter out Shorts-style clips and obvious non-music videos before queueing.
- Autoplay uses related recommendations and filters duplicate song titles from other channels/uploads.
- Shows presence with bot uptime, and adds the current track, artist, and requester while music is active.
- Suppresses link embeds so YouTube and playlist URLs do not expand into large web previews.
- Uses emoji-labeled, color-coded Discord embeds for bot messages: playing is green, skipped is blue, stopped/errors are red, and queued is amber.
- Edits a track's queued status into now-playing, then posts a new message for each new track so chat keeps playback history.
- Stays in the voice channel by default; `/stop` stops music without leaving, and owner-only `/leave` disconnects it.
- Supports Windows and Ubuntu/Linux. Uses bundled `@ffmpeg-installer/ffmpeg` by default, or system `ffmpeg` when `FFMPEG_PATH` is set.
- Cleans stale slash commands from older deployments when registering guild commands.
- Optionally restricts slash command usage to specific Discord role IDs.

## Artwork

The `img/` folder contains the bot artwork used for profiles, previews, and README presentation:

- `img/banner.png` - wide banner image.
- `img/pfp.png` - profile/avatar image.
- `img/short.png` - compact social preview image.

## Requirements

- Node.js `20.19.0` or newer.
- `pnpm` through Corepack.
- A Discord server where you can invite bots or manage apps.

## Create The Discord Bot

1. Open the [Discord Developer Portal](https://discord.com/developers/applications).
2. Select **New Application**, give it a name, then create it.
3. Open **General Information** and copy **Application ID**. This is `CLIENT_ID`.
4. Open **Bot**.
5. Create the bot user if Discord has not already created one.
6. Copy or reset the bot token. This is `DISCORD_TOKEN`.
7. To use `?` prefix commands or automatic chat TTS, enable **Message Content Intent** under Privileged Gateway Intents. The other privileged intents can stay disabled.

Keep the token private. Do not paste it into Discord chat, GitHub, or screenshots.

## Invite The Bot

In the Developer Portal, open **OAuth2** and generate an install URL.

Scopes:

- `bot`
- `applications.commands`

Bot permissions:

- View Channels
- Send Messages
- Connect
- Speak

Minimum permission integer for those four permissions:

```text
3148800
```

Manual invite URL format:

```text
https://discord.com/oauth2/authorize?client_id=1502034685134639284&permissions=3148800&scope=bot%20applications.commands
```

Replace `YOUR_CLIENT_ID` with the Application ID, open the URL, and choose your server. If the bot will use private text or voice channels, make sure the bot role is also allowed to view/send/connect/speak in those channel overrides.

Users need permission to use application commands in the channel. If slash commands do not show for normal members, check the server or channel permission for **Use Application Commands**.

## Windows Install

1. Enable Corepack:

```powershell
corepack enable
```

2. Activate the pinned pnpm version:

```powershell
corepack prepare pnpm@10.33.3 --activate
```

3. Install dependencies:

```powershell
pnpm install --frozen-lockfile
```

4. Create `.env`:

```powershell
Copy-Item .env.example .env
```

5. Edit `.env`:

```env
DISCORD_TOKEN=your-bot-token
CLIENT_ID=your-application-id
GUILD_ID=your-server-id
AUTHORIZED_ROLE_IDS=role-id
ENABLE_MESSAGE_CONTENT_INTENT=true
```

`GUILD_ID` is recommended while setting up because guild commands update immediately. Leave it empty only when you are ready to register global commands.

`AUTHORIZED_ROLE_IDS` is optional. Leave it empty to allow everyone who can see the slash commands. To restrict the bot, enable Discord Developer Mode, right-click the allowed role, copy its ID, and put it there. Multiple roles can be comma-separated.

Only set `ENABLE_MESSAGE_CONTENT_INTENT=true` after enabling **Message Content Intent** in the Discord Developer Portal. This is required for `?` prefix commands and automatic chat TTS. If the portal toggle is off, Discord rejects the gateway connection with `Used disallowed intents`.

## Ubuntu Install

The bot works on Ubuntu. The code is not Windows-only: `@ffmpeg-installer/ffmpeg` can provide a bundled ffmpeg binary, and the Ubuntu installer also installs system `ffmpeg` and sets `FFMPEG_PATH=/usr/bin/ffmpeg`.

From a cloned checkout on the Ubuntu server:

```bash
sudo bash scripts/install-ubuntu.sh
```

The installer:

- installs system packages: `curl`, `git`, `rsync`, `ffmpeg`, build tools, and Python 3
- installs Node.js `22.x` when the existing Node.js version is older than `20.19.0`
- enables Corepack and pnpm `10.33.3`
- copies the app to `/opt/asprisawi`
- creates an `asprisawi` system user
- installs production dependencies
- creates `/etc/systemd/system/asprisawi.service`

Edit the environment file:

```bash
sudo nano /opt/asprisawi/.env
```

Fill in at least:

```env
DISCORD_TOKEN=your-bot-token
CLIENT_ID=your-application-id
GUILD_ID=your-server-id
AUTHORIZED_ROLE_IDS=role-id
ENABLE_MESSAGE_CONTENT_INTENT=true
FFMPEG_PATH=/usr/bin/ffmpeg
```

Register slash commands:

```bash
cd /opt/asprisawi
sudo -u asprisawi corepack pnpm run register
```

Start and inspect the service:

```bash
sudo systemctl start asprisawi
sudo systemctl status asprisawi
sudo journalctl -u asprisawi -f
```

Installer options:

```bash
# Install somewhere else
sudo APP_DIR=/srv/asprisawi bash scripts/install-ubuntu.sh

# Use a different service/user name
sudo APP_USER=discordbot SERVICE_NAME=discordbot bash scripts/install-ubuntu.sh

# Register commands during install when .env is already filled
sudo REGISTER_COMMANDS=true bash scripts/install-ubuntu.sh
```

## Register Commands

Register slash commands:

```powershell
pnpm run register
```

When `GUILD_ID` is set, registration replaces that server's commands and clears global commands from this Discord application. This removes old slash commands left by previous bot scripts.

If you register global commands and still see old server-only commands, set this in `.env` and run `pnpm run register` once:

```env
CLEAR_GUILD_IDS=server-id,another-server-id
```

## Start The Bot

Run a syntax check:

```powershell
pnpm run check
```

Start the bot:

```powershell
pnpm start
```

You should see a log like:

```text
Logged in as BotName#0000.
Loaded 16 commands.
```

## Commands

- `/play query:<song, URL, or playlist>` queues music in your voice channel.
- `/nowplaying` shows the active track.
- `/lyric` shows lyrics for the current track.
- `/queue` shows the current track and next tracks.
- `/pause` toggles pause/resume.
- `/skip` skips the current track.
- `/previous` returns to the previous track when history is available.
- `/shuffle` shuffles queued tracks.
- `/autoplay enabled:<true|false>` toggles related tracks when the queue ends.
- `/searchsource source:<spotify|youtube|auto>` changes the default source for plain text `/play` searches.
- `/loop mode:<off|track|queue|autoplay>` changes repeat behavior.
- `/volume level:<0-100>` changes player volume.
- `/tts enabled:<true|false> voice:<optional Edge TTS ShortName>` toggles automatic TTS for this text channel and your voice channel.
- `/sawi question:<question>` asks Sawi a question.
- `/stop` stops playback without leaving voice.
- `/leave` stops playback and leaves voice. Only user ID `399562405249810433` can use it.

Every command can also be used with the `?` prefix when Message Content Intent is enabled. Examples: `?play artist song name`, `?stop`, `?leave`, `?skip`, `?pause`, `?volume 75`, `?loop track`, `?autoplay off`, `?searchsource spotify`, and `?sawi hi sawi`.

Examples:

```text
/play query:https://www.youtube.com/watch?v=VIDEO_ID
/play query:https://music.youtube.com/watch?v=VIDEO_ID
/play query:https://open.spotify.com/playlist/PLAYLIST_ID
/play query:artist song name
/lyric
/tts enabled:true
/tts enabled:true voice:en-US-AriaNeural
/tts enabled:false
/sawi question:hi sawi, how should I relax tonight?
?play artist song name
?stop
?leave
@BotName hi sawi, recommend a cozy song
```

Plain text searches use YouTube by default. Use `/searchsource source:spotify` if you prefer Spotify metadata search, or `/searchsource source:auto` to let Discord Player choose. URLs still use their detected source.

When `/tts` is enabled, the bot reads normal messages from the channel where you ran the command and speaks them in your current voice channel. It ignores bot, webhook, system, and `?` prefix command messages. Generated TTS tracks do not post now-playing or queue-finished messages.

You can also ask Sawi by mentioning the bot in chat, or by replying to a previous `Sawi says` message. Mentions work with the normal `GuildMessages` intent. Replies that do not ping the bot may also need Discord's Message Content intent.

## Optional Configuration

Use a custom ffmpeg binary instead of the bundled one:

```env
FFMPEG_PATH=C:\path\to\ffmpeg.exe
```

Improve YouTube stability with a throwaway YouTube account cookie:

```env
YOUTUBE_COOKIE=your-full-cookie-header
```

YouTube playback is unofficial and can be brittle when YouTube changes its clients. Use a throwaway account cookie, not your personal account, and check the source platform's terms before using it beyond private testing.

Spotify links are resolved to metadata and bridged to playable audio through the available streaming extractors. They usually work without credentials, but Spotify API credentials can make metadata fetching more reliable:

```env
DP_SPOTIFY_CLIENT_ID=your-spotify-client-id
DP_SPOTIFY_CLIENT_SECRET=your-spotify-client-secret
```

Enable Discord Player debug logs:

```env
DEBUG_PLAYER=true
```

Use a prefix other than `?` for text commands:

```env
COMMAND_PREFIX=!
```

Enable Sawi AI answers through Groq:

```env
GROQ_API_KEY=your-groq-api-key
GROQ_MODEL=openai/gpt-oss-120b
```

`GROQ_MODEL` is optional and defaults to `openai/gpt-oss-120b`.

Set the default voice for `/tts`:

```env
TTS_VOICE=id-ID-ArdiNeural
```

`/tts` uses Microsoft Edge Read Aloud TTS through the `msedge-tts` package, so it does not need a Discord, OpenAI, Azure, or ElevenLabs API key. It still needs outbound network access to Microsoft's speech endpoint and Discord's Message Content intent. Prefix commands also need Message Content intent. Enable that portal toggle, then set `ENABLE_MESSAGE_CONTENT_INTENT=true` in `.env`. Use an Edge TTS ShortName such as `id-ID-ArdiNeural`, `id-ID-GadisNeural`, or `en-US-AriaNeural`.

Store persistent per-server settings somewhere other than `data/guild-settings.json`:

```env
GUILD_SETTINGS_PATH=/var/lib/asprisawi/guild-settings.json
```

## Troubleshooting

If you see `You must be signed in to perform this operation`, add `YOUTUBE_COOKIE` to `.env`, restart the bot, then try again.

If startup fails with `Service Unavailable` for `https://discord.com/api/v10/gateway/bot`, Discord's REST API or your server's route to Discord is unavailable. The bot retries transient 5xx and network login errors automatically; check [Discord Status](https://discordstatus.com/) and test connectivity with `curl -I --connect-timeout 10 https://discord.com`.

If commands do not appear, run `pnpm run register` again and confirm the bot was invited with the `applications.commands` scope.

If `?` prefix commands do not respond, or `/tts` says setup is required or does not read chat messages, enable **Message Content Intent** in the Discord Developer Portal, set `ENABLE_MESSAGE_CONTENT_INTENT=true` in `.env`, restart the bot, and confirm you enabled TTS in the same text channel where users are chatting.

If old commands still appear, they are usually registered in the other scope. Use `GUILD_ID` to register guild commands and clear globals, or use `CLEAR_GUILD_IDS` when registering global commands to clear old guild commands.

If the bot joins voice but no audio plays, confirm the bot role has **Connect** and **Speak** in that voice channel.

## Discord References

- [OAuth2 and permissions](https://docs.discord.com/developers/platform/oauth2-and-permissions)
- [Application command authorization](https://docs.discord.com/developers/interactions/application-commands#authorizing-your-application)
- [Permission flags](https://docs.discord.com/developers/topics/permissions#bitwise-permission-flags)
