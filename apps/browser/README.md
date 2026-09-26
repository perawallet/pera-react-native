# Pera Wallet browser extension (Chrome MV3)

## Build and load

Requires a repo-root `.env` with `BACKEND_API_KEY=<staging key>` (the same
variable Bitrise injects for mobile; see `tools/dev/generate-config.sh`).
Without it, Pera-backend calls (should-refresh, asset metadata, prices,
history) 401 against staging; `bundle` still succeeds but prints a warning.
A production build (`APP_ENV=production`) fails instead.

The bundle stamps `manifest.json`: `version` is the numeric part of this
package's `version` (Chrome accepts only integers and needs a higher one for
every store upload), `version_name` keeps any pre-release tag, and non-production
builds get "(development build)" or "(staging build)" appended to the
description. Bump `version` in `package.json` to release.

    pnpm --filter extension bundle

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

    pnpm --filter extension bundle
    pnpm --filter extension exec playwright install chromium
    pnpm --filter extension test:e2e
