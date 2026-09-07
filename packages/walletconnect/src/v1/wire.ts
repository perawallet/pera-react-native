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

import type { IClientMeta } from '@perawallet/walletconnect'
import type { Network, Nullable } from '@perawallet/wallet-core-shared'
import type { ConnectionPeer } from '@perawallet/wallet-extension-connections'
import { isChainIdAcceptable } from '../shared/chain'
import { readString } from '../shared/read'

// The session-level check proves only the session's network; a dApp can stamp
// a foreign `chainId` on an individual legacy entry.
export const legacyItemChainIdsAcceptable = (
    params: unknown[],
    network: Network,
): boolean =>
    params.every(item => {
        if (typeof item !== 'object' || item === null) return false
        const { chainId } = item as { chainId?: unknown }
        return isChainIdAcceptable(
            typeof chainId === 'number' ? chainId : undefined,
            network,
        )
    })

export type WcRequest = { id: number; params: unknown }

// Recovers only the id (a response cannot be addressed without it) and the raw
// params; shape validation stays in the gate and the registry.
export const asWcRequest = (payload: unknown): Nullable<WcRequest> => {
    if (typeof payload !== 'object' || payload === null) return null
    const candidate = payload as { id?: unknown; params?: unknown }
    if (typeof candidate.id !== 'number') return null
    return { id: candidate.id, params: candidate.params }
}

export type SessionRequestParams = {
    // Not `IClientMeta`: a hostile peer's frame with only object-ness checked; `toPeer` is the only reader.
    peerMeta: Nullable<Record<string, unknown>>
    chainId: unknown
    permissions: Nullable<string[]>
}

export const asSessionRequestParams = (
    params: unknown,
): Nullable<SessionRequestParams> => {
    if (typeof params !== 'object' || params === null) return null
    const candidate = params as {
        peerMeta?: unknown
        chainId?: unknown
        permissions?: unknown
    }
    const peerMeta =
        typeof candidate.peerMeta === 'object' && candidate.peerMeta !== null
            ? (candidate.peerMeta as Record<string, unknown>)
            : null
    const permissions = Array.isArray(candidate.permissions)
        ? candidate.permissions.filter(
              (value): value is string => typeof value === 'string',
          )
        : null
    return { peerMeta, chainId: candidate.chainId, permissions }
}

export const toClientMeta = (peer: ConnectionPeer): IClientMeta => ({
    name: peer.name,
    url: peer.url ?? '',
    description: peer.description ?? '',
    icons: peer.icons ?? [],
})

export const readErrorDetail = (payload: unknown): Nullable<string> => {
    if (typeof payload !== 'object' || payload === null) return null
    const params = (payload as { params?: unknown }).params
    if (!Array.isArray(params) || params.length === 0) return null
    const first = params[0]
    if (typeof first !== 'object' || first === null) return null
    return readString(first as Record<string, unknown>, 'message') ?? null
}
