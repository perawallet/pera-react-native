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

import type { Nullable } from '@perawallet/wallet-core-shared'

// Generous on purpose: a dApp has one request in flight, and two tabs of the
// same site is the only ordinary reason to exceed it.
export const MAX_PENDING_REQUESTS_PER_PEER = 3
export const MAX_PENDING_REQUESTS = 8

export type PendingCapacityBreach = 'total' | 'peer'

/**
 * Which cap admitting one more request from `peer` would break, if any.
 * `openPeers` holds the peer key of every request still open, one per request.
 */
export const pendingCapacityBreach = (
    openPeers: Iterable<string>,
    peer: string,
): Nullable<PendingCapacityBreach> => {
    let total = 0
    let forPeer = 0
    for (const open of openPeers) {
        total++
        if (open === peer) forPeer++
    }
    if (total >= MAX_PENDING_REQUESTS) return 'total'
    return forPeer >= MAX_PENDING_REQUESTS_PER_PEER ? 'peer' : null
}
