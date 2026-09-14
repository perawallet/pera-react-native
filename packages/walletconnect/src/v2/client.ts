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

import { Core, EXPIRER_EVENTS } from '@walletconnect/core'
import {
    WalletKit,
    type IWalletKit,
    type WalletKitTypes,
} from '@reown/walletkit'
import { PERA_CLIENT_META } from '../shared/constants'
import type { WalletConnectV2Storage } from './storage'

export type WalletKitEvent = WalletKitTypes.Event

export type WalletKitEventArguments = WalletKitTypes.EventArguments

/**
 * One entry of `getActiveSessions()`. Taken off `IWalletKit` rather than
 * imported from `@walletconnect/types`, which is a transitive dependency and
 * only resolves from inside the packages that declare it.
 */
export type WalletKitSession = ReturnType<
    IWalletKit['getActiveSessions']
>[string]

/** The approved namespaces of a settled session, keyed by CAIP-2 namespace. */
export type WalletKitSessionNamespaces = WalletKitSession['namespaces']

export type WalletKitSessionProposal =
    WalletKitEventArguments['session_proposal']

export type WalletKitSessionRequest = WalletKitEventArguments['session_request']

/** The JSON-RPC frame `respondSessionRequest` puts on the wire. */
export type WalletKitJsonRpcResponse = { id: number; jsonrpc: '2.0' } & (
    | { result: unknown }
    | { error: { code: number; message: string } }
)

/**
 * Core's own name for the event, read from the SDK rather than spelled out, so
 * a rename cannot leave the wallet listening for a frame nothing emits.
 */
export const EXPIRER_EXPIRED_EVENT = EXPIRER_EVENTS.expired

/**
 * One expiry core reports. `target` is `topic:<value>` or `id:<value>`; a
 * session, a pairing and a pending request all expire through here.
 */
export type ExpirerExpiredEvent = { target: string }

/**
 * The slice of `IWalletKit` the handler uses, so the spec's fake is checked
 * against the real surface instead of a hand-written echo of it. It grows as
 * request handling needs more; anything absent here is something the handler
 * cannot call.
 */
export interface WalletKitClient {
    on<E extends WalletKitEvent>(
        event: E,
        listener: (args: WalletKitEventArguments[E]) => void,
    ): unknown
    off<E extends WalletKitEvent>(
        event: E,
        listener: (args: WalletKitEventArguments[E]) => void,
    ): unknown
    getActiveSessions(): Record<string, WalletKitSession>
    approveSession(params: {
        id: number
        namespaces: WalletKitSessionNamespaces
    }): Promise<WalletKitSession>
    rejectSession(params: {
        id: number
        reason: { code: number; message: string }
    }): Promise<void>
    /** Ends a settled session; the peer learns of it, the relay permitting. */
    disconnectSession(params: {
        topic: string
        reason: { code: number; message: string }
    }): Promise<void>
    /**
     * Answers one `session_request`. Rejects when the response never reaches
     * the relay, which is how the signing pipeline learns to retry.
     */
    respondSessionRequest(params: {
        topic: string
        response: WalletKitJsonRpcResponse
    }): Promise<void>
    core: {
        pairing: {
            /**
             * WalletKit's own `pair()` is this call with its result thrown
             * away, and the struct is the only place the pairing topic —
             * which `ConnectionHandler.pair` must resolve with — appears.
             */
            pair(params: { uri: string }): Promise<{ topic: string }>
            /** Ends a pairing, whether or not it ever produced a session. */
            disconnect(params: { topic: string }): Promise<void>
        }
        relayer: {
            transportClose(): Promise<void>
        }
        /**
         * The one interval every periodic core job (the expirer included)
         * runs off. `transportClose` leaves it pulsing.
         */
        heartbeat: {
            stop(): void
        }
        /**
         * WalletKit re-emits six events and `session_expire` is not one of
         * them, so a session that expires mid-run is only visible here.
         */
        expirer: {
            on(
                event: string,
                listener: (payload: ExpirerExpiredEvent) => void,
            ): unknown
            off(
                event: string,
                listener: (payload: ExpirerExpiredEvent) => void,
            ): unknown
        }
    }
}

export type WalletKitFactoryOptions = {
    /** Reown Cloud project id. The relay refuses a connection without one. */
    projectId: string
    storage: WalletConnectV2Storage
}

export type WalletKitFactory = (
    options: WalletKitFactoryOptions,
) => Promise<WalletKitClient>

/**
 * `storage` is passed explicitly because `Core` otherwise builds its own
 * `@walletconnect/keyvaluestorage`, whose react-native entry is AsyncStorage —
 * a second persistence layer beside MMKV, and a dependency the app would
 * otherwise carry for this alone.
 */
export const createWalletKitClient: WalletKitFactory = async ({
    projectId,
    storage,
}) => {
    // `Core` is a process-global singleton unless told otherwise: a second
    // construction hands back the first instance, whose relayer `teardown`
    // has explicitly closed, and binds a second engine to it so every inbound
    // frame is handled twice. A data wipe tears down and re-initializes, so
    // the handler needs a genuinely new client each time.
    process.env.DISABLE_GLOBAL_CORE = 'true'
    const core = new Core({ projectId, storage })
    return await WalletKit.init({ core, metadata: PERA_CLIENT_META })
}
