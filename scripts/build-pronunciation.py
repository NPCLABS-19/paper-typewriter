"""Render the daily decks with Piper's en_GB-cori-medium voice.

Install piper-tts==1.8.0 and ffmpeg, then run:
  python scripts/build-pronunciation.py path/to/en_GB-cori-medium.onnx
The Piper JSON config must be beside the model. Only the audio is shipped.
"""
import argparse
import json
from concurrent.futures import ProcessPoolExecutor
from pathlib import Path
import re
import subprocess

import numpy as np
import onnxruntime
from piper import PiperVoice, SynthesisConfig
from piper.config import PiperConfig

ROOT = Path(__file__).resolve().parents[1] / "assets" / "dfw"
DECK_SIZE = 20
SYNTHESIS = SynthesisConfig(noise_scale=0.32, noise_w_scale=0.40)

# IPA in eSpeak notation for dictionary pronunciations the base voice can misread.
PRONUNCIATIONS = {
    "accretion": "ɐkɹˈiːʃən",
    "aporia": "ɐpˈɔːɹiə",
    "bass": "bˈeɪs",  # the low register
    "gnomon": "nˈəʊmɒn",
    "inchoate": "ɪnkˈəʊeɪt",
    "invalid": "ɪnvˈalɪd",  # no longer valid
    "perspicacious": "pˌɜːspɪkˈeɪʃəs",
    "resume": "ɹɪzjˈuːm",  # begin again
    "susurrus": "sˌuːsˈʌɹəs",
    "obdurate": "ˈɒbdʒəɹət",
    "tear": "tˈɪə",  # shed tears
    "velleity": "vɛlˈiːɪti",
    "wound": "wˈuːnd",  # the injury
}
# Give the phonemizer context for spellings with noun/verb stress or vowel shifts.
HETERONYMS = set("""
abstract alternate associate attribute combat combine commune compact compound
compress conduct conflict console construct contest contrast converse convert
convict decrease desert dictate digest discharge discount entrance escort exploit
export extract finance frequent graduate implant import imprint incense incline
insert insult intern intimate invite moderate object offset overlap permit protest
recall refuse reject relay remit retail retard revolt suspect torment transplant upset
""".split())


def init_voice(model, threads):
    global voice, phoneme_pattern
    options = onnxruntime.SessionOptions()
    options.intra_op_num_threads = threads
    options.inter_op_num_threads = 1
    config = PiperConfig.from_dict(json.loads(model.with_suffix(".onnx.json").read_text()))
    voice = PiperVoice(
        session=onnxruntime.InferenceSession(str(model), options, providers=["CPUExecutionProvider"]),
        config=config,
    )
    clusters = sorted(map("".join, config.vowel_clusters or ()), key=len, reverse=True)
    phoneme_pattern = re.compile("|".join([*map(re.escape, clusters), "."]))


def word_audio(word, part):
    if word in PRONUNCIATIONS:
        phonemes = phoneme_pattern.findall(PRONUNCIATIONS[word] + ".")
    elif word in HETERONYMS:
        prefix = "to" if part == "verb" else "the"
        phrase = voice.phonemize(f"{prefix} {word}.")[0]
        phonemes = phrase[phrase.index(" ") + 1:] if " " in phrase else None
    else:
        phonemes = None
    if phonemes is None:
        return b"".join(chunk.audio_int16_bytes for chunk in voice.synthesize(f"{word}.", SYNTHESIS))
    samples = voice.phoneme_ids_to_audio(voice.phonemes_to_ids(phonemes), SYNTHESIS)
    peak = max(float(np.max(np.abs(samples))), 1e-8)
    return (samples * (32767 / peak)).astype("<i2").tobytes()


def render_deck(job):
    number, entries = job
    directory = ROOT / "pronunciation"
    padding = b"\x00\x00" * round(voice.config.sample_rate * 0.085)
    audio = bytearray()
    clips = []
    for word, part, *_ in entries:
        clip = padding + word_audio(word, part) + padding
        if len(clip) <= len(padding) * 2:
            raise RuntimeError(f"No audio for {word}.")
        clips.append([word, round(len(audio) * 500 / voice.config.sample_rate),
                      round(len(clip) * 500 / voice.config.sample_rate)])
        audio.extend(clip)
    subprocess.run(
        ["ffmpeg", "-v", "error", "-y", "-f", "s16le", "-ar", str(voice.config.sample_rate),
         "-ac", "1", "-i", "pipe:0", "-c:a", "libmp3lame", "-b:a", "32k",
         str(directory / f"{number}.mp3")],
        input=audio, check=True,
    )
    return number, clips


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("model", type=Path)
    parser.add_argument("--workers", type=int, default=3)
    parser.add_argument("--threads", type=int, default=3)
    args = parser.parse_args()
    words = json.loads((ROOT / "words.json").read_text())
    if len(words) % DECK_SIZE:
        raise ValueError("The vocabulary file contains an incomplete deck.")
    (ROOT / "pronunciation").mkdir(exist_ok=True)
    jobs = list(enumerate(words[offset:offset + DECK_SIZE] for offset in range(0, len(words), DECK_SIZE)))
    manifest = []
    with ProcessPoolExecutor(max_workers=args.workers, initializer=init_voice,
                             initargs=(args.model.resolve(), args.threads)) as pool:
        for number, clips in pool.map(render_deck, jobs):
            manifest.append(clips)
            if number == 0 or (number + 1) % 25 == 0 or number + 1 == len(jobs):
                print(f"Rendered {number + 1} of {len(jobs)} decks", flush=True)
    (ROOT / "pronunciation" / "timings.json").write_text(
        json.dumps(manifest, ensure_ascii=False, separators=(",", ":")) + "\n")


if __name__ == "__main__":
    main()
