import { QueryType } from 'discord-player';
import { cleanAuthorName, cleanTrackTitle, normalizeComparableText, normalizedSongKeys } from './track-cleanup.js';

const LOW_PRIORITY_VARIANTS = [
  'cover',
  'karaoke',
  'instrumental',
  'nightcore',
  'sped up',
  'slowed',
  'reverb',
  '8d',
  'remix',
  'live'
];

export async function chooseAutoplayTrack(queue, tracks) {
  const selected = chooseFromCandidates(queue, tracks);

  if (selected) {
    return selected;
  }

  const fallbackTracks = await searchArtistRadio(queue);
  return chooseFromCandidates(queue, fallbackTracks)
    ?? chooseLooseFallback(queue, fallbackTracks);
}

function chooseFromCandidates(queue, tracks = []) {
  const candidates = tracks.filter(Boolean);

  if (candidates.length === 0) {
    return null;
  }

  const knownTracks = getKnownTracks(queue);
  const knownUrls = new Set(knownTracks.map((track) => track.url).filter(Boolean));
  const knownTitles = new Set(
    knownTracks
      .flatMap((track) => [...normalizedSongKeys(track)])
      .filter((key) => key.length > 0)
  );
  const knownSongs = knownTracks.map((track) => ({
    authorKey: normalizeComparableText(cleanAuthorName(track.author)),
    titleKeys: [...normalizedSongKeys(track)]
  }));
  const seed = getSeedTrack(queue);
  const seedAuthor = normalizeComparableText(cleanAuthorName(seed?.author));
  const seedVariantWords = variantWords(cleanTrackTitle(seed));

  const ranked = candidates
    .map((track, index) => ({
      track,
      score: scoreCandidate(track, index, {
        knownTitles,
        knownSongs,
        knownUrls,
        seedAuthor,
        seedVariantWords
      })
    }))
    .filter((candidate) => candidate.score > Number.NEGATIVE_INFINITY)
    .sort((a, b) => b.score - a.score);

  return ranked[0]?.track ?? null;
}

function chooseLooseFallback(queue, tracks = []) {
  const candidates = tracks.filter(Boolean);

  if (candidates.length === 0) {
    return null;
  }

  const knownUrls = new Set(
    getKnownTracks(queue)
      .map((track) => track.url)
      .filter(Boolean)
  );
  const knownSongs = getKnownTracks(queue).map((track) => ({
    authorKey: normalizeComparableText(cleanAuthorName(track.author)),
    titleKeys: [...normalizedSongKeys(track)]
  }));

  return candidates.find((track) => track.url && !knownUrls.has(track.url) && !isKnownSong(track, {
    knownSongs,
    knownTitles: new Set(knownSongs.flatMap((song) => song.titleKeys))
  })) ?? null;
}

function scoreCandidate(track, index, context) {
  const titleKeys = [...normalizedSongKeys(track)];

  if (
    titleKeys.length === 0
    || context.knownUrls.has(track.url)
    || isKnownSong(track, context)
  ) {
    return Number.NEGATIVE_INFINITY;
  }

  let score = 1000 - index * 5;
  const authorKey = normalizeComparableText(cleanAuthorName(track.author));

  if (context.seedAuthor && authorKey === context.seedAuthor) {
    score += 40;
  } else if (context.seedAuthor && authorKey.includes(context.seedAuthor)) {
    score += 20;
  }

  for (const word of variantWords(cleanTrackTitle(track))) {
    if (!context.seedVariantWords.has(word)) {
      score -= 35;
    }
  }

  return score;
}

function getKnownTracks(queue) {
  return [
    queue.history?.currentTrack,
    ...(queue.history?.tracks?.toArray?.() ?? []),
    ...(queue.tracks?.toArray?.() ?? [])
  ].filter(Boolean);
}

function getSeedTrack(queue) {
  return queue.history?.currentTrack
    ?? queue.history?.previousTrack
    ?? queue.history?.tracks?.at?.(0)
    ?? null;
}

async function searchArtistRadio(queue) {
  const seed = getSeedTrack(queue);
  const author = cleanAuthorName(seed?.author);
  const title = cleanTrackTitle(seed);
  const queries = [
    author ? `${author} radio songs` : null,
    author ? `${author} similar songs` : null,
    title ? `${title} similar songs` : null
  ].filter(Boolean);

  if (queries.length === 0) {
    return [];
  }

  const tracks = [];

  for (const query of queries) {
    try {
      const result = await queue.player.search(query, {
        requestedBy: seed?.requestedBy ?? undefined,
        searchEngine: QueryType.YOUTUBE_SEARCH
      });

      tracks.push(...result.tracks ?? []);
    } catch (error) {
      console.error(`Autoplay fallback search failed for "${query}":`, error);
    }
  }

  return tracks;
}

function variantWords(value) {
  const text = normalizeComparableText(value);

  return new Set(LOW_PRIORITY_VARIANTS.filter((word) => text.includes(word)));
}

function isKnownSong(track, context) {
  const titleKeys = [...normalizedSongKeys(track)];

  if (titleKeys.some((key) => context.knownTitles.has(key))) {
    return true;
  }

  const authorKey = normalizeComparableText(cleanAuthorName(track.author));

  return context.knownSongs.some((knownSong) =>
    sameArtist(authorKey, knownSong.authorKey)
    && titleKeys.some((key) => knownSong.titleKeys.some((knownKey) => sameSongTitle(key, knownKey)))
  );
}

function sameArtist(authorKey, knownAuthorKey) {
  return Boolean(authorKey && knownAuthorKey)
    && (authorKey === knownAuthorKey || authorKey.includes(knownAuthorKey) || knownAuthorKey.includes(authorKey));
}

function sameSongTitle(titleKey, knownTitleKey) {
  if (!titleKey || !knownTitleKey) {
    return false;
  }

  if (titleKey === knownTitleKey) {
    return true;
  }

  const shorter = titleKey.length < knownTitleKey.length ? titleKey : knownTitleKey;
  const longer = titleKey.length < knownTitleKey.length ? knownTitleKey : titleKey;
  const tokenCount = shorter.split(' ').filter(Boolean).length;

  return tokenCount >= 3 && longer.includes(shorter)
    || tokenCount >= 2 && longer.endsWith(` ${shorter}`);
}
