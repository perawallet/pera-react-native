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

import { keccak256, type Hex } from 'viem'
import type { Decimal } from 'decimal.js'
import type {
    BalanceChange,
    ChainScope,
} from '@perawallet/wallet-core-chain-contract'
import type { Optional } from '@perawallet/wallet-core-shared'
import { spentFirst } from '../history/spent-first'
import type { EvmTransactionSimulation } from './types'

/** A call as both the review simulates it and the signed bytes carry it. */
export type PredictedCall = {
    from: string
    to: string
    /** Wei. */
    value: Decimal
    data: Hex
}

// Long enough to cover a review the user lingers on and a Ledger approval, not
// so long that a later call with the same calldata picks up a stale prediction.
const PREDICTION_TTL_MS = 10 * 60_000
const MAX_PREDICTIONS = 20

type Prediction = { changes: BalanceChange[]; storedAt: number }

const predictions = new Map<string, Prediction>()

// Gas and fees stay out of the key: the user can change the fee preset after
// the review simulated, and neither changes what the call moves.
const keyOf = (scope: ChainScope, call: PredictedCall): string =>
    [
        scope.chainId,
        scope.networkId,
        call.from.toLowerCase(),
        call.to.toLowerCase(),
        call.value.toFixed(),
        keccak256(call.data),
    ].join('|')

/** Keeps what a successful simulation says the call moves, for History to show while it's pending. */
export const rememberPrediction = (
    scope: ChainScope,
    call: PredictedCall,
    simulation: EvmTransactionSimulation,
): void => {
    if (simulation.status !== 'success') return
    const changes = spentFirst(
        simulation.assetChanges
            .filter(change => !change.amount.isZero())
            .map(change => ({
                assetRef: { chainId: scope.chainId, assetId: change.assetId },
                value: change.amount,
            })),
    )
    if (changes.length === 0) return
    const key = keyOf(scope, call)
    predictions.delete(key)
    predictions.set(key, { changes, storedAt: Date.now() })
    while (predictions.size > MAX_PREDICTIONS) {
        predictions.delete(predictions.keys().next().value!)
    }
}

/** The balance changes the review predicted for this call, while still fresh. */
export const predictedBalanceChangesOf = (
    scope: ChainScope,
    call: PredictedCall,
): Optional<BalanceChange[]> => {
    const key = keyOf(scope, call)
    const prediction = predictions.get(key)
    if (!prediction) return undefined
    if (Date.now() - prediction.storedAt > PREDICTION_TTL_MS) {
        predictions.delete(key)
        return undefined
    }
    return prediction.changes
}

/** Tests start each case with nothing remembered. */
export const clearPredictions = (): void => predictions.clear()
