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

import { populateAppCallResources } from '@algorandfoundation/algokit-utils'

import type { AlgorandClient } from '@algorandfoundation/algokit-utils'
import type { PeraTransaction } from '@perawallet/wallet-core-blockchain'

type TransactionComposer = ReturnType<AlgorandClient['newGroup']>

/**
 * Build a composed ARC59 group into signable transactions.
 *
 * algokit-utils v9's `composer.build()` does NOT populate app-call resources
 * (only `.send()` does). The ARC59 router reads dynamic resources at runtime —
 * e.g. `asset_holding_get AssetBalance` on the receiver/inbox — which the node
 * reports as "unavailable Account" unless they're referenced. Since Pera signs
 * and submits through its own pipeline (not algokit's send), populate the
 * foreign account/asset/box references via simulate before the group is signed.
 */
export const buildPopulatedGroup = async (
    composer: TransactionComposer,
    algokit: AlgorandClient,
): Promise<PeraTransaction[]> => {
    const { atc } = await composer.build()
    const populatedAtc = await populateAppCallResources(
        atc,
        algokit.client.algod,
    )
    return populatedAtc.buildGroup().map(t => t.txn)
}
