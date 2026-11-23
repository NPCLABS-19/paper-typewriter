const audioDirectory = new URL('../assets/dfw/pronunciation/', import.meta.url);
let context;
let timings;
let deckAudio;
let playback;

async function fetchAsset(name) {
  const response = await fetch(new URL(name, audioDirectory));
  if (!response.ok) throw new Error('Pronunciation audio is unavailable.');
  return response;
}

function loadTimings() {
  timings ??= fetchAsset('timings.json').then(response => response.json()).catch(error => {
    timings = undefined;
    throw error;
  });
  return timings;
}

function loadDeckAudio(index) {
  if (deckAudio?.index === index) return deckAudio.buffer;
  const entry = {
    index,
    buffer: fetchAsset(`${index}.mp3`)
      .then(response => response.arrayBuffer())
      .then(data => context.decodeAudioData(data))
      .catch(error => {
        if (deckAudio === entry) deckAudio = undefined;
        throw error;
      }),
  };
  deckAudio = entry;
  return entry.buffer;
}

export function stopPronunciation() {
  const previous = playback;
  playback = undefined;
  previous?.source?.stop();
  previous?.setState('');
}

export async function playPronunciation(deck, position, word, setState) {
  stopPronunciation();
  const request = { setState };
  playback = request;
  setState('loading');
  try {
    context ??= new AudioContext();
    // Resume during the button's trusted click so mobile Safari can play the fetched clip.
    const resume = context.state === 'running' ? undefined : context.resume();
    const [bank, buffer] = await Promise.all([loadTimings(), loadDeckAudio(deck), resume]);
    if (playback !== request) return;
    const [headword, start, duration] = bank[deck][position];
    if (headword !== word) throw new Error('Pronunciation does not match the word.');
    const source = context.createBufferSource();
    source.buffer = buffer;
    source.connect(context.destination);
    source.onended = () => {
      source.disconnect();
      if (playback !== request) return;
      playback = undefined;
      setState('');
    };
    source.start(0, start / 1000, duration / 1000);
    request.source = source;
    setState('playing');
  } catch {
    if (playback !== request) return;
    playback = undefined;
    setState('error');
  }
}
