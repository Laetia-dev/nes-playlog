# Lae's Playlog (Version 9)

An account-free personal gaming museum. NES / Famicom is the first active console. SNES and Game Boy are intentionally **future placeholders**, not fake game catalogs.

## Pages and architecture

* `index.html`, the global collector homepage, with the passport preview, stats, consoles and recent games
* `collection.html`, global display shelves and game status editing
* `passport.html`, editable global profile, NES series achievement stars, public passport export, read-only friend visits
* `nes/index.html`, the original NES exhibitions and series
* `nes/archive.html`, the searchable NES, Famicom and Disk System game archive
* `shared/nes-data.js`, the same 770 NES game records and series metadata that the NES museum uses
* `nes/app.js`, NES game behavior (still reads and writes the `nes-playlog-v2` key)
* `hub.js`, global frontend reads console records through an adapter, uses `laes-playlog-profile-v1` for shared profile

This structure keeps saves on the **same origin** and maintains the original NES storage key and game IDs. Every page is ordinary static HTML/CSS/JS, ideal for GitHub Pages. There is no server, login or analytics. The data and cover art collection are still incomplete and cover art is requested externally when enabled.

## Saving and safe sharing

* **Private backup** from the hub contains a complete NES save, including notes, dates, ratings and goals. Don't share private backups.
* **Public passport** from the Passport page includes the chosen display profile, public game statuses and earned achievements. It excludes dates, notes, ratings and personal goals.
* **Open friend's passport** is read-only. The file is loaded into the current page's memory, never imported into localStorage or merged into the owner's save.
* Previously exported `NES Playlog Public Passport` version 1 files also open in the global Passport page.
* NES private backup import/export remains supported in the NES Archive. 

## Publishing on GitHub Pages

Keep the repository currently named `nes-playlog`. Under repository **Settings → Pages**, select **Deploy from a branch** / `main` / `/(root)`, then save.

The site will appear at `https://laetia-dev.github.io/nes-playlog/` if Pages is enabled. 

When the umbrella website is tested and the user chooses, the repository can be renamed to `laes-playlog`. That will require attention to the GitHub Pages URL and any installed app/service worker references. Do not rename it before that step.

## Migrating progress

Use the same browser and site origin, and existing data should appear without action. The global hub reads the old `nes-playlog-v2` storage key. For switching domains, browsers or local standalone files, export a JSON backup first. The global hub can export a complete private backup, and the NES Archive still has its own backup import.

## Installation

`sw.js` and `manifest.webmanifest` provide an offline app shell. Initial online loading is needed for cover art. Installability and caching need a hosted HTTPS test, and the install prompt depends on the browser.
