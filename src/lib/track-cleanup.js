import { trackTitle } from './format.js';

export function cleanTrackTitle(track) {
  const title = removeVideoNoise(plainText(trackTitle(track)));
  const author = cleanAuthorName(track?.author);

  if (!author) {
    return title;
  }

  return stripAuthorSuffix(stripAuthorPrefix(title, author), author);
}

export function cleanAuthorName(author) {
  return removeVideoNoise(plainText(author ?? ''))
    .replace(/\s+-\s+topic$/i, '')
    .trim();
}

export function plainText(value) {
  return String(value)
    .replace(/\s+/g, ' ')
    .trim();
}

export function normalizedSongKey(track) {
  return normalizeComparableText(cleanTrackTitle(track));
}

export function normalizedSongKeys(track) {
  return new Set([
    normalizedSongKey(track),
    normalizeComparableText(trackTitle(track))
  ].filter(Boolean));
}

export function normalizeComparableText(value) {
  return removeVideoNoise(plainText(value))
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[\u2018\u2019\u201b\u2032']/g, '')
    .replace(/\b(official|music|video|audio|lyrics?|lyric|visualizer|amv|mv|clip|hd|hq|4k)\b/g, ' ')
    .replace(/[^\p{Letter}\p{Number}]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function stripAuthorPrefix(title, author) {
  for (const separator of [' - ', ' \u2013 ', ' \u2014 ', ' | ', ': ']) {
    const prefix = `${author}${separator}`;

    if (title.toLowerCase().startsWith(prefix.toLowerCase())) {
      return title.slice(prefix.length).trim();
    }
  }

  return title;
}

function stripAuthorSuffix(title, author) {
  for (const separator of [' - ', ' \u2013 ', ' \u2014 ', ' | ', ': ']) {
    const suffix = `${separator}${author}`;

    if (title.toLowerCase().endsWith(suffix.toLowerCase())) {
      return title.slice(0, -suffix.length).trim();
    }
  }

  return title;
}

function removeVideoNoise(value) {
  return value
    .replace(/\s*[\[(][^\])]*(official|music\s+video|lyric|lyrics|audio|visualizer|amv|mv)[^\])]*[\])]/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
}
