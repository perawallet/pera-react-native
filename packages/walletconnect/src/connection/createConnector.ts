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

import WalletConnect, {
    type ISessionStorage,
    type IWalletConnectSession,
} from '@perawallet/walletconnect'
import { PERA_CLIENT_META } from '../constants'

export type CreateWalletConnectConnectorOptions = {
    /** A `wc:` pairing URI for a brand-new session (fresh pair). */
    uri?: string
    /** A previously persisted session to adopt (boot-time revival). */
    session?: unknown
}

/**
 * A no-op `ISessionStorage`. Left unset, `WalletConnect`'s constructor
 * defaults `sessionStorage` to `new SessionStorage('walletconnect')` over
 * `window.localStorage` — and its constructor unconditionally does `const n
 * = opts.session || this._getStorageSession(); n && (this.session = n)`
 * *whenever no explicit `session` option is given*, i.e. on every fresh
 * `uri` pairing too, not just boot-time revival. If a previous session was
 * ever approved (`approveSession` → `_setStorageSession()`) while that
 * default was in effect, its stale record is sitting in `localStorage` and
 * gets adopted wholesale — overwriting `clientId`, `key`, `bridge`,
 * `handshakeTopic`, `peerId`, and `connected` on the brand-new connector
 * before it ever talks to a dApp. Every extension realm (offscreen
 * included) has a real `window.localStorage`, so this isn't a
 * React-Native-only concern here the way it is for native (which has none).
 *
 * Pera already persists sessions itself — the `WalletConnectConnection`
 * record `wcHost.ts` writes to the WC zustand store on `approve-session` —
 * so the SDK's own copy is pure liability, never a source of truth. Always
 * returning `null`/no-op keeps the constructor's `session || getSession()`
 * fallback from ever resolving to anything.
 */
const noopSessionStorage: ISessionStorage = {
    getSession: () => null,
    setSession: session => session,
    removeSession: () => {},
}

/**
 * Builds a real `WalletConnect` v1 connector with Pera's client metadata
 * (and the no-op session storage above) applied, so a construction site
 * that uses it presents the same identity to the bridge and dApps without
 * inheriting the SDK's own storage liability. Injected as the offscreen
 * document's sole `WcHostDeps.createConnector` (`runOffscreenApp.ts`);
 * native's `useWalletConnect` and `connectorRegistry` still construct
 * `WalletConnect` inline and are out of scope here — they never call this
 * factory, so the no-op storage above never reaches them. (React Native has
 * no `window.localStorage` in the first place, so native was never exposed
 * to the bug this guards against; if native ever does migrate onto this
 * factory, the no-op storage remains correct for it too — there is nothing
 * for the default `SessionStorage` to have usefully persisted to there
 * either.)
 *
 * Lives here rather than in `apps/mobile`: `@perawallet/walletconnect` is
 * only a dependency of this package (see `HeadlessWcConnector`'s doc comment
 * in `apps/browser/src/offscreen/walletconnect/bindHeadlessHandlers.ts` for
 * why apps/mobile can't import it directly), and constructing an SDK client
 * is logic, not UI.
 *
 * `session` is accepted as `unknown` rather than `IWalletConnectSession`:
 * callers on the other side of the apps/mobile boundary (`WcHostDeps.
 * createConnector`) can't name that type either, so the injected function
 * signature has to stay structural at that edge. It's cast back to the
 * real shape here, where the dependency legitimately exists.
 *
 * Return type is the real `WalletConnect` class, not the offscreen host's
 * minimal `HeadlessWcConnector`, deliberately: if a future SDK upgrade
 * removes or reshapes a member `HeadlessWcConnector` relies on, assigning
 * this factory to `WcHostDeps.createConnector` (which returns
 * `HeadlessWcConnector`) stops type-checking at that call site — a compile
 * error where the incompatibility is introduced, instead of a silent
 * runtime `undefined is not a function` inside the offscreen document.
 */
export const createWalletConnectConnector = (
    options: CreateWalletConnectConnectorOptions,
): WalletConnect =>
    new WalletConnect({
        uri: options.uri,
        session: options.session as IWalletConnectSession | undefined,
        clientMeta: PERA_CLIENT_META,
        storage: noopSessionStorage,
    })
