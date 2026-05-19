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

import {
    isArbitraryDataRequest,
    isArc60Request,
    isTransactionRequest,
    type SignRequest,
} from '../models'

/**
 * Resolve the primary signer address for a sign request so the lifecycle
 * can look up the corresponding {@link WalletAccount} (we need this to
 * thread the device name into the hardware-signing overlay).
 *
 * Mirrors the per-request-type signer extraction in `buildSignableGroups`
 * (see `machine/actions.ts`); kept local + minimal because the overlay
 * only needs *a* signer (the device name is identical across groups for a
 * given hardware request).
 */
export const resolveSignerAddress = (
    request: SignRequest,
): string | undefined => {
    if (isTransactionRequest(request)) {
        const firstTx = request.txs[0]
        if (!firstTx) return undefined
        const override = request.signerOverrides?.get(0)
        if (override) return override
        // Defensive: malformed/mocked tx shapes (e.g. test fixtures) may
        // not carry a sender. The hardware overlay can still open without
        // a known signer — deviceName just falls back to null.
        return firstTx.sender?.toString?.()
    }
    if (isArbitraryDataRequest(request)) {
        return request.data[0]?.signer
    }
    if (isArc60Request(request)) {
        return request.stdSigData?.signer
    }
    return undefined
}
