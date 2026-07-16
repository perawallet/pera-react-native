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
    type SignRequest,
} from '@perawallet/wallet-core-signing'

/**
 * Returns the participant addresses that currently have an in-flight
 * cosign request in the signing queue for the given multisig sign-request
 * id. The signing store is the source of truth — once an actor finishes,
 * the entry drops from `pendingSignRequests` and the address falls out of
 * this set on the next tick.
 *
 * `signerOverrides.get(0)` is safe because `buildMultisigCosignRequest`
 * pins every tx index to the same participant address.
 */
export const getInFlightCosignAddresses = (
    pendingSignRequests: SignRequest[],
    signRequestId: string | null,
): Set<string> => {
    const result = new Set<string>()
    if (!signRequestId) return result
    for (const request of pendingSignRequests) {
        if (!isTransactionRequest(request)) continue
        if (request.sourceType !== 'multisig-cosign') continue
        if (request.signRequestId !== signRequestId) continue
        const signer = request.signerOverrides?.get(0)
        if (signer) result.add(signer)
    }
    return result
}
