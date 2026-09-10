# Pera Wallet browser extension (Chrome MV3)

## Build and load

Requires a repo-root `.env` with `BACKEND_API_KEY=<staging key>` (the same
variable Bitrise injects for mobile; see `tools/dev-config.sh`).
Without it, Pera-backend calls (should-refresh, asset metadata, prices,
history) 401 against staging; `bundle` still succeeds but prints a warning.

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
