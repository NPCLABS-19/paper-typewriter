# Sources and licenses

## Sound
The bundled WAVs are edited excerpts of recordings dedicated to the public domain under CC0 1.0:
- `strike-1.wav` through `strike-6.wav`, `space.wav`: **typewriter-olivetti-lettra-22.wav** by keithpeter. https://freesound.org/people/keithpeter/sounds/123344/ . Preview source: https://cdn.freesound.org/previews/123/123344_1848966-hq.mp3 . Isolated impressions cut from one Olivetti Lettera 22 recording; normalized and faded at boundaries.
- `bell.wav`: **Typewriter ding_near_mono.wav** by _stubb. https://freesound.org/people/_stubb/sounds/406243/ . Leading silence trimmed.
- `return.wav`, `stop.wav`: **Typewriter bell & carriage reset** by knufds. https://freesound.org/people/knufds/sounds/345955/ . Return excerpt distributed by https://github.com/Appletrumpet/Typewriter/blob/main/public/sfx/return.wav ; split into travel and stop, with faded boundaries.
- CC0: https://creativecommons.org/publicdomain/zero/1.0/ . Source license verified on Freesound, November 2026.

## Typeface
TT2020 Base Regular by Fredrick R. Brennan. https://github.com/ctrlcctrlv/TT2020 . SIL Open Font License 1.1, bundled in `assets/fonts/OFL.txt`.

## Motion library
GSAP, locally bundled from the published npm package. Standard GSAP license: https://gsap.com/community/standard-license/ . Package license in `assets/vendor/GSAP-LICENSE.txt`.

## Interface
The live sheet uses procedural paper grain and animated letter impressions. No external services receive typed text; there are no analytics, advertisements, or network requests carrying document content.

The desk and typewriter were created with the built-in ImageGen tool and saved as `assets/typewriter-desk.webp`.

Generation prompt

> Photoreal product photograph to serve as a full-screen backdrop for a web typewriter app. Landscape 3:2. Extremely symmetrical straight-on centered close-up of a real Oxblood Ferrari-red 1960s portable manual typewriter, a handsome unbranded Italian enamel machine with tiny nicks and genuine use wear, black round-square keys and real chrome platen and knobs. Entire typewriter sits on a real dark brown walnut table with low, warm raking light showing subtle horizontal wood grain. Seamless jet black studio background behind the table, lit dramatically from upper left. CAMERA: in front, looking down about 18 degrees, compressed product lens, visible keys and typebar basket. COMPOSITION MUST BE PRECISE: the black rubber platen perfectly horizontal near Y=62% of the image height, machine centered on X=50%, machine width including knobs 69% of entire canvas. Machine body and key bank fills lower 37% with front edge at Y=98%, can be cropped slightly at bottom. Width enough for real margins either side. The back/top 61% of the photo is empty near-black backdrop, this is where a real animated cream paper sheet will be composited by CSS down behind the platen. Absolutely no paper, props, people, writing, interface, logos, arrows, floating keys, signage or watermarks. Natural filmic black shadows and subtle red lacquer reflections, richly graded red and warm black, photographic sharpness. Grounded believable vintage machine, not a render.

## Design research
https://uniqcode.com/typewriter/ : carriage mechanics, margin warning, fixed strike point.
https://typewritesomething.com/ : minimal writing experience.

`tear.wav`: **Paper tear** by colorsCrimsonTears, CC0. https://freesound.org/people/colorsCrimsonTears/sounds/566199/ . Leading silence trimmed, converted to mono 44.1kHz, tail faded.
