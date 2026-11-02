# Pera Wallet browser extension (Chrome MV3)

## Build and load

The extension bakes no API key, even when `BACKEND_API_KEY` is set
(`scripts/web-config.mjs` keeps it out): its credential is the web integrity
token the service worker mints. Set `WEB_INTEGRITY_MINT_ENABLED`,
`WEB_INTEGRITY_BEARER_ENABLED` and `WEB_INTEGRITY_ENROL_ENABLED` to `true` in
the repo-root `.env`. With any of them off, guarded Pera-backend calls
(should-refresh, asset metadata, prices, history) 401; `bundle` still succeeds
but prints a warning. A production build (`APP_ENV=production`) fails instead.

The bundle stamps `manifest.json`: `version` is the numeric part of this
package's `version` (Chrome accepts only integers and needs a higher one for
every store upload), `version_name` keeps any pre-release tag, and non-production
builds get "(development build)" or "(staging build)" appended to the
description. A tagged CI build takes the version from the tag instead; see
`docs/RELEASE.md` for releasing to the Chrome Web Store.

    pnpm --filter browser bundle

Then open `chrome://extensions`, enable Developer mode, "Load unpacked",
select the `dist/` folder the bundle writes into. Click the toolbar icon to
open the popup.

## How it fits together

- The popup/expanded/approval pages all render the mobile app's
  react-native-web bundle, exported by `expo export --platform web` from
  `apps/mobile` (see `entry.web.js` / `src/App.web.tsx` there).
- `apps/mobile/metro.config.js` aliases
  `@perawallet/wallet-extension-platform-driver` to
  `extensions/platform-chrome` when bundling for web.
- `src/background/` is the MV3 service worker, bundled by esbuild via
  `scripts/build.mjs`.

## E2E

    pnpm --filter browser bundle:e2e
    pnpm --filter browser exec playwright install chromium
    pnpm --filter browser test:e2e

`bundle:e2e` ships Algorand and Ethereum and bakes a localhost fake node
(`e2e/fixtures/fake-evm-node.mjs`) as every EVM RPC URL, because Playwright
cannot route the offscreen document's requests. Staging and production builds
refuse the override. `window-ethereum.spec.ts` fails on a dist without an EVM
chain: a plain `bundle`, or a `CHAINS` in the repo-root `.env`, which
`generate-config.sh` lets override the one `bundle:e2e` sets.

A build without EVM chains is checked by `scripts/build.mjs` instead: it
carries no viem and no `window.ethereum` provider in `content-inject-main.js`.
CI builds one as the `no-evm` entry of the extension e2e job.
