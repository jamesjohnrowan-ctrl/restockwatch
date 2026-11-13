# ReStockWatch Canada

A personal, non-commercial stock tracker for Canadian Nintendo Switch 2 Zelda 40th Anniversary consoles and controllers. Runs locally; not affiliated with Nintendo, Reddit or retailers.

## Current functionality

- Canadian retailer product checks, with a new randomized 4–6 minute interval after each run.
- Separate controller-only and Nintendo-exclusive display-stand bundle listings.
- An optional Chrome/Edge unpacked extension reads explicitly selected EB Games and Staples product tabs. Console and controller tabs have independent monitors.
- Restock/sellout history, including clearly marked unconfirmed Nintendo metadata signals.
- Optional Twilio SMS for confirmed restocks and Nintendo **POSSIBLE STOCK (?)** metadata signals. Metadata is not proof that checkout is available.
- A red/green browser-tab icon highlights confirmed or possible-stock signals.

## Run locally

Requires Node.js 22 or newer. Install dependencies with `npm install`, then run `npm start` and visit http://127.0.0.1:4317/. On Windows, Start Tracker.cmd can locate an installed Node runtime and launch the app.

The server binds to localhost only. The app is not a public hosted service. Retailer checks may fail or be blocked; stock reports and detections are experimental and do not guarantee purchasing availability.

For optional retailer-tab checks, open /extension-guide. The local server generates extension/config.js on startup; load the extension folder as an unpacked Chrome/Edge extension. Keep the selected product tabs, browser and tracker running. The extension does not export cookies, solve challenges or click checkout.

For optional SMS, open /sms and supply your own Twilio configuration locally. Sending messages may incur charges. Restock and possible-stock alerts share the configured monthly attempt limit; repeated signals are deduplicated.

## Reddit feature: proposed, not implemented

See [REDDIT-INTEGRATION.md](REDDIT-INTEGRATION.md). This repository does not contain a Reddit collector, API credentials or collected Reddit content. Data API approval is being requested before implementation.

## Tests

Run `npm test`. SMS tests use fake credentials and a mocked sender; they do not contact Twilio. Some tests create temporary fixture directories under a sibling work directory. No real credentials, phone numbers, browser profiles or runtime history are included in this source release.

## Files

- server.mjs: local HTTP API, scheduler, history and alert integration.
- checker.mjs and identity.mjs: retailer stock parsing and product/variant identity checks.
- metadata.mjs and history.mjs: deduplicated unconfirmed signals and confirmed stock history.
- sms.mjs: optional local Twilio integration.
- public/: dashboard and local settings pages.
- extension/: opt-in retailer tab checker.

Runtime state belongs in data/ and must not be published. extension/config.js is generated locally and must not be published. This is a source-code review snapshot; it contains no inventory guarantee or deployed Reddit integration.
