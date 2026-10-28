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

import type { ChainId } from '@perawallet/wallet-core-chain-contract'
import type {
    Connection,
    ConnectionId,
    ConnectionOrigin,
} from '@perawallet/wallet-extension-connections'
import type {
    JsonRpcNotification,
    JsonRpcRequest,
    JsonRpcResponse,
} from './codec'
import { EIP1193_DAPP_KIND } from './eip1193Protocol'
import type { DAPP_KIND } from './protocol'

export type DappAccount = { address: string; name: string }

/**
 * How strongly the wallet warns about a site: on a phishing list (`blocked`),
 * imitating a known dApp (`look-alike`), or neither. `clear` never vouches.
 */
export type SiteWarningLevel = 'clear' | 'look-alike' | 'blocked'

const SITE_WARNING_RANK: Record<SiteWarningLevel, number> = {
    clear: 0,
    'look-alike': 1,
    blocked: 2,
}

const isSiteWarningLevel = (value: unknown): value is SiteWarningLevel =>
    typeof value === 'string' && value in SITE_WARNING_RANK

/** Whether a site's warning got worse than the one the user accepted. */
export const isWorseSiteWarning = (
    current: SiteWarningLevel,
    acknowledged: SiteWarningLevel,
): boolean => SITE_WARNING_RANK[current] > SITE_WARNING_RANK[acknowledged]

/** Recorded at approval, so a warning the user accepted doesn't hide the site's accounts. */
export type SiteWarningMetadata = { acknowledgedSiteWarning?: SiteWarningLevel }

/** `clear` for a connection approved before any warning was recorded. */
export const acknowledgedSiteWarningOf = (
    connection: Connection,
): SiteWarningLevel => {
    const level = connection.metadata?.acknowledgedSiteWarning
    return isSiteWarningLevel(level) ? level : 'clear'
}

/** A check that fails counts as `blocked`: the approval that forces is safe. */
export const readSiteWarning = async (
    check: ((origin: string) => Promise<SiteWarningLevel>) | undefined,
    origin: string,
): Promise<SiteWarningLevel> =>
    check ? check(origin).catch((): SiteWarningLevel => 'blocked') : 'clear'

export type DappConnection = Connection & { kind: typeof DAPP_KIND }

/** The site's own chain; its network is whichever one the wallet has selected for it. */
export type Eip1193ConnectionMetadata = SiteWarningMetadata & {
    chainId: ChainId
}

export type Eip1193Connection = Connection & {
    kind: typeof EIP1193_DAPP_KIND
    metadata: Eip1193ConnectionMetadata
    origin: ConnectionOrigin & { requesterOrigin: string }
}

export const isEip1193Connection = (
    connection: Connection,
): connection is Eip1193Connection =>
    connection.kind === EIP1193_DAPP_KIND &&
    typeof connection.metadata?.chainId === 'string' &&
    typeof connection.origin?.requesterOrigin === 'string'

// Prefixed: the store is keyed by id across kinds, and the same site's
// `window.pera` record already holds the bare origin.
export const eip1193ConnectionIdOf = (origin: string): ConnectionId =>
    `${EIP1193_DAPP_KIND}:${origin}`

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
