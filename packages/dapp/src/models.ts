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

import type { Connection } from '@perawallet/wallet-extension-connections'
import type {
    JsonRpcNotification,
    JsonRpcRequest,
    JsonRpcResponse,
} from './codec'
import type { DAPP_KIND } from './protocol'

export type DappAccount = { address: string; name: string }

export type DappConnection = Connection & { kind: typeof DAPP_KIND }

/** `origin` is verified by the transport (browser-stamped), never read off the payload. */
export type DappRequestContext = {
    origin: string
    hasUserActivation: boolean
    /** Browser-supplied tab favicon; only a fallback when the page sends no usable icon. */
    faviconUrl?: string
}

/** Rejects when the page could not be reached, so the request stays answerable. */
export type DappRespond = (response: JsonRpcResponse) => Promise<void>

export interface DappTransport {
    onRequest(
        listener: (
            ctx: DappRequestContext,
            request: JsonRpcRequest,
            respond: DappRespond,
        ) => void,
    ): () => void
    notify(origin: string, notification: JsonRpcNotification): Promise<void>
}

/** For realms that construct the handler only to answer descriptors (UI). */
export const createNoopDappTransport = (): DappTransport => ({
    onRequest: () => () => {},
    notify: async () => {},
})
