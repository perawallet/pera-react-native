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

import {
    isTransactionRequest,
    isUnsignedTransaction,
} from '@perawallet/wallet-core-signing'
import { useSigningStore } from '@packages/signing/src/store'

/**
 * Records every transaction sign request that reaches the pipeline in the
 * Algorand-transaction shape rather than as chain-neutral transactions, so a
 * flow that still builds one fails its test.
 */
export const watchLegacyTransactionRequests = (): {
    stop: () => string[]
} => {
    const seen = new Set<string>()
    const offenders: string[] = []
    const record = (
        requests: ReturnType<
            typeof useSigningStore.getState
        >['pendingSignRequests'],
    ) => {
        for (const request of requests) {
            if (seen.has(request.id)) continue
            seen.add(request.id)
            // Typed chain-neutral, so only the runtime value can show the old shape.
            const txs: readonly unknown[] = isTransactionRequest(request)
                ? request.txs
                : []
            if (txs.length > 0 && !isUnsignedTransaction(txs[0])) {
                offenders.push(request.id)
            }
        }
    }
    // An earlier test's leftover requests are that test's to answer for.
    for (const request of useSigningStore.getState().pendingSignRequests) {
        seen.add(request.id)
    }
    const unsubscribe = useSigningStore.subscribe(state =>
        record(state.pendingSignRequests),
    )
    return {
        stop: () => {
            unsubscribe()
            return offenders
        },
    }
}
