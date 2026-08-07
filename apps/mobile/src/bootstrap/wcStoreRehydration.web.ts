/*
 Copyright 2022-2026 Pera Wallet, LDA
 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 Unless required by applicable law or agreed to in writing, software
 distributed under the License is distributed on an "AS IS" BASIS,
 WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 See the License for the specific language governing permissions and
 limitations under the License
 */

import { onLocalStorageKeyChanged } from '@perawallet/wallet-extension-platform-chrome'
import { useWalletConnectStore } from '@perawallet/wallet-core-walletconnect'

// Mirrors the literal `runOffscreenApp.ts` uses for the same store (`'kv:' +
// STORE_NAME` from packages/walletconnect/src/store/store.ts — not exported
// as a constant there, so both call sites hardcode it the same way).
const WALLET_CONNECT_STORE_KEY = 'kv:wallet-connect-store'

/**
 * Every UI realm (popup, expanded tab, approval surface) hydrates
 * its own copy of `useWalletConnectStore` once at import and never rereads
 * `chrome.storage.local` afterward — zustand `persist` has no built-in
 * cross-realm sync. `persist` also writes the WHOLE partialized slice on
 * every `set`, not a diff, so if this realm's copy is stale when it next
 * writes (e.g. `useWalletConnectSessionsControl.web.ts`'s `disconnect`
 * filtering the local list), that write persists a snapshot taken from THIS
 * realm's last-known state — silently dropping any session another realm
 * (most commonly offscreen, pairing a new session) added after this realm's
 * hydrate. Offscreen's own in-memory copy still holds the dropped record, so
 * its next write self-heals — but if the offscreen document is torn down
 * before that happens, `reviveStoredSessions` never sees the session again.
 *
 * Registering this in every UI realm (see `AppShell.web.tsx`, which calls it
 * once at module scope — the same point `updateQueryHeaders()` runs, right
 * after `App.web.tsx`'s boot-order contract guarantees `getProvider()` is
 * hydrated) keeps this realm's copy current with any cross-realm write, so
 * the next write FROM this realm persists an up-to-date slice instead of a
 * stale one.
 *
 * Goes through `onLocalStorageKeyChanged` (the same platform-chrome
 * accessor `runOffscreenApp.ts` already uses for its own stores) rather than
 * a raw `chrome.storage.onChanged` listener, since `apps/mobile` may not
 * reference the ambient `chrome` global.
 */
export const registerWcStoreRehydration = (): (() => void) =>
    onLocalStorageKeyChanged([WALLET_CONNECT_STORE_KEY], () => {
        void useWalletConnectStore.persist.rehydrate()
    })
