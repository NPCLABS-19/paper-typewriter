# Validation

The browser and model checks cover Backspace and Delete, mobile deletion, buffered carriage returns, 68-column margin lock and bell, blocked autocorrect and paste, ten-page storage, downloads, the Fresh sheet confirmation and tear, and sound controls. On phones the tests check that the sheet stays centered, long lines wrap inside the margins, and typing after a swipe returns to the active line.

Desktop and phone axe checks found no accessibility violations. Keyboard navigation begins with the skip link; focused utility controls remain visible. Reduced motion disables continuous movement. The screen does not move while idle by design.

Visual measurements from the previous guide-only version: 60 fps in the headless desktop and 4× CPU-throttled phone checks, no viewport overflow, no small targets, CLS 0, and a 1.22 second throttled mobile load. LCP is not reported for the intentionally blank initial paper scene, so no LCP claim is made. There are no JavaScript errors or failed asset requests.

Independent screenshot critic: 7.17/10 (Design 7.3, Usability 6.7, Creativity 7.6, Content 7.2). Their main suggestion was a first-use typing cue, which is intentionally omitted to preserve the requested blank-paper screen. Their mobile clipping finding was addressed with a larger right inset for the writing point and swipe review of the paper. The critique predates that final correction.

The live metadata audit has zero failures. Its robots/sitemap warnings arise from checking the root of a GitHub Pages project domain; both files are present and return HTTP 200 under `/paper-typewriter/`. The hosted custom missing-page route returns HTTP 404. The social image loads from the deployed URL.

In the scene with the red typewriter, the live text sits within the sheet above the photo of the roller. The desk and typewriter layers share the same framing, which keeps the roller aligned with the sheet across desktop and phone sizes.

## Run
`npm install`, `npm run dev`, then `npm test` in a second terminal. For a hosted smoke run: `TEST_URL=https://npclabs-19.github.io/paper-typewriter/ npm test`.
