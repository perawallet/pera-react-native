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

import { encodeToBase64, type Network } from '@perawallet/wallet-core-shared'
import type { PeraTransaction } from '@perawallet/wallet-core-blockchain'

import { GenesisHashMismatchError } from '../pipeline/errors'

/**
 * Asserts that every transaction's `genesisHash` matches the active network's
 * configured genesis hash. Throws {@link GenesisHashMismatchError} on the first
 * mismatch. Validates the signable set handed to it — the wallet never signs
 * legs it doesn't own, so checking this subset is sufficient to guarantee no
 * cross-network signature is produced. `genesisHash` is the canonical,
 * signature-bound chain identifier; `genesisId` is intentionally not checked.
 *
 * `expectedGenesisHash` is supplied by the caller rather than read from config
 * so that networks whose genesis is not build-time-pinned (betanet, fnet,
 * localnet) can pass their runtime-resolved identity in. See
 * `resolveExpectedGenesisHash`.
 *
 * Rejects an empty `expectedGenesisHash` outright, before comparing any
 * transaction. An empty hash is never a valid chain identity — without this
 * guard, a transaction whose own `genesisHash` is missing or empty computes
 * `actual === ''` too, so `'' === ''` would satisfy the comparison and let an
 * unverified-chain transaction through. `resolveExpectedGenesisHash` is
 * expected to never produce `''` either, but this function is public API in
 * its own right, so it defends independently rather than trusting the
 * caller's convention.
 */
export const assertTransactionsMatchNetwork = (
    transactions: PeraTransaction[],
    network: Network,
    expectedGenesisHash: string,
): void => {
    if (!expectedGenesisHash) {
        throw new GenesisHashMismatchError(network, -1, expectedGenesisHash, '')
    }

    for (let i = 0; i < transactions.length; i++) {
        const genesisHash = transactions[i].genesisHash
        const actual = genesisHash ? encodeToBase64(genesisHash) : ''
        if (actual !== expectedGenesisHash) {
            throw new GenesisHashMismatchError(
                network,
                i,
                expectedGenesisHash,
                actual,
            )
        }
    }
}
