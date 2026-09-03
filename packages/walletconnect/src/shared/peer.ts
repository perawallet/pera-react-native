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

import type { ConnectionPeer } from '@perawallet/wallet-extension-connections'
import { readString } from './read'

/** Upper bound on persisted peer icons; a peer's metadata is hostile input. */
const MAX_PEER_ICONS = 8

const FALLBACK_PEER_NAME = 'Unknown dApp'

const readTrimmed = (
    source: Record<string, unknown>,
    key: string,
): string | undefined => readString(source, key)?.trim() || undefined

/**
 * The one reading of a WalletConnect peer's self-description (`peerMeta` on
 * v1, `proposer.metadata` on v2) into a `ConnectionPeer`. Neither protocol
 * validates it, so every field is type-checked rather than trusted, and a
 * peer with nothing usable is still nameable rather than refused.
 */
export const toPeer = (peerMeta: unknown): ConnectionPeer => {
    if (typeof peerMeta !== 'object' || peerMeta === null) {
        return { name: FALLBACK_PEER_NAME }
    }
    const source = peerMeta as Record<string, unknown>
    const url = readTrimmed(source, 'url')
    const description = readTrimmed(source, 'description')
    const icons = Array.isArray(source.icons)
        ? source.icons
              .filter(
                  (icon): icon is string =>
                      typeof icon === 'string' && icon.length > 0,
              )
              .slice(0, MAX_PEER_ICONS)
        : undefined

    return {
        name: readTrimmed(source, 'name') ?? url ?? FALLBACK_PEER_NAME,
        ...(url ? { url } : {}),
        ...(description ? { description } : {}),
        ...(icons ? { icons } : {}),
    }
}
