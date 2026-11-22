# Paper

A browser typewriter with three playable machines. The red Olympia SM3 has a firm strike and a long lever return. The green Olivetti Lettera 22 advances and returns more quickly. The cream IBM Selectric II rotates and tilts its typeball, moves the carrier across fixed paper, and returns automatically at the right margin. Each uses a different set of recorded sounds and a distinct ink impression.

## Use
Choose a machine at the top and type on your keyboard or click the modeled keys. Enter returns the carriage or carrier. On a manual model, you can also click the return lever. The camera stays centered on the body while the manual carriage moves. On a phone, tap **Type** to open the keyboard or **Return** to feed a line. Backspace and Delete both erase the last character. From an empty line they go back to the previous line. Use Fresh sheet in the menu to tear away the current sheet and start another. Automatic correction, capitalization, and spellcheck are disabled. On a phone, tap the paper to open the keyboard.

Escape or the lower-right menu opens text/PNG download, print/PDF, sound and volume, fullscreen, fresh sheets, and the local sheet archive. Cmd/Ctrl+S saves plain text. Long lines wrap visually to fit the sheet. Scroll or swipe vertically to review earlier lines. Typing returns to the writing point. Your ten most recent pages are preserved locally.

Documents autosave to localStorage in the current browser. Export copies for use elsewhere; clearing browser data clears local sheets. No backend, account, analytics, or tracking.

## Develop
`npm install`, then `npm run dev` (http://127.0.0.1:4400). The static site serves the checked-in `assets/machine.mjs` bundle. Run `npm run build` after editing the 3D model in `rig/`. WebGL renders the 3D machine, with a simpler scene when WebGL is unavailable. `npm test` runs model and browser behavior checks. See CREDITS.md for sample and font licenses.

## Publish
Hosted only on the owner's GitHub account: https://npclabs-19.github.io/paper-typewriter/ . Root files are published from the main branch using GitHub Pages; no build or hosting account is needed. `.nojekyll` bypasses Jekyll.
