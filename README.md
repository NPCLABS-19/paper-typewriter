# Paper

A blank sheet and one steel type guide. A minimal browser typewriter with real recorded keys, escapement, a margin bell eight columns before the end of a 68-character line, a manual carriage return, and subtle permanent ink impressions.

## Use
Just type. Enter returns the carriage. Backspace asks whether to tear off the current page and start a fresh one; confirmation plays a paper tear animation and recording. Delete, undo, replacement, paste, and cursor editing do not alter the document. Automatic correction, capitalization, and spellcheck are disabled. On a phone, tap the paper to open the keyboard.

Escape or the lower-right menu opens text/PNG download, print/PDF, sound and volume, fullscreen, fresh sheets, and the local sheet archive. Cmd/Ctrl+S saves plain text. Mouse wheel reviews earlier lines; the next impression returns to the writing point. Your ten most recent pages are preserved locally.

Documents autosave to localStorage in the current browser. Export copies for use elsewhere; clearing browser data clears local sheets. No backend, account, analytics, or tracking.

## Develop
`npm install`, then `npm run dev` (http://127.0.0.1:4400). Production is the same buildless HTML/CSS/JS, with self-hosted assets. `npm test` runs model and browser behavior checks. See CREDITS.md for sample and font licenses.

## Publish
Hosted only on the owner's GitHub account: https://npclabs-19.github.io/paper-typewriter/ . Root files are published from the main branch using GitHub Pages; no build or hosting account is needed. `.nojekyll` bypasses Jekyll.
