/*
 Copyright 2022-2025 Pera Wallet, LDA
 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 Unless required by applicable law or agreed to in writing, software
 distributed under the License is distributed on an "AS IS" BASIS,
 WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 See the License for the specific language governing permissions and
 limitations under the License
*/

import type { NegotiateOffer, SelectedProtocol, WalletProtocol } from './types'

const parseVersion = (v: string): number[] =>
    v.split('.').map(n => Number.parseInt(n, 10) || 0)

const compareVersions = (a: string, b: string): number => {
    const pa = parseVersion(a)
    const pb = parseVersion(b)
    const len = Math.max(pa.length, pb.length)
    for (let i = 0; i < len; i++) {
        const diff = (pa[i] ?? 0) - (pb[i] ?? 0)
        if (diff !== 0) return diff
    }
    return 0
}

const highestCommonVersion = (
    walletVersions: string[],
    offeredVersions: string[],
): string | null => {
    const common = walletVersions.filter(v => offeredVersions.includes(v))
    if (common.length === 0) return null
    return [...common].sort(compareVersions).at(-1) ?? null
}

/**
 * Wallet preference order is authoritative (ALPN-style): iterate the wallet's
 * protocols in order and return the first the dApp also offers, at the highest
 * mutually-supported version. Returns null when nothing overlaps.
 */
export const selectProtocol = (
    walletProtocols: WalletProtocol[],
    offer: NegotiateOffer,
): SelectedProtocol | null => {
    for (const wallet of walletProtocols) {
        const offered = offer.protocols.find(p => p.id === wallet.id)
        if (!offered) continue
        const version = highestCommonVersion(wallet.versions, offered.versions)
        if (version) return { id: wallet.id, version }
    }
    return null
}
