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
import { PERA_CLIENT_META } from '../shared/constants'

export type CreateWalletConnectConnectorOptions = {
    /** A `wc:` pairing URI for a brand-new session (fresh pair). */
    uri?: string
    /** A previously persisted session to adopt (boot-time revival). */
    session?: unknown
}

/**
 * Without this the SDK defaults to `localStorage` and its constructor adopts any
 * stored session whenever no `session` option is given, fresh `uri` pairings
 * included, overwriting the new connector's `clientId`, `key`, `peerId` and
 * `connected`. Pera persists sessions itself, so the SDK's copy is pure liability.
 */
const noopSessionStorage: ISessionStorage = {
    getSession: () => null,
    setSession: session => session,
    removeSession: () => {},
}

/**
 * `session` is `unknown` because callers across the apps/mobile boundary cannot
 * name `IWalletConnectSession`. The return type is the real `WalletConnect`
 * class so an SDK upgrade that reshapes a member fails to type-check at the
 * `WcHostDeps.createConnector` call site instead of at runtime in the offscreen document.
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
