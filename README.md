# Paper

A browser typewriter with three playable machines. The red Olympia SM3 has a firm strike and a long lever return. The green Olivetti Lettera 22 advances and returns more quickly. The cream IBM Selectric II rotates and tilts its typeball, moves the carrier across fixed paper, and returns automatically at the right margin. Each uses a different set of recorded sounds and a distinct ink impression.

## Use
Choose a machine at the top and type on your keyboard or click the modeled keys. Enter returns the carriage or carrier. On a manual model, you can also click the return lever. The camera stays centered on the body while the manual carriage moves. On a phone, tap **Type** to open the keyboard or **Return** to feed a line. Backspace and Delete both erase the last character. From an empty line they go back to the previous line. Use Fresh sheet in the menu to tear away the current sheet and start another. Automatic correction, capitalization, and spellcheck are disabled. On a phone, tap the paper to open the keyboard.

Escape or the lower-right menu opens the draft gallery, text/PNG download, print/PDF, sound and volume, fullscreen, and fresh sheets. The gallery groups typed sheets by the date they were created. Click a preview to reopen the sheet with its saved typewriter.

Cmd/Ctrl+S saves plain text. Long lines wrap visually to fit the sheet. Scroll or swipe vertically to review earlier lines. Typing returns to the writing point. Drafts autosave in the current browser, with older sheets migrated from the previous ten-sheet archive. Export copies for use elsewhere. Clearing site data clears local drafts. No backend, account, analytics, or tracking.

## DFW mode

Open **DFW mode** from Paper’s menu. It starts with your current sheet and keeps its own editable copy. Assess sentence rhythm and asides, then run a rule-based edit or, on supported browsers, a David Foster Wallace–inspired rewrite with a local language model. The WebGPU model requires a first-use download of about 0.9 GB. Drafts are processed in the browser.

**Daily words** shows twenty terms with definitions, sample sentences, and a speaker button for British English pronunciation. Match each definition to its word and practice writing your own sentences. The deck rotates at local midnight and quiz progress stays on this device.

## Develop
`npm install`, then `npm run dev` (http://127.0.0.1:4400). The static site serves the checked-in `assets/machine.mjs` bundle. Run `npm run build` after editing the 3D model in `rig/`. WebGL renders the 3D machine, with a simpler scene when WebGL is unavailable. `npm test` runs model and browser behavior checks. See CREDITS.md for sample and font licenses.

Use `npm run build:dfw` after changing the DFW model worker or its prompt. After rebuilding the daily vocabulary, regenerate the pronunciation clips with `scripts/build-pronunciation.py`. Run `npm run test:dfw` for prose, quiz, and audio behavior and `npm run test:gallery` for archive migration and gallery navigation.

## Publish
Hosted only on the owner's GitHub account: https://npclabs-19.github.io/paper-typewriter/ . Root files are published from the main branch using GitHub Pages; no build or hosting account is needed. `.nojekyll` bypasses Jekyll.
