export function moveAddedSingleTrackNext(result, queueWasActive) {
  if (!queueWasActive || result?.searchResult?.playlist || !result?.track) {
    return false;
  }

  const queue = result.queue;
  const upcomingTracks = queue?.tracks?.toArray?.();

  if (!Array.isArray(upcomingTracks)) {
    return false;
  }

  const trackIndex = upcomingTracks.findIndex((track) => track === result.track);

  if (trackIndex <= 0) {
    return false;
  }

  if (typeof queue.node?.move !== 'function') {
    return false;
  }

  try {
    queue.node.move(trackIndex, 0);
    return true;
  } catch {
    return false;
  }
}
