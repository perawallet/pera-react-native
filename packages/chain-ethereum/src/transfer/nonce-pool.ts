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

import type { Address, PublicClient } from 'viem'
import type { ChainScope } from '@perawallet/wallet-core-chain-contract'
import type { Database } from '@perawallet/wallet-core-database'
import { getOpenSubmissionAttempts } from '@perawallet/wallet-core-signing'

export type AllocateEthereumNonceParams = {
    client: PublicClient
    scope: ChainScope
    sender: Address
    db?: Database
}

/**
 * The first nonce at or above the node's pending count that no open ledger
 * row of this sender holds. The ledger covers sends the RPC hasn't surfaced
 * yet, and a dropped row settled `failed` frees its nonce so the next send
 * fills the gap. A ledger read failure propagates: guessing could reuse a
 * nonce.
 */
export const allocateEthereumNonce = async ({
    client,
    scope,
    sender,
    db,
}: AllocateEthereumNonceParams): Promise<number> => {
    const [pending, open] = await Promise.all([
        client.getTransactionCount({ address: sender, blockTag: 'pending' }),
        getOpenSubmissionAttempts({ db, scope, sender }),
    ])
    const held = new Set(open.map(attempt => attempt.nonce))
    let nonce = pending
    while (held.has(nonce)) nonce++
    return nonce
}
